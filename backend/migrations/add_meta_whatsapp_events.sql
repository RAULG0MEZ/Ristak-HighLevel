-- WhatsApp custom conversion events for Meta Conversions API.

ALTER TABLE contacts ADD COLUMN meta_schedule_event_sent INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN meta_schedule_event_sent_at DATETIME;
ALTER TABLE contacts ADD COLUMN meta_schedule_event_id TEXT;
ALTER TABLE contacts ADD COLUMN meta_purchase_event_sent INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN meta_purchase_event_sent_at DATETIME;
ALTER TABLE contacts ADD COLUMN meta_purchase_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_meta_schedule_sent ON contacts(meta_schedule_event_sent);
CREATE INDEX IF NOT EXISTS idx_contacts_meta_purchase_sent ON contacts(meta_purchase_event_sent);

CREATE TABLE IF NOT EXISTS meta_conversion_event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id TEXT,
  event_type TEXT NOT NULL,
  meta_event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL,
  request_payload TEXT,
  response_payload TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_meta_conversion_logs_contact ON meta_conversion_event_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_meta_conversion_logs_event ON meta_conversion_event_logs(event_type, event_id);
CREATE INDEX IF NOT EXISTS idx_meta_conversion_logs_created ON meta_conversion_event_logs(created_at);
