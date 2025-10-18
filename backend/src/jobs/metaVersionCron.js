import cron from 'node-cron'
import { logger } from '../utils/logger.js'
import { db } from '../config/database.js'
import {
  detectLatestVersion,
  getCurrentVersion,
  saveVersion
} from '../services/metaVersionService.js'

/**
 * Verifica si han pasado 6 meses desde la última actualización
 */
async function shouldUpdateVersion() {
  try {
    const result = await db.get(
      `SELECT updated_at FROM meta_api_version
       ORDER BY updated_at DESC LIMIT 1`
    )

    if (!result) {
      return true // Primera vez, actualizar
    }

    const lastUpdate = new Date(result.updated_at)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    return lastUpdate < sixMonthsAgo
  } catch (error) {
    logger.error('Error verificando última actualización:', error.message)
    return false
  }
}

/**
 * Actualiza la versión de Meta API si es necesario
 */
export async function updateMetaVersion() {
  try {
    logger.info('🔄 Verificando actualización de versión de Meta API...')

    const currentVersion = await getCurrentVersion()
    const latestVersion = await detectLatestVersion()

    if (currentVersion === latestVersion) {
      logger.info(`✅ Ya tienes la versión más reciente: ${currentVersion}`)
      return {
        updated: false,
        version: currentVersion
      }
    }

    // Guardar nueva versión
    await saveVersion(latestVersion)

    logger.success(`
      ✨ VERSIÓN DE META API ACTUALIZADA ✨
      Anterior: ${currentVersion}
      Nueva: ${latestVersion}
    `)

    return {
      updated: true,
      oldVersion: currentVersion,
      newVersion: latestVersion
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
 * Inicia el cron job para actualización de versión
 * Se ejecuta el día 1 y 15 de cada mes a las 3:00 AM
 */
export function startMetaVersionCron() {
  // Ejecutar el día 1 y 15 de cada mes a las 3:00 AM
  cron.schedule('0 3 1,15 * *', async () => {
    logger.info('⏰ Ejecutando verificación de versión de Meta API...')

    const needsUpdate = await shouldUpdateVersion()

    if (needsUpdate) {
      logger.info('📅 Han pasado 6+ meses, actualizando versión...')
      const result = await updateMetaVersion()

      if (result.updated) {
        logger.success(`✅ Cron: Versión actualizada de ${result.oldVersion} a ${result.newVersion}`)
      }
    } else {
      logger.info('⏱️ Aún no han pasado 6 meses desde la última actualización')
    }
  }, {
    timezone: 'America/Mexico_City'
  })

  logger.info('✅ Cron de actualización de versión Meta API iniciado (días 1 y 15 a las 3 AM)')
}

/**
 * Función para forzar actualización manual (para testing)
 */
export async function forceMetaVersionUpdate() {
  logger.warn('⚠️ Forzando actualización manual de versión...')
  return await updateMetaVersion()
}