import cron from 'node-cron'
import { logger } from '../utils/logger.js'
import { updateMetaVersion, getCurrentVersion, shouldUpdateVersion } from '../services/metaVersionService.js'
import { setMetaApiVersion } from '../config/constants.js'

/**
 * Cron job para actualizar la versión de Meta Graph API cada 6 meses
 *
 * Programación:
 * - Se ejecuta el día 1 y 15 de cada mes a las 3:00 AM
 * - Verifica si han pasado 6 meses desde la última actualización
 * - Si es necesario, detecta la versión más reciente y la actualiza
 *
 * Formato cron: '0 3 1,15 * *'
 * - Minuto: 0
 * - Hora: 3
 * - Día del mes: 1 y 15
 * - Mes: todos (*)
 * - Día de la semana: todos (*)
 */

export function startMetaVersionCron() {
  logger.info('🔧 Iniciando cron job de actualización de Meta API version...')

  // Cargar versión inicial desde BD al arrancar el servidor
  loadInitialVersion()

  // Ejecutar el 1 y 15 de cada mes a las 3:00 AM
  cron.schedule('0 3 1,15 * *', async () => {
    try {
      logger.info('⏰ Cron job de Meta API version ejecutándose...')

      // Verificar si necesitamos actualizar (si han pasado 6 meses)
      const needsUpdate = await shouldUpdateVersion()

      if (needsUpdate) {
        logger.info('🔄 Iniciando actualización de versión de Meta API...')

        const result = await updateMetaVersion()

        if (result.updated) {
          // Actualizar la versión en memoria (constants.js)
          setMetaApiVersion(result.newVersion)

          logger.success(`✅ Versión de Meta API actualizada: ${result.oldVersion} → ${result.newVersion}`)
          logger.warn('⚠️  IMPORTANTE: Se recomienda reiniciar el servidor para garantizar que todos los módulos usen la nueva versión')
        } else {
          logger.info('ℹ️  No se requiere actualización de versión')
        }
      } else {
        logger.info('✅ Versión de Meta API está actualizada. No se requieren cambios.')
      }

    } catch (error) {
      logger.error('❌ Error en cron job de Meta API version:', error.message)
    }
  }, {
    scheduled: true,
    timezone: 'America/Mexico_City' // Ajusta a tu zona horaria
  })

  logger.success('✅ Cron job de Meta API version iniciado (se ejecuta el 1 y 15 de cada mes a las 3:00 AM)')
}

/**
 * Carga la versión inicial desde la BD al arrancar el servidor
 * Esto garantiza que siempre usemos la versión más reciente guardada
 */
async function loadInitialVersion() {
  try {
    const currentVersion = await getCurrentVersion()
    setMetaApiVersion(currentVersion)

    logger.success(`✅ Versión de Meta API cargada: ${currentVersion}`)
  } catch (error) {
    logger.error('Error cargando versión inicial de Meta API:', error.message)
    logger.warn('⚠️  Usando versión por defecto: v23.0')
  }
}

/**
 * Ejecuta la actualización manualmente (útil para testing)
 * Puedes llamar esto desde un endpoint de admin
 */
export async function forceMetaVersionUpdate() {
  try {
    logger.info('🔄 Forzando actualización manual de versión de Meta API...')

    const result = await updateMetaVersion()

    if (result.updated) {
      setMetaApiVersion(result.newVersion)
      logger.success(`✅ Versión actualizada manualmente: ${result.oldVersion} → ${result.newVersion}`)
    }

    return result
  } catch (error) {
    logger.error('Error en actualización manual:', error.message)
    throw error
  }
}
