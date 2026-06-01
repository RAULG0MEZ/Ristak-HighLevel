-- Guarda los custom fields de GoHighLevel dentro del contacto.
-- PostgreSQL:
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;

-- SQLite equivalente, si se ejecuta manualmente:
-- ALTER TABLE contacts ADD COLUMN custom_fields TEXT DEFAULT '[]';
