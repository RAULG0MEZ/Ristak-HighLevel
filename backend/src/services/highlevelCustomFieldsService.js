import fetch from 'node-fetch'
import { logger } from '../utils/logger.js'
import { normalizeCustomFieldDefinition } from '../utils/contactCustomFields.js'

const HIGHLEVEL_BASE_URL = 'https://services.leadconnectorhq.com'
const HIGHLEVEL_API_VERSION = '2021-07-28'
const CACHE_TTL_MS = 5 * 60 * 1000

const definitionsCache = new Map()

function extractArrayPayload(response, keys = []) {
  if (Array.isArray(response)) return response

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key]
  }

  const data = response?.data
  if (Array.isArray(data)) return data

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }

  return []
}

export async function fetchHighLevelContactCustomFieldDefinitions({
  apiToken,
  locationId,
  force = false
} = {}) {
  if (!apiToken || !locationId) return []

  const cacheKey = String(locationId)
  const cached = definitionsCache.get(cacheKey)
  const now = Date.now()

  if (!force && cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.fields
  }

  try {
    const url = new URL(`${HIGHLEVEL_BASE_URL}/locations/${locationId}/customFields`)
    url.searchParams.set('model', 'contact')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Version: HIGHLEVEL_API_VERSION,
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.warn(`No se pudieron obtener custom fields de HighLevel (${response.status}): ${errorText.slice(0, 200)}`)
      return cached?.fields || []
    }

    const data = await response.json()
    const fields = extractArrayPayload(data, ['customFields', 'fields', 'items', 'results'])
      .map(normalizeCustomFieldDefinition)
      .filter((field) => field.id || field.key || field.label)

    definitionsCache.set(cacheKey, {
      loadedAt: now,
      fields
    })

    return fields
  } catch (error) {
    logger.warn(`No se pudieron cargar definiciones de custom fields de HighLevel: ${error.message}`)
    return cached?.fields || []
  }
}
