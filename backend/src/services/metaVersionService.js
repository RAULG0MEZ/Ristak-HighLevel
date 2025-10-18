import fetch from 'node-fetch'
import { db } from '../config/database.js'
import { logger } from '../utils/logger.js'

/**
 * Servicio para detectar y actualizar la versión de Meta Graph API
 *
 * Meta Graph API tiene un ciclo de vida:
 * - Cada versión dura ~2 años
 * - Nuevas versiones cada 3 meses (aprox)
 * - Documentación: https://developers.facebook.com/docs/graph-api/changelog
 *
 * Este servicio:
 * 1. Detecta la versión más reciente usando el endpoint de Meta
 * 2. La guarda en BD
 * 3. Se ejecuta cada 6 meses vía cron job
 */

/**
 * Obtiene la versión actual guardada en BD
 * @returns {Promise<string>} Versión actual (ej: "v23.0")
 */
export async function getCurrentVersion() {
  try {
    const row = await db.get('SELECT version, updated_at FROM meta_api_version ORDER BY id DESC LIMIT 1')

    if (row) {
      logger.info(`Versión actual de Meta API: ${row.version} (actualizada: ${row.updated_at})`)
      return row.version
    }

    // Si no hay versión guardada, usar v23.0 como fallback
    logger.warn('No hay versión de Meta API guardada. Usando v23.0 por defecto.')
    await saveVersion('v23.0')
    return 'v23.0'
  } catch (error) {
    logger.error('Error obteniendo versión de Meta API:', error.message)
    return 'v23.0' // Fallback
  }
}

/**
 * Detecta la versión más reciente de Meta Graph API
 *
 * Estrategia:
 * 1. Intenta llamar a /me con diferentes versiones (de la más alta a la más baja)
 * 2. La primera que responda sin error de "versión no soportada" es la válida
 * 3. Meta depreca versiones antiguas, así que esto funciona bien
 *
 * @returns {Promise<string>} Versión más reciente (ej: "v23.0")
 */
export async function detectLatestVersion() {
  try {
    logger.info('🔍 Detectando versión más reciente de Meta Graph API...')

    // Generar lista de versiones a probar (de la más reciente a la más antigua)
    // Meta usa formato vXX.0 desde v2.0 (2014) hasta hoy
    // Empezamos desde v30.0 (futuro) hacia atrás
    const versionsToTest = []
    for (let major = 30; major >= 15; major--) {
      versionsToTest.push(`v${major}.0`)
    }

    // Probar cada versión
    for (const version of versionsToTest) {
      const isValid = await testVersion(version)

      if (isValid) {
        logger.success(`✅ Versión más reciente encontrada: ${version}`)
        return version
      }
    }

    // Si ninguna funciona, fallback a v23.0
    logger.warn('No se pudo detectar versión. Usando v23.0 por defecto.')
    return 'v23.0'

  } catch (error) {
    logger.error('Error detectando versión de Meta API:', error.message)
    return 'v23.0' // Fallback
  }
}

/**
 * Prueba si una versión específica es válida
 * @param {string} version - Versión a probar (ej: "v23.0")
 * @returns {Promise<boolean>} true si es válida, false si no
 */
async function testVersion(version) {
  try {
    // Hacer una llamada simple al endpoint /me (no requiere token real, solo validar versión)
    // Usamos un token de prueba inválido - si la versión no existe, Meta responde con error específico
    const url = `https://graph.facebook.com/${version}/me?access_token=test_token_invalid`

    const response = await fetch(url)
    const data = await response.json()

    // Si la versión no existe, Meta responde con error tipo 2500 (API version error)
    if (data.error?.code === 2500 || data.error?.message?.includes('version')) {
      logger.debug(`❌ ${version} - No soportada`)
      return false
    }

    // Si responde con error de token (código 190), la versión SÍ existe
    if (data.error?.code === 190 || data.error?.type === 'OAuthException') {
      logger.debug(`✅ ${version} - Soportada`)
      return true
    }

    // Cualquier otra respuesta, asumir que es válida
    return true

  } catch (error) {
    logger.debug(`⚠️ ${version} - Error al probar: ${error.message}`)
    return false
  }
}

/**
 * Guarda la versión en la base de datos
 * @param {string} version - Versión a guardar (ej: "v23.0")
 */
export async function saveVersion(version) {
  try {
    await db.run(`
      INSERT INTO meta_api_version (version, updated_at)
      VALUES (?, datetime('now'))
    `, [version])

    logger.success(`Versión ${version} guardada en BD`)
  } catch (error) {
    logger.error('Error guardando versión:', error.message)
  }
}

/**
 * Verifica si necesitamos actualizar la versión
 * (Si han pasado más de 6 meses desde la última actualización)
 *
 * @returns {Promise<boolean>} true si necesita actualizar
 */
export async function shouldUpdateVersion() {
  try {
    const row = await db.get('SELECT updated_at FROM meta_api_version ORDER BY id DESC LIMIT 1')

    if (!row) {
      return true // No hay versión guardada, actualizar
    }

    // Calcular diferencia en días
    const lastUpdate = new Date(row.updated_at)
    const now = new Date()
    const daysDiff = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24))

    // 6 meses = ~180 días
    const needsUpdate = daysDiff >= 180

    if (needsUpdate) {
      logger.info(`⏰ Han pasado ${daysDiff} días desde la última actualización. Actualizando versión...`)
    } else {
      logger.info(`✅ Versión actualizada hace ${daysDiff} días. No necesita actualización.`)
    }

    return needsUpdate

  } catch (error) {
    logger.error('Error verificando si necesita actualización:', error.message)
    return false
  }
}

/**
 * Actualiza la versión de Meta API (ejecutado por cron job)
 * Detecta la versión más reciente y la guarda en BD
 */
export async function updateMetaVersion() {
  try {
    logger.info('🔄 Iniciando actualización de versión de Meta API...')

    // Detectar versión más reciente
    const latestVersion = await detectLatestVersion()
    const currentVersion = await getCurrentVersion()

    // Si cambió la versión, guardar la nueva
    if (latestVersion !== currentVersion) {
      logger.success(`🎉 Nueva versión detectada: ${currentVersion} → ${latestVersion}`)

      await saveVersion(latestVersion)

      // Log importante para debugging
      logger.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📢 VERSIÓN DE META API ACTUALIZADA
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Versión anterior: ${currentVersion}
  Versión nueva:    ${latestVersion}
  Fecha:            ${new Date().toISOString()}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  IMPORTANTE: Reinicia el servidor para usar la nueva versión
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `)

      return {
        updated: true,
        oldVersion: currentVersion,
        newVersion: latestVersion
      }
    } else {
      logger.info(`✅ Ya tienes la versión más reciente: ${currentVersion}`)
      return {
        updated: false,
        version: currentVersion
      }
    }

  } catch (error) {
    logger.error('Error actualizando versión de Meta API:', error.message)
    return {
      updated: false,
      error: error.message
    }
  }
}

/**
 * Obtiene el historial de versiones usadas
 * @param {number} limit - Número de registros a obtener
 * @returns {Promise<Array>}
 */
export async function getVersionHistory(limit = 10) {
  try {
    const rows = await db.all(`
      SELECT version, updated_at
      FROM meta_api_version
      ORDER BY id DESC
      LIMIT ?
    `, [limit])

    return rows
  } catch (error) {
    logger.error('Error obteniendo historial de versiones:', error.message)
    return []
  }
}
