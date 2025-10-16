/**
 * Cron Job de Reconciliación de Invoices
 *
 * Función: Sincronizar invoices desde HighLevel cada 15 minutos
 * - Previene pérdida de datos si los webhooks fallan
 * - Actualiza estados de invoices existentes
 * - Captura nuevos pagos y actualizaciones
 */

import cron from 'node-cron'
import { syncInvoices } from '../services/invoicesSyncService.js'
import { logger } from '../utils/logger.js'

// Ejecutar cada 15 minutos
const CRON_SCHEDULE = '*/15 * * * *' // Formato: minuto hora día mes día-semana

/**
 * Inicia el cron job de reconciliación
 */
export function startInvoicesReconciliation() {
  logger.info('Iniciando cron job de reconciliación de invoices')
  logger.info(`Programado para ejecutarse: cada 15 minutos (${CRON_SCHEDULE})`)

  const task = cron.schedule(CRON_SCHEDULE, async () => {
    try {
      logger.info('🔄 Iniciando reconciliación automática de invoices...')

      const startTime = Date.now()

      // Sincronizar últimos 100 invoices
      const stats = await syncInvoices({ limit: 100 })

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      logger.success(`✅ Reconciliación completada en ${duration}s`)
      logger.info(`   - Creados: ${stats.created}`)
      logger.info(`   - Actualizados: ${stats.updated}`)
      logger.info(`   - Omitidos: ${stats.skipped}`)

    } catch (error) {
      logger.error('❌ Error en reconciliación automática:', error)
      // No lanzar el error para que el cron continúe ejecutándose
    }
  })

  // Ejecutar inmediatamente al iniciar (opcional)
  // Si no quieres que se ejecute al iniciar, comenta estas líneas
  logger.info('Ejecutando primera sincronización...')
  syncInvoices({ limit: 100 })
    .then(stats => {
      logger.success(`Primera sincronización completada: ${JSON.stringify(stats)}`)
    })
    .catch(error => {
      logger.warn('Error en primera sincronización (continuando):', error.message)
    })

  return task
}

/**
 * Detiene el cron job de reconciliación
 * @param {object} task - El cron task a detener
 */
export function stopInvoicesReconciliation(task) {
  if (task) {
    task.stop()
    logger.info('Cron job de reconciliación detenido')
  }
}
