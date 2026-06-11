import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Bot,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  Facebook,
  Filter,
  GitBranch,
  Hourglass,
  Instagram,
  ListChecks,
  Megaphone,
  MessageCircle,
  MessageCircleReply,
  MessageSquareText,
  MousePointerClick,
  PencilLine,
  PlayCircle,
  Radio,
  Receipt,
  RotateCcw,
  Rss,
  Send,
  Shuffle,
  Sparkles,
  Split,
  StickyNote,
  Tag,
  Tags,
  Target,
  Timer,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserSearch,
  UserX,
  Webhook,
  Zap
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Registro central de tipos de nodos del editor de automatizaciones.
// Cada tipo define su apariencia, configuración por defecto, formulario de
// configuración (declarativo), validación y salidas (handles).
// ---------------------------------------------------------------------------

export type NodeKind = 'trigger' | 'action'

export type NodeAccent =
  | 'green'
  | 'blue'
  | 'purple'
  | 'coral'
  | 'dark'
  | 'yellow'
  | 'teal'
  | 'pink'
  | 'orange'

export interface NodeOutputHandle {
  id: string
  label?: string
}

export interface ConfigFieldOption {
  value: string
  label: string
}

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'toggle'
  | 'keywords'
  | 'duration'
  | 'datetime'
  | 'keyValue'
  | 'percentBranches'
  | 'branches'
  | 'conditions'
  | 'webhookUrl'
  | 'automation'
  | 'info'

export interface ConfigField {
  key: string
  label: string
  type: ConfigFieldType
  placeholder?: string
  help?: string
  required?: boolean
  options?: ConfigFieldOption[]
  /** Muestra las variables de contacto disponibles bajo el campo */
  showVariables?: boolean
  /** Texto fijo para campos tipo info */
  text?: string
  /** Visibilidad condicional según la configuración actual */
  showIf?: (config: Record<string, unknown>) => boolean
}

export interface NodeSummaryData {
  /** Línea descriptiva del estado actual de la configuración */
  text?: string
  /** Contenido destacado en caja (mensaje, prompt, nota) */
  box?: string
  /** Texto a mostrar cuando el nodo aún no está configurado */
  empty?: string
}

export interface NodeDefinition {
  type: string
  kind: NodeKind
  label: string
  /** Texto pequeño sobre el título de la cajita (ej. "Facebook") */
  brand?: string
  category: string
  description?: string
  icon: LucideIcon
  accent: NodeAccent
  /** Encabezado con banda de color (lógica, IA, extras) o plano (contenido) */
  tintedHeader?: boolean
  pro?: boolean
  defaultConfig: () => Record<string, unknown>
  fields: ConfigField[]
  /** Salidas del nodo según su configuración. [] = sin salidas (comentario) */
  outputs: (config: Record<string, unknown>) => NodeOutputHandle[]
  /** Sin conector de entrada (comentarios) */
  noInput?: boolean
  /** Validación específica además de los campos requeridos */
  validate?: (config: Record<string, unknown>) => string[]
  summary: (config: Record<string, unknown>) => NodeSummaryData
}

export interface NodeCategory {
  id: string
  label: string
  kind: NodeKind
}

/** Tipo reservado de la tarjeta inicial "Cuando..." (no vive en el registro) */
export const START_NODE_TYPE = 'start'

export const CONTACT_VARIABLES = [
  '{{nombre}}',
  '{{apellido}}',
  '{{email}}',
  '{{telefono}}',
  '{{etiquetas}}',
  '{{respuesta_ia}}'
]

export const NODE_CATEGORIES: NodeCategory[] = [
  { id: 'trigger-contacts', label: 'Contactos', kind: 'trigger' },
  { id: 'trigger-events', label: 'Eventos', kind: 'trigger' },
  { id: 'trigger-appointments', label: 'Citas', kind: 'trigger' },
  { id: 'trigger-fbig', label: 'Eventos de Facebook/Instagram', kind: 'trigger' },
  { id: 'trigger-payments', label: 'Pagos', kind: 'trigger' },
  { id: 'action-contacts', label: 'Contactos', kind: 'action' },
  { id: 'action-data', label: 'Enviar datos', kind: 'action' },
  { id: 'action-logic', label: 'Interno / Lógico', kind: 'action' },
  { id: 'action-ai', label: 'IA', kind: 'action' },
  { id: 'action-content', label: 'Contenido / Canales', kind: 'action' },
  { id: 'action-extras', label: 'Extras', kind: 'action' }
]

const SINGLE_OUTPUT: NodeOutputHandle[] = [{ id: 'out', label: 'Siguiente paso' }]

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const CHANNEL_OPTIONS: ConfigFieldOption[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Correo electrónico' }
]

const channelLabel = (value: string): string =>
  CHANNEL_OPTIONS.find((option) => option.value === value)?.label || value

const DURATION_UNITS: ConfigFieldOption[] = [
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'days', label: 'Días' }
]

const durationLabel = (amount: number, unit: string): string => {
  const labels: Record<string, [string, string]> = {
    minutes: ['minuto', 'minutos'],
    hours: ['hora', 'horas'],
    days: ['día', 'días']
  }
  const [singular, plural] = labels[unit] || ['hora', 'horas']
  return `${amount} ${amount === 1 ? singular : plural}`
}

interface MessageNodeOptions {
  type: string
  label: string
  brand?: string
  icon: LucideIcon
  accent?: NodeAccent
  description?: string
}

/** Fabrica los nodos de "enviar mensaje" por canal (Messenger, Instagram, etc.) */
function messageNode({ type, label, brand, icon, accent = 'blue', description }: MessageNodeOptions): NodeDefinition {
  return {
    type,
    kind: 'action',
    label,
    brand,
    category: 'action-content',
    description,
    icon,
    accent,
    defaultConfig: () => ({ message: '' }),
    fields: [
      {
        key: 'message',
        label: 'Texto del mensaje',
        type: 'textarea',
        placeholder: 'Escribe el mensaje…',
        required: true,
        showVariables: true
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      box: str(config.message),
      empty: 'Toca para escribir el mensaje'
    })
  }
}

// ---------------------------------------------------------------------------
// Disparadores
// ---------------------------------------------------------------------------

const TRIGGERS: NodeDefinition[] = [
  {
    type: 'trigger-contact-tag',
    kind: 'trigger',
    label: 'Etiqueta de contacto',
    category: 'trigger-contacts',
    description: 'Se activa cuando una etiqueta cambia en un contacto',
    icon: Tag,
    accent: 'green',
    defaultConfig: () => ({ tag: '', operator: 'added' }),
    fields: [
      { key: 'tag', label: 'Etiqueta', type: 'text', placeholder: 'Ej. cliente-vip', required: true },
      {
        key: 'operator',
        label: 'Operador',
        type: 'select',
        required: true,
        options: [
          { value: 'added', label: 'Añadida' },
          { value: 'removed', label: 'Eliminada' },
          { value: 'contains', label: 'Contiene' }
        ]
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => {
      const operators: Record<string, string> = { added: 'añadida', removed: 'eliminada', contains: 'contiene' }
      const tag = str(config.tag)
      return {
        text: tag ? `Etiqueta "${tag}" ${operators[str(config.operator)] || 'añadida'}` : undefined,
        empty: 'Selecciona la etiqueta'
      }
    }
  },
  {
    type: 'trigger-form-submitted',
    kind: 'trigger',
    label: 'Formulario enviado',
    category: 'trigger-events',
    description: 'Se activa cuando alguien envía un formulario',
    icon: ClipboardList,
    accent: 'green',
    defaultConfig: () => ({ form: '', conditions: '' }),
    fields: [
      { key: 'form', label: 'Formulario', type: 'text', placeholder: 'Nombre o ID del formulario', required: true },
      { key: 'conditions', label: 'Condiciones (opcional)', type: 'textarea', placeholder: 'Ej. campo "interés" = demo' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.form) ? `Formulario: ${str(config.form)}` : undefined,
      empty: 'Selecciona el formulario'
    })
  },
  {
    type: 'trigger-customer-replied',
    kind: 'trigger',
    label: 'El Cliente Respondió',
    category: 'trigger-events',
    description: 'Se activa cuando el contacto responde un mensaje',
    icon: MessageCircleReply,
    accent: 'green',
    defaultConfig: () => ({ channel: 'whatsapp', keywords: [], match: 'contains' }),
    fields: [
      { key: 'channel', label: 'Canal', type: 'select', required: true, options: CHANNEL_OPTIONS },
      { key: 'keywords', label: 'Palabras clave (opcional)', type: 'keywords', placeholder: 'Escribe y presiona Enter' },
      {
        key: 'match',
        label: 'Coincidencia',
        type: 'select',
        options: [
          { value: 'contains', label: 'Contiene' },
          { value: 'exact', label: 'Coincidencia exacta' }
        ]
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => {
      const keywords = arr<string>(config.keywords)
      const channel = channelLabel(str(config.channel))
      return {
        text: keywords.length > 0 ? `${channel} · "${keywords.join('", "')}"` : `Cualquier respuesta por ${channel}`
      }
    }
  },
  {
    type: 'trigger-incoming-webhook',
    kind: 'trigger',
    label: 'Webhook entrante',
    category: 'trigger-events',
    description: 'Se activa al recibir una llamada HTTP externa',
    icon: Rss,
    accent: 'green',
    pro: true,
    defaultConfig: () => ({ endpointId: '', method: 'POST' }),
    fields: [
      { key: 'endpointId', label: 'URL del webhook', type: 'webhookUrl' },
      {
        key: 'method',
        label: 'Método',
        type: 'select',
        options: [
          { value: 'POST', label: 'POST' },
          { value: 'GET', label: 'GET' }
        ]
      },
      {
        key: 'samplePayload',
        label: 'Ejemplo de payload',
        type: 'info',
        text: '{\n  "contacto": {\n    "nombre": "Ana",\n    "telefono": "+52 55 0000 0000",\n    "email": "ana@ejemplo.com"\n  },\n  "datos": { "origen": "mi-sistema" }\n}'
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.endpointId) ? `Esperando llamadas ${str(config.method) || 'POST'}` : undefined,
      empty: 'Genera la URL del webhook'
    })
  },
  {
    type: 'trigger-appointment-status',
    kind: 'trigger',
    label: 'Estado de la cita',
    category: 'trigger-appointments',
    description: 'Se activa cuando una cita cambia de estado',
    icon: CalendarClock,
    accent: 'green',
    defaultConfig: () => ({ status: 'confirmed', calendar: '' }),
    fields: [
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        options: [
          { value: 'confirmed', label: 'Confirmada' },
          { value: 'cancelled', label: 'Cancelada' },
          { value: 'rescheduled', label: 'Reagendada' },
          { value: 'completed', label: 'Completada' },
          { value: 'no_show', label: 'No asistió' }
        ]
      },
      { key: 'calendar', label: 'Calendario (opcional)', type: 'text', placeholder: 'Todos los calendarios' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => {
      const statuses: Record<string, string> = {
        confirmed: 'Confirmada',
        cancelled: 'Cancelada',
        rescheduled: 'Reagendada',
        completed: 'Completada',
        no_show: 'No asistió'
      }
      return { text: `Cita ${statuses[str(config.status)] || 'Confirmada'}` }
    }
  },
  {
    type: 'trigger-contact-updated',
    kind: 'trigger',
    label: 'Contacto modificado',
    category: 'trigger-contacts',
    description: 'Se activa cuando cambia un campo del contacto',
    icon: UserCog,
    accent: 'green',
    defaultConfig: () => ({ field: '', condition: '' }),
    fields: [
      { key: 'field', label: 'Campo modificado', type: 'text', placeholder: 'Ej. teléfono, etapa…', required: true },
      { key: 'condition', label: 'Condición (opcional)', type: 'text', placeholder: 'Ej. etapa = cliente' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.field) ? `Cuando cambia "${str(config.field)}"` : undefined,
      empty: 'Selecciona el campo a observar'
    })
  },
  {
    type: 'trigger-contact-created',
    kind: 'trigger',
    label: 'Contacto creado',
    category: 'trigger-contacts',
    description: 'Se activa cuando se crea un contacto nuevo',
    icon: UserPlus,
    accent: 'green',
    defaultConfig: () => ({ source: '' }),
    fields: [
      { key: 'source', label: 'Fuente (opcional)', type: 'text', placeholder: 'Cualquier fuente' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.source) ? `Fuente: ${str(config.source)}` : 'Cualquier contacto nuevo'
    })
  },
  {
    type: 'trigger-activation-link',
    kind: 'trigger',
    label: 'Se ha hecho clic en el enlace de activación',
    category: 'trigger-events',
    description: 'Se activa cuando el contacto abre tu enlace',
    icon: MousePointerClick,
    accent: 'green',
    defaultConfig: () => ({ link: '' }),
    fields: [
      { key: 'link', label: 'Enlace o identificador', type: 'text', placeholder: 'Ej. enlace-promo', required: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.link) ? `Enlace: ${str(config.link)}` : undefined,
      empty: 'Define el enlace a rastrear'
    })
  },
  {
    type: 'trigger-scheduler',
    kind: 'trigger',
    label: 'Scheduler',
    category: 'trigger-events',
    description: 'Se ejecuta en una fecha u horario programado',
    icon: Clock,
    accent: 'green',
    defaultConfig: () => ({ datetime: '', recurrence: 'none', timezone: '' }),
    fields: [
      { key: 'datetime', label: 'Fecha y hora', type: 'datetime', required: true },
      {
        key: 'recurrence',
        label: 'Recurrencia',
        type: 'select',
        options: [
          { value: 'none', label: 'Una sola vez' },
          { value: 'daily', label: 'Cada día' },
          { value: 'weekly', label: 'Cada semana' },
          { value: 'monthly', label: 'Cada mes' }
        ]
      },
      { key: 'timezone', label: 'Zona horaria (opcional)', type: 'text', placeholder: 'Ej. America/Mexico_City' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => {
      const recurrences: Record<string, string> = {
        none: 'Una sola vez',
        daily: 'Cada día',
        weekly: 'Cada semana',
        monthly: 'Cada mes'
      }
      const datetime = str(config.datetime)
      return {
        text: datetime ? `${recurrences[str(config.recurrence)] || 'Una sola vez'} · ${datetime.replace('T', ' ')}` : undefined,
        empty: 'Programa la fecha y hora'
      }
    }
  },
  {
    type: 'trigger-appointment-booked',
    kind: 'trigger',
    label: 'Cita reservada por el cliente',
    category: 'trigger-appointments',
    description: 'Se activa cuando el contacto agenda una cita',
    icon: CalendarCheck,
    accent: 'green',
    defaultConfig: () => ({ calendar: '' }),
    fields: [
      { key: 'calendar', label: 'Calendario (opcional)', type: 'text', placeholder: 'Todos los calendarios' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.calendar) ? `Calendario: ${str(config.calendar)}` : 'Cualquier calendario'
    })
  },
  {
    type: 'trigger-payment-received',
    kind: 'trigger',
    label: 'Pago recibido',
    category: 'trigger-payments',
    description: 'Se activa cuando se registra un pago',
    icon: Receipt,
    accent: 'green',
    defaultConfig: () => ({ provider: '', amount: '', status: '' }),
    fields: [
      { key: 'provider', label: 'Proveedor (opcional)', type: 'text', placeholder: 'Ej. Stripe' },
      { key: 'amount', label: 'Monto mínimo (opcional)', type: 'number', placeholder: '0' },
      { key: 'status', label: 'Estado (opcional)', type: 'text', placeholder: 'Ej. pagado' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.provider) ? `Pagos de ${str(config.provider)}` : 'Cualquier pago recibido'
    })
  },
  {
    type: 'trigger-facebook-comment',
    kind: 'trigger',
    label: 'Facebook - Comentario(s) en una publicación',
    brand: 'Facebook',
    category: 'trigger-fbig',
    description: 'Se activa con comentarios en tus publicaciones de Facebook',
    icon: Facebook,
    accent: 'green',
    defaultConfig: () => ({ post: '', keywords: [], replyChannel: 'messenger', allowedComments: 'all' }),
    fields: [
      { key: 'post', label: 'Publicación', type: 'text', placeholder: 'URL o ID de la publicación', required: true },
      { key: 'keywords', label: 'Palabras clave (opcional)', type: 'keywords', placeholder: 'Escribe y presiona Enter' },
      { key: 'replyChannel', label: 'Canal de respuesta', type: 'select', options: CHANNEL_OPTIONS },
      {
        key: 'allowedComments',
        label: 'Comentarios permitidos',
        type: 'select',
        options: [
          { value: 'all', label: 'Todos los comentarios' },
          { value: 'first_only', label: 'Solo el primer comentario de cada persona' }
        ]
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.post) ? `Comentarios en ${str(config.post)}` : undefined,
      empty: 'Selecciona la publicación'
    })
  },
  {
    type: 'trigger-instagram-comment',
    kind: 'trigger',
    label: 'Instagram - Comentario(s) en una publicación',
    brand: 'Instagram',
    category: 'trigger-fbig',
    description: 'Se activa con comentarios en tus publicaciones de Instagram',
    icon: Instagram,
    accent: 'green',
    defaultConfig: () => ({ post: '', keywords: [], replyChannel: 'instagram', allowedComments: 'all' }),
    fields: [
      { key: 'post', label: 'Publicación', type: 'text', placeholder: 'URL o ID de la publicación', required: true },
      { key: 'keywords', label: 'Palabras clave (opcional)', type: 'keywords', placeholder: 'Escribe y presiona Enter' },
      { key: 'replyChannel', label: 'Canal de respuesta', type: 'select', options: CHANNEL_OPTIONS },
      {
        key: 'allowedComments',
        label: 'Comentarios permitidos',
        type: 'select',
        options: [
          { value: 'all', label: 'Todos los comentarios' },
          { value: 'first_only', label: 'Solo el primer comentario de cada persona' }
        ]
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.post) ? `Comentarios en ${str(config.post)}` : undefined,
      empty: 'Selecciona la publicación'
    })
  },
  {
    type: 'trigger-click-to-whatsapp',
    kind: 'trigger',
    label: 'Click to WhatsApp ads',
    brand: 'WhatsApp',
    category: 'trigger-fbig',
    description: 'Se activa cuando llega un mensaje desde un anuncio de WhatsApp',
    icon: MessageSquareText,
    accent: 'green',
    defaultConfig: () => ({ campaign: '', source: '' }),
    fields: [
      { key: 'campaign', label: 'Campaña o anuncio (opcional)', type: 'text', placeholder: 'Cualquier campaña' },
      { key: 'source', label: 'Fuente (opcional)', type: 'text', placeholder: 'Ej. ctwa' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.campaign) ? `Anuncio: ${str(config.campaign)}` : 'Cualquier anuncio de WhatsApp'
    })
  },
  {
    type: 'trigger-refund',
    kind: 'trigger',
    label: 'Refund',
    category: 'trigger-payments',
    description: 'Se activa cuando se procesa un reembolso',
    icon: RotateCcw,
    accent: 'green',
    defaultConfig: () => ({ provider: '', amount: '' }),
    fields: [
      { key: 'provider', label: 'Proveedor (opcional)', type: 'text', placeholder: 'Ej. Stripe' },
      { key: 'amount', label: 'Monto mínimo (opcional)', type: 'number', placeholder: '0' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.provider) ? `Reembolsos de ${str(config.provider)}` : 'Cualquier reembolso'
    })
  },
  {
    type: 'trigger-facebook-ad-click',
    kind: 'trigger',
    label: 'El usuario hace clic en un anuncio de Facebook',
    brand: 'Facebook Ads',
    category: 'trigger-fbig',
    description: 'Se activa cuando el contacto llega desde un anuncio',
    icon: Megaphone,
    accent: 'green',
    defaultConfig: () => ({ campaign: '', adId: '' }),
    fields: [
      { key: 'campaign', label: 'Campaña (opcional)', type: 'text', placeholder: 'Cualquier campaña' },
      { key: 'adId', label: 'ID del anuncio (opcional)', type: 'text', placeholder: 'Ej. Facebook Ads #1' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.adId) || str(config.campaign)
        ? `Anuncio: ${str(config.adId) || str(config.campaign)}`
        : 'Cualquier anuncio de Facebook'
    })
  }
]

// ---------------------------------------------------------------------------
// Acciones de contacto
// ---------------------------------------------------------------------------

const CONTACT_ACTIONS: NodeDefinition[] = [
  {
    type: 'action-create-contact',
    kind: 'action',
    label: 'Crear contacto',
    category: 'action-contacts',
    icon: UserPlus,
    accent: 'blue',
    defaultConfig: () => ({ name: '', phone: '', email: '' }),
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', placeholder: '{{nombre}}', showVariables: true },
      { key: 'phone', label: 'Teléfono', type: 'text', placeholder: '{{telefono}}' },
      { key: 'email', label: 'Correo', type: 'text', placeholder: '{{email}}' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.name) || str(config.phone) || str(config.email)
        ? `Crea: ${[str(config.name), str(config.phone), str(config.email)].filter(Boolean).join(' · ')}`
        : 'Crea un contacto con los datos del flujo'
    })
  },
  {
    type: 'action-find-contact',
    kind: 'action',
    label: 'Encontrar contacto',
    category: 'action-contacts',
    icon: UserSearch,
    accent: 'blue',
    defaultConfig: () => ({ searchBy: 'phone' }),
    fields: [
      {
        key: 'searchBy',
        label: 'Buscar por',
        type: 'select',
        required: true,
        options: [
          { value: 'phone', label: 'Teléfono' },
          { value: 'email', label: 'Correo' },
          { value: 'name', label: 'Nombre' }
        ]
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => {
      const labels: Record<string, string> = { phone: 'teléfono', email: 'correo', name: 'nombre' }
      return { text: `Busca el contacto por ${labels[str(config.searchBy)] || 'teléfono'}` }
    }
  },
  {
    type: 'action-update-contact-field',
    kind: 'action',
    label: 'Actualizar el campo de contacto',
    category: 'action-contacts',
    icon: PencilLine,
    accent: 'blue',
    defaultConfig: () => ({ field: '', value: '' }),
    fields: [
      { key: 'field', label: 'Campo', type: 'text', placeholder: 'Ej. etapa', required: true },
      { key: 'value', label: 'Nuevo valor', type: 'text', placeholder: 'Ej. cliente', showVariables: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.field) ? `${str(config.field)} → ${str(config.value) || '(vacío)'}` : undefined,
      empty: 'Elige el campo a actualizar'
    })
  },
  {
    type: 'action-add-contact-tag',
    kind: 'action',
    label: 'Añadir etiqueta de contacto',
    category: 'action-contacts',
    icon: Tags,
    accent: 'blue',
    defaultConfig: () => ({ tag: '' }),
    fields: [
      { key: 'tag', label: 'Etiqueta', type: 'text', placeholder: 'Ej. interesado', required: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.tag) ? `Añade "${str(config.tag)}"` : undefined,
      empty: 'Selecciona la etiqueta'
    })
  },
  {
    type: 'action-remove-contact-tag',
    kind: 'action',
    label: 'Eliminar la etiqueta de contacto',
    category: 'action-contacts',
    icon: Tags,
    accent: 'blue',
    defaultConfig: () => ({ tag: '' }),
    fields: [
      { key: 'tag', label: 'Etiqueta', type: 'text', placeholder: 'Ej. interesado', required: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.tag) ? `Elimina "${str(config.tag)}"` : undefined,
      empty: 'Selecciona la etiqueta'
    })
  },
  {
    type: 'action-assign-user',
    kind: 'action',
    label: 'Asignar al usuario',
    category: 'action-contacts',
    icon: UserCheck,
    accent: 'blue',
    defaultConfig: () => ({ user: '' }),
    fields: [
      { key: 'user', label: 'Usuario', type: 'text', placeholder: 'Nombre o correo del usuario', required: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.user) ? `Asigna a ${str(config.user)}` : undefined,
      empty: 'Selecciona el usuario'
    })
  },
  {
    type: 'action-unassign-user',
    kind: 'action',
    label: 'Eliminar usuario asignado',
    category: 'action-contacts',
    icon: UserMinus,
    accent: 'blue',
    defaultConfig: () => ({}),
    fields: [],
    outputs: () => SINGLE_OUTPUT,
    summary: () => ({ text: 'Quita el usuario asignado del contacto' })
  },
  {
    type: 'action-delete-contact',
    kind: 'action',
    label: 'Eliminar contacto',
    category: 'action-contacts',
    icon: UserX,
    accent: 'blue',
    defaultConfig: () => ({}),
    fields: [
      {
        key: 'warning',
        label: 'Atención',
        type: 'info',
        text: 'Esta acción elimina el contacto de forma permanente cuando la automatización se ejecuta.'
      }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: () => ({ text: 'Elimina el contacto del CRM' })
  }
]

// ---------------------------------------------------------------------------
// Enviar datos / Lógica / IA / Contenido / Extras
// ---------------------------------------------------------------------------

const OTHER_ACTIONS: NodeDefinition[] = [
  {
    type: 'action-webhook',
    kind: 'action',
    label: 'Webhook',
    category: 'action-data',
    description: 'Envía datos a un sistema externo',
    icon: Webhook,
    accent: 'teal',
    defaultConfig: () => ({ url: '', method: 'POST', headers: [], body: '' }),
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://…', required: true },
      {
        key: 'method',
        label: 'Método',
        type: 'select',
        options: [
          { value: 'POST', label: 'POST' },
          { value: 'GET', label: 'GET' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' }
        ]
      },
      { key: 'headers', label: 'Headers', type: 'keyValue' },
      { key: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{\n  "telefono": "{{telefono}}"\n}', showVariables: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.url) ? `${str(config.method) || 'POST'} ${str(config.url)}` : undefined,
      empty: 'Configura la URL del webhook'
    })
  },
  {
    type: 'logic-if-else',
    kind: 'action',
    label: 'If / Else',
    category: 'action-logic',
    description: 'Divide el flujo según condiciones',
    icon: GitBranch,
    accent: 'purple',
    tintedHeader: true,
    defaultConfig: () => ({ conditions: [{ field: '', operator: 'equals', value: '' }] }),
    fields: [
      { key: 'conditions', label: 'Condiciones', type: 'conditions', required: true }
    ],
    outputs: () => [
      { id: 'yes', label: 'Sí' },
      { id: 'no', label: 'No' }
    ],
    validate: (config) => {
      const conditions = arr<Record<string, unknown>>(config.conditions)
      if (conditions.length === 0 || conditions.every((condition) => !str(condition.field))) {
        return ['Agrega al menos una condición']
      }
      return []
    },
    summary: (config) => {
      const conditions = arr<Record<string, unknown>>(config.conditions).filter((condition) => str(condition.field))
      return {
        text: conditions.length > 0
          ? `${conditions.length} ${conditions.length === 1 ? 'condición' : 'condiciones'}`
          : undefined,
        empty: 'Define las condiciones'
      }
    }
  },
  {
    type: 'logic-condition',
    kind: 'action',
    label: 'Condición',
    category: 'action-logic',
    description: 'Continúa solo si se cumple la condición',
    icon: Filter,
    accent: 'purple',
    tintedHeader: true,
    pro: true,
    defaultConfig: () => ({ conditions: [{ field: '', operator: 'equals', value: '' }] }),
    fields: [
      { key: 'conditions', label: 'Condiciones', type: 'conditions', required: true }
    ],
    outputs: () => [
      { id: 'yes', label: 'Cumple' },
      { id: 'no', label: 'No cumple' }
    ],
    validate: (config) => {
      const conditions = arr<Record<string, unknown>>(config.conditions)
      if (conditions.length === 0 || conditions.every((condition) => !str(condition.field))) {
        return ['Agrega al menos una condición']
      }
      return []
    },
    summary: (config) => {
      const conditions = arr<Record<string, unknown>>(config.conditions).filter((condition) => str(condition.field))
      return {
        text: conditions.length > 0
          ? `${conditions.length} ${conditions.length === 1 ? 'condición' : 'condiciones'}`
          : undefined,
        empty: 'Define las condiciones'
      }
    }
  },
  {
    type: 'logic-wait',
    kind: 'action',
    label: 'Esperar',
    category: 'action-logic',
    description: 'Pausa el flujo durante un tiempo',
    icon: Hourglass,
    accent: 'coral',
    tintedHeader: true,
    defaultConfig: () => ({ mode: 'duration', amount: 1, unit: 'hours', untilDate: '' }),
    fields: [
      {
        key: 'mode',
        label: 'Tipo de espera',
        type: 'select',
        options: [
          { value: 'duration', label: 'Un periodo de tiempo establecido' },
          { value: 'until', label: 'Una fecha y hora específicas' }
        ]
      },
      { key: 'amount', label: 'Duración', type: 'duration', showIf: (config) => str(config.mode) !== 'until' },
      { key: 'untilDate', label: 'Hasta la fecha', type: 'datetime', showIf: (config) => str(config.mode) === 'until' }
    ],
    outputs: () => SINGLE_OUTPUT,
    validate: (config) => {
      if (str(config.mode) === 'until' && !str(config.untilDate)) {
        return ['Selecciona la fecha y hora de espera']
      }
      if (str(config.mode) !== 'until' && (Number(config.amount) || 0) <= 0) {
        return ['La duración debe ser mayor a cero']
      }
      return []
    },
    summary: (config) => {
      if (str(config.mode) === 'until') {
        const until = str(config.untilDate)
        return { text: until ? `Espera hasta ${until.replace('T', ' ')}` : undefined, empty: 'Configura la espera' }
      }
      return { text: `Espera ${durationLabel(Number(config.amount) || 0, str(config.unit) || 'hours')} y luego continúa` }
    }
  },
  {
    type: 'logic-goal',
    kind: 'action',
    label: 'Evento objetivo',
    category: 'action-logic',
    description: 'Marca una meta dentro de la automatización',
    icon: Target,
    accent: 'purple',
    tintedHeader: true,
    defaultConfig: () => ({ goal: '' }),
    fields: [
      { key: 'goal', label: 'Nombre del objetivo', type: 'text', placeholder: 'Ej. compró el plan', required: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.goal) ? `Objetivo: ${str(config.goal)}` : undefined,
      empty: 'Nombra el objetivo'
    })
  },
  {
    type: 'logic-split',
    kind: 'action',
    label: 'Dividir',
    category: 'action-logic',
    description: 'Crea múltiples ramas con nombre',
    icon: Split,
    accent: 'purple',
    tintedHeader: true,
    defaultConfig: () => ({
      branches: [
        { id: 'branch-1', label: 'Rama 1' },
        { id: 'branch-2', label: 'Rama 2' }
      ]
    }),
    fields: [
      { key: 'branches', label: 'Ramas', type: 'branches', required: true }
    ],
    outputs: (config) =>
      arr<{ id?: unknown; label?: unknown }>(config.branches).map((branch, index) => ({
        id: str(branch.id) || `branch-${index + 1}`,
        label: str(branch.label) || `Rama ${index + 1}`
      })),
    validate: (config) => (arr(config.branches).length < 2 ? ['Agrega al menos dos ramas'] : []),
    summary: (config) => ({ text: `${arr(config.branches).length} ramas` })
  },
  {
    type: 'randomizer',
    kind: 'action',
    label: 'Aleatorizador',
    category: 'action-logic',
    description: 'Divide el tráfico al azar entre ramas',
    icon: Shuffle,
    accent: 'purple',
    tintedHeader: true,
    pro: true,
    defaultConfig: () => ({
      branches: [
        { id: 'a', label: 'A', percent: 50 },
        { id: 'b', label: 'B', percent: 50 }
      ]
    }),
    fields: [
      { key: 'branches', label: 'Ramas y porcentajes', type: 'percentBranches', required: true }
    ],
    outputs: (config) =>
      arr<{ id?: unknown; label?: unknown; percent?: unknown }>(config.branches).map((branch, index) => ({
        id: str(branch.id) || `branch-${index + 1}`,
        label: `${str(branch.label) || String.fromCharCode(65 + index)} · ${Number(branch.percent) || 0}%`
      })),
    validate: (config) => {
      const branches = arr<{ percent?: unknown }>(config.branches)
      const total = branches.reduce((sum, branch) => sum + (Number(branch.percent) || 0), 0)
      if (branches.length < 2) return ['Agrega al menos dos ramas']
      if (total !== 100) return [`Los porcentajes deben sumar 100% (ahora suman ${total}%)`]
      return []
    },
    summary: (config) => ({ text: `${arr(config.branches).length} ramas al azar` })
  },
  {
    type: 'logic-smart-pause',
    kind: 'action',
    label: 'Pausa inteligente',
    category: 'action-logic',
    description: 'Espera respetando una ventana horaria',
    icon: Timer,
    accent: 'coral',
    tintedHeader: true,
    pro: true,
    defaultConfig: () => ({ amount: 23, unit: 'hours', windowEnabled: false, windowStart: '09:00', windowEnd: '18:00' }),
    fields: [
      { key: 'amount', label: 'Duración', type: 'duration' },
      { key: 'windowEnabled', label: 'Limitar a una ventana horaria', type: 'toggle' },
      { key: 'windowStart', label: 'Desde', type: 'text', placeholder: '09:00', showIf: (config) => Boolean(config.windowEnabled) },
      { key: 'windowEnd', label: 'Hasta', type: 'text', placeholder: '18:00', showIf: (config) => Boolean(config.windowEnabled) }
    ],
    outputs: () => SINGLE_OUTPUT,
    validate: (config) => ((Number(config.amount) || 0) <= 0 ? ['La duración debe ser mayor a cero'] : []),
    summary: (config) => {
      const base = `Espera ${durationLabel(Number(config.amount) || 0, str(config.unit) || 'hours')} y luego continúa`
      return {
        text: config.windowEnabled
          ? `${base} (${str(config.windowStart) || '09:00'}–${str(config.windowEnd) || '18:00'})`
          : base
      }
    }
  },
  {
    type: 'logic-actions-group',
    kind: 'action',
    label: 'Acciones',
    category: 'action-logic',
    description: 'Agrupa varias acciones internas',
    icon: ListChecks,
    accent: 'orange',
    tintedHeader: true,
    defaultConfig: () => ({ notes: '' }),
    fields: [
      { key: 'notes', label: 'Acciones a ejecutar', type: 'textarea', placeholder: 'Describe las acciones, una por línea' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      box: str(config.notes),
      empty: 'Describe las acciones'
    })
  },
  {
    type: 'ai-step',
    kind: 'action',
    label: 'AI Step',
    category: 'action-ai',
    description: 'Permite que la IA gestione las conversaciones por ti',
    icon: Sparkles,
    accent: 'dark',
    tintedHeader: true,
    defaultConfig: () => ({ systemPrompt: '', userPrompt: '', saveAs: 'respuesta_ia' }),
    fields: [
      { key: 'systemPrompt', label: 'Prompt del sistema', type: 'textarea', placeholder: 'Eres un asistente que…', required: true },
      { key: 'userPrompt', label: 'Prompt del usuario', type: 'textarea', placeholder: 'Responde al contacto sobre…', showVariables: true },
      { key: 'saveAs', label: 'Guardar respuesta en variable', type: 'text', placeholder: 'respuesta_ia' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      box: str(config.systemPrompt),
      empty: 'Escribe el prompt de la IA'
    })
  },
  {
    type: 'ai-gpt-openai',
    kind: 'action',
    label: 'GPT impulsado por OpenAI',
    brand: 'OpenAI',
    category: 'action-ai',
    description: 'Genera contenido con un modelo GPT',
    icon: Bot,
    accent: 'dark',
    tintedHeader: true,
    defaultConfig: () => ({ model: 'gpt-4o-mini', systemPrompt: '', userPrompt: '', saveAs: 'respuesta_ia' }),
    fields: [
      { key: 'model', label: 'Modelo', type: 'text', placeholder: 'gpt-4o-mini' },
      { key: 'systemPrompt', label: 'Prompt del sistema', type: 'textarea', placeholder: 'Eres un asistente que…', required: true },
      { key: 'userPrompt', label: 'Prompt del usuario', type: 'textarea', placeholder: 'Genera una respuesta para…', showVariables: true },
      { key: 'saveAs', label: 'Guardar respuesta en variable', type: 'text', placeholder: 'respuesta_ia' }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      box: str(config.systemPrompt),
      empty: 'Escribe el prompt del modelo'
    })
  },
  messageNode({
    type: 'channel-instagram',
    label: 'Instagram',
    brand: 'Instagram',
    icon: Instagram,
    accent: 'pink',
    description: 'Envía un mensaje por Instagram'
  }),
  messageNode({
    type: 'channel-messenger',
    label: 'Messenger',
    brand: 'Facebook',
    icon: MessageCircle,
    accent: 'blue',
    description: 'Envía un mensaje por Messenger'
  }),
  messageNode({
    type: 'channel-telegram',
    label: 'Telegram',
    brand: 'Telegram',
    icon: Send,
    accent: 'teal',
    description: 'Envía un mensaje por Telegram'
  }),
  {
    type: 'channel-generic',
    kind: 'action',
    label: 'Canal',
    category: 'action-content',
    description: 'Envía un mensaje por el canal que elijas',
    icon: Radio,
    accent: 'blue',
    defaultConfig: () => ({ channel: 'whatsapp', message: '' }),
    fields: [
      { key: 'channel', label: 'Canal', type: 'select', required: true, options: CHANNEL_OPTIONS },
      { key: 'message', label: 'Texto del mensaje', type: 'textarea', placeholder: 'Escribe el mensaje…', required: true, showVariables: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.message) ? channelLabel(str(config.channel)) : undefined,
      box: str(config.message),
      empty: 'Elige el canal y escribe el mensaje'
    })
  },
  {
    type: 'start-automation',
    kind: 'action',
    label: 'Iniciar Automatización',
    category: 'action-content',
    description: 'Inicia otra automatización para este contacto',
    icon: PlayCircle,
    accent: 'blue',
    defaultConfig: () => ({ automationId: '', automationName: '' }),
    fields: [
      { key: 'automationId', label: 'Automatización', type: 'automation', required: true }
    ],
    outputs: () => SINGLE_OUTPUT,
    summary: (config) => ({
      text: str(config.automationName) ? `Inicia "${str(config.automationName)}"` : undefined,
      empty: 'Selecciona la automatización'
    })
  },
  messageNode({
    type: 'channel-facebook-message',
    label: 'Enviar mensaje',
    brand: 'Facebook',
    icon: Facebook,
    accent: 'blue',
    description: 'Envía un mensaje por Facebook'
  }),
  {
    type: 'extra-comment',
    kind: 'action',
    label: 'Comentario',
    category: 'action-extras',
    description: 'Nota interna visible en el canvas',
    icon: StickyNote,
    accent: 'yellow',
    tintedHeader: true,
    noInput: true,
    defaultConfig: () => ({ text: '' }),
    fields: [
      { key: 'text', label: 'Nota', type: 'textarea', placeholder: 'Escribe una nota para tu equipo…' }
    ],
    outputs: () => [],
    summary: (config) => ({
      box: str(config.text),
      empty: 'Haz doble clic para escribir la nota'
    })
  }
]

// ---------------------------------------------------------------------------
// API del registro
// ---------------------------------------------------------------------------

export const NODE_DEFINITIONS: NodeDefinition[] = [...TRIGGERS, ...CONTACT_ACTIONS, ...OTHER_ACTIONS]

const definitionsByType = new Map(NODE_DEFINITIONS.map((definition) => [definition.type, definition]))

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return definitionsByType.get(type)
}

export function getDefinitionsByKind(kind: NodeKind): NodeDefinition[] {
  return NODE_DEFINITIONS.filter((definition) => definition.kind === kind)
}

export function getCategoriesForKind(kind: NodeKind): NodeCategory[] {
  return NODE_CATEGORIES.filter((category) => category.kind === kind)
}

/** Errores de configuración de un nodo: requeridos genéricos + validación propia */
export function validateNodeConfig(definition: NodeDefinition, config: Record<string, unknown>): string[] {
  const errors: string[] = []

  definition.fields.forEach((field) => {
    if (!field.required) return
    const value = config[field.key]
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) {
      errors.push(`Completa el campo "${field.label}"`)
    }
  })

  if (definition.validate) {
    errors.push(...definition.validate(config))
  }

  return errors
}
