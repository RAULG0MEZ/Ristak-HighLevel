import fetch from 'node-fetch'
import { db } from '../config/database.js'
import { logger } from '../utils/logger.js'
import {
  API_URLS,
  WEBHOOK_CUSTOM_VALUE_MAP,
  OBSOLETE_WEBHOOK_NAMES
} from '../config/constants.js'

/**
 * Obtiene la URL base pública según el entorno.
 * En producción (Render) usa RENDER_EXTERNAL_URL; en local, localhost.
 */
export function getWebhookBaseUrl() {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL
  }
  const port = process.env.PORT || 3001
  return `http://localhost:${port}`
}

/**
 * Construye el mapa nombre -> URL completa de los custom values de webhook.
 * @param {string} baseUrl
 * @returns {Record<string, string>}
 */
export function buildWebhookCustomValues(baseUrl) {
  const cleanBase = baseUrl.replace(/\/+$/, '')
  return Object.fromEntries(
    WEBHOOK_CUSTOM_VALUE_MAP.map(({ name, path }) => [name, `${cleanBase}${path}`])
  )
}

/**
 * Detecta el parentId (carpeta) donde HighLevel agrupa los custom values de
 * webhook. Devuelve el parentId más frecuente entre los webhooks existentes
 * que ya estén dentro de una carpeta, o null si ninguno tiene carpeta.
 * @param {Array<{name?: string, parentId?: string}>} customValues
 * @returns {string | null}
 */
export function detectWebhookFolderId(customValues = []) {
  const counts = new Map()
  for (const cv of customValues) {
    const isWebhook = cv?.name?.toLowerCase().startsWith('webhook')
    if (isWebhook && cv.parentId) {
      counts.set(cv.parentId, (counts.get(cv.parentId) || 0) + 1)
    }
  }
  let best = null
  let bestCount = 0
  for (const [parentId, count] of counts) {
    if (count > bestCount) { best = parentId; bestCount = count }
  }
  return best
}

/**
 * Lee la configuración de HighLevel (single-tenant).
 * @returns {Promise<{location_id: string, api_token: string} | null>}
 */
export async function getHighLevelConfig() {
  return db.get('SELECT location_id, api_token FROM highlevel_config LIMIT 1')
}

/**
 * Crea o actualiza en HighLevel todos los custom values de webhook definidos
 * en WEBHOOK_CUSTOM_VALUE_MAP, y limpia los nombres obsoletos.
 *
 * Esta es la ÚNICA implementación real de sincronización. La llaman:
 *  - syncCustomValues (botón de Configuración)
 *  - updateWebhooks (endpoint manual /api/webhook-config/update)
 *  - verifyAndUpdateWebhooks (arranque en producción)
 *
 * @param {{ config: {location_id: string, api_token: string}, baseUrl?: string }} params
 * @returns {Promise<{ baseUrl: string, results: Array, environment: string }>}
 */
export async function syncWebhookCustomValues({ config, baseUrl } = {}) {
  if (!config?.location_id || !config?.api_token) {
    throw new Error('Configuración de HighLevel no encontrada (location_id / api_token)')
  }

  const resolvedBase = baseUrl || getWebhookBaseUrl()
  const webhooks = buildWebhookCustomValues(resolvedBase)

  const headers = {
    'Authorization': `Bearer ${config.api_token}`,
    'Version': '2021-07-28'
  }
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

  logger.info(`🔗 Sincronizando custom values de webhook con base: ${resolvedBase}`)

  // Obtener custom values existentes
  const listUrl = API_URLS.HIGHLEVEL_CUSTOM_VALUES(config.location_id)
  const getResponse = await fetch(listUrl, { headers })

  if (!getResponse.ok) {
    const errorData = await getResponse.text()
    throw new Error(`No se pudieron obtener custom values de HighLevel: ${getResponse.status} ${errorData}`)
  }

  const getData = await getResponse.json()
  const existingCustomValues = getData.customValues || []
  logger.info(`📋 ${existingCustomValues.length} custom values existentes en HighLevel`)

  // Detectar la carpeta donde HighLevel agrupa los webhooks (campo parentId).
  // Los custom values creados manualmente en la UI viven dentro de una carpeta;
  // reutilizamos ese mismo parentId para que los que creemos no queden sueltos.
  const folderId = detectWebhookFolderId(existingCustomValues)
  if (folderId) {
    logger.info(`📁 Carpeta de webhooks detectada: ${folderId} (se respetará al crear/mover)`)
  } else {
    logger.info('📂 No se detectó carpeta de webhooks; los nuevos se crearán sueltos')
  }

  const results = []

  for (const [name, value] of Object.entries(webhooks)) {
    try {
      const existing = existingCustomValues.find(cv => cv.name === name)

      // El cuerpo incluye parentId solo si hay carpeta detectada.
      const body = { name, value }
      if (folderId) body.parentId = folderId

      // Sin cambios: mismo valor Y (sin carpeta objetivo o ya está en ella).
      if (existing && existing.value === value && (!folderId || existing.parentId === folderId)) {
        results.push({ name, status: 'unchanged', value })
        logger.info(`✅ Webhook ya correcto: ${name}`)
        continue
      }

      if (existing) {
        const updateUrl = API_URLS.HIGHLEVEL_CUSTOM_VALUE(config.location_id, existing.id)
        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify(body)
        })

        if (updateResponse.ok) {
          const movedToFolder = folderId && existing.parentId !== folderId
          results.push({ name, status: 'updated', value, movedToFolder: !!movedToFolder })
          logger.info(`🔄 Webhook actualizado: ${name}${movedToFolder ? ' (movido a la carpeta)' : ''}`)
        } else {
          const errorData = await updateResponse.json().catch(() => ({}))
          results.push({ name, status: 'error', error: errorData })
          logger.error(`❌ Error actualizando ${name}:`, errorData)
        }
      } else {
        const createResponse = await fetch(listUrl, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(body)
        })

        if (createResponse.ok) {
          results.push({ name, status: 'created', value, inFolder: !!folderId })
          logger.info(`✨ Webhook creado: ${name}${folderId ? ' (en la carpeta)' : ''}`)
        } else {
          const errorData = await createResponse.json().catch(() => ({}))
          results.push({ name, status: 'error', error: errorData })
          logger.error(`❌ Error creando ${name}:`, errorData)
        }
      }
    } catch (err) {
      results.push({ name, status: 'error', error: err.message })
      logger.error(`❌ Error configurando ${name}:`, err)
    }
  }

  // Limpiar nombres obsoletos/duplicados
  await cleanupObsoleteWebhooks(config, existingCustomValues)

  return {
    baseUrl: resolvedBase,
    results,
    environment: process.env.RENDER_EXTERNAL_URL ? 'production' : 'development'
  }
}

/**
 * Elimina custom values con nombres obsoletos/duplicados.
 */
export async function cleanupObsoleteWebhooks(config, customValues) {
  const toDelete = customValues.filter(cv => OBSOLETE_WEBHOOK_NAMES.includes(cv.name))
  if (toDelete.length === 0) return

  logger.info(`🗑️ Limpiando ${toDelete.length} webhooks obsoletos...`)
  for (const cv of toDelete) {
    try {
      const deleteUrl = API_URLS.HIGHLEVEL_CUSTOM_VALUE(config.location_id, cv.id)
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${config.api_token}`,
          'Version': '2021-07-28'
        }
      })
      if (deleteResponse.ok) {
        logger.info(`🗑️ Webhook obsoleto eliminado: ${cv.name}`)
      }
    } catch (err) {
      logger.error(`Error eliminando webhook obsoleto ${cv.name}:`, err)
    }
  }
}
