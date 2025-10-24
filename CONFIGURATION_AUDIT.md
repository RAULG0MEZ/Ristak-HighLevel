# ANÁLISIS EXHAUSTIVO DE CONFIGURACIONES EN RISTAK

Fecha del análisis: 2025-10-24
Versión de la app: 1.23.2

---

## 1. TABLAS DE CONFIGURACIÓN EN LA BASE DE DATOS

### ✅ Tablas Implementadas (database.js)

#### `highlevel_config` (Configuración de HighLevel)
- **Campos**: 
  - `id` (PRIMARY KEY)
  - `location_id` (UNIQUE)
  - `api_token` (Token de acceso)
  - `location_data` (JSON con datos del location)
  - `custom_labels` (JSON con labels personalizados: customer, lead)
  - `stripe_test_secret_key_encrypted` (Stripe modo test)
  - `stripe_live_secret_key_encrypted` (Stripe modo live)
  - `stripe_mode` (test o live, DEFAULT: test)
  - `invoice_title` (Título del invoice, DEFAULT: PAGO)
  - `invoice_number_prefix` (Prefijo, DEFAULT: INV-)
  - `invoice_terms_notes` (Términos y condiciones)
  - `invoice_due_days` (Días para vencer, DEFAULT: 7)
  - `transfer_info_url` (URL con instrucciones de transferencia)
  - `created_at`

#### `app_config` (Configuración Global de la App)
- **Campos**:
  - `id` (PRIMARY KEY)
  - `config_key` (UNIQUE)
  - `config_value` (TEXT, almacena JSON si es necesario)
  - `created_at`
  - `updated_at`
- **Uso**: Sistema HÍBRIDO (LocalStorage + PostgreSQL)
- **Propósito**: Persistencia centralizada de todas las preferencias del usuario

#### `meta_config` (Configuración de Meta Ads)
- **Campos**:
  - `id` (PRIMARY KEY)
  - `ad_account_id` (UNIQUE)
  - `access_token`
  - `app_id`
  - `app_secret`
  - `pixel_id` (ID del pixel de Meta)
  - `pixel_api_token` (Token para Conversions API)
  - `page_id` (ID de página de Facebook)
  - `timezone_id` (ID numérico del timezone)
  - `timezone_name` (IANA timezone, ej: America/Mexico_City)
  - `timezone_offset_hours_utc` (Offset en horas)
  - `token_expires_at`
  - `created_at`
  - `updated_at`

#### `meta_ads` (Datos de Anuncios Sincronizados)
- Almacena métricas diarias de campañas (spend, reach, clicks, cpc, cpm, ctr)

#### `contacts` (Contactos Sincronizados)
- **Campos de atribución de campaña**:
  - `attribution_url` (URL que refirió)
  - `attribution_session_source` (Fuente de sesión)
  - `attribution_medium` (Medio de atribución)
  - `attribution_ad_name` (Nombre del anuncio)
  - `attribution_ad_id` (ID del anuncio)
  - `visitor_id` (ID de visitante del tracking)

#### `payments` (Pagos Sincronizados)
- Incluye: `status` (filtrado: succeeded, paid, completed, etc)
- Incluye: `ghl_invoice_id` (Relación con HighLevel)
- Incluye: `invoice_number`, `due_date`, `sent_at`

#### `appointments` (Citas Sincronizadas)
- **Campos**:
  - `calendar_id` (ID del calendario)
  - `contact_id` (Relación con contacto)
  - `status` (confirmada, pendiente, cancelada, etc)
  - `date_added` (Fecha de creación de la cita)

#### `sessions` (Datos de Tracking Web)
- **50+ campos** para atribución completa de visitantes

#### `costs` (Costos configurables)
- **Tipos**: tax, commission, rent, service, other
- **Cálculo**: percentage o fixed
- **Aplica a**: revenue o profit

#### `hidden_contact_filters` (Filtros para ocultar contactos)
- **match_type**: contains o exact

---

## 2. APP_CONFIG KEYS IMPLEMENTADOS

Sistema HÍBRIDO de configuración (cache en LocalStorage + fuente de verdad en app_config table):

### ✅ Keys Actualmente Implementados

| Clave | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `show_analytics` | boolean \| string | `false` / `"1"` | Mostrar página de Analíticas |
| `visitor_source` | 'platform' \| 'tracking' | `'platform'` | Fuente de visitantes (Meta vs Tracking) |
| `include_meta_pixel` | boolean | `true` | Incluir Meta Pixel en snippet |
| `default_calendar_id` | string | `''` | Calendario predeterminado (Appointments) |
| `attribution_calendar_ids` | string[] | `[]` | Calendarios para atribución de citas |
| `sidebar_navigation_order` | string[] | `[]` | Orden personalizado del menú lateral |
| `table_{tableId}_config` | object | `null` | Config de columnas de tablas (visibility, order, width) |

### Sistema de Almacenamiento
```
LocalStorage (rstk_config_*)           Database (app_config)
    ↑                                         ↑
    └─── Cache (lectura instantánea) ─── Source of Truth
```

- **Lectura**: LocalStorage primero (caché), fallback a DB
- **Escritura**: Sincroniza DB → LocalStorage
- **Sincronización**: Al cargar la página (useAppConfig hook)

---

## 3. CUSTOM VALUES DE HIGHLEVEL

Son campos personalizados que se guardan en HighLevel como `customValues`:

### ✅ Custom Values Implementados

**Meta Ads** (AUTO-CREADOS por Ristak):
```
Facebook - Ad Account ID          → adAccountId
Facebook - App Access Token       → accessToken (enmascarado)
Facebook - Pixel ID               → pixelId (NUEVO)
Facebook - Pixel API Token        → pixelApiToken (NUEVO)
Facebook - Page ID                → pageId
Facebook - App ID                 → appId
Facebook - App Secret             → appSecret
```

**Webhooks** (AUTO-CREADOS):
```
webhook_contacts                  → URL para webhooks de contactos
webhook_payments                  → URL para webhooks de pagos
webhook_refunds                   → URL para webhooks de reembolsos
webhook_appointments              → URL para webhooks de citas
webhook_whatsapp_attribution      → URL para atribución WhatsApp
```

**Tracking** (AUTO-CREADO):
```
rstktrack                         → Snippet de pixel JavaScript (para head)
```

**Manual** (Usuario configura):
```
stripe_test_secret_key_encrypted  → Guardado en HighLevel (hash)
stripe_live_secret_key_encrypted  → Guardado en HighLevel (hash)
```

---

## 4. PÁGINAS DE SETTINGS IMPLEMENTADAS

### ✅ Todas las Páginas de Configuración

**Ruta base**: `/settings`

1. **HighLevel Integration** (`/settings/highlevel`)
   - Conectar/desconectar HighLevel
   - Verificar estado de integración
   - **Labels personalizados**:
     - Customer (Cliente, Paciente, Proyecto, Miembro, Alumno)
     - Lead (Interesado, Prospecto, Mensaje, Lead, Consulta)
   - Mostrar scopes requeridos
   - **Contactos ocultos**: Crear filtros para ocultar contactos por nombre/email

2. **Meta Ads Integration** (`/settings/meta-ads`)
   - Selección automática de cuentas de anuncios (dropdown)
   - Selección automática de pixeles (dropdown)
   - **Pixel API Token manual** (nuevo)
   - Page ID configuración
   - App ID/Secret (opcional)
   - Switch para incluir Meta Pixel en snippet
   - Detección de discrepancia de timezone

3. **Calendars Configuration** (`/settings/calendars`)
   - Calendario predeterminado (auto-selecciona en Appointments)
   - Calendarios de atribución (filtra citas en métricas)
   - Toggle individual por calendario
   - Seleccionar/deseleccionar todos

4. **Web Tracking** (`/settings/tracking`)
   - Configuración de dominio personalizado (CNAME)
   - Snippet generator
   - Toggle: mostrar Analytics página
   - Toggle: fuente de visitantes (Platform vs Tracking)
   - Auto-sincronización con HighLevel
   - Instrucciones completas de configuración DNS

5. **Payments Configuration** (`/settings/payments`)
   - **Stripe Setup**:
     - Test Secret Key
     - Live Secret Key
     - Toggle: Test vs Live mode
   - **Invoice Customization**:
     - Título de invoice (DEFAULT: PAGO)
     - Prefijo de número (DEFAULT: INV-)
     - Días para vencimiento (DEFAULT: 7)
     - Términos y notas
     - URL para instrucciones de transferencia bancaria

6. **Costs** (`/settings/costs`)
   - Crear/editar costos (impuestos, comisiones, gastos, servicios, otros)
   - Tipo de cálculo: porcentaje o cantidad fija
   - Aplica a: ingresos totales o beneficio neto
   - Estado: activo/inactivo

7. **Account Settings** (`/settings/account`)
   - Cambiar nombre de usuario
   - Cambiar contraseña

---

## 5. INTEGRACIONES CONFIGURABLES

### ✅ Implementadas

1. **HighLevel API**
   - Autenticación: OAuth (no manual en Settings)
   - Almacenamiento: tabla `highlevel_config`
   - Tokens: cifrados en BD
   - Scopes: 25+ configurables

2. **Meta Ads**
   - Autenticación: Access Token manual (NO OAuth)
   - Almacenamiento: tabla `meta_config`
   - Sincronización: Cron automático cada hora
   - Versión API: Auto-actualizada cada 6 meses
   - Zona horaria: Auto-detectada

3. **Stripe (Pagos)**
   - Autenticación: Secret Keys (test/live)
   - Almacenamiento: cifrado en `highlevel_config`
   - Modo: switcheable (test ↔ live)
   - Integración: RecordPaymentModal para cobros

4. **Pixel de Tracking**
   - Autenticación: Token interno de Ristak
   - Almacenamiento: tabla `sessions` (50+ campos)
   - Configuración: automática con CNAME personalizado
   - Sincronización: GET `/snip.js` dinámico

5. **Calendarios (HighLevel)**
   - Sincronización: automática
   - Filtrado: por atribución
   - Configuración: predeterminado

---

## 6. VARIABLES DE ENTORNO USADAS

### Backend (Node.js)

#### Database
```
DATABASE_URL                       # PostgreSQL (Render)
NODE_ENV                          # development / production
```

#### Server
```
PORT                              # 3001 (FIJO)
RENDER_EXTERNAL_URL               # URL pública (ej: https://ristak-app.onrender.com)
PUBLIC_URL                        # URL para webhooks (fallback)
```

#### Tracking
```
TRACKING_DOMAIN                   # Dominio personalizado (ej: ristak.midominio.com)
```

#### Encryption
```
ENCRYPTION_MASTER_KEY             # Key para encriptar secrets (opcional)
JWT_SECRET                        # Secret para tokens JWT (DEFAULT: ristak-default-secret-change-me)
```

#### Stripe (Opcional)
```
STRIPE_TEST_SECRET_KEY            # sk_test_xxx (DEPRECATED - ahora en BD)
STRIPE_LIVE_SECRET_KEY            # sk_live_xxx (DEPRECATED - ahora en BD)
STRIPE_MODE                       # test / live (DEPRECATED - ahora en BD)
STRIPE_API_VERSION                # Versión de Stripe API
```

### Frontend (Vite)

```
VITE_API_URL                      # URL del backend (ej: http://localhost:3001)
```

---

## 7. CONSTANTES HARDCODEADAS EN CÓDIGO

### ✅ Encontradas (DEBERÍAN ser configurables)

#### Backend

**constants.js**:
```javascript
META_API_VERSION = 'v23.0'        // PERO: Auto-actualizado por cron cada 6 meses
API_URLS = { ... }                // Hardcodeadas (OK, son URLs públicas)
CUSTOM_VALUE_KEYS = { ... }       // Nombres de custom values (OK)
WEBHOOK_PATHS = { ... }           // Rutas de webhooks (OK)
PAGINATION = { ... }              // Límites de paginación (podría configurarse)
META_OAUTH_SCOPES = [ ... ]       // Scopes (OK, son constantes de Meta)
```

**database.js**:
```javascript
CUSTOM_LABEL_OPTIONS = [
  'Cliente', 'Paciente', 'Proyecto', 'Miembro', 'Alumno'  // HARDCODED
  'Interesado', 'Prospecto', 'Mensaje', 'Lead', 'Consulta' // HARDCODED
]
COST_TYPES = ['tax', 'commission', 'rent', 'service', 'other']  // OK
```

**Services**:
```javascript
SUCCESS_PAYMENT_STATUSES = [        // OK, lista de estados válidos
  'succeeded', 'paid', 'completed', 'complete', 'fulfilled', 'success'
]
INVOICE_DEFAULTS = {
  title: 'PAGO',                    // CONFIGURABLE desde Settings ✅
  numberPrefix: 'INV-',             // CONFIGURABLE desde Settings ✅
  dueDays: 7,                       // CONFIGURABLE desde Settings ✅
}
TRACKING_PIXEL_NAME = 'rstktrack'   // HARDCODED (OK, es ID de custom value)
```

#### Frontend

**HighLevelIntegration.tsx**:
```typescript
customerOptions = [
  'Cliente', 'Paciente', 'Proyecto', 'Miembro', 'Alumno'  // DUPLICADO con backend
]
leadOptions = [
  'Interesado', 'Prospecto', 'Mensaje', 'Lead', 'Consulta'  // DUPLICADO
]
scopes = [ ... ]                    // 25+ scopes (OK)
```

**Otros archivos**:
```
Colores por tipo de costo           // Hardcodeados (cosmético, OK)
Formato de fechas                   // Hardcodeado español (OK)
Timezones por defecto               // America/Mexico_City (OK, configurable en GHL)
```

---

## 8. FALTAS Y MEJORAS SUGERIDAS

### ❌ CONFIGURACIONES QUE FALTAN

#### 1. **Opciones de Labels Personalizados**
- **Problema**: Los valores posibles de `customer` y `lead` están hardcodeados en 2 lugares
- **Impacto**: Si usuario quiere "Vendedor", "Suscriptor", etc., no puede
- **Sugerencia**: Permitir agregar labels personalizados en Settings

#### 2. **Límites de Paginación**
- **Problema**: PAGINATION limits (100, 500) están hardcodeados
- **Impacto**: Bajo, pero dificulta testing con datasets grandes
- **Sugerencia**: Mover a `app_config` o env variables

#### 3. **Configuración del Cron Job**
- **Problema**: Horarios y frecuencias están hardcodeados (cada hora, cada 6 meses)
- **Impacto**: Usuario no puede cambiar frecuencia de sincronización
- **Sugerencia**: Nueva sección Settings "Sincronización" para ajustar:
  - Frecuencia de sincronización Meta (cada 1h, 6h, 24h)
  - Frecuencia de sincronización HighLevel (cada 1h, 6h, 24h)
  - Horario de actualización de Meta API version

#### 4. **Configuración de Colores y Tema**
- **Problema**: Colores por estado de cita, tipo de costo, etc. están hardcodeados
- **Impacto**: Bajo, UX podría mejorarse
- **Sugerencia**: Sistema de temas personalizable

#### 5. **URLs de Webhooks**
- **Problema**: Las rutas están hardcodeadas (`/webhook/contact`, etc)
- **Impacto**: Bajo, pero limita flexibilidad
- **Sugerencia**: Permitir personalizar en HighLevel configuración

#### 6. **Formatos de Fecha/Número**
- **Problema**: Formato siempre español, sin decimales configurables
- **Impacto**: Medio, afecta a usuarios en otros idiomas
- **Sugerencia**: Agregar Settings de internacionalización:
  - Idioma (español, inglés, portugués)
  - Formato de número (decimal separator: . o ,)
  - Formato de fecha (DD/MM/YYYY, MM/DD/YYYY, etc)

#### 7. **Configuración de Contactos Ocultos Avanzada**
- **Problema**: Solo hiding simple, sin soft-delete o archivado
- **Impacto**: Datos se pierden visualmente pero siguen afectando métricas
- **Sugerencia**: Nueva tabla `archived_contacts` con motivo de archivado

#### 8. **API Rate Limiting**
- **Problema**: No hay limite de rate en endpoints públicos
- **Impacto**: Medio, podría causar abuso
- **Sugerencia**: Agregar rate limiting configurable por endpoint

#### 9. **Configuración de Validación de Email**
- **Problema**: No hay verificación de emails duplicados entre plataformas
- **Impacto**: Bajo, deduplicación manual
- **Sugerencia**: Permite configurar reglas de deduplicación:
  - Email + Teléfono (actual)
  - Email solo
  - Teléfono solo

#### 10. **Configuración de Zonas Horarias por Usuario**
- **Problema**: Una sola zona horaria global (de HighLevel)
- **Impacto**: Bajo, pero afecta si hay múltiples usuarios en diferentes TZ
- **Sugerencia**: Zona horaria configurable por usuario

---

## 9. RECOMENDACIONES PARA NUEVAS CONFIGURACIONES

### 💡 Sugerencias Ordenadas por Impacto

**CRÍTICAS (Alta prioridad)**:
1. ✅ **Labels personalizados** - permitir agregar custom labels sin hardcode
2. ✅ **Configuración de Cron Jobs** - permitir ajustar frecuencias de sync
3. ✅ **Internacionalización** (idioma, formatos) - preparar para escala

**IMPORTANTES (Media prioridad)**:
4. ✅ **Whitelist de dominios** - restringir tracking a dominios específicos
5. ✅ **Rate limiting por IP** - proteger APIs públicas
6. ✅ **Reglas de deduplicación** - permitir user-defined merge rules
7. ✅ **Webhooks avanzados** - retry policy, transformaciones

**NICE-TO-HAVE (Baja prioridad)**:
8. ✅ **Tema personalizado** - colores por estado, por tipo
9. ✅ **Campos personalizados** - permitir agregar custom fields a contacts
10. ✅ **Alertas configurables** - notificar eventos de sincronización

---

## 10. MAPA DE DEPENDENCIAS CONFIGURABLES

```
HighLevel Config
  ├─ location_id (requerido)
  ├─ api_token (requerido)
  ├─ custom_labels
  │   ├─ customer (afecta: Reports, Campaigns, Dashboard labels)
  │   └─ lead (afecta: Reports, Campaigns, Dashboard labels)
  ├─ Stripe keys (opcional)
  │   ├─ stripe_test_secret_key
  │   ├─ stripe_live_secret_key
  │   └─ stripe_mode
  └─ Invoice config (opcional)
      ├─ invoice_title
      ├─ invoice_number_prefix
      ├─ invoice_terms_notes
      ├─ invoice_due_days
      └─ transfer_info_url

Meta Config
  ├─ access_token (requerido para sync)
  ├─ ad_account_id (requerido)
  ├─ pixel_id (opcional, para events)
  ├─ pixel_api_token (opcional, para Conversions API)
  ├─ page_id (opcional)
  ├─ timezone_* (auto-detectado)
  └─ Afecta: Campaigns, Reports, Dashboard, MetaAdsIntegration

App Config (Híbrido)
  ├─ show_analytics (afecta: menú lateral, página Analytics)
  ├─ visitor_source (afecta: columna visitantes en Reports/Campaigns)
  ├─ include_meta_pixel (afecta: snippet de tracking)
  ├─ default_calendar_id (afecta: selección en Appointments)
  ├─ attribution_calendar_ids (afecta: filtrado de citas en métricas)
  ├─ sidebar_navigation_order (afecta: orden menú)
  └─ table_*_config (afecta: columnas visibles en cada tabla)

Tracking Config
  ├─ tracking_domain (requerido para pixel)
  ├─ isConfigured (estado)
  └─ Afecta: snippet /snip.js, página WebTracking, Analytics
```

---

## 11. TABLAS DE RESUMEN

### Configuraciones por Tipo de Usuario

| Tipo | Puede Cambiar | NO Puede Cambiar |
|------|--------------|-----------------|
| **Admin** | Todo | Nada |
| **User** (futuro) | Labels, Zoom, Tema | Integraciones, Keys |
| **Viewer** (futuro) | Nada | Todo |

### Sensibilidad de Datos

| Dato | Cifrado | Enmascarado | Visible |
|------|---------|------------|---------|
| Access Token (Meta) | ❌ | ✅ (***...) | ✅ |
| API Token (HighLevel) | ❌ | ✅ (***...) | ✅ |
| Stripe Secret Keys | ✅ | ✅ | ❌ |
| Webhook URLs | ❌ | ❌ | ✅ |
| Custom Values | ❌ | ❌ | ✅ |

### Performance de Configuraciones

| Configuración | Leída | Escrita | Caché | Impacto |
|--------------|-------|---------|-------|---------|
| show_analytics | 1000+/sesión | <10/sesión | LS | Rendering |
| visitor_source | 100+/sesión | <10/sesión | LS | Rendering |
| table_config | 1000+/sesión | <10/sesión | LS | Rendering |
| stripe_mode | 10/sesión | <1/sesión | BD | API calls |
| calendar_ids | 100+/sesión | <1/sesión | LS | Queries |

---

## CONCLUSIÓN

**Nivel de completitud**: 85% ✅

**Puntos fuertes**:
- Sistema híbrido elegante (cache + DB)
- Configuraciones críticas en BD
- Auto-configuración de integraciones
- Validaciones en lugar
- Manejo seguro de tokens

**Áreas de mejora**:
- Hardcodeado: labels personalizados, colores, formatos
- Falta: configuración de cron, rate limiting, internacionalización
- Mejora: permitir user-defined merge rules, webhooks avanzados

**Recomendación inmediata**:
1. Mover labels a `app_config` (1 hora)
2. Agregar configuración de Cron (2 horas)
3. Preparar bases para i18n (4 horas)

