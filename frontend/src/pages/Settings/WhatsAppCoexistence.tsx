import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card } from '@/components/common'
import { useNotification } from '@/contexts/NotificationContext'
import {
  CheckCircle,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  XCircle
} from 'lucide-react'
import { SiWhatsapp } from 'react-icons/si'
import {
  whatsappService,
  type WhatsAppConfig,
  type WhatsAppStorageSummary
} from '@/services/whatsappService'
import styles from './WhatsAppCoexistence.module.css'

type EmbeddedSignupPayload = {
  type?: string
  event?: string
  version?: number
  data?: Record<string, unknown>
}

type FacebookLoginResponse = {
  authResponse?: {
    code?: string
    accessToken?: string
    userID?: string
    expiresIn?: string
    signedRequest?: string
  }
  status?: string
}

const DEFAULT_GRAPH_VERSION = 'v23.0'
const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding'
const COEXISTENCE_FINISH_EVENT = 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'

const emptyConfig: WhatsAppConfig = {
  configured: false,
  appId: '',
  appSecret: '',
  appSecretConfigured: false,
  embeddedSignupConfigId: '',
  graphApiVersion: DEFAULT_GRAPH_VERSION,
  webhookVerifyToken: '',
  webhookVerifyTokenConfigured: false,
  callbackUrl: '',
  businessToken: '',
  businessTokenConfigured: false,
  wabaId: '',
  phoneNumberId: '',
  displayPhoneNumber: '',
  verifiedName: '',
  qualityRating: '',
  platformType: '',
  isOnBizApp: false,
  connectionStatus: 'not_configured',
  onboardingEvent: '',
  connectedAt: null,
  lastExchangeAt: null,
  lastVerifiedAt: null,
  coexistenceFeatureType: COEXISTENCE_FEATURE_TYPE,
  finishEvent: COEXISTENCE_FINISH_EVENT
}

const emptyStorage: WhatsAppStorageSummary = {
  phoneNumbers: 0,
  contacts: 0,
  chats: 0,
  messages: 0,
  webhookEvents: 0
}

function buildDefaultCallbackUrl() {
  if (typeof window === 'undefined') return '/webhook/whatsapp'
  return `${window.location.origin}/webhook/whatsapp`
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'connected':
      return 'Conectado'
    case 'ready_to_connect':
      return 'Listo para conectar'
    case 'token_exchanged':
      return 'Token intercambiado'
    case 'signup_event_received':
      return 'Evento recibido'
    default:
      return 'No configurado'
  }
}

function getStatusClassName(status: string) {
  if (status === 'connected') return styles.statusConnected
  if (status === 'ready_to_connect' || status === 'token_exchanged' || status === 'signup_event_received') {
    return styles.statusWarning
  }
  return styles.statusDisconnected
}

function hasFinishEvent(payload: EmbeddedSignupPayload | null) {
  return payload?.event === COEXISTENCE_FINISH_EVENT || payload?.event === 'FINISH'
}

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!appId) {
      reject(new Error('App ID requerido'))
      return
    }

    const initialize = () => {
      if (!window.FB) {
        reject(new Error('Facebook SDK no disponible'))
        return
      }

      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version
      })
      resolve()
    }

    if (window.FB) {
      initialize()
      return
    }

    window.fbAsyncInit = initialize

    if (document.getElementById('facebook-jssdk')) {
      const startedAt = Date.now()
      const interval = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(interval)
          initialize()
        } else if (Date.now() - startedAt > 8000) {
          window.clearInterval(interval)
          reject(new Error('Facebook SDK no respondió'))
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('No se pudo cargar Facebook SDK'))
    document.body.appendChild(script)
  })
}

export const WhatsAppCoexistence: React.FC = () => {
  const { showToast } = useNotification()
  const [config, setConfig] = useState<WhatsAppConfig>(emptyConfig)
  const [storage, setStorage] = useState<WhatsAppStorageSummary>(emptyStorage)
  const [form, setForm] = useState({
    appId: '',
    appSecret: '',
    embeddedSignupConfigId: '',
    graphApiVersion: DEFAULT_GRAPH_VERSION,
    webhookVerifyToken: '',
    callbackUrl: buildDefaultCallbackUrl()
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sessionPayload, setSessionPayload] = useState<EmbeddedSignupPayload | null>(null)
  const pendingCodeRef = useRef<string>('')
  const sessionPayloadRef = useRef<EmbeddedSignupPayload | null>(null)
  const completedCodeRef = useRef<string>('')

  const setupSteps = useMemo(() => ([
    { label: 'Meta App', done: Boolean(form.appId && (form.appSecret || config.appSecretConfigured)) },
    { label: 'Login config', done: Boolean(form.embeddedSignupConfigId) },
    { label: 'Webhook', done: Boolean(form.webhookVerifyToken || config.webhookVerifyTokenConfigured) },
    { label: 'Coexistence', done: config.connectionStatus === 'connected' }
  ]), [config.appSecretConfigured, config.connectionStatus, config.webhookVerifyTokenConfigured, form])

  const completedSteps = setupSteps.filter(step => step.done).length
  const canLaunchSignup = Boolean(
    config.configured &&
    form.appId &&
    form.embeddedSignupConfigId &&
    (form.appSecret || config.appSecretConfigured)
  )

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    const handleEmbeddedSignupMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return

      let payload: EmbeddedSignupPayload | null = null
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        payload = null
      }

      if (!payload || payload.type !== 'WA_EMBEDDED_SIGNUP') return

      setSessionPayload(payload)
      sessionPayloadRef.current = payload

      if (payload.event === 'CANCEL') {
        whatsappService.completeEmbeddedSignup({
          code: '',
          sessionPayload: payload as Record<string, unknown>,
          responsePayload: {}
        }).catch(() => undefined)

        const errorMessage = typeof payload.data?.error_message === 'string'
          ? payload.data.error_message
          : 'El flujo de Meta se canceló antes de terminar'
        showToast('warning', 'Flujo cancelado', errorMessage)
        return
      }

      if (hasFinishEvent(payload) && pendingCodeRef.current) {
        finalizeSignup(pendingCodeRef.current, payload, { source: 'message_event' })
      }
    }

    window.addEventListener('message', handleEmbeddedSignupMessage)
    return () => window.removeEventListener('message', handleEmbeddedSignupMessage)
  }, [])

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const response = await whatsappService.getConfig()
      applyConfigResponse(response.config, response.storage)
    } catch (error) {
      showToast('error', 'Error', 'No se pudo cargar WhatsApp API')
    } finally {
      setIsLoading(false)
    }
  }

  const applyConfigResponse = (nextConfig: WhatsAppConfig, nextStorage?: WhatsAppStorageSummary) => {
    setConfig(nextConfig)
    if (nextStorage) setStorage(nextStorage)
    setForm({
      appId: nextConfig.appId || '',
      appSecret: nextConfig.appSecret || '',
      embeddedSignupConfigId: nextConfig.embeddedSignupConfigId || '',
      graphApiVersion: nextConfig.graphApiVersion || DEFAULT_GRAPH_VERSION,
      webhookVerifyToken: nextConfig.webhookVerifyToken || '',
      callbackUrl: nextConfig.callbackUrl || buildDefaultCallbackUrl()
    })
  }

  const handleInputChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.appId || !form.embeddedSignupConfigId) {
      showToast('error', 'Datos incompletos', 'App ID y Configuration ID son requeridos')
      return
    }

    if (!form.appSecret && !config.appSecretConfigured) {
      showToast('error', 'App Secret requerido', 'Guarda el App Secret de Meta Developers')
      return
    }

    if (!form.webhookVerifyToken && !config.webhookVerifyTokenConfigured) {
      showToast('error', 'Verify token requerido', 'Define el token que usarás en el webhook de Meta')
      return
    }

    setIsSaving(true)
    try {
      const saved = await whatsappService.saveConfig(form)
      setConfig(saved)
      setForm(prev => ({
        ...prev,
        appSecret: saved.appSecret || prev.appSecret,
        webhookVerifyToken: saved.webhookVerifyToken || prev.webhookVerifyToken,
        graphApiVersion: saved.graphApiVersion || prev.graphApiVersion
      }))
      showToast('success', 'WhatsApp guardado', 'Configuración lista para Embedded Signup')
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const finalizeSignup = async (
    code: string,
    payload: EmbeddedSignupPayload | null,
    responsePayload: Record<string, unknown>
  ) => {
    if (!code || completedCodeRef.current === code) return
    completedCodeRef.current = code
    setIsCompleting(true)

    try {
      const result = await whatsappService.completeEmbeddedSignup({
        code,
        sessionPayload: (payload || {}) as Record<string, unknown>,
        responsePayload
      })
      applyConfigResponse(result.config, result.storage)
      pendingCodeRef.current = ''

      if (result.config.connectionStatus === 'connected') {
        showToast('success', 'Número conectado', 'WhatsApp quedó conectado en modo Coexistence')
      } else {
        showToast('warning', 'Revisa Meta', 'El token se guardó, pero falta confirmar WABA o Phone Number ID')
      }
    } catch (error) {
      completedCodeRef.current = ''
      showToast('error', 'Error de conexión', error instanceof Error ? error.message : 'Meta no completó la conexión')
    } finally {
      setIsCompleting(false)
      setIsLaunching(false)
    }
  }

  const handleLaunchSignup = async () => {
    if (!canLaunchSignup) {
      showToast('error', 'Guarda primero', 'Completa y guarda la configuración de Meta Developers')
      return
    }

    setIsLaunching(true)
    pendingCodeRef.current = ''
    completedCodeRef.current = ''
    sessionPayloadRef.current = null
    setSessionPayload(null)

    try {
      await loadFacebookSdk(form.appId, form.graphApiVersion)
      window.FB.login((response: FacebookLoginResponse) => {
        const code = response.authResponse?.code
        if (!code) {
          setIsLaunching(false)
          showToast('warning', 'Sin código', 'Meta no regresó el code de Embedded Signup')
          return
        }

        pendingCodeRef.current = code
        const latestSession = sessionPayloadRef.current
        if (hasFinishEvent(latestSession)) {
          finalizeSignup(code, latestSession, response as Record<string, unknown>)
          return
        }

        window.setTimeout(() => {
          if (pendingCodeRef.current === code && completedCodeRef.current !== code) {
            finalizeSignup(code, sessionPayloadRef.current, response as Record<string, unknown>)
          }
        }, 2500)
      }, {
        config_id: form.embeddedSignupConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: COEXISTENCE_FEATURE_TYPE
        }
      })
    } catch (error) {
      setIsLaunching(false)
      showToast('error', 'Facebook SDK', error instanceof Error ? error.message : 'No se pudo abrir Meta')
    }
  }

  const handleRefreshStatus = async () => {
    setIsRefreshing(true)
    try {
      const result = await whatsappService.refreshStatus()
      applyConfigResponse(result.config, result.storage)
      showToast('success', 'Estado actualizado', 'Se consultó el número en Meta')
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'No se pudo consultar Meta')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showToast('success', 'Copiado', label)
    } catch {
      showToast('error', 'Error', 'No se pudo copiar')
    }
  }

  return (
    <div className={styles.container}>
      <Card className={styles.mainCard}>
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerLeft}>
              <span className={styles.logoMark} aria-hidden="true">
                <SiWhatsapp size={26} />
              </span>
              <div>
                <h2 className={styles.pageTitle}>WhatsApp API Coexistence</h2>
                <p className={styles.pageSubtitle}>
                  Conecta un numero de WhatsApp Business App a Cloud API sin mezclar datos con CRM.
                </p>
              </div>
            </div>
            <div className={styles.headerRight}>
              <div className={getStatusClassName(config.connectionStatus)}>
                {config.connectionStatus === 'connected' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span>{getStatusLabel(config.connectionStatus)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.workspace}>
          <div className={styles.primaryColumn}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Meta Developers</h3>
                  <p className={styles.sectionDescription}>
                    App, login configuration y webhook para Embedded Signup.
                  </p>
                </div>
                <span className={styles.stepCount}>{completedSteps}/4 listo</span>
              </div>

              <div className={styles.progressList}>
                {setupSteps.map((step, index) => (
                  <div key={step.label} className={`${styles.progressItem} ${step.done ? styles.progressDone : ''}`}>
                    <span className={styles.progressDot}>{step.done ? <CheckCircle size={13} /> : index + 1}</span>
                    <span className={styles.progressLabel}>{step.label}</span>
                  </div>
                ))}
              </div>

              {isLoading ? (
                <div className={styles.loadingState}>Cargando WhatsApp API...</div>
              ) : (
                <div className={styles.formGrid}>
                  <label className={styles.formGroup}>
                    <span className={styles.formLabel}>Meta App ID</span>
                    <input
                      className={styles.formInput}
                      value={form.appId}
                      onChange={(event) => handleInputChange('appId', event.target.value)}
                      placeholder="123456789012345"
                    />
                  </label>

                  <label className={styles.formGroup}>
                    <span className={styles.formLabel}>App Secret</span>
                    <input
                      className={styles.formInput}
                      value={form.appSecret}
                      onChange={(event) => handleInputChange('appSecret', event.target.value)}
                      placeholder="Pega el App Secret"
                      type="password"
                    />
                  </label>

                  <label className={styles.formGroup}>
                    <span className={styles.formLabel}>Configuration ID</span>
                    <input
                      className={styles.formInput}
                      value={form.embeddedSignupConfigId}
                      onChange={(event) => handleInputChange('embeddedSignupConfigId', event.target.value)}
                      placeholder="Facebook Login for Business configuration"
                    />
                  </label>

                  <label className={styles.formGroup}>
                    <span className={styles.formLabel}>Graph API Version</span>
                    <input
                      className={styles.formInput}
                      value={form.graphApiVersion}
                      onChange={(event) => handleInputChange('graphApiVersion', event.target.value)}
                      placeholder="v23.0"
                    />
                  </label>

                  <label className={`${styles.formGroup} ${styles.formGroupWide}`}>
                    <span className={styles.formLabel}>Webhook verify token</span>
                    <input
                      className={styles.formInput}
                      value={form.webhookVerifyToken}
                      onChange={(event) => handleInputChange('webhookVerifyToken', event.target.value)}
                      placeholder="Token privado para verificar el webhook"
                    />
                  </label>

                  <label className={`${styles.formGroup} ${styles.formGroupWide}`}>
                    <span className={styles.formLabel}>Webhook callback URL</span>
                    <div className={styles.inputActionRow}>
                      <input
                        className={styles.formInput}
                        value={form.callbackUrl}
                        onChange={(event) => handleInputChange('callbackUrl', event.target.value)}
                      />
                      <Button type="button" variant="secondary" onClick={() => handleCopy(form.callbackUrl, 'Webhook URL copiado')}>
                        <Copy size={16} />
                        Copiar
                      </Button>
                    </div>
                  </label>
                </div>
              )}

              <div className={styles.actions}>
                <Button type="button" variant="secondary" onClick={handleSave} disabled={isSaving || isLoading}>
                  <KeyRound size={16} className={isSaving ? styles.spinning : ''} />
                  {isSaving ? 'Guardando...' : 'Guardar configuración'}
                </Button>
                <Button type="button" variant="primary" onClick={handleLaunchSignup} disabled={!canLaunchSignup || isLaunching || isCompleting}>
                  <Link2 size={16} className={isLaunching || isCompleting ? styles.spinning : ''} />
                  {isCompleting ? 'Conectando...' : 'Conectar número Coexistence'}
                </Button>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Estructura WhatsApp separada</h3>
                  <p className={styles.sectionDescription}>
                    Almacenamiento dedicado para preparar chats, mensajes, contactos, numeros y webhooks.
                  </p>
                </div>
              </div>

              <div className={styles.storageGrid}>
                <div className={styles.storageItem}>
                  <span className={styles.storageValue}>{storage.phoneNumbers}</span>
                  <span className={styles.storageLabel}>Números</span>
                </div>
                <div className={styles.storageItem}>
                  <span className={styles.storageValue}>{storage.contacts}</span>
                  <span className={styles.storageLabel}>Contactos WA</span>
                </div>
                <div className={styles.storageItem}>
                  <span className={styles.storageValue}>{storage.chats}</span>
                  <span className={styles.storageLabel}>Chats</span>
                </div>
                <div className={styles.storageItem}>
                  <span className={styles.storageValue}>{storage.messages}</span>
                  <span className={styles.storageLabel}>Mensajes</span>
                </div>
                <div className={styles.storageItem}>
                  <span className={styles.storageValue}>{storage.webhookEvents}</span>
                  <span className={styles.storageLabel}>Webhooks</span>
                </div>
              </div>
            </section>
          </div>

          <div className={styles.sideColumn}>
            <section className={styles.section}>
              <div className={styles.numberHeader}>
                <span className={styles.numberIcon} aria-hidden="true">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <h3 className={styles.sectionTitle}>Número conectado</h3>
                  <p className={styles.sectionDescription}>Estado leído desde WhatsApp Business Platform.</p>
                </div>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span>WABA ID</span>
                  <strong>{config.wabaId || 'Pendiente'}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Phone Number ID</span>
                  <strong>{config.phoneNumberId || 'Pendiente'}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Número</span>
                  <strong>{config.displayPhoneNumber || 'Pendiente'}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Nombre</span>
                  <strong>{config.verifiedName || 'Pendiente'}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Coexistence</span>
                  <strong>{config.isOnBizApp ? 'Activo' : 'Sin confirmar'}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Platform</span>
                  <strong>{config.platformType || 'Pendiente'}</strong>
                </div>
              </div>

              <Button type="button" variant="secondary" onClick={handleRefreshStatus} disabled={!config.businessTokenConfigured || isRefreshing} fullWidth>
                <RefreshCw size={16} className={isRefreshing ? styles.spinning : ''} />
                {isRefreshing ? 'Consultando...' : 'Actualizar estado'}
              </Button>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Campos webhook</h3>
                  <p className={styles.sectionDescription}>Actívalos en WhatsApp &gt; Configuration.</p>
                </div>
              </div>

              <div className={styles.fieldPills}>
                <span>messages</span>
                <span>message_template_status_update</span>
                <span>account_update</span>
                <span>history</span>
                <span>smb_app_state_sync</span>
                <span>smb_message_echoes</span>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.docsList}>
                <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation" target="_blank" rel="noopener noreferrer">
                  Embedded Signup
                  <ExternalLink size={14} />
                </a>
                <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users" target="_blank" rel="noopener noreferrer">
                  Coexistence
                  <ExternalLink size={14} />
                </a>
              </div>
            </section>

            {sessionPayload && (
              <section className={styles.section}>
                <div className={styles.infoRow}>
                  <span>Último evento</span>
                  <strong>{sessionPayload.event || 'WA_EMBEDDED_SIGNUP'}</strong>
                </div>
              </section>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
