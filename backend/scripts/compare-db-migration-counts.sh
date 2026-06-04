#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Uso: $0 <SOURCE_DATABASE_URL> <TARGET_DATABASE_URL>"
  echo "Ejemplo: $0 \"postgres://...source\" \"postgres://...target\""
  exit 1
fi

SOURCE_DATABASE_URL="$1"
TARGET_DATABASE_URL="$2"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql no está instalado. Instala PostgreSQL client y vuelve a correr."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SOURCE_TABLES="$TMP_DIR/source_tables.tsv"
TARGET_TABLES="$TMP_DIR/target_tables.tsv"
SOURCE_COUNTS="$TMP_DIR/source_counts.tsv"
TARGET_COUNTS="$TMP_DIR/target_counts.tsv"
SOURCE_SEQUENCES="$TMP_DIR/source_sequences.tsv"
TARGET_SEQUENCES="$TMP_DIR/target_sequences.tsv"
SOURCE_EXTENSIONS="$TMP_DIR/source_extensions.tsv"
TARGET_EXTENSIONS="$TMP_DIR/target_extensions.tsv"

export PGOPTIONS='-c statement_timeout=0'

fetch_table_list() {
  local database_url="$1"
  local output_file="$2"

  psql "$database_url" -At -F $'\t' -c "
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;" > "$output_file"
}

fetch_exact_counts() {
  local database_url="$1"
  local tables_file="$2"
  local output_file="$3"

  : > "$output_file"
  while IFS=$'\t' read -r schema_name table_name; do
    local quoted_schema
    local quoted_table
    local qualified_table
    local row_count
    quoted_schema="\"${schema_name//\"/\"\"}\""
    quoted_table="\"${table_name//\"/\"\"}\""
    qualified_table="${quoted_schema}.${quoted_table}"
    row_count="$(
      psql "$database_url" -At -c "SELECT count(*) FROM ${qualified_table};"
    )"
    printf '%s.%s\t%s\n' "$schema_name" "$table_name" "$row_count" >> "$output_file"
  done < "$tables_file"
}

fetch_sequences() {
  local database_url="$1"
  local output_file="$2"

  psql "$database_url" -At -F $'\t' -c "
SELECT schemaname || '.' || sequencename AS sequence_name,
       COALESCE(last_value::text, '')
FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY sequence_name;" > "$output_file"
}

fetch_extensions() {
  local database_url="$1"
  local output_file="$2"

  psql "$database_url" -At -F $'\t' -c "
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;" > "$output_file"
}

compare_files() {
  local label="$1"
  local source_file="$2"
  local target_file="$3"

  if diff -u "$source_file" "$target_file" > "$TMP_DIR/${label}.diff"; then
    echo "OK: $label coincide."
    return 0
  fi

  echo "ERROR: $label no coincide."
  cat "$TMP_DIR/${label}.diff"
  return 1
}

echo "[1/6] Obteniendo lista de tablas..."
fetch_table_list "$SOURCE_DATABASE_URL" "$SOURCE_TABLES"
fetch_table_list "$TARGET_DATABASE_URL" "$TARGET_TABLES"
compare_files "table-list" "$SOURCE_TABLES" "$TARGET_TABLES"

echo "[2/6] Contando filas exactas en origen..."
fetch_exact_counts "$SOURCE_DATABASE_URL" "$SOURCE_TABLES" "$SOURCE_COUNTS"

echo "[3/6] Contando filas exactas en destino..."
fetch_exact_counts "$TARGET_DATABASE_URL" "$TARGET_TABLES" "$TARGET_COUNTS"
compare_files "exact-row-counts" "$SOURCE_COUNTS" "$TARGET_COUNTS"

echo "[4/6] Comparando secuencias..."
fetch_sequences "$SOURCE_DATABASE_URL" "$SOURCE_SEQUENCES"
fetch_sequences "$TARGET_DATABASE_URL" "$TARGET_SEQUENCES"
compare_files "sequences" "$SOURCE_SEQUENCES" "$TARGET_SEQUENCES"

echo "[5/6] Comparando extensiones..."
fetch_extensions "$SOURCE_DATABASE_URL" "$SOURCE_EXTENSIONS"
fetch_extensions "$TARGET_DATABASE_URL" "$TARGET_EXTENSIONS"
compare_files "extensions" "$SOURCE_EXTENSIONS" "$TARGET_EXTENSIONS"

echo "[6/6] Consultando tamanos..."
echo "DB source size: $(psql "$SOURCE_DATABASE_URL" -At -c "SELECT pg_size_pretty(pg_database_size(current_database()));")"
echo "DB target size: $(psql "$TARGET_DATABASE_URL" -At -c "SELECT pg_size_pretty(pg_database_size(current_database()));")"
echo "Comparacion completada."
