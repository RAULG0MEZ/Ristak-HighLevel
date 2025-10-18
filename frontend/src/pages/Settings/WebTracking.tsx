import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components/common'
import {
  Activity,
  Copy,
  Check,
  Info,
  Globe,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { trackingService, TrackingSession } from '@/services/trackingService'
import { useNotification } from '@/contexts/NotificationContext'
import styles from './HighLevelIntegration.module.css'

export const WebTracking: React.FC = () => {
  const { showToast } = useNotification()
  const [trackingDomain, setTrackingDomain] = useState('')
  const [copied, setCopied] = useState(false)
  const [recentSessions, setRecentSessions] = useState<TrackingSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [configuringTracking, setConfiguringTracking] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [hasHighLevel, setHasHighLevel] = useState(false)

  useEffect(() => {
    loadTrackingConfig()
    loadRecentSessions()
  }, [])

  const loadTrackingConfig = async () => {
    setLoadingConfig(true)
    try {
      const config = await trackingService.getTrackingConfig()
      setTrackingDomain(config.trackingDomain || '')
      setIsConfigured(config.isConfigured)
      setHasHighLevel(config.hasHighLevel)
    } catch (error) {
      showToast('error', 'Error', 'No se pudo cargar la configuración del tracking')
    } finally {
      setLoadingConfig(false)
    }
  }

  const loadRecentSessions = async () => {
    setLoadingSessions(true)
    try {
      const sessions = await trackingService.getSessions(50) // Aumentamos a 50 para ver más datos
      setRecentSessions(sessions)
    } catch (error) {
      // Silent error
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleConfigureTracking = async () => {
    if (!hasHighLevel) {
      showToast('error', 'Error', 'Primero configura HighLevel en Settings')
      return
    }

    // Validar que el dominio contenga "collect"
    if (!trackingDomain.includes('collect')) {
      showToast(
        'error',
        'Dominio inválido',
        'El dominio debe contener "collect" (ej: collect.tudominio.com). Configura el CNAME en tu DNS primero.'
      )
      return
    }

    setConfiguringTracking(true)
    try {
      const result = await trackingService.configureTracking()

      if (result.success) {
        showToast('success', '¡Listo!', 'Custom value actualizado en HighLevel')
        setIsConfigured(true)
        // Recargar config para actualizar estado
        await loadTrackingConfig()
      } else {
        showToast('error', 'Error', result.error || 'No se pudo configurar')
      }
    } catch (error: any) {
      showToast('error', 'Error', error.message || 'Error configurando')
    } finally {
      setConfiguringTracking(false)
    }
  }

  const handleCopySnippet = async () => {
    if (!trackingDomain.trim()) {
      showToast('error', 'Error', 'Ingresa tu dominio primero')
      return
    }

    const snippet = trackingService.generateSnippet(trackingDomain)
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      showToast('success', 'Copiado', 'Código copiado al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast('error', 'Error', 'No se pudo copiar')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
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
                <h1 className={styles.pageTitle}>Web Tracking</h1>
                <p className={styles.pageSubtitle}>
                  Captura visitas, UTMs y atribución de campañas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuración */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Configuración</h3>
          </div>

          {loadingConfig ? (
            <div className={styles.loadingState}>
              <Loader2 size={24} className={styles.spinIcon} />
              <p>Cargando configuración...</p>
            </div>
          ) : (
            <>
              {/* Instrucción importante: Usar subdominio collect */}
              {!trackingDomain.includes('collect') && (
                <div className={styles.warningBox} style={{ marginBottom: '16px' }}>
                  <div className={styles.infoBoxTitle}>
                    <Info size={16} />
                    <span>Configuración requerida</span>
                  </div>
                  <div className={styles.infoBoxContent}>
                    Para configurar el tracking, accede usando el subdominio <code className={styles.codeInline}>collect.tudominio.com</code>
                  </div>
                  <div className={styles.infoBoxContent} style={{ marginTop: '8px' }}>
                    Configura un CNAME en tu DNS: <code className={styles.codeInline}>collect</code> → <code className={styles.codeInline}>ristak-app.onrender.com</code>
                  </div>
                </div>
              )}

              {/* Dominio detectado */}
              {trackingDomain && (
                <div className={styles.infoBox} style={{ marginBottom: '16px' }}>
                  <div className={styles.infoBoxTitle}>
                    <Globe size={16} />
                    <span>Dominio detectado</span>
                  </div>
                  <div className={styles.infoBoxContent}>
                    <code className={styles.codeInline}>{trackingDomain}</code>
                  </div>
                </div>
              )}

              {/* Estado */}
              {isConfigured ? (
                <div className={styles.successBox} style={{ marginBottom: '16px' }}>
                  <div className={styles.infoBoxTitle}>
                    <Check size={16} />
                    <span>Tracking configurado</span>
                  </div>
                  <div className={styles.infoBoxContent}>
                    Usa <code className={styles.codeInline}>{'{{ custom_values.rstktrack }}'}</code> en el <code className={styles.codeInline}>&lt;head&gt;</code> de tu sitio
                  </div>
                </div>
              ) : (
                <div className={styles.infoBox} style={{ marginBottom: '16px' }}>
                  <div className={styles.infoBoxTitle}>
                    <Info size={16} />
                    <span>Configuración pendiente</span>
                  </div>
                  <div className={styles.infoBoxContent}>
                    Sincroniza para crear el custom value <code className={styles.codeInline}>rstktrack</code> en HighLevel
                  </div>
                </div>
              )}

              {/* Botón de sincronización - SIEMPRE visible */}
              <Button
                variant="primary"
                onClick={handleConfigureTracking}
                disabled={configuringTracking || !hasHighLevel || !trackingDomain.includes('collect')}
              >
                {configuringTracking ? (
                  <>
                    <Loader2 size={16} className={styles.spinIcon} />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {isConfigured ? 'Volver a sincronizar' : 'Sincronizar con HighLevel'}
                  </>
                )}
              </Button>

              {/* Mensajes de ayuda */}
              {!hasHighLevel && (
                <p className={styles.formHint} style={{ marginTop: '8px', color: 'var(--color-warning)' }}>
                  ⚠️ Primero configura HighLevel en Settings
                </p>
              )}
              {hasHighLevel && !trackingDomain.includes('collect') && (
                <p className={styles.formHint} style={{ marginTop: '8px', color: 'var(--color-warning)' }}>
                  ⚠️ El dominio debe contener "collect" (ej: collect.tudominio.com)
                </p>
              )}

              {/* Código del pixel */}
              {trackingDomain && (
                <div style={{ marginTop: '24px' }}>
                  <label className={styles.formLabel}>Código del pixel</label>
                  <div className={styles.codeBlockWrapper}>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={handleCopySnippet}
                      className={styles.copyButton}
                    >
                      {copied ? (
                        <>
                          <Check size={14} />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copiar
                        </>
                      )}
                    </Button>
                    <div className={styles.codeBlock}>
                      <pre className={styles.codeContent}>
                        {trackingService.generateSnippet(trackingDomain)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Tabla de eventos de tracking */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Eventos de Tracking</h3>
            <Button
              variant="ghost"
              size="small"
              onClick={loadRecentSessions}
              disabled={loadingSessions}
            >
              <RefreshCw size={16} className={loadingSessions ? styles.spinIcon : ''} />
              {loadingSessions ? 'Cargando...' : 'Actualizar'}
            </Button>
          </div>

          {recentSessions.length > 0 ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Visitor ID</th>
                    <th>Contact ID</th>
                    <th>Fecha</th>
                    <th>Landing URL</th>
                    <th>Referrer</th>
                    <th>UTM Source</th>
                    <th>UTM Medium</th>
                    <th>UTM Campaign</th>
                    <th>GCLID</th>
                    <th>FBCLID</th>
                    <th>Device</th>
                    <th>IP</th>
                    <th>Páginas</th>
                    <th>Eventos</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((session) => (
                    <tr key={session.session_id}>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>
                          {session.session_id?.substring(0, 8)}...
                        </code>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>
                          {session.visitor_id?.substring(0, 8)}...
                        </code>
                      </td>
                      <td>
                        {session.contact_id ? (
                          <code style={{ fontSize: '0.75rem' }}>
                            {session.contact_id.substring(0, 8)}...
                          </code>
                        ) : '-'}
                      </td>
                      <td className={styles.tableDateCell}>
                        {formatDate(session.started_at)}
                      </td>
                      <td className={styles.tableLinkCell} style={{ maxWidth: '200px' }}>
                        <a href={session.landing_url} target="_blank" rel="noopener noreferrer">
                          {session.landing_url}
                        </a>
                      </td>
                      <td style={{ fontSize: '0.813rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.referrer_url || '-'}
                      </td>
                      <td>{session.utm_source || '-'}</td>
                      <td>{session.utm_medium || '-'}</td>
                      <td>{session.utm_campaign || '-'}</td>
                      <td>
                        {session.gclid ? (
                          <code style={{ fontSize: '0.75rem' }}>
                            {session.gclid.substring(0, 8)}...
                          </code>
                        ) : '-'}
                      </td>
                      <td>
                        {session.fbclid ? (
                          <code style={{ fontSize: '0.75rem' }}>
                            {session.fbclid.substring(0, 8)}...
                          </code>
                        ) : '-'}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {session.device_type || '-'}
                      </td>
                      <td style={{ fontSize: '0.813rem' }}>
                        {session.ip || '-'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 500 }}>
                        {session.pageviews_count || 0}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 500 }}>
                        {session.events_count || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Activity size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>No hay eventos capturados</p>
              <p className={styles.emptyStateHint}>
                Instala el pixel para empezar a capturar datos
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
