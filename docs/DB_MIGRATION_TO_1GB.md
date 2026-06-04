# Migración segura de Postgres a 1GB (autoscaling)

Objetivo: migrar desde la BD actual de Render (15GB en `basic-256mb`, según comportamiento por default) a una BD nueva en `1GB` con `storageAutoscalingEnabled: true`, sin perder datos.

> Render no permite bajar `diskSizeGB` de una BD existente. Si una BD ya está en 15GB y en el YAML pones `diskSizeGB: 1`, el sync puede fallar por intentar decrementar.

## Antes de empezar (muy importante)

1. Define una ventana de mantenimiento.
2. Haz que nadie escriba datos en la app durante el corte final (pausar integraciones, cron, etc.).
3. Descarga/guarda:
   - `DATABASE_URL` actual
   - variables de producción
   - fecha/hora del snapshot que vayas a tomar

## 1) Backup de salida (fuente)

### Opcion A: export de Render `.dir.tar.gz`

El export de Render que termina en `.dir.tar.gz` sirve para esta migracion. Es un backup logico en formato directorio comprimido, no un SQL plano. Para restaurarlo se usa `pg_restore` con `--format=directory`.

Desde la pantalla **Recovery -> Export**:

1. Crea el export.
2. Espera a que termine y aparezca el link del archivo.
3. Descargalo localmente.
4. No borres la BD vieja todavia.

Ejemplo de preparacion local:

```bash
export RENDER_EXPORT_TGZ="$HOME/Downloads/ristak-db.dir.tar.gz"
export RENDER_EXPORT_DIR="$HOME/backups/ristak-render-export"

mkdir -p "$RENDER_EXPORT_DIR"
tar -xzf "$RENDER_EXPORT_TGZ" -C "$RENDER_EXPORT_DIR"

export RENDER_DUMP_DIR="$(find "$RENDER_EXPORT_DIR" -name toc.dat -exec dirname {} \; | head -n 1)"
test -n "$RENDER_DUMP_DIR"

pg_restore --list "$RENDER_DUMP_DIR" > "$RENDER_EXPORT_DIR/objects.txt"
```

Si `pg_restore --list` funciona, el backup esta legible.

### Opcion B: backup manual con `pg_dump`

Conecta `pg_dump` al DB actual desde tu terminal:

```bash
export SOURCE_DATABASE_URL="postgresql://USER:PASS@HOST:5432/ristak_db?sslmode=require"
mkdir -p ~/backups/ristak-$(date +%Y%m%d)

pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --no-comments \
  --file=~/backups/ristak-$(date +%Y%m%d)/ristak-src-1gb-migrate.dump \
  "$SOURCE_DATABASE_URL"

ls -lh ~/backups/ristak-$(date +%Y%m%d)/ristak-src-1gb-migrate.dump
```

Opcional pero recomendado: también guardar una copia temporal sin comprimir por si quieres inspección manual:

```bash
pg_restore --list ~/backups/ristak-$(date +%Y%m%d)/ristak-src-1gb-migrate.dump > ~/backups/ristak-$(date +%Y%m%d)/objects.txt
```

## 2) Validar baseline antes de migrar

Ejecuta estos checks sobre la BD origen y guárdalos como evidencia:

```bash
export SOURCE_DATABASE_URL=...

psql "$SOURCE_DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS current_db_size;"

# Conteo rápido de tablas críticas (ajusta nombres si tu esquema cambia)
psql "$SOURCE_DATABASE_URL" -At <<'SQL'
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'contacts', COUNT(*)
UNION ALL SELECT 'payments', COUNT(*)
UNION ALL SELECT 'appointments', COUNT(*)
ORDER BY 1;
SQL
```

## 3) Crear BD nueva en Render (1GB)

Para evitar que el blueprint toque la BD vieja al hacer sync, te recomiendo una BD temporal con otro nombre y luego mover el `fromDatabase` del servicio web.

- Crea en Render un `Postgres` nuevo (o clonado por backup manual)
- Configúralo así:
  - `plan: basic-256mb` (o el que te convenga)
  - `diskSizeGB: 1`
  - `storageAutoscalingEnabled: true`

> `diskSizeGB` con valor `1` sí permite crear una BD de 1GB en instancias nuevas. La restricción de no bajar disco aplica al `schema` existente.

Guarda su `DATABASE_URL` destino en:

```bash
export TARGET_DATABASE_URL="postgresql://USER:PASS@HOST:5432/ristak_db_migrated?sslmode=require"
```

## 4) Restaurar en la BD nueva

Si usaste el export de Render:

```bash
pg_restore \
  --format=directory \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  -d "$TARGET_DATABASE_URL" \
  "$RENDER_DUMP_DIR"

psql "$TARGET_DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS restored_db_size;"
```

Si usaste `pg_dump --format=custom`:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  -d "$TARGET_DATABASE_URL" \
  ~/backups/ristak-$(date +%Y%m%d)/ristak-src-1gb-migrate.dump

psql "$TARGET_DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS restored_db_size;"
```

## 5) Verificación estricta (antes de tocar BD vieja)

Vuelve a correr los conteos contra destino y compara:

```bash
psql "$TARGET_DATABASE_URL" -At <<'SQL'
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'contacts', COUNT(*)
UNION ALL SELECT 'payments', COUNT(*)
UNION ALL SELECT 'appointments', COUNT(*)
ORDER BY 1;
SQL
```

Si quieres, automatiza comparación con este script:

```bash
./backend/scripts/compare-db-migration-counts.sh "$SOURCE_DATABASE_URL" "$TARGET_DATABASE_URL"
```

Haz además smoke tests en producción/staging:

- Login normal
- Listado de contactos
- Crear/editar contacto
- Crear pago o transacción mínima
- Cargar dashboard principal

## 6) Corte final

1. Detén/escalona el servicio app (o ponlo en maintenance) para que no entren escrituras nuevas.
2. Cambia el `DATABASE_URL` del servicio `ristak-app` a la BD migrada.
3. Deploy y validación rápida de endpoints (`/api/dashboard/storage-status` + login).
4. Deja correr 24h con respaldo de rollback listo.

## 7) Cierre

Una vez validado todo 24h:

- Mantén backup en local/objetivo por lo menos 7 días.
- Elimina la BD vieja.
- Si quieres reutilizar `render.yaml` con `diskSizeGB:1`, hazlo **solo cuando la BD vieja ya no exista** y tengas confirmación de migración.
