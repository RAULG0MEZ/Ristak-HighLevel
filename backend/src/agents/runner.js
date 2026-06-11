import { Agent, Runner, OpenAIProvider, assistant, webSearchTool } from '@openai/agents'
import { logger } from '../utils/logger.js'
import { getAccountTimezone } from '../utils/dateUtils.js'
import { getAIAgentConfig } from '../services/aiAgentService.js'
import {
  startAgentRun,
  updateAgentRun,
  recordAgentStep,
  completeAgentRun,
  buildAgentTracePayload
} from '../services/agentExecutionLedgerService.js'
import { getAgentCategory, resolveCategoryContextFields } from './registry.js'
import { loadAgentMemories } from './tools/memoryTools.js'

const MESSAGE_HISTORY_LIMIT = 12
const MAX_TURNS = 12
const DEFAULT_MODEL = 'gpt-5.5'
const CONTEXT_FIELD_LIMIT = 4000

const MAX_CHAT_ATTACHMENTS = 8
const MAX_ATTACHMENT_TEXT_CHARS = 18000

const CONTEXT_FIELD_LABELS = {
  business_context: 'Contexto del negocio',
  market_context: 'Mercado y nicho',
  ideal_customer: 'Cliente ideal',
  location_context: 'Zona geográfica',
  competitors_context: 'Competidores y referencias',
  brand_voice: 'Tono y voz de marca'
}

const BASE_INSTRUCTIONS = `Eres un agente IA de Ristak, el panel de operación de este negocio. Respondes SIEMPRE en español, claro y directo, como un colaborador de confianza.

Reglas generales (no negociables):
- Usa tus herramientas para consultar datos reales antes de afirmar algo; nunca inventes cifras, IDs ni resultados.
- Nunca inventes un ID: obtén los IDs reales con las herramientas de búsqueda/listado.
- Para acciones destructivas (eliminar contacto, cita, pago o costo) SIEMPRE pide confirmación explícita al usuario en un mensaje y ejecuta solo cuando responda que sí.
- Si una herramienta devuelve { ok: false }, lee el error, corrige y reintenta o explica al usuario qué falta.
- Si no encuentras datos, dilo claramente ("no encontré...") en lugar de suponer.
- Puedes ver imágenes, PDFs y archivos de texto que el usuario adjunte; los videos llegan solo como miniatura.
- Responde corto: resultados primero, detalle solo si aporta.`

function truncate(value, limit) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function buildInstructions({ category, agentConfig, memories, viewContext, timezone, nowIso }) {
  const sections = [BASE_INSTRUCTIONS, category.instructions]

  const contextFields = resolveCategoryContextFields(category)
  const contextLines = contextFields
    .map((field) => {
      const value = truncate(agentConfig?.[field], CONTEXT_FIELD_LIMIT)
      return value ? `### ${CONTEXT_FIELD_LABELS[field] || field}\n${value}` : null
    })
    .filter(Boolean)

  if (contextLines.length) {
    sections.push(`## Contexto del negocio (solo lo relevante para tu especialidad)\n${contextLines.join('\n\n')}`)
  }

  sections.push(`## Fecha y zona horaria
- Fecha y hora actual: ${nowIso}
- Zona horaria de la cuenta: ${timezone}
Interpreta fechas relativas ("hoy", "mañana", "este mes") con esta fecha y zona.`)

  if (memories.length) {
    const memoryLines = memories
      .map((memory) => `- [${memory.id}] ${truncate(memory.content, 400)}`)
      .join('\n')
    sections.push(`## Memoria de tu especialidad (notas guardadas)\n${memoryLines}\nUsa save_memory para guardar datos nuevos que te pidan recordar y forget_memory para borrar notas obsoletas.`)
  } else {
    sections.push('## Memoria de tu especialidad\nAún no tienes notas guardadas. Usa save_memory cuando el usuario te pida recordar algo o detectes una preferencia estable.')
  }

  const viewPath = truncate(viewContext?.path, 200)
  const viewTitle = truncate(viewContext?.title || viewContext?.routeLabel, 200)
  if (viewPath || viewTitle) {
    sections.push(`## Pantalla actual del usuario\n${[viewTitle, viewPath].filter(Boolean).join(' — ')}`)
  }

  return sections.join('\n\n')
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:') && value.includes(';base64,')
}

/**
 * Convierte un adjunto del chat (imagen, video, PDF, texto, archivo) en partes
 * de contenido del protocolo del Agents SDK. Misma lógica que el flujo legacy.
 */
function attachmentToContentParts(attachment) {
  if (!attachment || typeof attachment !== 'object') return []

  const name = String(attachment.name || 'archivo').slice(0, 180)
  const kind = String(attachment.kind || '').toLowerCase()
  const summary = `Adjunto: ${name} (tipo=${attachment.mimeType || kind || 'desconocido'})`
  const parts = []

  if (kind === 'image' && isDataUrl(attachment.dataUrl)) {
    parts.push({ type: 'input_image', image: attachment.dataUrl })
  } else if (kind === 'video' && isDataUrl(attachment.thumbnailDataUrl)) {
    parts.push({ type: 'input_text', text: `${summary}\nEste video se envió con una miniatura visual para analizar el encuadre/contenido visible.` })
    parts.push({ type: 'input_image', image: attachment.thumbnailDataUrl })
  } else if (typeof attachment.text === 'string' && attachment.text.trim()) {
    parts.push({ type: 'input_text', text: `${summary}\nContenido del archivo ${name}:\n${attachment.text.slice(0, MAX_ATTACHMENT_TEXT_CHARS)}` })
  } else if (isDataUrl(attachment.dataUrl)) {
    parts.push({ type: 'input_file', filename: name, file: attachment.dataUrl })
  } else {
    parts.push({ type: 'input_text', text: `${summary} (sin contenido legible adjunto)` })
  }

  return parts
}

export function buildInputItems(messages) {
  const recent = (Array.isArray(messages) ? messages : [])
    .filter((message) => {
      if (!message) return false
      const hasText = typeof message.content === 'string' && message.content.trim()
      const hasAttachments = Array.isArray(message.attachments) && message.attachments.length
      return hasText || hasAttachments
    })
    .slice(-MESSAGE_HISTORY_LIMIT)

  return recent.map((message) => {
    let text = typeof message.content === 'string' ? message.content.trim() : ''
    if (message.role === 'user' && message.selectedClarificationOption?.value) {
      text = `${text}\n[Opción seleccionada: ${message.selectedClarificationOption.value}]`
    }

    if (message.role === 'assistant') {
      return assistant(text)
    }

    const attachmentParts = (Array.isArray(message.attachments) ? message.attachments : [])
      .slice(0, MAX_CHAT_ATTACHMENTS)
      .flatMap(attachmentToContentParts)

    const content = [
      ...(text ? [{ type: 'input_text', text }] : []),
      ...attachmentParts
    ]

    return {
      role: 'user',
      content: content.length ? content : [{ type: 'input_text', text: '(mensaje vacío)' }]
    }
  })
}

/**
 * Extrae fuentes (citas de URL de la búsqueda web) de las respuestas crudas del modelo.
 */
function extractSources(rawResponses = []) {
  const sources = []
  const seen = new Set()

  for (const response of rawResponses) {
    for (const item of response?.output || []) {
      const contentParts = Array.isArray(item?.content) ? item.content : []
      for (const part of contentParts) {
        const annotations = part?.annotations || part?.providerData?.annotations || []
        for (const annotation of annotations) {
          const type = annotation?.type || annotation?.Type
          const url = annotation?.url
          if (type === 'url_citation' && url && !seen.has(url)) {
            seen.add(url)
            sources.push({ title: annotation.title || url, url })
          }
        }
      }
    }
  }

  return sources.slice(0, 10)
}

function aggregateUsage(rawResponses = []) {
  const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  let hasData = false
  for (const response of rawResponses) {
    const u = response?.usage
    if (!u) continue
    hasData = true
    usage.input_tokens += Number(u.inputTokens || 0)
    usage.output_tokens += Number(u.outputTokens || 0)
    usage.total_tokens += Number(u.totalTokens || 0)
  }
  return hasData ? usage : null
}

async function recordToolSteps(agentRun, newItems = []) {
  const outputsByCallId = new Map()
  for (const item of newItems) {
    if (item?.type === 'tool_call_output_item') {
      const callId = item.rawItem?.callId || item.rawItem?.call_id || item.rawItem?.id
      outputsByCallId.set(callId, item.output ?? item.rawItem?.output ?? null)
    }
  }

  for (const item of newItems) {
    if (item?.type !== 'tool_call_item') continue
    const raw = item.rawItem || {}
    const callId = raw.callId || raw.call_id || raw.id
    let parsedInput = raw.arguments
    try {
      parsedInput = typeof raw.arguments === 'string' ? JSON.parse(raw.arguments) : raw.arguments
    } catch { /* deja el string crudo */ }

    await recordAgentStep(agentRun, {
      stepType: 'tool_call',
      toolName: raw.name || 'unknown_tool',
      status: 'completed',
      input: parsedInput || null,
      output: outputsByCallId.has(callId) ? truncate(JSON.stringify(outputsByCallId.get(callId)), 4000) : null
    })
  }
}

/**
 * Ejecuta el agente especializado de una categoría y devuelve la respuesta con
 * la misma forma que el chat legacy: { reply, model, sources, clarificationOptions, usage, trace }.
 */
export async function runSpecializedAgentReply({ apiKey, category: categoryId, messages, viewContext = {}, userId = null }) {
  const category = getAgentCategory(categoryId)
  if (!category) {
    const error = new Error(`Especialidad de agente desconocida: ${categoryId}`)
    error.statusCode = 400
    throw error
  }

  const latestUserMessage = [...(messages || [])].reverse().find((message) => message?.role === 'user')?.content || ''

  let agentRun = null
  try {
    agentRun = await startAgentRun({ userId, latestUserMessage, viewContext })
  } catch (error) {
    logger.warn(`No se pudo iniciar rastro del agente especializado: ${error.message}`)
  }

  try {
    const [agentConfig, memories, timezone] = await Promise.all([
      getAIAgentConfig({ userId }),
      loadAgentMemories(category.id),
      getAccountTimezone().catch(() => 'America/Mexico_City')
    ])

    const model = String(agentConfig?.model || DEFAULT_MODEL)
    const nowIso = new Date().toLocaleString('es-MX', { timeZone: timezone, dateStyle: 'full', timeStyle: 'short' })
    const webSearchEnabled = [true, 1, '1', 'true'].includes(agentConfig?.web_search_enabled)
    const tools = webSearchEnabled ? [...category.tools, webSearchTool()] : category.tools

    await updateAgentRun(agentRun, {
      domain: category.id,
      action: 'specialized_chat',
      model,
      route: { engine: 'openai-agents-sdk', category: category.id, toolCount: tools.length, webSearchEnabled }
    })
    await recordAgentStep(agentRun, {
      stepType: 'route',
      status: 'completed',
      output: { engine: 'openai-agents-sdk', category: category.id, model, webSearchEnabled }
    })

    const agent = new Agent({
      name: `Ristak · ${category.label}`,
      model,
      instructions: buildInstructions({ category, agentConfig, memories, viewContext, timezone, nowIso }),
      tools
    })

    const runner = new Runner({
      modelProvider: new OpenAIProvider({ apiKey }),
      tracingDisabled: true
    })

    const result = await runner.run(agent, buildInputItems(messages), {
      maxTurns: MAX_TURNS,
      context: { category: category.id, userId }
    })

    await recordToolSteps(agentRun, result.newItems || [])

    const reply = String(result.finalOutput || '').trim() ||
      'No pude generar una respuesta. Intenta reformular tu mensaje.'
    const usage = aggregateUsage(result.rawResponses || [])
    const sources = extractSources(result.rawResponses || [])

    await recordAgentStep(agentRun, {
      stepType: 'final_response',
      status: 'completed',
      output: { reply: truncate(reply, 1600), model }
    })
    await completeAgentRun(agentRun, { status: 'completed', reply, model, usage })

    return {
      reply,
      model,
      category: category.id,
      sources,
      clarificationOptions: [],
      agentMemory: null,
      usage,
      trace: buildAgentTracePayload(agentRun, 'completed')
    }
  } catch (error) {
    logger.error(`Error en agente especializado (${categoryId}): ${error.message}`)
    await recordAgentStep(agentRun, {
      stepType: 'error',
      status: 'failed',
      error: error.message
    })
    await completeAgentRun(agentRun, { status: 'failed', error: error.message })
    error.agentTrace = buildAgentTracePayload(agentRun, 'failed')
    throw error
  }
}
