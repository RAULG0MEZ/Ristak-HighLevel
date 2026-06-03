import apiClient from './apiClient'

export interface WhatsAppWebSession {
  id: string
  label?: string | null
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'reconnecting' | string
  phone?: string | null
  jid?: string | null
  push_name?: string | null
  profile_picture_url?: string | null
  business_profile_json?: string | null
  account_info_json?: string | null
  qr_code?: string | null
  qr_image?: string | null
  last_error?: string | null
  connected_at?: string | null
  disconnected_at?: string | null
  last_qr_at?: string | null
  auth_saved?: boolean
}

export interface WhatsAppWebStats {
  chats?: number
  contacts: number
  messages: number
  attribution: number
}

export interface WhatsAppWebStatus {
  session: WhatsAppWebSession
  stats: WhatsAppWebStats
}

export interface WhatsAppWebMessage {
  id: string
  contact_id?: string | null
  phone?: string | null
  push_name?: string | null
  message_text?: string | null
  message_type?: string | null
  detected_ctwa_clid?: string | null
  detected_source_id?: string | null
  detected_source_url?: string | null
  created_at?: string | null
}

export interface WhatsAppWebLog {
  id: string
  whatsapp_web_message_id?: string | null
  contact_id?: string | null
  remote_jid?: string | null
  phone?: string | null
  direction?: string | null
  message_type?: string | null
  message_text?: string | null
  push_name?: string | null
  has_attribution?: number | boolean | null
  detected_ctwa_clid?: string | null
  detected_source_id?: string | null
  detected_source_url?: string | null
  detected_source_type?: string | null
  detected_source_app?: string | null
  detected_entry_point?: string | null
  detected_headline?: string | null
  detected_body?: string | null
  message_timestamp?: string | null
  created_at?: string | null
}

export interface WhatsAppWebLogs {
  recent: WhatsAppWebLog[]
  attributed: WhatsAppWebLog[]
}

export interface WhatsAppWebAnalyticsTrendPoint {
  label: string
  messages: number
  conversations: number
  contacts: number
  attributed: number
}

export interface WhatsAppWebAnalyticsSource {
  name: string
  value: number
  color?: string
}

export interface WhatsAppWebAnalyticsTopContact {
  id: string
  name?: string | null
  phone?: string | null
  messages: number
}

export interface WhatsAppWebAnalytics {
  status: {
    connected: boolean
    configured: boolean
    status?: string | null
    hasData: boolean
  }
  metrics: {
    inboundMessages: number
    outboundMessages: number
    conversations: number
    contacts: number
    attributedMessages: number
    attributionRate: number
  }
  trend: WhatsAppWebAnalyticsTrendPoint[]
  sources: WhatsAppWebAnalyticsSource[]
  topContacts: WhatsAppWebAnalyticsTopContact[]
}

export const whatsappWebService = {
  getStatus: () => apiClient.get<WhatsAppWebStatus>('/whatsapp-web/status'),
  connect: (options?: { reset?: boolean }) => apiClient.post<WhatsAppWebStatus>('/whatsapp-web/connect', options || {}),
  disconnect: () => apiClient.post<WhatsAppWebStatus>('/whatsapp-web/disconnect'),
  getLogs: () => apiClient.get<WhatsAppWebLogs>('/whatsapp-web/logs'),
  getAnalytics: ({ start, end, groupBy = 'day' }: { start: string; end: string; groupBy?: 'day' | 'month' | 'year' }) =>
    apiClient.get<WhatsAppWebAnalytics>('/whatsapp-web/analytics', { params: { start, end, groupBy } }),
  getMessages: (limit = 12) => apiClient.get<WhatsAppWebMessage[]>('/whatsapp-web/messages', {
    params: { limit: String(limit) }
  })
}
