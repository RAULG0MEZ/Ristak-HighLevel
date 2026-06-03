import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components/common'
import { Check, Copy, Info, Loader2, RefreshCw, Activity } from 'lucide-react'
import { trackingService } from '@/services/trackingService'
import { useNotification } from '@/contexts/NotificationContext'
import { useAppConfig } from '@/hooks'
import styles from './HighLevelIntegration.module.css'

export const WebTracking: React.FC = () => {
  const { showToast } = useNotification()

  // Sistema híbrido de configuración (cache + DB)
  // Defaults: false y 'platform' hasta que se configure dominio personalizado
  const [showAnalytics, setShowAnalytics] = useAppConfig('show_analytics', false)
  const [visitorSource, setVisitorSource] = useAppConfig<'platform' | 'tracking'>('visitor_source', 'platform')

  const [trackingDomain, setTrackingDomain] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [configuringTracking, setConfiguringTracking] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [hasHighLevel, setHasHighLevel] = useState(false)
  const [hasAutoActivated, setHasAutoActivated] = useState(false)
  const [trackingSnippet, setTrackingSnippet] = useState('')

  useEffect(() => {
    loadTrackingConfig()
  }, [])

  const loadTrackingConfig = async () => {
    setLoadingConfig(true)
    try {
      const config = await trackingService.getTrackingConfig()
      setTrackingDomain(config.trackingDomain || '')
      setIsConfigured(config.isConfigured)
      setHasHighLevel(config.hasHighLevel)
      setTrackingSnippet(config.trackingSnippet || '')

      // Activación automática cuando hay dominio de tracking configurado
      if (config.trackingDomain && !hasAutoActivated) {
        if (!showAnalytics) {
          await setShowAnalytics(true)
        }
        if (visitorSource !== 'tracking') {
          await setVisitorSource('tracking')
        }
        setHasAutoActivated(true)

        // Disparar eventos para actualizar el sidebar
        window.dispatchEvent(new CustomEvent('analytics-preference-changed', {
          detail: { showAnalytics: true }
        }))
        window.dispatchEvent(new CustomEvent('visitor-source-changed', {
          detail: { visitorSource: 'tracking' }
        }))
      }
    } catch (error) {
      showToast('error', 'Error', 'No se pudo cargar la configuración del tracking')
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleConfigureTracking = async () => {
    setConfiguringTracking(true)
    try {
      const response = await trackingService.configureTracking()
      if (response.snippet) {
        setTrackingSnippet(response.snippet)
      }
      setIsConfigured(true)
      showToast('success', 'Sincronización exitosa', 'El código del pixel se guardó en HighLevel como "rstktrack"')
    } catch (error) {
      showToast('error', 'Error al sincronizar', 'No se pudo guardar el código en HighLevel')
    } finally {
      setConfiguringTracking(false)
    }
  }

  const handleCopyTrackingSnippet = async () => {
    if (!trackingSnippet) return

    try {
      await navigator.clipboard.writeText(trackingSnippet)
      showToast('success', 'Código copiado', 'Pégalo en los headers del sitio correspondiente')
    } catch (error) {
      showToast('error', 'Error', 'No se pudo copiar el código del pixel')
    }
  }

  return (
    <div className={styles.integrationContainer}>
      <Card className={styles.mainCard}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerLeft}>
              <div className={styles.logoContainer}>
                <Activity size={40} color="var(--color-primary)" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h1 className={styles.pageTitle}>Rastreo Web</h1>
                </div>
                <p className={styles.pageSubtitle}>
                  Captura visitas, UTMs y atribución de campañas
                </p>
              </div>
            </div>
            <div className={styles.headerRight}>
              {loadingConfig ? (
                <div className={styles.statusConnected}>
                  <Loader2 size={16} className={styles.spinIcon} />
                  <span>Verificando...</span>
                </div>
              ) : isConfigured ? (
                <div className={styles.statusConnected}>
                  <Check size={16} />
                  <span>Configurado</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Configuración */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Configuración Rápida</h3>
            <p className={styles.sectionSubtitle} style={{ marginTop: '4px', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Sigue 3 pasos simples para activar el tracking
            </p>
          </div>

          {!trackingDomain.trim() ? (
            <div className={styles.warningBox}>
              <div className={styles.infoBoxTitle}>
                <Info size={16} />
                <span>Paso 1: Configurar CNAME</span>
              </div>
              <div className={styles.infoBoxContent}>
                Ve a tu proveedor de DNS (Cloudflare, GoDaddy, etc.) y crea un CNAME:
              </div>
              <div className={styles.codeBlock} style={{ marginTop: '12px', padding: '12px', fontSize: '0.875rem' }}>
                <div><strong>Tipo:</strong> CNAME</div>
                <div><strong>Nombre:</strong> collect</div>
                <div><strong>Apunta a:</strong> ristak-app.onrender.com</div>
              </div>
              <div className={styles.infoBoxContent} style={{ marginTop: '12px' }}>
                Luego accede a esta página usando <code className={styles.codeInline}>collect.tudominio.com</code>
              </div>
            </div>
          ) : (
            <>
              {/* Paso 1: Dominio detectado */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Paso 1: Dominio configurado
                </label>
                <div className={`${styles.formInput} ${styles.readonlyValue}`} style={{ cursor: 'default' }}>
                  {trackingDomain}
                </div>
              </div>

              {/* Paso 2: Sincronizar */}
              <div className={styles.formGroup} style={{ marginTop: '24px' }}>
                <label className={styles.formLabel}>
                  Paso 2: Sincronizar con HighLevel
                </label>
                {hasHighLevel ? (
                  <>
                    <p className={styles.formHint} style={{ marginBottom: '12px' }}>
                      Esto guarda el código del pixel en HighLevel automáticamente
                    </p>
                    <Button
                      variant="primary"
                      onClick={handleConfigureTracking}
                      disabled={configuringTracking}
                    >
                      {configuringTracking ? (
                        <>
                          <Loader2 size={16} className={styles.spinIcon} />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} />
                          {isConfigured ? 'Volver a sincronizar' : 'Sincronizar ahora'}
                        </>
                      )}
                    </Button>
                    {isConfigured && (
                      <p className={styles.formHint} style={{ marginTop: '12px' }}>
                        Ya está sincronizado. El código está guardado como rstktrack en HighLevel
                      </p>
                    )}
                  </>
                ) : (
                  <div className={styles.infoBox}>
                    <div className={styles.infoBoxTitle}>
                      <Info size={16} />
                      <span>HighLevel no está conectado</span>
                    </div>
                    <div className={styles.infoBoxContent}>
                      Puedes conectar HighLevel para sincronizar automático o usar el código manual de abajo.
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.manualInstallDivider} aria-hidden="true">
                <span>O</span>
              </div>

              <div className={styles.manualSnippetBox}>
                <div className={styles.manualSnippetHeader}>
                  <div>
                    <label className={styles.formLabel}>
                      Código de píxel web
                    </label>
                    <p className={styles.formHint}>
                      Copia este código y pégalo en los headers de la página correspondiente.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyTrackingSnippet}
                    disabled={!trackingSnippet}
                  >
                    <Copy size={16} />
                    Copiar código
                  </Button>
                </div>
                <pre className={styles.manualSnippetCode}><code>{trackingSnippet || 'Cargando código del pixel...'}</code></pre>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
