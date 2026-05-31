import React, { useEffect, useState } from 'react'
import { Bot, CheckCircle, Database, Eye, EyeOff, Globe2, KeyRound, Megaphone, MessageCircle, Save, Sparkles, Trash2, XCircle } from 'lucide-react'
import { Button, Card } from '@/components/common'
import { useNotification } from '@/contexts/NotificationContext'
import { aiAgentService, type AIAgentConfigStatus, type AIAgentRecommendationMode, type AIAgentResponseStyle } from '@/services/aiAgentService'
import styles from './AIAgentSettings.module.css'

const DEFAULT_AI_MODEL = 'gpt-5.5'

const emptyStatus: AIAgentConfigStatus = {
  configured: false,
  model: DEFAULT_AI_MODEL,
  tokenPreview: null,
  businessContext: '',
  marketContext: '',
  idealCustomer: '',
  locationContext: '',
  competitorsContext: '',
  brandVoice: '',
  researchDomains: '',
  responseStyle: 'direct',
  recommendationMode: 'on_request',
  webSearchEnabled: false,
  metaAdsMcp: {
    enabled: true,
    configured: false,
    serverUrl: 'https://mcp.facebook.com/ads',
    adAccountId: null,
    tokenSource: null
  },
  updatedAt: null
}

const emptyForm = {
  model: DEFAULT_AI_MODEL,
  businessContext: '',
  marketContext: '',
  idealCustomer: '',
  locationContext: '',
  competitorsContext: '',
  brandVoice: '',
  researchDomains: '',
  responseStyle: 'direct' as AIAgentResponseStyle,
  recommendationMode: 'on_request' as AIAgentRecommendationMode,
  webSearchEnabled: false
}

const modelOptionGroups = [
  {
    label: 'GPT-5.5 y GPT-5.4',
    options: [
      { value: 'gpt-5.5', label: 'GPT-5.5', description: 'El más nuevo para análisis complejo, criterio y trabajo profesional.' },
      { value: 'gpt-5.5-pro', label: 'GPT-5.5 pro', description: 'Más cómputo para respuestas más precisas; puede tardar más.' },
      { value: 'gpt-5.4', label: 'GPT-5.4', description: 'Frontier fuerte con mejor balance de costo.' },
      { value: 'gpt-5.4-pro', label: 'GPT-5.4 pro', description: 'Versión pro de GPT-5.4 para más precisión.' },
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini', description: 'Rápido y más barato para alto volumen.' },
      { value: 'gpt-5.4-nano', label: 'GPT-5.4 nano', description: 'El más económico de la familia GPT-5.4.' }
    ]
  },
  {
    label: 'GPT-5 anteriores',
    options: [
      { value: 'gpt-5.2', label: 'GPT-5.2', description: 'Modelo frontier anterior para trabajo profesional.' },
      { value: 'gpt-5.2-pro', label: 'GPT-5.2 pro', description: 'Versión pro anterior con más precisión.' },
      { value: 'gpt-5.1', label: 'GPT-5.1', description: 'Modelo anterior para tareas de agente y código.' },
      { value: 'gpt-5', label: 'GPT-5', description: 'Modelo GPT-5 original.' },
      { value: 'gpt-5-pro', label: 'GPT-5 pro', description: 'Versión pro de GPT-5.' },
      { value: 'gpt-5-mini', label: 'GPT-5 mini', description: 'Más rápido y económico que GPT-5.' },
      { value: 'gpt-5-nano', label: 'GPT-5 nano', description: 'Más barato y rápido para tareas simples.' }
    ]
  },
  {
    label: 'Modelos usados en ChatGPT',
    options: [
      { value: 'chat-latest', label: 'chat-latest', description: 'Modelo instantáneo actual usado en ChatGPT; OpenAI lo puede actualizar.' },
      { value: 'gpt-5.3-chat-latest', label: 'GPT-5.3 Chat', description: 'Snapshot instantáneo GPT-5.3 usado en ChatGPT.' },
      { value: 'gpt-5.2-chat-latest', label: 'GPT-5.2 Chat', description: 'Snapshot GPT-5.2 usado en ChatGPT.' },
      { value: 'gpt-5.1-chat-latest', label: 'GPT-5.1 Chat', description: 'Versión ChatGPT anterior.' },
      { value: 'gpt-5-chat-latest', label: 'GPT-5 Chat', description: 'Versión GPT-5 usada antes en ChatGPT.' },
      { value: 'chatgpt-4o-latest', label: 'ChatGPT-4o', description: 'Alias anterior de GPT-4o usado en ChatGPT.' }
    ]
  },
  {
    label: 'GPT-4 y legacy',
    options: [
      { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Modelo no razonador fuerte.' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Versión más rápida de GPT-4.1.' },
      { value: 'gpt-4.1-nano', label: 'GPT-4.1 nano', description: 'Versión más económica de GPT-4.1.' },
      { value: 'gpt-4o', label: 'GPT-4o', description: 'Modelo rápido y flexible anterior.' },
      { value: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Modelo económico para tareas enfocadas.' },
      { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview', description: 'Modelo preview legacy.' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Modelo GPT-4 Turbo legacy.' },
      { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview', description: 'Preview legacy de GPT-4 Turbo.' },
      { value: 'gpt-4', label: 'GPT-4', description: 'Modelo GPT-4 original.' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Modelo legacy barato para chat.' }
    ]
  },
  {
    label: 'Razonamiento y búsqueda',
    options: [
      { value: 'o3-pro', label: 'o3-pro', description: 'Razonamiento con más cómputo.' },
      { value: 'o3', label: 'o3', description: 'Modelo de razonamiento anterior.' },
      { value: 'o4-mini', label: 'o4-mini', description: 'Razonamiento rápido y económico.' },
      { value: 'o3-mini', label: 'o3-mini', description: 'Modelo de razonamiento pequeño legacy.' },
      { value: 'o1-pro', label: 'o1-pro', description: 'Razonamiento o1 con más cómputo.' },
      { value: 'o1', label: 'o1', description: 'Modelo o-series anterior.' },
      { value: 'o1-mini', label: 'o1-mini', description: 'Versión pequeña legacy de o1.' },
      { value: 'o1-preview', label: 'o1 preview', description: 'Preview legacy de o1.' },
      { value: 'gpt-4o-search-preview', label: 'GPT-4o Search Preview', description: 'Modelo legacy orientado a búsqueda.' },
      { value: 'gpt-4o-mini-search-preview', label: 'GPT-4o mini Search Preview', description: 'Modelo pequeño legacy orientado a búsqueda.' }
    ]
  },
  {
    label: 'Codex, deep research y open-weight',
    options: [
      { value: 'gpt-5.3-codex', label: 'GPT-5.3-Codex', description: 'Modelo optimizado para programación/agentes de código.' },
      { value: 'gpt-5.2-codex', label: 'GPT-5.2-Codex', description: 'Codex anterior para tareas largas de código.' },
      { value: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', description: 'Codex GPT-5.1 legacy.' },
      { value: 'gpt-5.1-codex-max', label: 'GPT-5.1-Codex-Max', description: 'Codex para tareas largas legacy.' },
      { value: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex mini', description: 'Codex mini legacy.' },
      { value: 'gpt-5-codex', label: 'GPT-5-Codex', description: 'Codex GPT-5 legacy.' },
      { value: 'codex-mini-latest', label: 'codex-mini-latest', description: 'Codex mini legacy.' },
      { value: 'o3-deep-research', label: 'o3-deep-research', description: 'Modelo especializado en investigación profunda.' },
      { value: 'o4-mini-deep-research', label: 'o4-mini-deep-research', description: 'Investigación profunda más rápida/económica.' },
      { value: 'gpt-oss-120b', label: 'gpt-oss-120b', description: 'Modelo open-weight grande.' },
      { value: 'gpt-oss-20b', label: 'gpt-oss-20b', description: 'Modelo open-weight más ligero.' }
    ]
  }
]

const modelOptions = modelOptionGroups.flatMap((group) => group.options)

function getKnownModel(value?: string | null) {
  return modelOptions.some((option) => option.value === value) ? String(value) : DEFAULT_AI_MODEL
}

const responseStyleOptions: Array<{
  value: AIAgentResponseStyle
  label: string
  description: string
}> = [
  {
    value: 'direct',
    label: 'Directo al dato',
    description: 'Contesta exactamente lo preguntado y no se extiende.'
  },
  {
    value: 'balanced',
    label: 'Balanceado',
    description: 'Dato primero, con una lectura breve cuando aporte.'
  },
  {
    value: 'advisor',
    label: 'Asesor',
    description: 'Más contexto y criterio estratégico por defecto.'
  }
]

const recommendationModeOptions: Array<{
  value: AIAgentRecommendationMode
  label: string
  description: string
}> = [
  {
    value: 'on_request',
    label: 'Sólo si las pido',
    description: 'No da acciones ni consejos si sólo pediste un dato.'
  },
  {
    value: 'when_useful',
    label: 'Si hay algo importante',
    description: 'Recomienda sólo ante riesgos u oportunidades claras.'
  },
  {
    value: 'proactive',
    label: 'Proactivas',
    description: 'Puede sugerir acciones aunque no las pidas.'
  }
]

export const AIAgentSettings: React.FC = () => {
  const { showToast, showConfirm } = useNotification()
  const [status, setStatus] = useState<AIAgentConfigStatus>(emptyStatus)
  const [form, setForm] = useState(emptyForm)
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
      const normalizedModel = getKnownModel(nextStatus.model)
      setStatus({
        ...nextStatus,
        model: normalizedModel
      })
      setForm({
        model: normalizedModel,
        businessContext: nextStatus.businessContext || '',
        marketContext: nextStatus.marketContext || '',
        idealCustomer: nextStatus.idealCustomer || '',
        locationContext: nextStatus.locationContext || '',
        competitorsContext: nextStatus.competitorsContext || '',
        brandVoice: nextStatus.brandVoice || '',
        researchDomains: nextStatus.researchDomains || '',
        responseStyle: nextStatus.responseStyle || 'direct',
        recommendationMode: nextStatus.recommendationMode || 'on_request',
        webSearchEnabled: Boolean(nextStatus.webSearchEnabled)
      })
    } catch (error: any) {
      showToast('error', 'Error', error?.message || 'No se pudo cargar el estado del agente AI')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const updateField = (field: keyof typeof emptyForm, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  const selectedModel = modelOptions.find((option) => option.value === form.model) || modelOptions[0]

  const handleSave = async () => {
    setSaving(true)
    try {
      const nextStatus = await aiAgentService.saveConfig({
        apiKey: apiKey.trim() || undefined,
        ...form
      })
      setStatus(nextStatus)
      setApiKey('')
      setShowApiKey(false)
      emitConfigChange(nextStatus)
      showToast(
        'success',
        'Agente AI actualizado',
        nextStatus.configured ? 'El agente ya usará el contexto del negocio.' : 'Contexto guardado. Agrega el token para activar el chat con IA.'
      )
    } catch (error: any) {
      showToast('error', 'No se pudo guardar', error?.message || 'Revisa la configuración del agente')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      await aiAgentService.deleteConfig()
      setStatus(emptyStatus)
      setForm(emptyForm)
      setApiKey('')
      emitConfigChange(emptyStatus)
      showToast('success', 'Agente AI desconectado', 'El chat seguirá visible para volver a configurarlo cuando quieras.')
    } catch (error: any) {
      showToast('error', 'Error', error?.message || 'No se pudo desconectar el agente AI')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleDisconnect = () => {
    showConfirm(
      'Desconectar Agente AI',
      'Se eliminará el token guardado. El chat seguirá visible, pero quedará en modo configuración.',
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
                Conecta OpenAI para activar el chat flotante con lectura segura de la DB, contexto de la vista actual y acciones externas bajo confirmación.
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
          <div className={styles.field}>
            <label className={styles.label}>API Token</label>
            <div className={styles.inputRow}>
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
              <Button onClick={handleSave} loading={saving} disabled={loading || saving}>
                <KeyRound size={16} />
                Guardar configuración
              </Button>
            </div>
            <p className={styles.helper}>
              El token se valida con OpenAI y se guarda cifrado en el backend. Nunca se manda de regreso al navegador.
            </p>
          </div>
        </div>

        <div className={styles.section} style={{ marginTop: 22 }}>
          <h3 className={styles.sectionTitle}>Modelo de ChatGPT</h3>
          <div className={styles.modelGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Modelo principal</label>
              <select
                className={styles.select}
                value={form.model}
                onChange={(event) => updateField('model', event.target.value)}
                disabled={saving || loading}
              >
                {modelOptionGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className={styles.helper}>
                {selectedModel.description}
              </p>
            </div>
            <p className={styles.helper}>
              Incluye las versiones oficiales de texto, ChatGPT, razonamiento, Codex, búsqueda y legacy que aplican para este agente. No hay modelo personalizado.
            </p>
          </div>
        </div>

        <div className={styles.section} style={{ marginTop: 22 }}>
          <h3 className={styles.sectionTitle}>Contexto del negocio</h3>
          <div className={styles.contextGrid}>
            <div className={styles.fieldWide}>
              <label className={styles.label}>Detalles del negocio</label>
              <textarea
                className={styles.textarea}
                value={form.businessContext}
                placeholder="Qué vendes, cómo operas, ticket promedio, promesas, diferenciadores, restricciones importantes..."
                onChange={(event) => updateField('businessContext', event.target.value)}
                disabled={saving || loading}
                rows={4}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Mercado o nicho</label>
              <textarea
                className={styles.textarea}
                value={form.marketContext}
                placeholder="Ej. clínica estética, educación, real estate, consultoría, servicios locales..."
                onChange={(event) => updateField('marketContext', event.target.value)}
                disabled={saving || loading}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Cliente ideal</label>
              <textarea
                className={styles.textarea}
                value={form.idealCustomer}
                placeholder="Quién compra, qué le duele, objeciones, nivel económico, edad, ubicación, motivaciones..."
                onChange={(event) => updateField('idealCustomer', event.target.value)}
                disabled={saving || loading}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Zona geográfica</label>
              <textarea
                className={styles.textarea}
                value={form.locationContext}
                placeholder="Ciudad, país, colonias, contexto local, temporadas, cultura, limitaciones geográficas..."
                onChange={(event) => updateField('locationContext', event.target.value)}
                disabled={saving || loading}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Competidores o referencias</label>
              <textarea
                className={styles.textarea}
                value={form.competitorsContext}
                placeholder="Competidores, marcas de referencia, sitios, cuentas, ventajas o desventajas que conozcas..."
                onChange={(event) => updateField('competitorsContext', event.target.value)}
                disabled={saving || loading}
                rows={3}
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.label}>Tono, prioridades y reglas</label>
              <textarea
                className={styles.textarea}
                value={form.brandVoice}
                placeholder="Cómo quieres que recomiende: agresivo, conservador, premium, familiar; qué evitar; qué metas importan más..."
                onChange={(event) => updateField('brandVoice', event.target.value)}
                disabled={saving || loading}
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className={styles.section} style={{ marginTop: 22 }}>
          <h3 className={styles.sectionTitle}>Comportamiento de respuestas</h3>
          <div className={styles.behaviorGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Estilo por defecto</label>
              <div className={styles.optionGroup}>
                {responseStyleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionButton} ${form.responseStyle === option.value ? styles.optionButtonActive : ''}`}
                    onClick={() => updateField('responseStyle', option.value)}
                    disabled={saving || loading}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    <span className={styles.optionDescription}>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Recomendaciones</label>
              <div className={styles.optionGroup}>
                {recommendationModeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionButton} ${form.recommendationMode === option.value ? styles.optionButtonActive : ''}`}
                    onClick={() => updateField('recommendationMode', option.value)}
                    disabled={saving || loading}
                  >
                    <span className={styles.optionLabel}>{option.label}</span>
                    <span className={styles.optionDescription}>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className={styles.helper}>
            En modo directo, si preguntas “cuál campaña es más rentable”, el agente responde el dato y las métricas necesarias. Sólo se pone consultor si se lo pides.
          </p>
        </div>

        <div className={styles.section} style={{ marginTop: 22 }}>
          <h3 className={styles.sectionTitle}>Investigación online</h3>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={form.webSearchEnabled}
              onChange={(event) => updateField('webSearchEnabled', event.target.checked)}
              disabled={saving || loading}
            />
            <span>
              <Globe2 size={16} />
              Permitir que la IA investigue en internet cuando el contexto externo pueda mejorar la recomendación.
            </span>
          </label>

          <div className={styles.field}>
            <label className={styles.label}>Dominios preferidos u obligatorios</label>
            <textarea
              className={styles.textarea}
              value={form.researchDomains}
              placeholder="Opcional. Un dominio por línea o separados por coma. Ej. inegi.org.mx, statista.com, gob.mx"
              onChange={(event) => updateField('researchDomains', event.target.value)}
              disabled={saving || loading || !form.webSearchEnabled}
              rows={3}
            />
            <p className={styles.helper}>
              Si lo dejas vacío, la IA podrá buscar abierto. Si pones dominios, se limitará a esas fuentes.
            </p>
          </div>

          <div className={styles.actions}>
            <Button onClick={handleSave} loading={saving} disabled={loading || saving}>
              <Save size={16} />
              Guardar contexto
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
                <span className={styles.detailLabel}>Chat</span>
                <span className={styles.detailValue}>
                  <MessageCircle size={15} />
                  Visible en la app
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Investigación online</span>
                <span className={styles.detailValue}>
                  <Globe2 size={15} />
                  {status.webSearchEnabled ? 'Activada' : 'Desactivada'}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Meta Ads MCP</span>
                <span className={styles.detailValue}>
                  <Megaphone size={15} />
                  {status.metaAdsMcp?.configured ? 'Conectado' : status.metaAdsMcp?.enabled === false ? 'Desactivado' : 'Sin token'}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Respuesta</span>
                <span className={styles.detailValue}>
                  {status.responseStyle === 'advisor' ? 'Asesor' : status.responseStyle === 'balanced' ? 'Balanceado' : 'Directo'}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Recomendaciones</span>
                <span className={styles.detailValue}>
                  {status.recommendationMode === 'proactive' ? 'Proactivas' : status.recommendationMode === 'when_useful' ? 'Si son importantes' : 'Sólo si las pides'}
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
              <MessageCircle size={16} />
              Usa la ruta y el texto visible de la pantalla actual para explicar lo que estás viendo.
            </div>
            <div className={styles.capability}>
              <Sparkles size={16} />
              Combina los números internos con el contexto del mercado, cliente ideal y zona geográfica.
            </div>
            <div className={styles.capability}>
              <Globe2 size={16} />
              Puede investigar online para traer contexto social, cultural, político, histórico o competitivo cuando aporte valor.
            </div>
            <div className={styles.capability}>
              <Megaphone size={16} />
              Usa Meta Ads MCP para operar Ads Manager bajo confirmación: campañas, presupuestos, anuncios, públicos, exclusiones y diagnósticos.
            </div>
            <div className={styles.capability}>
              <CheckCircle size={16} />
              La DB sigue siendo solo lectura y es la fuente real para leads, citas, ventas, ingresos, ROAS y rentabilidad.
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
