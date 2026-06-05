import apiClient from './apiClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export type SiteType = 'standard_form' | 'interactive_form' | 'landing_page'
export type SiteStatus = 'draft' | 'published' | 'archived'
export type SiteMetaTrigger = 'page_view' | 'form_submit'
export type SiteBlockType =
  | 'headline'
  | 'subheading'
  | 'title'
  | 'subtitle'
  | 'description'
  | 'text'
  | 'embed'
  | 'calendar_embed'
  | 'section'
  | 'header_panel'
  | 'footer_panel'
  | 'hero'
  | 'image'
  | 'video'
  | 'button'
  | 'benefits'
  | 'testimonials'
  | 'services'
  | 'form_embed'
  | 'faq'
  | 'cta'
  | 'short_text'
  | 'paragraph'
  | 'currency'
  | 'number'
  | 'dropdown'
  | 'radio'
  | 'checkboxes'
  | 'phone'
  | 'email'
  | 'date'

export type SiteOptionAction =
  | 'continue'
  | 'cold_lead'
  | 'warm_lead'
  | 'hot_lead'
  | 'disqualify'
  | 'show_message'
  | 'end_form'
  | 'jump'
  | 'tag'
  | 'category'

export interface SiteBlockOption {
  id?: string
  label: string
  value?: string
  action?: SiteOptionAction
  targetBlockId?: string
  message?: string
  tag?: string
  category?: string
}

export type SiteTemplateId =
  | 'ristak'
  | 'executive'
  | 'launch'
  | 'premium'
  | 'local'
  | 'compact'
  | 'event'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'vsl'
  | 'interactive'

export interface SitePage {
  id: string
  title: string
  sortOrder: number
  metaCapiEnabled?: boolean
  metaEventName?: string
  metaTrigger?: SiteMetaTrigger
}

export interface SiteTheme {
  accentColor?: string
  backgroundColor?: string
  backgroundImage?: string
  backgroundMediaType?: 'image' | 'video'
  backgroundFit?: 'cover' | 'contain' | 'full_width' | 'auto'
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'
  backgroundPosition?: string
  backgroundAttachment?: 'scroll' | 'fixed'
  textColor?: string
  template?: SiteTemplateId
  pages?: SitePage[]
  pagePadding?: number
  pageRadius?: number
  pageBorderWidth?: number
  pageBorderColor?: string
  pageMaxWidth?: number
  metaConversionTarget?: 'same_page' | 'next_page'
  brandName?: string
  brandSubtitle?: string
  brandAvatar?: string
  followers?: string
  brandVerified?: boolean
  submitText?: string
  finalMessages?: {
    success?: string
    disqualified?: string
  }
}

export interface SiteTemplateMeta {
  id: SiteTemplateId
  label: string
  description: string
  group: 'form' | 'landing' | 'interactive'
  category: 'full_page' | 'social' | 'compact' | 'guided' | 'event'
  accent: string
  swatchBg: string
  swatchInk: string
  badge: string
  defaultTheme?: Partial<SiteTheme>
}

export const siteTemplates: SiteTemplateMeta[] = [
  { id: 'ristak', label: 'Base de negocio', description: 'Pagina completa limpia para explicar una oferta y pedir contacto.', group: 'landing', category: 'full_page', accent: '#111827', swatchBg: '#f5f6f8', swatchInk: '#0f172a', badge: 'Web' },
  { id: 'executive', label: 'Corporativo claro', description: 'Sitio grande, serio y ordenado para servicios o consultorias.', group: 'landing', category: 'full_page', accent: '#0f766e', swatchBg: '#f8fafc', swatchInk: '#0f172a', badge: 'Web', defaultTheme: { backgroundColor: '#f8fafc', accentColor: '#0f766e' } },
  { id: 'launch', label: 'Lanzamiento', description: 'Colores calidos para presentar promociones, aperturas o nuevas ofertas.', group: 'landing', category: 'full_page', accent: '#ea580c', swatchBg: '#fff7ed', swatchInk: '#1f2937', badge: 'Promo', defaultTheme: { backgroundColor: '#fff7ed', accentColor: '#ea580c' } },
  { id: 'premium', label: 'Premium sobrio', description: 'Fondo oscuro, contraste alto y apariencia elegante para vender valor.', group: 'landing', category: 'full_page', accent: '#d4af37', swatchBg: '#101010', swatchInk: '#f8fafc', badge: 'Premium', defaultTheme: { backgroundColor: '#101010', accentColor: '#d4af37', textColor: '#f8fafc' } },
  { id: 'local', label: 'Negocio local', description: 'Estilo fresco para negocios, servicios y atencion cercana.', group: 'landing', category: 'full_page', accent: '#15803d', swatchBg: '#f0fdf4', swatchInk: '#14532d', badge: 'Local', defaultTheme: { backgroundColor: '#f0fdf4', accentColor: '#15803d' } },
  { id: 'vsl', label: 'Carta de ventas', description: 'Pagina generica de venta con video, pruebas y llamada a la accion.', group: 'landing', category: 'full_page', accent: '#111827', swatchBg: '#0a0b0d', swatchInk: '#ffffff', badge: 'Venta' },
  { id: 'facebook', label: 'Facebook', description: 'Formato corto con apariencia de anuncio o perfil de Facebook.', group: 'form', category: 'social', accent: '#1877f2', swatchBg: '#f0f2f5', swatchInk: '#1c1e21', badge: 'Redes' },
  { id: 'instagram', label: 'Instagram', description: 'Formato corto con apariencia de publicacion o anuncio de Instagram.', group: 'form', category: 'social', accent: '#0095f6', swatchBg: '#ffffff', swatchInk: '#262626', badge: 'Redes' },
  { id: 'tiktok', label: 'TikTok', description: 'Formato oscuro y directo para trafico que viene de TikTok.', group: 'form', category: 'social', accent: '#fe2c55', swatchBg: '#000000', swatchInk: '#ffffff', badge: 'Redes' },
  { id: 'compact', label: 'Formulario compacto', description: 'Captura rapida de datos, ideal para formularios pequenos y directos.', group: 'form', category: 'compact', accent: '#2563eb', swatchBg: '#f8fafc', swatchInk: '#0f172a', badge: 'Corto', defaultTheme: { backgroundColor: '#f8fafc', accentColor: '#2563eb', pageMaxWidth: 480, pagePadding: 18, pageRadius: 18 } },
  { id: 'event', label: 'Registro simple', description: 'Para pedir datos antes de una llamada, evento, clase o cotizacion.', group: 'form', category: 'event', accent: '#be123c', swatchBg: '#fdf2f8', swatchInk: '#500724', badge: 'Registro', defaultTheme: { backgroundColor: '#fdf2f8', accentColor: '#be123c', pageMaxWidth: 520, pagePadding: 22, pageRadius: 22 } },
  { id: 'interactive', label: 'Quiz guiado', description: 'Una pregunta por pantalla para calificar prospectos paso a paso.', group: 'interactive', category: 'guided', accent: '#111827', swatchBg: '#0a0b0d', swatchInk: '#ffffff', badge: 'Quiz' }
]

export interface SiteBlock {
  id: string
  siteId: string
  blockType: SiteBlockType
  label: string
  content: string
  placeholder: string
  required: boolean
  options: Array<string | SiteBlockOption>
  settings: Record<string, unknown>
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SiteSubmission {
  id: string
  siteId: string
  contactId: string | null
  domain: string
  responses: Record<string, string | string[]>
  meta: Record<string, unknown>
  status: string
  createdAt: string
  contactName: string
  contactEmail: string
  contactPhone: string
}

export interface PublicSite {
  id: string
  name: string
  slug: string
  siteType: SiteType
  status: SiteStatus
  domain: string
  title: string
  description: string
  theme: SiteTheme
  metaCapiEnabled: boolean
  metaEventName: string
  renderDomainVerified: boolean
  renderDomainCheckedAt: string | null
  renderDomainError: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  submissionsCount: number
  trackingStats?: {
    views: number
    visitors: number
    sessions: number
    conversions: number
    conversionRate: number
  }
  blocks?: SiteBlock[]
  submissions?: SiteSubmission[]
}

export interface SitesDomainConfig {
  domain: string
  renderDomainVerified: boolean
  renderDomainCheckedAt: string | null
  renderDomainError: string | null
  verification?: {
    verified: boolean
    error: string | null
  }
}

export type SitesAICreationKind = 'landing' | 'form'

export interface SitesAICreationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SitesAICreationResult {
  status: 'needs_more_info' | 'created'
  reply: string
  site?: PublicSite
}

export const blockLabels: Record<SiteBlockType, string> = {
  headline: 'Titular',
  subheading: 'Subtitulo',
  title: 'Titulo',
  subtitle: 'Subtitulo',
  description: 'Texto descriptivo',
  text: 'Texto',
  embed: 'Embed',
  calendar_embed: 'Calendario',
  section: 'Franja',
  header_panel: 'Panel superior',
  footer_panel: 'Panel inferior',
  hero: 'Hero',
  image: 'Imagen',
  video: 'Video',
  button: 'Boton',
  benefits: 'Beneficios',
  testimonials: 'Testimonios',
  services: 'Servicios',
  form_embed: 'Formulario embebido',
  faq: 'Preguntas frecuentes',
  cta: 'CTA final',
  short_text: 'Respuesta corta',
  paragraph: 'Parrafo',
  currency: 'Moneda',
  number: 'Numero',
  dropdown: 'Dropdown',
  radio: 'Radio buttons',
  checkboxes: 'Checkboxes',
  phone: 'Telefono',
  email: 'Email',
  date: 'Fecha'
}

export const landingBlockTypes: SiteBlockType[] = [
  'header_panel',
  'section',
  'title',
  'subtitle',
  'text',
  'image',
  'video',
  'button',
  'benefits',
  'testimonials',
  'services',
  'embed',
  'calendar_embed',
  'form_embed',
  'faq',
  'cta',
  'footer_panel'
]

export const formBlockTypes: SiteBlockType[] = [
  'short_text',
  'paragraph',
  'number',
  'currency',
  'dropdown',
  'radio',
  'checkboxes',
  'phone',
  'email',
  'date',
  'title',
  'subtitle',
  'description',
  'video',
  'embed',
  'calendar_embed'
]

export const blockTypes: SiteBlockType[] = [
  ...landingBlockTypes,
  'short_text',
  'paragraph',
  'currency',
  'number',
  'dropdown',
  'radio',
  'checkboxes',
  'phone',
  'email',
  'date'
]

export const fieldBlockTypes = new Set<SiteBlockType>([
  'short_text',
  'paragraph',
  'currency',
  'number',
  'dropdown',
  'radio',
  'checkboxes',
  'phone',
  'email',
  'date'
])

export const sitesService = {
  listSites() {
    return apiClient.get<PublicSite[]>('/sites')
  },

  createSite(payload: Partial<PublicSite> & { siteType?: SiteType }) {
    return apiClient.post<PublicSite>('/sites', payload)
  },

  createWithAI(payload: { siteKind: SitesAICreationKind; messages: SitesAICreationMessage[] }) {
    return apiClient.post<SitesAICreationResult>('/sites/ai-create', payload)
  },

  getSite(siteId: string) {
    return apiClient.get<PublicSite>(`/sites/${siteId}`)
  },

  async getPreviewHtml(siteId: string, pageId?: string, options: { test?: boolean } = {}) {
    const searchParams = new URLSearchParams()
    if (pageId) searchParams.set('page', pageId)
    if (options.test) searchParams.set('test', '1')
    const params = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const response = await fetch(`${API_BASE_URL}/api/sites/${siteId}/preview${params}`, {
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      let message = 'No se pudo generar la previsualizacion'
      const errorResponse = response.clone()
      try {
        const payload = await response.json()
        message = payload?.error || message
      } catch {
        message = await errorResponse.text().catch(() => message)
      }
      throw new Error(message)
    }

    return response.text()
  },

  getCalendarPreviewUrl(calendarSlug: string) {
    return `${API_BASE_URL}/api/sites/public/calendar-preview/${encodeURIComponent(calendarSlug)}?test=1`
  },

  updateSite(siteId: string, payload: Partial<PublicSite>) {
    return apiClient.put<PublicSite>(`/sites/${siteId}`, payload)
  },

  deleteSite(siteId: string) {
    return apiClient.delete(`/sites/${siteId}`)
  },

  getDomain() {
    return apiClient.get<SitesDomainConfig>('/sites/domain')
  },

  verifyDomain(domain: string) {
    return apiClient.post<SitesDomainConfig>('/sites/domain/verify', { domain })
  },

  verifySiteDomain(siteId: string, domain?: string) {
    return apiClient.post<SitesDomainConfig>(`/sites/${siteId}/verify-domain`, domain === undefined ? undefined : { domain })
  },

  createBlock(siteId: string, payload: Partial<SiteBlock> & { blockType: SiteBlockType }) {
    return apiClient.post<PublicSite>(`/sites/${siteId}/blocks`, payload)
  },

  updateBlock(siteId: string, blockId: string, payload: Partial<SiteBlock>) {
    return apiClient.put<PublicSite>(`/sites/${siteId}/blocks/${blockId}`, payload)
  },

  deleteBlock(siteId: string, blockId: string) {
    return apiClient.delete<PublicSite>(`/sites/${siteId}/blocks/${blockId}`)
  },

  reorderBlocks(siteId: string, blockIds: string[], pageId?: string) {
    return apiClient.put<PublicSite>(`/sites/${siteId}/blocks/reorder`, { blockIds, pageId })
  }
}
