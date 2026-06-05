import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bell,
  Bot,
  CalendarDays,
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  MonitorX,
  RefreshCw,
  Search,
  Send,
  Settings,
  Smartphone,
  X
} from 'lucide-react'
import { AppointmentModal, RecordPaymentModal } from '@/components/common'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useTimezone } from '@/contexts/TimezoneContext'
import { useAppConfig } from '@/hooks'
import apiClient from '@/services/apiClient'
import { calendarsService, type Calendar, type CalendarEvent } from '@/services/calendarsService'
import { contactsService, type JourneyEvent } from '@/services/contactsService'
import { pushNotificationsService } from '@/services/pushNotificationsService'
import { whatsappApiService, type WhatsAppApiStatus } from '@/services/whatsappApiService'
import type { Contact } from '@/types'
import styles from './PhoneChat.module.css'

const PORTABLE_WIDTH_QUERY = '(max-width: 1366px)'
const PHONE_WIDTH_QUERY = '(max-width: 900px)'
const COARSE_POINTER_QUERY = '(pointer: coarse)'
const MOBILE_OR_TABLET_USER_AGENT_PATTERN = /Android|iPad|iPhone|iPod|IEMobile|Opera Mini|Mobile|Tablet/i
const SCROLLABLE_CHAT_SELECTOR = '[data-phone-chat-scrollable="true"], textarea, input, select'

type AccessState = 'checking' | 'allowed' | 'blocked'
type ComposerStatus = 'idle' | 'sending'
type PaymentMode = 'single' | 'partial'
type ActionSheet = 'payment' | 'appointment' | 'notifications' | null

interface ChatMessage {
  id: string
  text: string
  date: string
  direction: 'inbound' | 'outbound' | 'system'
  status?: string
}

function hasPortableAccess() {
  if (typeof window === 'undefined') return false

  const portableViewport = window.matchMedia(PORTABLE_WIDTH_QUERY).matches
  const phoneViewport = window.matchMedia(PHONE_WIDTH_QUERY).matches
  const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches
  const userAgent = navigator.userAgent || ''
  const mobileOrTabletUserAgent = MOBILE_OR_TABLET_USER_AGENT_PATTERN.test(userAgent)
  const iPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1

  return phoneViewport || (portableViewport && (mobileOrTabletUserAgent || iPadDesktopMode || coarsePointer))
}

function getAccessState(): AccessState {
  if (typeof window === 'undefined') return 'checking'
  return hasPortableAccess() ? 'allowed' : 'blocked'
}

function getContactName(contact?: Partial<Contact> | null) {
  return contact?.name || contact?.email || contact?.phone || 'Contacto sin nombre'
}

function getContactDetail(contact?: Partial<Contact> | null) {
  return contact?.phone || contact?.email || 'Sin teléfono guardado'
}

function getContactInitials(contact?: Partial<Contact> | null) {
  const label = getContactName(contact)
  const parts = label.split(' ').filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

function formatMessageTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

function formatMessageDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short'
  }).format(date).replace('.', '')
}

function getJourneyMessage(event: JourneyEvent, index: number): ChatMessage | null {
  if (event.type !== 'whatsapp_message') return null

  const text = String(
    event.data?.message_text ||
    event.data?.message ||
    event.data?.body ||
    ''
  ).trim()

  if (!text && !event.data?.message_type) return null

  const direction = String(event.data?.direction || '').toLowerCase() === 'outbound' ? 'outbound' : 'inbound'

  return {
    id: String(event.data?.whatsapp_api_message_id || event.data?.whatsapp_message_id || event.data?.attribution_record_id || `message-${index}`),
    text: text || `Mensaje ${event.data?.message_type || 'de WhatsApp'}`,
    date: event.date,
    direction,
    status: String(event.data?.status || '')
  }
}

function getNotificationPermissionLabel() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'Este celular no permite avisos de la app.'
  if (Notification.permission === 'granted') return 'Este celular ya puede recibir avisos.'
  if (Notification.permission === 'denied') return 'El celular bloqueó los avisos. Actívalos desde los ajustes del navegador.'
  return 'Toca Activar para permitir avisos en este celular.'
}

function toPaymentContact(contact: Contact | null) {
  if (!contact) return null
  return {
    id: contact.id,
    name: getContactName(contact),
    email: contact.email || '',
    phone: contact.phone || ''
  }
}

function createDefaultAppointmentRange(timeZone: string) {
  const start = new Date()
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timeZone
  }
}

export const PhoneChat: React.FC = () => {
  const [searchParams] = useSearchParams()
  const requestedContactParam = searchParams.get('contact')
  const { locationId, accessToken } = useAuth()
  const { showToast } = useNotification()
  const { timezone } = useTimezone()
  const [defaultCalendarId] = useAppConfig<string>('default_calendar_id', '')
  const [calendarPushEnabled, setCalendarPushEnabled] = useAppConfig<boolean>('calendar_push_notifications_enabled', false)
  const [chatPushEnabled, setChatPushEnabled] = useAppConfig<boolean>('chat_push_notifications_enabled', true)
  const [paymentPushEnabled, setPaymentPushEnabled] = useAppConfig<boolean>('payment_push_notifications_enabled', true)
  const [pushCalendarIds] = useAppConfig<string[]>('calendar_push_notification_calendar_ids', [])

  const [accessState, setAccessState] = useState<AccessState>(getAccessState)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [contactsError, setContactsError] = useState('')
  const [query, setQuery] = useState('')
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [conversationOpen, setConversationOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [composerStatus, setComposerStatus] = useState<ComposerStatus>('idle')
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppApiStatus | null>(null)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState('')
  const [sheet, setSheet] = useState<ActionSheet>(null)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('single')
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [requestingPush, setRequestingPush] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const activeContact = useMemo(
    () => contacts.find((contact) => contact.id === activeContactId) || null,
    [activeContactId, contacts]
  )

  const selectedCalendar = useMemo(
    () => calendars.find((calendar) => calendar.id === selectedCalendarId) || calendars[0] || null,
    [calendars, selectedCalendarId]
  )

  const initialContact = useMemo(() => toPaymentContact(activeContact), [activeContact])
  const defaultAppointmentRange = useMemo(() => createDefaultAppointmentRange(timezone), [timezone])
  const whatsappConnected = Boolean(whatsappStatus?.connected && whatsappStatus?.configured)
  const canSendMessage = Boolean(activeContact?.phone && messageText.trim() && composerStatus !== 'sending')

  const loadContacts = useCallback(async () => {
    setContactsLoading(true)
    setContactsError('')

    try {
      const trimmed = query.trim()
      const data = trimmed.length >= 2
        ? await contactsService.searchContacts(trimmed)
        : await apiClient.get<Contact[]>('/contacts', {
            params: {
              page: '1',
              limit: '40',
              sortBy: 'created_at',
              sortOrder: 'DESC'
            }
          })

      let nextContacts = Array.isArray(data) ? data : []
      let requestedContact = requestedContactParam
        ? nextContacts.find((contact) => contact.id === requestedContactParam)
        : null

      if (requestedContactParam && !requestedContact) {
        const contact = await contactsService.getContactDetails(requestedContactParam).catch(() => null)
        if (contact) {
          requestedContact = contact
          nextContacts = [contact, ...nextContacts.filter((item) => item.id !== contact.id)]
        }
      }

      setContacts(nextContacts)
      setActiveContactId((current) => {
        if (requestedContact) return requestedContact.id
        if (current && nextContacts.some((contact) => contact.id === current)) return current
        return null
      })
      if (requestedContact) {
        setConversationOpen(true)
      }
    } catch {
      setContactsError('No se pudieron cargar los contactos.')
      setContacts([])
    } finally {
      setContactsLoading(false)
    }
  }, [query, requestedContactParam])

  const loadConversation = useCallback(async (contactId: string) => {
    setMessagesLoading(true)
    try {
      const journey = await contactsService.getContactJourney(contactId)
      const nextMessages = journey
        .map(getJourneyMessage)
        .filter((message): message is ChatMessage => Boolean(message))
        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())

      setMessages(nextMessages)
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  const loadSupportData = useCallback(async () => {
    const [status] = await Promise.all([
      whatsappApiService.getStatus().catch(() => null),
      locationId && accessToken
        ? calendarsService.getCalendars(locationId, accessToken).then((items) => {
            setCalendars(items)
            const preferred = items.find((calendar) => calendar.id === defaultCalendarId)
            setSelectedCalendarId((current) => current || preferred?.id || items[0]?.id || '')
          }).catch(() => setCalendars([]))
        : Promise.resolve()
    ])

    if (status) setWhatsappStatus(status)
  }, [accessToken, defaultCalendarId, locationId])

  useEffect(() => {
    document.title = activeContact ? `${getContactName(activeContact)} | Ristak Chat` : 'Ristak Chat'
  }, [activeContact])

  useEffect(() => {
    const updateAccess = () => setAccessState(getAccessState())
    const portableMedia = window.matchMedia(PORTABLE_WIDTH_QUERY)
    const phoneMedia = window.matchMedia(PHONE_WIDTH_QUERY)
    const pointerMedia = window.matchMedia(COARSE_POINTER_QUERY)

    updateAccess()
    portableMedia.addEventListener('change', updateAccess)
    phoneMedia.addEventListener('change', updateAccess)
    pointerMedia.addEventListener('change', updateAccess)
    window.addEventListener('resize', updateAccess)
    window.addEventListener('orientationchange', updateAccess)
    window.visualViewport?.addEventListener('resize', updateAccess)

    return () => {
      portableMedia.removeEventListener('change', updateAccess)
      phoneMedia.removeEventListener('change', updateAccess)
      pointerMedia.removeEventListener('change', updateAccess)
      window.removeEventListener('resize', updateAccess)
      window.removeEventListener('orientationchange', updateAccess)
      window.visualViewport?.removeEventListener('resize', updateAccess)
    }
  }, [])

  useEffect(() => {
    if (accessState !== 'allowed') return

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousHtmlHeight = html.style.height
    const previousHtmlOverscroll = html.style.overscrollBehavior
    const previousBodyOverflow = body.style.overflow
    const previousBodyHeight = body.style.height
    const previousBodyOverscroll = body.style.overscrollBehavior
    let startY = 0

    html.style.overflow = 'hidden'
    html.style.height = '100%'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.height = '100%'
    body.style.overscrollBehavior = 'none'

    const getScrollableElement = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null
      const scrollable = target.closest(SCROLLABLE_CHAT_SELECTOR)
      return scrollable instanceof HTMLElement ? scrollable : null
    }

    const handleTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY || 0
    }

    const handleTouchMove = (event: TouchEvent) => {
      const scrollable = getScrollableElement(event.target)
      if (!scrollable) {
        event.preventDefault()
        return
      }

      const currentY = event.touches[0]?.clientY || startY
      const deltaY = currentY - startY
      const canScroll = scrollable.scrollHeight > scrollable.clientHeight + 1
      const atTop = scrollable.scrollTop <= 0
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1

      if (!canScroll || (atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault()
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      html.style.overflow = previousHtmlOverflow
      html.style.height = previousHtmlHeight
      html.style.overscrollBehavior = previousHtmlOverscroll
      body.style.overflow = previousBodyOverflow
      body.style.height = previousBodyHeight
      body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [accessState])

  useEffect(() => {
    if (accessState !== 'allowed') return
    const timer = window.setTimeout(() => {
      loadContacts()
    }, query.trim() ? 120 : 0)

    return () => window.clearTimeout(timer)
  }, [accessState, loadContacts, query])

  useEffect(() => {
    if (accessState !== 'allowed') return
    loadSupportData()
  }, [accessState, loadSupportData])

  useEffect(() => {
    if (!activeContact?.id || accessState !== 'allowed') {
      setMessages([])
      return
    }
    loadConversation(activeContact.id)
  }, [accessState, activeContact?.id, loadConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, messagesLoading, conversationOpen])

  const handleSelectContact = (contact: Contact) => {
    setActiveContactId(contact.id)
    setConversationOpen(true)
  }

  const handleSendMessage = async () => {
    const text = messageText.trim()
    if (!activeContact || !text) return

    if (!activeContact.phone) {
      showToast('error', 'Falta teléfono', 'Guarda el teléfono del contacto para poder escribirle por WhatsApp.')
      return
    }

    if (!whatsappConnected) {
      showToast('error', 'WhatsApp no está conectado', 'Conecta WhatsApp API en configuración para enviar mensajes desde Ristak.')
      return
    }

    const optimisticId = `local-${Date.now()}`
    setComposerStatus('sending')
    setMessageText('')
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        text,
        date: new Date().toISOString(),
        direction: 'outbound',
        status: 'enviando'
      }
    ])

    try {
      await whatsappApiService.sendText({
        to: activeContact.phone,
        text,
        externalId: optimisticId
      })
      setMessages((current) => current.map((message) => (
        message.id === optimisticId ? { ...message, status: 'sent' } : message
      )))
      await loadConversation(activeContact.id)
    } catch (error: any) {
      setMessages((current) => current.map((message) => (
        message.id === optimisticId ? { ...message, status: 'error' } : message
      )))
      showToast('error', 'No se envió', error?.message || 'Intenta mandar el mensaje otra vez.')
    } finally {
      setComposerStatus('idle')
    }
  }

  const handleCreateAppointment = async (payload: {
    title: string
    appointmentStatus: CalendarEvent['appointmentStatus']
    startTime: string
    endTime: string
    notes: string
    address: string
    timeZone: string
    contactId?: string
  }) => {
    if (!selectedCalendar) return

    try {
      await calendarsService.createAppointment({
        calendarId: selectedCalendar.id,
        ...(locationId ? { locationId } : {}),
        ...payload
      }, accessToken || undefined)

      setAppointmentOpen(false)
      setSheet(null)
      showToast('success', 'Cita agendada', 'La cita quedó guardada.')
      setMessages((current) => [
        ...current,
        {
          id: `appointment-${Date.now()}`,
          text: 'Cita agendada desde este chat.',
          date: new Date().toISOString(),
          direction: 'system'
        }
      ])
    } catch (error) {
      showToast('error', 'No se pudo agendar', 'Intenta de nuevo en unos minutos.')
      throw error
    }
  }

  const handleRequestPush = async () => {
    setRequestingPush(true)
    try {
      const result = await pushNotificationsService.subscribeToAppNotifications({
        calendarIds: pushCalendarIds
      })

      if (result.status === 'subscribed') {
        showToast('success', 'Avisos activados', 'Este celular ya puede recibir avisos de Ristak.')
      } else {
        showToast('warning', 'No se activaron', result.reason)
      }
    } catch (error: any) {
      showToast('error', 'No se activaron', error?.message || 'Intenta nuevamente.')
    } finally {
      setRequestingPush(false)
    }
  }

  const renderContacts = () => {
    if (contactsLoading) {
      return (
        <div className={styles.centerState}>
          <Loader2 size={18} className={styles.spinIcon} />
          <span>Cargando contactos...</span>
        </div>
      )
    }

    if (contactsError) {
      return (
        <div className={styles.centerState}>
          <span>{contactsError}</span>
          <button type="button" onClick={loadContacts}>Reintentar</button>
        </div>
      )
    }

    if (contacts.length === 0) {
      return (
        <div className={styles.emptyContacts}>
          <MessageCircle size={22} />
          <strong>Sin contactos por ahora</strong>
          <span>Cuando entren mensajes o guardes contactos, aparecerán aquí.</span>
        </div>
      )
    }

    return contacts.map((contact) => (
      <button
        key={contact.id}
        type="button"
        className={`${styles.contactItem} ${activeContact?.id === contact.id ? styles.contactItemActive : ''}`}
        onClick={() => handleSelectContact(contact)}
      >
        <span className={styles.avatar}>{getContactInitials(contact)}</span>
        <span className={styles.contactMain}>
          <strong>{getContactName(contact)}</strong>
          <small>{getContactDetail(contact)}</small>
        </span>
        <span className={styles.contactMeta}>{contact.createdAt ? formatMessageDate(contact.createdAt) : ''}</span>
      </button>
    ))
  }

  const renderMessages = () => {
    if (!activeContact) {
      return (
        <div className={styles.emptyConversation}>
          <MessageCircle size={34} />
          <strong>Elige un contacto</strong>
          <span>Abre una conversación para escribir, cobrar o agendar.</span>
        </div>
      )
    }

    if (messagesLoading) {
      return (
        <div className={styles.emptyConversation}>
          <Loader2 size={22} className={styles.spinIcon} />
          <span>Cargando conversación...</span>
        </div>
      )
    }

    if (messages.length === 0) {
      return (
        <div className={styles.emptyConversation}>
          <MessageCircle size={34} />
          <strong>Sin mensajes todavía</strong>
          <span>Escribe el primer mensaje o usa una acción rápida.</span>
        </div>
      )
    }

    return messages.map((message) => (
      <div
        key={message.id}
        className={`${styles.messageRow} ${styles[`messageRow_${message.direction}`]}`}
      >
        <div className={styles.messageBubble}>
          <p>{message.text}</p>
          <span>
            {formatMessageTime(message.date)}
            {message.direction === 'outbound' && (
              <Check size={13} className={message.status === 'error' ? styles.messageErrorIcon : undefined} />
            )}
          </span>
        </div>
      </div>
    ))
  }

  if (accessState === 'checking') {
    return (
      <main className={styles.loadingPage}>
        <span className={styles.loadingDot} />
      </main>
    )
  }

  if (accessState === 'blocked') {
    return (
      <main className={styles.blockedPage}>
        <section className={styles.blockedPanel} aria-labelledby="phone-chat-blocked-title">
          <div className={styles.blockedIcon} aria-hidden="true">
            <MonitorX size={28} />
          </div>
          <div className={styles.blockedCopy}>
            <p className={styles.eyebrow}>Ristak Chat</p>
            <h1 id="phone-chat-blocked-title">Solo en móvil o tablet</h1>
            <p>Esta app de chat está hecha para usarse desde el celular, como una app guardada en inicio.</p>
          </div>
          <Link className={styles.dashboardLink} to="/dashboard">
            Volver al dashboard
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className={`${styles.phoneChatPage} ${conversationOpen ? styles.conversationOpen : ''}`} aria-label="Ristak Chat móvil">
      <div className={styles.phoneFrame}>
        <header className={styles.appHeader}>
          <div className={styles.brandCluster}>
            <span className={styles.brandMark}>R</span>
            <div>
              <p>Ristak Chat</p>
              <h1>WhatsApp</h1>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.iconButton} onClick={loadContacts} aria-label="Actualizar chats">
              <RefreshCw size={18} className={contactsLoading ? styles.spinIcon : undefined} />
            </button>
            <Link className={styles.iconButton} to="/phone/agent-chat" aria-label="Abrir agente AI">
              <Bot size={18} />
            </Link>
            <button type="button" className={styles.iconButton} onClick={() => setSheet('notifications')} aria-label="Configurar avisos">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className={styles.chatShell}>
          <aside className={styles.contactPane}>
            <div className={styles.searchBox}>
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar contacto"
                aria-label="Buscar contacto"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className={styles.contactList} data-phone-chat-scrollable="true">
              {renderContacts()}
            </div>
          </aside>

          <section className={styles.conversationPane}>
            <div className={styles.conversationHeader}>
              <button type="button" className={styles.backButton} onClick={() => setConversationOpen(false)} aria-label="Volver a contactos">
                <X size={18} />
              </button>

              {activeContact ? (
                <>
                  <span className={styles.avatar}>{getContactInitials(activeContact)}</span>
                  <div className={styles.conversationIdentity}>
                    <strong>{getContactName(activeContact)}</strong>
                    <span>{getContactDetail(activeContact)}</span>
                  </div>
                </>
              ) : (
                <div className={styles.conversationIdentity}>
                  <strong>Sin contacto</strong>
                  <span>Elige una conversación</span>
                </div>
              )}

              <div className={styles.quickActions}>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('single')
                    setSheet('payment')
                  }}
                  disabled={!activeContact}
                  aria-label="Registrar pago"
                >
                  <CreditCard size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setSheet('appointment')}
                  disabled={!activeContact}
                  aria-label="Agendar cita"
                >
                  <CalendarDays size={18} />
                </button>
              </div>
            </div>

            <div className={styles.messagesPane} data-phone-chat-scrollable="true">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.composer}>
              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder={activeContact?.phone ? 'Escribe un mensaje' : 'Este contacto no tiene teléfono'}
                rows={1}
                disabled={!activeContact?.phone || composerStatus === 'sending'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSendMessage()
                  }
                }}
              />
              <button type="button" onClick={handleSendMessage} disabled={!canSendMessage} aria-label="Enviar mensaje">
                {composerStatus === 'sending' ? <Loader2 size={18} className={styles.spinIcon} /> : <Send size={18} />}
              </button>
            </div>
          </section>
        </div>
      </div>

      {sheet && (
        <div className={styles.sheetBackdrop} onClick={() => setSheet(null)}>
          <section
            className={`${styles.sheetPanel} ${sheet === 'payment' ? styles.paymentSheet : ''}`}
            onClick={(event) => event.stopPropagation()}
            aria-label="Acciones del chat"
          >
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <div>
                <p>{activeContact ? getContactName(activeContact) : 'Ristak Chat'}</p>
                <h2>
                  {sheet === 'payment' && 'Registrar pago'}
                  {sheet === 'appointment' && 'Agendar cita'}
                  {sheet === 'notifications' && 'Avisos del celular'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label={
                  sheet === 'payment'
                    ? 'Cerrar panel de pago'
                    : sheet === 'appointment'
                      ? 'Cerrar panel de cita'
                      : 'Cerrar panel de avisos'
                }
              >
                <X size={18} />
              </button>
            </div>

            {sheet === 'payment' && (
              <>
                <div className={styles.segmentedControl}>
                  <button
                    type="button"
                    className={paymentMode === 'single' ? styles.segmentActive : ''}
                    onClick={() => setPaymentMode('single')}
                  >
                    Pago único
                  </button>
                  <button
                    type="button"
                    className={paymentMode === 'partial' ? styles.segmentActive : ''}
                    onClick={() => setPaymentMode('partial')}
                  >
                    Plan de pagos
                  </button>
                </div>
                <div className={styles.embeddedPayment} data-phone-chat-scrollable="true">
                  <RecordPaymentModal
                    key={`${paymentMode}-${initialContact?.id || 'empty'}`}
                    variant="embedded"
                    isOpen
                    initialPaymentMode={paymentMode}
                    initialContact={initialContact}
                    onClose={() => setSheet(null)}
                    onSuccess={() => {
                      setSheet(null)
                      setMessages((current) => [
                        ...current,
                        {
                          id: `payment-${Date.now()}`,
                          text: 'Pago registrado desde este chat.',
                          date: new Date().toISOString(),
                          direction: 'system'
                        }
                      ])
                    }}
                  />
                </div>
              </>
            )}

            {sheet === 'appointment' && (
              <div className={styles.appointmentSetup}>
                <div className={styles.setupCard}>
                  <CalendarDays size={20} />
                  <div>
                    <strong>Calendario</strong>
                    <span>Elige dónde quieres guardar la cita.</span>
                  </div>
                </div>

                <select
                  value={selectedCalendar?.id || ''}
                  onChange={(event) => setSelectedCalendarId(event.target.value)}
                  disabled={calendars.length === 0}
                >
                  {calendars.length === 0 ? (
                    <option value="">No hay calendarios disponibles</option>
                  ) : calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>{calendar.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className={styles.primarySheetButton}
                  onClick={() => setAppointmentOpen(true)}
                  disabled={!selectedCalendar || !activeContact}
                >
                  <CalendarDays size={18} />
                  Agendar cita
                </button>
              </div>
            )}

            {sheet === 'notifications' && (
              <div className={styles.notificationsStack}>
                <section className={styles.permissionCard}>
                  <span>
                    <Smartphone size={18} />
                  </span>
                  <div>
                    <strong>Este celular</strong>
                    <small>{getNotificationPermissionLabel()}</small>
                  </div>
                  <button type="button" onClick={handleRequestPush} disabled={requestingPush}>
                    {requestingPush ? <Loader2 size={16} className={styles.spinIcon} /> : <Bell size={16} />}
                    Activar
                  </button>
                </section>

                <label className={styles.toggleRow}>
                  <span>
                    <strong>Mensajes de chat</strong>
                    <small>Avisa cuando llegue un WhatsApp nuevo.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={chatPushEnabled}
                    onChange={(event) => setChatPushEnabled(event.target.checked).catch(() => showToast('error', 'No se guardó', 'Intenta otra vez.'))}
                  />
                </label>

                <label className={styles.toggleRow}>
                  <span>
                    <strong>Citas</strong>
                    <small>Avisa cuando alguien agenda una cita.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={calendarPushEnabled}
                    onChange={(event) => setCalendarPushEnabled(event.target.checked).catch(() => showToast('error', 'No se guardó', 'Intenta otra vez.'))}
                  />
                </label>

                <label className={styles.toggleRow}>
                  <span>
                    <strong>Pagos</strong>
                    <small>Avisa cuando se registre un pago.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={paymentPushEnabled}
                    onChange={(event) => setPaymentPushEnabled(event.target.checked).catch(() => showToast('error', 'No se guardó', 'Intenta otra vez.'))}
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      )}

      <AppointmentModal
        isOpen={appointmentOpen}
        onClose={() => setAppointmentOpen(false)}
        mode="create"
        calendar={selectedCalendar}
        defaultStart={defaultAppointmentRange.start}
        defaultEnd={defaultAppointmentRange.end}
        defaultTimeZone={defaultAppointmentRange.timeZone}
        defaultTitle={initialContact?.name || ''}
        initialContact={initialContact}
        defaultScheduleMode="default"
        accessToken={accessToken || undefined}
        locationId={locationId || undefined}
        presentation="mobileSheet"
        onSave={handleCreateAppointment}
      />
    </main>
  )
}
