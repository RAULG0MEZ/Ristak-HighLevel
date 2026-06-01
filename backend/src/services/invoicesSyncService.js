/**
 * Servicio de sincronización de invoices desde HighLevel
 *
 * Funcionalidad:
 * - Obtiene invoices desde la API de HighLevel
 * - Los guarda en BD local para evitar duplicados
 * - Actualiza estados si ya existen
 * - Permite mostrar pagos pendientes y pagados
 */

import { db } from '../config/database.js'
import { getGHLClient } from './ghlClient.js'
import { logger } from '../utils/logger.js'
import { getInvoicePaymentMode, nonTestPaymentCondition } from '../utils/paymentMode.js'
import { markPaymentFlowInvoicePaid } from './paymentFlowService.js'
import {
  isSuccessfulPaymentStatus,
  triggerWhatsappFirstPurchaseEvent
} from './metaWhatsappEventsService.js'

const PAID_INVOICE_STATUSES = new Set(['paid', 'succeeded', 'completed'])

function getInvoiceItems(invoice = {}) {
  for (const source of [invoice.invoiceItems, invoice.items, invoice.lineItems]) {
    if (Array.isArray(source) && source.length > 0) return source
  }

  return []
}

function getInvoiceDisplayDescription(invoice = {}) {
  const firstItem = getInvoiceItems(invoice)[0] || {}

  return (
    firstItem.description ||
    firstItem.name ||
    invoice.description ||
    invoice.title ||
    invoice.name ||
    'Pago'
  )
}

function getInvoiceDisplayTitle(invoice = {}) {
  const firstItem = getInvoiceItems(invoice)[0] || {}

  return (
    invoice.title ||
    invoice.name ||
    firstItem.name ||
    firstItem.description ||
    'Pago'
  )
}

async function findExistingPaymentForInvoice({ invoiceId, contactId, invoiceNumber }) {
  const existingByInvoiceId = await db.get(
    'SELECT id, status, payment_mode, ghl_invoice_id FROM payments WHERE ghl_invoice_id = ? OR id = ? LIMIT 1',
    [invoiceId, invoiceId]
  )

  if (existingByInvoiceId) return existingByInvoiceId

  if (!contactId || !invoiceNumber) return null

  return await db.get(
    `SELECT id, status, payment_mode, ghl_invoice_id
     FROM payments
     WHERE contact_id = ?
       AND (
         invoice_number = ?
         OR reference = ?
         OR reference = ?
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [contactId, invoiceNumber, invoiceNumber, `Invoice #${invoiceNumber}`]
  )
}

async function activatePaymentFlowFromPaidInvoice(invoiceId, invoiceData) {
  if (!invoiceId || !PAID_INVOICE_STATUSES.has(invoiceData.status) || !invoiceData.contact_id) {
    return
  }

  try {
    await markPaymentFlowInvoicePaid(invoiceId, {
      contactId: invoiceData.contact_id,
      amount: invoiceData.amount,
      description: invoiceData.description
    })
  } catch (error) {
    logger.error(`No se pudo activar flujo de parcialidades desde invoice sincronizado ${invoiceId}: ${error.message}`)
  }
}

/**
 * Sincroniza invoices desde HighLevel a BD local
 * @param {Object} options - Opciones de sincronización
 * @param {number} options.limit - Número de invoices a obtener (default: 100)
 * @param {number} options.offset - Offset para paginación (default: 0)
 * @param {string} options.contactId - Filtrar por contacto específico
 * @returns {Promise<Object>} - Estadísticas de sincronización
 */
export async function syncInvoices({ limit = 100, offset = 0, contactId } = {}) {
  try {
    logger.info(`Iniciando sincronización de invoices (limit: ${limit}, offset: ${offset})`)

    const ghlClient = await getGHLClient()

    // Obtener invoices desde HighLevel
    const response = await ghlClient.listInvoices({ limit, offset, contactId })

    // GHL puede devolver { invoices: [...] } o { data: [...] }
    const invoices = response.invoices || response.data || []

    logger.info(`Obtenidos ${invoices.length} invoices desde HighLevel`)

    let created = 0
    let updated = 0
    let skipped = 0

    for (const invoice of invoices) {
      try {
        // ID del invoice en HighLevel
        const ghlInvoiceId = invoice.id || invoice._id

        if (!ghlInvoiceId) {
          logger.warn('Invoice sin ID, saltando:', invoice)
          skipped++
          continue
        }

        // Validar que tenga contactId válido (puede estar en contactDetails.id o contactId)
        const contactId = invoice.contactDetails?.id || invoice.contactId

        if (!contactId) {
          logger.warn(`⚠️ Invoice ${ghlInvoiceId} sin contactId válido, saltando...`)
          skipped++
          continue
        }

        const invoiceNumber = invoice.invoiceNumber || null
        const existing = await findExistingPaymentForInvoice({
          invoiceId: ghlInvoiceId,
          contactId,
          invoiceNumber
        })

        // Datos comunes del invoice
        const invoiceData = {
          contact_id: contactId,
          amount: invoice.total || invoice.amount || 0,
          currency: invoice.currency || 'MXN',
          status: mapInvoiceStatus(invoice.status),
          payment_method: invoice.paymentMode || null,
          payment_mode: getInvoicePaymentMode(invoice, existing?.payment_mode || 'live'),
          reference: invoiceNumber,
          title: getInvoiceDisplayTitle(invoice),
          description: getInvoiceDisplayDescription(invoice),
          date: invoice.createdAt || invoice.issueDate || new Date().toISOString(),
          ghl_invoice_id: ghlInvoiceId,
          invoice_number: invoiceNumber,
          due_date: invoice.dueDate || null,
          sent_at: invoice.sentAt || null,
        }

        if (existing) {
          // Actualizar SIEMPRE para mantener datos sincronizados (incluyendo descripción)
          await db.run(
            `UPDATE payments
             SET status = ?, amount = ?, currency = ?, payment_method = ?,
                 payment_mode = ?, reference = ?, title = ?, description = ?, contact_id = ?,
                 ghl_invoice_id = ?, invoice_number = ?, due_date = ?, sent_at = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              invoiceData.status,
              invoiceData.amount,
              invoiceData.currency,
              invoiceData.payment_method,
              invoiceData.payment_mode,
              invoiceData.reference,
              invoiceData.title,
              invoiceData.description,
              invoiceData.contact_id,
              invoiceData.ghl_invoice_id,
              invoiceData.invoice_number,
              invoiceData.due_date,
              invoiceData.sent_at,
              existing.id
            ]
          )
          updated++
          logger.info(`Invoice actualizado: ${ghlInvoiceId}`)
        } else {
          // Verificar si el contacto existe antes de crear el invoice
          if (invoiceData.contact_id) {
            const contactExists = await db.get(
              'SELECT id FROM contacts WHERE id = ?',
              [invoiceData.contact_id]
            )

            if (!contactExists) {
              logger.warn(`⚠️ Ignorando invoice ${ghlInvoiceId}: contacto ${invoiceData.contact_id} no existe`)
              skipped++
              continue
            }
          }

          // Crear nuevo invoice en BD
          await db.run(
            `INSERT INTO payments (
              id, contact_id, amount, currency, status, payment_method, payment_mode,
              reference, title, description, date, ghl_invoice_id, invoice_number,
              due_date, sent_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              ghlInvoiceId, // Usar mismo ID que en HighLevel
              invoiceData.contact_id,
              invoiceData.amount,
              invoiceData.currency,
              invoiceData.status,
              invoiceData.payment_method,
              invoiceData.payment_mode,
              invoiceData.reference,
              invoiceData.title,
              invoiceData.description,
              invoiceData.date,
              invoiceData.ghl_invoice_id,
              invoiceData.invoice_number,
              invoiceData.due_date,
              invoiceData.sent_at
            ]
          )
          created++
          logger.success(`Invoice creado: ${ghlInvoiceId} (${invoiceData.status})`)
        }

        // Si el invoice está pagado, actualizar estadísticas del contacto
        if (invoiceData.status === 'paid' && invoiceData.contact_id) {
          await updateContactStats(invoiceData.contact_id)
        }

        await activatePaymentFlowFromPaidInvoice(ghlInvoiceId, invoiceData)

        const transitionedToPaid = invoiceData.contact_id &&
          isSuccessfulPaymentStatus(invoiceData.status) &&
          existing &&
          !isSuccessfulPaymentStatus(existing.status)

        if (transitionedToPaid) {
          await triggerWhatsappFirstPurchaseEvent(invoiceData.contact_id, {
            amount: invoiceData.amount,
            currency: invoiceData.currency,
            paymentMode: invoiceData.payment_mode
          })
        }

      } catch (error) {
        logger.error(`Error procesando invoice ${invoice.id}:`, error)
        skipped++
      }
    }

    const stats = {
      total: invoices.length,
      created,
      updated,
      skipped
    }

    logger.success(`Sincronización completada: ${JSON.stringify(stats)}`)

    return stats

  } catch (error) {
    logger.error('Error en sincronización de invoices:', error)
    throw error
  }
}

/**
 * Sincroniza TODOS los invoices desde HighLevel (con paginación completa)
 * Esta función obtiene TODOS los invoices haciendo múltiples llamadas paginadas
 *
 * @param {Object} options - Opciones de sincronización
 * @param {string} options.contactId - Filtrar por contacto específico (opcional)
 * @returns {Promise<Object>} - Estadísticas de sincronización completa
 */
export async function syncAllInvoices({ contactId } = {}) {
  try {
    logger.info('🔄 Iniciando sincronización COMPLETA de invoices desde HighLevel...')

    const ghlClient = await getGHLClient()
    let allInvoices = []
    let offset = 0
    const limit = 100 // Tamaño de cada bloque
    let hasMore = true
    let totalFetched = 0

    // Loop de paginación - obtener TODO
    while (hasMore) {
      logger.info(`📥 Obteniendo invoices - offset: ${offset}, limit: ${limit}`)

      const response = await ghlClient.listInvoices({ limit, offset, contactId })
      const invoices = response.invoices || response.data || []

      allInvoices = allInvoices.concat(invoices)
      totalFetched += invoices.length

      logger.info(`   ✓ Obtenidos ${invoices.length} invoices (total acumulado: ${totalFetched})`)

      // Si trajo menos de lo que pedimos, ya no hay más
      if (invoices.length < limit) {
        hasMore = false
        logger.info(`✅ Paginación completa - total de invoices obtenidos: ${totalFetched}`)
      } else {
        offset += limit
      }
    }

    logger.info(`📊 Procesando ${allInvoices.length} invoices en la base de datos...`)

    // Procesar todos los invoices obtenidos
    let created = 0
    let updated = 0
    let skipped = 0

    for (const invoice of allInvoices) {
      try {
        const ghlInvoiceId = invoice.id || invoice._id

        if (!ghlInvoiceId) {
          skipped++
          continue
        }

        // Verificar si ya existe en BD local
        const contactId = invoice.contactId

        const invoiceNumber = invoice.invoiceNumber || null
        const existing = await findExistingPaymentForInvoice({
          invoiceId: ghlInvoiceId,
          contactId,
          invoiceNumber
        })

        if (!contactId) {
          skipped++
          continue
        }

        // Datos comunes del invoice
        const invoiceData = {
          contact_id: contactId,
          amount: invoice.total || invoice.amount || 0,
          currency: invoice.currency || 'MXN',
          status: mapInvoiceStatus(invoice.status),
          payment_method: invoice.paymentMode || null,
          payment_mode: getInvoicePaymentMode(invoice, existing?.payment_mode || 'live'),
          reference: invoiceNumber,
          title: getInvoiceDisplayTitle(invoice),
          description: getInvoiceDisplayDescription(invoice),
          date: invoice.createdAt || invoice.issueDate || new Date().toISOString(),
          ghl_invoice_id: ghlInvoiceId,
          invoice_number: invoiceNumber,
          due_date: invoice.dueDate || null,
          sent_at: invoice.sentAt || null,
        }

        if (existing) {
          // Actualizar SIEMPRE para mantener datos sincronizados (incluyendo descripción)
          await db.run(
            `UPDATE payments
             SET status = ?, amount = ?, currency = ?, payment_method = ?,
                 payment_mode = ?, reference = ?, title = ?, description = ?, contact_id = ?,
                 ghl_invoice_id = ?, invoice_number = ?, due_date = ?, sent_at = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              invoiceData.status,
              invoiceData.amount,
              invoiceData.currency,
              invoiceData.payment_method,
              invoiceData.payment_mode,
              invoiceData.reference,
              invoiceData.title,
              invoiceData.description,
              invoiceData.contact_id,
              invoiceData.ghl_invoice_id,
              invoiceData.invoice_number,
              invoiceData.due_date,
              invoiceData.sent_at,
              existing.id
            ]
          )
          updated++
        } else {
          // Verificar si el contacto existe
          if (invoiceData.contact_id) {
            const contactExists = await db.get(
              'SELECT id FROM contacts WHERE id = ?',
              [invoiceData.contact_id]
            )

            if (!contactExists) {
              skipped++
              continue
            }
          }

          // Crear nuevo invoice en BD
          await db.run(
            `INSERT INTO payments (
              id, contact_id, amount, currency, status, payment_method, payment_mode,
              reference, title, description, date, ghl_invoice_id, invoice_number,
              due_date, sent_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              ghlInvoiceId,
              invoiceData.contact_id,
              invoiceData.amount,
              invoiceData.currency,
              invoiceData.status,
              invoiceData.payment_method,
              invoiceData.payment_mode,
              invoiceData.reference,
              invoiceData.title,
              invoiceData.description,
              invoiceData.date,
              invoiceData.ghl_invoice_id,
              invoiceData.invoice_number,
              invoiceData.due_date,
              invoiceData.sent_at
            ]
          )
          created++
        }

        // Si está pagado, actualizar estadísticas del contacto
        if (invoiceData.status === 'paid' && invoiceData.contact_id) {
          await updateContactStats(invoiceData.contact_id)
        }

        await activatePaymentFlowFromPaidInvoice(ghlInvoiceId, invoiceData)

        const transitionedToPaid = invoiceData.contact_id &&
          isSuccessfulPaymentStatus(invoiceData.status) &&
          existing &&
          !isSuccessfulPaymentStatus(existing.status)

        if (transitionedToPaid) {
          await triggerWhatsappFirstPurchaseEvent(invoiceData.contact_id, {
            amount: invoiceData.amount,
            currency: invoiceData.currency,
            paymentMode: invoiceData.payment_mode
          })
        }

      } catch (error) {
        logger.error(`Error procesando invoice ${invoice.id}:`, error)
        skipped++
      }
    }

    const stats = {
      totalFetched: allInvoices.length,
      created,
      updated,
      skipped
    }

    logger.success(`✅ Sincronización completa finalizada: ${JSON.stringify(stats)}`)

    return stats

  } catch (error) {
    logger.error('❌ Error en sincronización completa de invoices:', error)
    throw error
  }
}

/**
 * Sincroniza UN invoice específico desde HighLevel a BD local (upsert seguro)
 * Usado después de crear/pagar un invoice para asegurar que la BD refleja el estado real de GHL.
 * Protección anti-race condition: nunca hace downgrade de 'paid' a 'draft'.
 *
 * @param {string} invoiceId - ID del invoice en HighLevel
 * @returns {Promise<Object>} - { success, invoiceId, status }
 */
export async function syncSingleInvoice(invoiceId) {
  try {
    const ghlClient = await getGHLClient()
    const response = await ghlClient.getInvoice(invoiceId)
    const invoice = response.invoice || response

    if (!invoice || (!invoice.id && !invoice._id)) {
      throw new Error(`Invoice ${invoiceId} no encontrado en HighLevel`)
    }

    const ghlInvoiceId = invoice.id || invoice._id
    const contactId = invoice.contactDetails?.id || invoice.contactId

    const ghlStatus = mapInvoiceStatus(invoice.status)
    const invoiceNumber = invoice.invoiceNumber || null
    const existing = await findExistingPaymentForInvoice({
      invoiceId: ghlInvoiceId,
      contactId,
      invoiceNumber
    })

    const invoiceData = {
      contact_id: contactId || null,
      amount: invoice.total || invoice.amount || 0,
      currency: invoice.currency || 'MXN',
      status: ghlStatus,
      payment_method: invoice.paymentMode || null,
      payment_mode: getInvoicePaymentMode(invoice, existing?.payment_mode || 'live'),
      reference: invoiceNumber,
      title: getInvoiceDisplayTitle(invoice),
      description: getInvoiceDisplayDescription(invoice),
      date: invoice.createdAt || invoice.issueDate || new Date().toISOString(),
      invoice_number: invoiceNumber,
      due_date: invoice.dueDate || null,
      sent_at: invoice.sentAt || null,
    }

    if (existing) {
      // Protección anti-race condition: si local ya tiene 'paid' y GHL aún no lo refleja,
      // conservar 'paid' y solo actualizar los demás campos.
      const statusToSave = existing.status === 'paid' ? 'paid' : invoiceData.status

      await db.run(
        `UPDATE payments
         SET status = ?, amount = ?, currency = ?, payment_method = ?,
             payment_mode = ?, reference = ?, title = ?, description = ?, contact_id = ?,
             ghl_invoice_id = ?, invoice_number = ?, due_date = ?, sent_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          statusToSave,
          invoiceData.amount,
          invoiceData.currency,
          invoiceData.payment_method,
          invoiceData.payment_mode,
          invoiceData.reference,
          invoiceData.title,
          invoiceData.description,
          invoiceData.contact_id,
          ghlInvoiceId,
          invoiceData.invoice_number,
          invoiceData.due_date,
          invoiceData.sent_at,
          existing.id
        ]
      )
      logger.info(`Invoice actualizado desde GHL: ${ghlInvoiceId} (${statusToSave})`)
    } else {
      // No existe en BD — insertar. Si el contacto no existe en contacts, guardarlo igual con contact_id null.
      await db.run(
        `INSERT INTO payments (
          id, contact_id, amount, currency, status, payment_method, payment_mode,
          reference, title, description, date, ghl_invoice_id, invoice_number,
          due_date, sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          ghlInvoiceId,
          invoiceData.contact_id,
          invoiceData.amount,
          invoiceData.currency,
          invoiceData.status,
          invoiceData.payment_method,
          invoiceData.payment_mode,
          invoiceData.reference,
          invoiceData.title,
          invoiceData.description,
          invoiceData.date,
          ghlInvoiceId,
          invoiceData.invoice_number,
          invoiceData.due_date,
          invoiceData.sent_at
        ]
      )
      logger.info(`Invoice insertado desde GHL: ${ghlInvoiceId} (${invoiceData.status})`)
    }

    // Actualizar stats del contacto si está pagado
    if (['paid', 'succeeded', 'completed'].includes(invoiceData.status) && invoiceData.contact_id) {
      await updateContactStats(invoiceData.contact_id)
    }

    await activatePaymentFlowFromPaidInvoice(ghlInvoiceId, invoiceData)

    const transitionedToPaid = invoiceData.contact_id &&
      isSuccessfulPaymentStatus(invoiceData.status) &&
      existing &&
      !isSuccessfulPaymentStatus(existing.status)

    if (transitionedToPaid) {
      await triggerWhatsappFirstPurchaseEvent(invoiceData.contact_id, {
        amount: invoiceData.amount,
        currency: invoiceData.currency,
        paymentMode: invoiceData.payment_mode
      })
    }

    return { success: true, invoiceId: ghlInvoiceId, status: invoiceData.status }
  } catch (error) {
    logger.error(`Error en syncSingleInvoice(${invoiceId}): ${error.message}`)
    throw error
  }
}

/**
 * Mapea el status de HighLevel a nuestros estados internos
 * @param {string} ghlStatus - Status de HighLevel
 * @returns {string} - Status interno
 */
function mapInvoiceStatus(ghlStatus) {
  // Mapeo directo 1:1 - mantenemos TODOS los estados de HighLevel
  const statusMap = {
    'draft': 'draft',                // Borrador
    'sent': 'sent',                  // Enviado
    'paid': 'paid',                  // Pagado
    'void': 'void',                  // Anulado
    'voided': 'void',                // Anulado (variante)
    'refunded': 'refunded',          // Reembolsado
    'partially_paid': 'partial',     // Parcialmente pagado
    'partial': 'partial',            // Parcialmente pagado (variante)
    'pending': 'pending',            // Pendiente
    'overdue': 'overdue',            // Vencido
    'deleted': 'deleted'             // Eliminado
  }

  return statusMap[ghlStatus] || ghlStatus || 'pending'
}

/**
 * Actualiza las estadísticas de un contacto (total_paid, purchases_count, last_purchase_date)
 * @param {string} contactId - ID del contacto
 */
async function updateContactStats(contactId) {
  try {
    // Calcular estadísticas desde los pagos (SOLO pagos exitosos, NO refunded/cancelled)
    const stats = await db.get(
      `SELECT
        SUM(amount) as total_paid,
        COUNT(*) as purchases_count,
        MAX(date) as last_purchase_date
       FROM payments
       WHERE contact_id = ?
       AND amount > 0
       AND LOWER(status) IN ('succeeded', 'paid', 'completed', 'complete', 'fulfilled', 'success')
       AND ${nonTestPaymentCondition()}`,
      [contactId]
    )

    if (stats) {
      await db.run(
        `UPDATE contacts
         SET total_paid = ?, purchases_count = ?, last_purchase_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          stats.total_paid || 0,
          stats.purchases_count || 0,
          stats.last_purchase_date || null,
          contactId
        ]
      )
    }
  } catch (error) {
    logger.error(`Error actualizando stats del contacto ${contactId}:`, error)
  }
}

/**
 * Obtiene todos los invoices desde BD local con filtros opcionales
 * @param {Object} filters - Filtros opcionales
 * @param {string} filters.status - Filtrar por status
 * @param {string} filters.contactId - Filtrar por contacto
 * @param {number} filters.limit - Límite de resultados
 * @param {number} filters.offset - Offset para paginación
 * @returns {Promise<Array>} - Lista de invoices
 */
export async function getInvoicesFromDB({ status, contactId, limit = 100, offset = 0 } = {}) {
  try {
    let query = 'SELECT * FROM payments WHERE 1=1'
    const params = []

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (contactId) {
      query += ' AND contact_id = ?'
      params.push(contactId)
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const invoices = await db.all(query, params)

    return invoices

  } catch (error) {
    logger.error('Error obteniendo invoices desde BD:', error)
    throw error
  }
}

/**
 * Obtiene un invoice específico por su ghl_invoice_id
 * @param {string} ghlInvoiceId - ID del invoice en HighLevel
 * @returns {Promise<Object>} - Datos del invoice
 */
export async function getInvoiceByGHLId(ghlInvoiceId) {
  try {
    const invoice = await db.get(
      'SELECT * FROM payments WHERE ghl_invoice_id = ?',
      [ghlInvoiceId]
    )

    return invoice

  } catch (error) {
    logger.error(`Error obteniendo invoice ${ghlInvoiceId}:`, error)
    throw error
  }
}
