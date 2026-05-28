import React, { useEffect, useState } from 'react'
import { Bot, CheckCircle, Database, Eye, EyeOff, KeyRound, PanelRight, Sparkles, Trash2, XCircle } from 'lucide-react'
import { Button, Card } from '@/components/common'
import { useNotification } from '@/contexts/NotificationContext'
import { aiAgentService, type AIAgentConfigStatus } from '@/services/aiAgentService'
import styles from './AIAgentSettings.module.css'

const emptyStatus: AIAgentConfigStatus = {
  configured: false,
  model: 'gpt-5.2',
  tokenPreview: null,
  updatedAt: null
}

export const AIAgentSettings: React.FC = () => {
  const { showToast, showConfirm } = useNotification()
  const [status, setStatus] = useState<AIAgentConfigStatus>(emptyStatus)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const emitConfigChange = (nextStatus: AIAgentConfigStatus) => {
    window.dispatchEvent(new CustomEvent('ai-agent-config-changed', {
      detail: nextStatus
    }))
  }

  const loadStatus = async () => {
    setLoading(true)
    try {
      const nextStatus = await aiAgentService.getConfig()
      setStatus(nextStatus)
    } catch (error: any) {
      showToast('error', 'Error', error?.message || 'No se pudo cargar el estado del agente AI')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleSave = async () => {
    if (!apiKey.trim()) {
      showToast('warning', 'Token requerido', 'Pega una API Key válida de OpenAI')
      return
    }

    setSaving(true)
    try {
      const nextStatus = await aiAgentService.saveConfig(apiKey.trim())
      setStatus(nextStatus)
      setApiKey('')
      setShowApiKey(false)
      emitConfigChange(nextStatus)
      showToast('success', 'Agente AI listo', 'El panel lateral ya está disponible en la app')
    } catch (error: any) {
      showToast('error', 'No se pudo conectar OpenAI', error?.message || 'Revisa el API Token')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      await aiAgentService.deleteConfig()
      setStatus(emptyStatus)
      setApiKey('')
      emitConfigChange(emptyStatus)
      showToast('success', 'Agente AI desconectado', 'El panel lateral fue ocultado')
    } catch (error: any) {
      showToast('error', 'Error', error?.message || 'No se pudo desconectar el agente AI')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleDisconnect = () => {
    showConfirm(
      'Desconectar Agente AI',
      'Se eliminará el token guardado y el panel lateral dejará de aparecer en la app.',
      disconnect,
      'Desconectar',
      'Cancelar'
    )
  }

  return (
    <div className={styles.container}>
      <Card>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBox}>
              <Bot size={22} />
            </div>
            <div>
              <h2 className={styles.title}>Agente AI</h2>
              <p className={styles.description}>
                Conecta OpenAI para activar un chat lateral con acceso de solo lectura al contexto del negocio y a la vista actual de la interfaz.
              </p>
            </div>
          </div>

          {status.configured ? (
            <div className={styles.statusConnected}>
              <CheckCircle size={15} />
              Conectado
            </div>
          ) : (
            <div className={styles.statusDisconnected}>
              <XCircle size={15} />
              No configurado
            </div>
          )}
        </div>

        <div className={styles.section} style={{ marginTop: 20 }}>
          <h3 className={styles.sectionTitle}>Credenciales de OpenAI</h3>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>API Token</label>
              <div className={styles.inputWrap}>
                <input
                  className={styles.input}
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  placeholder={status.configured ? 'Pega una nueva key para reemplazar la actual' : 'sk-...'}
                  autoComplete="off"
                  onChange={(event) => setApiKey(event.target.value)}
                  disabled={saving || loading}
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setShowApiKey((current) => !current)}
                  aria-label={showApiKey ? 'Ocultar token' : 'Mostrar token'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className={styles.helper}>
                El token se valida con OpenAI y se guarda cifrado en el backend. Nunca se manda de regreso al navegador.
              </p>
            </div>

            <Button onClick={handleSave} loading={saving} disabled={loading || saving}>
              <KeyRound size={16} />
              Guardar token
            </Button>
          </div>
        </div>

        {status.configured && (
          <div className={styles.section} style={{ marginTop: 22 }}>
            <h3 className={styles.sectionTitle}>Configuración actual</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Token</span>
                <span className={styles.detailValue}>{status.tokenPreview || 'Configurado'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Modelo</span>
                <span className={styles.detailValue}>{status.model}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Panel</span>
                <span className={styles.detailValue}>
                  <PanelRight size={15} />
                  Visible en la app
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Qué puede hacer</h3>
          <div className={styles.capabilities}>
            <div className={styles.capability}>
              <Database size={16} />
              Lee un resumen seguro de contactos, pagos, citas, campañas, sesiones web y fuentes de tráfico.
            </div>
            <div className={styles.capability}>
              <PanelRight size={16} />
              Usa la ruta y el texto visible de la pantalla actual para explicar lo que estás viendo.
            </div>
            <div className={styles.capability}>
              <Sparkles size={16} />
              Detecta oportunidades, riesgos y siguientes acciones según los datos disponibles.
            </div>
            <div className={styles.capability}>
              <CheckCircle size={16} />
              Funciona como asesor de negocio, no como editor de datos: el acceso a la DB es de solo lectura.
            </div>
          </div>

          {status.configured && (
            <div className={styles.actions}>
              <Button
                variant="danger"
                onClick={handleDisconnect}
                loading={disconnecting}
                disabled={disconnecting}
              >
                <Trash2 size={16} />
                Desconectar
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
