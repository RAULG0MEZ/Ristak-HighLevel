import type { BadgeVariant } from '@/components/common/Badge'

type ContactStage = 'lead' | 'appointment' | 'attended' | 'customer'

interface ContactStageLabels {
  lead: string
  customer: string
}

interface ContactStageBadge {
  stage: ContactStage
  text: string
  variant: BadgeVariant
}

export const CONTACT_STAGE_BADGE_VARIANTS: Record<ContactStage, BadgeVariant> = {
  lead: 'neutral',
  appointment: 'purple',
  attended: 'info',
  customer: 'success'
}

const CUSTOMER_KEYWORDS = ['customer', 'cliente', 'sale', 'ventas', 'sold', 'converted', 'paid', 'pago', 'pagó', 'compra', 'compró', 'closed-won', 'won']
const APPOINTMENT_KEYWORDS = ['appointment', 'cita', 'agend', 'booked', 'scheduled', 'confirmado', 'reserva', 'reservo', 'calendar']
const ATTENDANCE_KEYWORDS = ['asist', 'showed', 'attended', 'completed']

const ATTENDED_APPOINTMENT_STATUSES = new Set(['completed', 'showed', 'attended'])

export const isAttendedAppointmentStatus = (status?: string | null) =>
  ATTENDED_APPOINTMENT_STATUSES.has(String(status || '').trim().toLowerCase())

const normalizeValue = (value: unknown) => String(value || '').trim().toLowerCase()

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toBoolean = (value: unknown) =>
  value === true || value === 1 || value === '1' || normalizeValue(value) === 'true'

const normalizeTags = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string').map(normalizeValue).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value.split(',').map(normalizeValue).filter(Boolean)
  }

  return []
}

const getAppointmentStatus = (appointment: unknown) => {
  if (!appointment || typeof appointment !== 'object') return ''
  const item = appointment as Record<string, unknown>
  return normalizeValue(item.appointmentStatus ?? item.appointment_status ?? item.status)
}

export const getContactStageBadge = (
  contactInput: unknown,
  labels: ContactStageLabels
): ContactStageBadge | null => {
  if (!contactInput || typeof contactInput !== 'object') return null

  const contact = contactInput as Record<string, unknown>
  const statusValues = [
    contact.status,
    contact.customerStatus,
    contact.stage,
    contact.lifecycleStage
  ].map(normalizeValue).filter(Boolean)

  const tags = [
    ...normalizeTags(contact.tags),
    ...normalizeTags(contact.labels),
    ...normalizeTags(contact.tagList),
    ...normalizeTags(contact.contactTags)
  ]

  const statusMatches = (keywords: string[]) =>
    statusValues.some(status => keywords.some(keyword => status.includes(keyword)))

  const tagsMatch = (keywords: string[]) =>
    tags.some(tag => keywords.some(keyword => tag.includes(keyword)))

  const payments = Array.isArray(contact.payments) ? contact.payments : []
  const appointments = Array.isArray(contact.appointments) ? contact.appointments : []

  const hasPurchases =
    toBoolean(contact.isCustomer) ||
    toBoolean(contact.is_customer) ||
    toBoolean(contact.isSale) ||
    toBoolean(contact.is_sale) ||
    toNumber(contact.purchases) > 0 ||
    toNumber(contact.lifetimePurchases ?? contact.purchasesLifetime ?? contact.purchases_count) > 0 ||
    toNumber(contact.ltv) > 0 ||
    toNumber(contact.lifetimeLtv ?? contact.totalPaid ?? contact.total_paid) > 0 ||
    payments.some(payment => payment && typeof payment === 'object' && toNumber((payment as Record<string, unknown>).amount) > 0) ||
    statusMatches(CUSTOMER_KEYWORDS) ||
    tagsMatch(CUSTOMER_KEYWORDS)

  if (hasPurchases) {
    return {
      stage: 'customer',
      text: labels.customer,
      variant: CONTACT_STAGE_BADGE_VARIANTS.customer
    }
  }

  const hasAttendedAppointment =
    toBoolean(contact.hasShowedAppointment) ||
    toBoolean(contact.hasAttendedAppointment) ||
    appointments.some(appointment => isAttendedAppointmentStatus(getAppointmentStatus(appointment))) ||
    statusMatches(ATTENDANCE_KEYWORDS) ||
    tagsMatch(ATTENDANCE_KEYWORDS)

  if (hasAttendedAppointment) {
    return {
      stage: 'attended',
      text: 'Asistió a Cita',
      variant: CONTACT_STAGE_BADGE_VARIANTS.attended
    }
  }

  const hasAppointments =
    toBoolean(contact.hasAppointments) ||
    appointments.length > 0 ||
    Boolean(contact.nextAppointmentDate) ||
    Boolean(contact.firstAppointmentDate) ||
    statusMatches(APPOINTMENT_KEYWORDS) ||
    tagsMatch(APPOINTMENT_KEYWORDS)

  if (hasAppointments) {
    return {
      stage: 'appointment',
      text: 'Agendó cita',
      variant: CONTACT_STAGE_BADGE_VARIANTS.appointment
    }
  }

  return {
    stage: 'lead',
    text: labels.lead,
    variant: CONTACT_STAGE_BADGE_VARIANTS.lead
  }
}
