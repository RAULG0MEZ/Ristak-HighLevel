import { useEffect, useState } from 'react'
import {
  Globe,
  MessageCircle,
  UserPlus,
  Calendar,
  DollarSign,
  MapPin,
  Monitor,
  Clock
} from 'lucide-react'
import { contactsService, type JourneyEvent } from '@/services/contactsService'
import { formatCurrency, formatDate } from '@/utils/format'
import styles from './ContactJourney.module.css'

interface ContactJourneyProps {
  contactId: string
}

const getEventIcon = (type: JourneyEvent['type']) => {
  switch (type) {
    case 'first_visit':
      return Globe
    case 'whatsapp_message':
      return MessageCircle
    case 'contact_created':
      return UserPlus
    case 'first_appointment':
      return Calendar
    case 'first_payment':
      return DollarSign
    default:
      return Globe
  }
}

const getEventTitle = (type: JourneyEvent['type']) => {
  switch (type) {
    case 'first_visit':
      return 'Primera visita'
    case 'whatsapp_message':
      return 'Mensaje de WhatsApp'
    case 'contact_created':
      return 'Se convirtió en contacto'
    case 'first_appointment':
      return 'Primera cita agendada'
    case 'first_payment':
      return 'Primera compra'
    default:
      return 'Evento'
  }
}

const getEventColor = (type: JourneyEvent['type']) => {
  switch (type) {
    case 'first_visit':
      return 'blue'
    case 'whatsapp_message':
      return 'green'
    case 'contact_created':
      return 'purple'
    case 'first_appointment':
      return 'orange'
    case 'first_payment':
      return 'success'
    default:
      return 'gray'
  }
}

const EventDetails = ({ event }: { event: JourneyEvent }) => {
  const { type, data } = event

  if (type === 'first_visit') {
    return (
      <div className={styles.eventDetails}>
        {data.landing_url && (
          <div className={styles.detailRow}>
            <Globe size={14} />
            <span className={styles.detailLabel}>Página:</span>
            <span className={styles.detailValue}>{new URL(data.landing_url).pathname}</span>
          </div>
        )}
        {(data.utm_campaign || data.campaign_name) && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Campaña:</span>
            <span className={styles.detailValue}>{data.utm_campaign || data.campaign_name}</span>
          </div>
        )}
        {(data.ad_name || data.utm_content) && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Anuncio:</span>
            <span className={styles.detailValue}>{data.ad_name || data.utm_content}</span>
          </div>
        )}
        {data.device_type && (
          <div className={styles.detailRow}>
            <Monitor size={14} />
            <span className={styles.detailValue}>
              {data.device_type} {data.browser && `• ${data.browser}`}
            </span>
          </div>
        )}
        {(data.geo_city || data.geo_region) && (
          <div className={styles.detailRow}>
            <MapPin size={14} />
            <span className={styles.detailValue}>
              {[data.geo_city, data.geo_region].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'whatsapp_message') {
    return (
      <div className={styles.eventDetails}>
        {data.referral_headline && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Título:</span>
            <span className={styles.detailValue}>{data.referral_headline}</span>
          </div>
        )}
        {data.referral_source_type && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Origen:</span>
            <span className={styles.detailValue}>{data.referral_source_type}</span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'contact_created') {
    return (
      <div className={styles.eventDetails}>
        {data.name && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Nombre:</span>
            <span className={styles.detailValue}>{data.name}</span>
          </div>
        )}
        {data.source && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Fuente:</span>
            <span className={styles.detailValue}>{data.source}</span>
          </div>
        )}
        {data.attribution_ad_name && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Anuncio:</span>
            <span className={styles.detailValue}>{data.attribution_ad_name}</span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'first_appointment') {
    return (
      <div className={styles.eventDetails}>
        {data.title && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Título:</span>
            <span className={styles.detailValue}>{data.title}</span>
          </div>
        )}
        {data.start_time && (
          <div className={styles.detailRow}>
            <Clock size={14} />
            <span className={styles.detailValue}>{formatDate(data.start_time, 'long')}</span>
          </div>
        )}
        {data.address && (
          <div className={styles.detailRow}>
            <MapPin size={14} />
            <span className={styles.detailValue}>{data.address}</span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'first_payment') {
    return (
      <div className={styles.eventDetails}>
        {data.amount && (
          <div className={styles.detailRow}>
            <DollarSign size={14} />
            <span className={styles.detailValue}>{formatCurrency(data.amount)}</span>
          </div>
        )}
        {data.title && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Producto:</span>
            <span className={styles.detailValue}>{data.title}</span>
          </div>
        )}
      </div>
    )
  }

  return null
}

export const ContactJourney = ({ contactId }: ContactJourneyProps) => {
  const [journey, setJourney] = useState<JourneyEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadJourney = async () => {
      setLoading(true)
      const data = await contactsService.getContactJourney(contactId)
      setJourney(data)
      setLoading(false)
    }

    loadJourney()
  }, [contactId])

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Cargando viaje del cliente...</span>
      </div>
    )
  }

  if (journey.length === 0) {
    return (
      <div className={styles.empty}>
        <Globe size={48} />
        <p>No hay eventos registrados para este contacto</p>
      </div>
    )
  }

  return (
    <div className={styles.journey}>
      <h3 className={styles.title}>Viaje del Cliente</h3>
      <div className={styles.timeline}>
        {journey.map((event, index) => {
          const Icon = getEventIcon(event.type)
          const color = getEventColor(event.type)
          const isLast = index === journey.length - 1

          return (
            <div key={index} className={styles.event}>
              <div className={styles.eventLine}>
                <div className={`${styles.eventDot} ${styles[color]}`}>
                  <Icon size={16} />
                </div>
                {!isLast && <div className={styles.connector} />}
              </div>
              <div className={styles.eventContent}>
                <div className={styles.eventHeader}>
                  <h4 className={styles.eventTitle}>{getEventTitle(event.type)}</h4>
                  <span className={styles.eventDate}>{formatDate(event.date, 'short')}</span>
                </div>
                <EventDetails event={event} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
