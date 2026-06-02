-- Dedicated WhatsApp Business API storage.
-- These tables intentionally do not reference contacts, attribution, or CRM tables.

CREATE TABLE IF NOT EXISTS whatsapp_api_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT,
  app_secret TEXT,
  graph_api_version TEXT DEFAULT 'v23.0',
  webhook_verify_token TEXT,
  callback_url TEXT,
  waba_id TEXT,
  phone_number_id TEXT,
  display_phone_number TEXT,
  verified_name TEXT,
  quality_rating TEXT,
  platform_type TEXT,
  is_on_biz_app INTEGER DEFAULT 0,
  connection_status TEXT DEFAULT 'not_configured',
  onboarding_event TEXT,
  last_session_payload TEXT,
  last_error_payload TEXT,
  metadata TEXT,
  connected_at DATETIME,
  last_exchange_at DATETIME,
  last_verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_api_config_status ON whatsapp_api_config(connection_status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_api_config_waba ON whatsapp_api_config(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_api_config_phone ON whatsapp_api_config(phone_number_id);

CREATE TABLE IF NOT EXISTS whatsapp_phone_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id INTEGER,
  waba_id TEXT,
  phone_number_id TEXT UNIQUE NOT NULL,
  display_phone_number TEXT,
  verified_name TEXT,
  quality_rating TEXT,
  code_verification_status TEXT,
  name_status TEXT,
  platform_type TEXT,
  is_on_biz_app INTEGER DEFAULT 0,
  throughput_level TEXT,
  status TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_numbers_waba ON whatsapp_phone_numbers(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_numbers_config ON whatsapp_phone_numbers(config_id);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_id TEXT UNIQUE NOT NULL,
  phone TEXT,
  profile_name TEXT,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone);

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number_id TEXT,
  wa_contact_id INTEGER,
  wa_id TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  last_message_at DATETIME,
  unread_count INTEGER DEFAULT 0,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phone_number_id, wa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone_number ON whatsapp_chats(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_wa_id ON whatsapp_chats(wa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_last_message ON whatsapp_chats(last_message_at);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  whatsapp_message_id TEXT UNIQUE,
  chat_id INTEGER,
  phone_number_id TEXT,
  wa_contact_id INTEGER,
  waba_id TEXT,
  wa_id TEXT,
  direction TEXT NOT NULL,
  message_type TEXT,
  message_timestamp DATETIME,
  status TEXT,
  text_body TEXT,
  raw_payload TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_number ON whatsapp_messages(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON whatsapp_messages(wa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(message_timestamp);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);

CREATE TABLE IF NOT EXISTS whatsapp_message_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  whatsapp_message_id TEXT,
  meta_message_id TEXT,
  phone_number_id TEXT,
  recipient_id TEXT,
  status TEXT NOT NULL,
  conversation_id TEXT,
  pricing_category TEXT,
  raw_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_statuses_message ON whatsapp_message_statuses(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_statuses_phone ON whatsapp_message_statuses(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_statuses_status ON whatsapp_message_statuses(status);

CREATE TABLE IF NOT EXISTS whatsapp_onboarding_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT,
  session_id TEXT,
  code TEXT,
  waba_id TEXT,
  phone_number_id TEXT,
  current_step TEXT,
  error_code TEXT,
  error_message TEXT,
  raw_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_onboarding_sessions_event ON whatsapp_onboarding_sessions(event);
CREATE INDEX IF NOT EXISTS idx_whatsapp_onboarding_sessions_waba ON whatsapp_onboarding_sessions(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_onboarding_sessions_phone ON whatsapp_onboarding_sessions(phone_number_id);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_hash TEXT UNIQUE,
  waba_id TEXT,
  phone_number_id TEXT,
  field TEXT,
  event_type TEXT,
  processing_status TEXT DEFAULT 'received',
  raw_payload TEXT,
  error_message TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_waba ON whatsapp_webhook_events(waba_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_phone ON whatsapp_webhook_events(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_field ON whatsapp_webhook_events(field);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_received ON whatsapp_webhook_events(received_at);

CREATE TABLE IF NOT EXISTS whatsapp_sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  waba_id TEXT,
  phone_number_id TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  finished_at DATETIME,
  metadata TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sync_jobs_type ON whatsapp_sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sync_jobs_status ON whatsapp_sync_jobs(status);
