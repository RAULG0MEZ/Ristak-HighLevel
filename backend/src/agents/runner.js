import { Agent, Runner, OpenAIProvider, user, assistant } from '@openai/agents'
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

const CONTEXT_FIELD_LABELS = {
  businessContext: 'Contexto del negocio',
  marketContext: 'Mercado y nicho',
  idealCustomer: 'Cliente ideal',
  locationContext: 'Zona geográfica',
  competitorsContext: 'Competidores y referencias',
  brandVoice: 'Tono y voz de marca'
}

const BASE_INSTRUCTIONS = `Eres un agente IA de Ristak, el panel de operación de este negocio. Respondes SIEMPRE en español, claro y directo, como un colaborador de confianza.

Reglas generales (no negociables):
- Usa tus herramientas para consultar datos reales antes de afirmar algo; nunca inventes cifras, IDs ni resultados.
- Nunca inventes un ID: obtén los IDs reales con las herramientas de búsqueda/listado.
- Para acciones destructivas (eliminar contacto, cita, pago o costo) SIEMPRE pide confirmación explícita al usuario en un mensaje y ejecuta solo cuando responda que sí.
- Si una herramienta devuelve { ok: false }, lee el error, corrige y reintenta o explica al usuario qué falta.
- Si no encuentras datos, dilo claramente ("no encontré...") en lugar de suponer.
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

function buildInputItems(messages) {
  const recent = (Array.isArray(messages) ? messages : [])
    .filter((message) => message && typeof message.content === 'string' && message.content.trim())
    .slice(-MESSAGE_HISTORY_LIMIT)

  return recent.map((message) => {
    let text = message.content.trim()
    if (message.role === 'user' && message.selectedClarificationOption?.value) {
      text = `${text}\n[Opción seleccionada: ${message.selectedClarificationOption.value}]`
    }
    return message.role === 'assistant' ? assistant(text) : user(text)
  })
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

    await updateAgentRun(agentRun, {
      domain: category.id,
      action: 'specialized_chat',
      model,
      route: { engine: 'openai-agents-sdk', category: category.id, toolCount: category.tools.length }
    })
    await recordAgentStep(agentRun, {
      stepType: 'route',
      status: 'completed',
      output: { engine: 'openai-agents-sdk', category: category.id, model }
    })

    const agent = new Agent({
      name: `Ristak · ${category.label}`,
      model,
      instructions: buildInstructions({ category, agentConfig, memories, viewContext, timezone, nowIso }),
      tools: category.tools
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
      sources: [],
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
