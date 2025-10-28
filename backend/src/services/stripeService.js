import Stripe from 'stripe'
import { db } from '../config/database.js'
import { decrypt } from '../utils/encryption.js'
import { logger } from '../utils/logger.js'

/**
 * Obtiene una instancia de Stripe configurada según el location
 * @param {string} locationId - ID del location en HighLevel
 * @returns {Stripe} - Instancia de Stripe
 */
export async function getStripeClient(locationId) {
  try {
    // Obtener configuración del location
    const config = await db.get(
      'SELECT stripe_test_secret_key_encrypted, stripe_live_secret_key_encrypted, stripe_mode FROM highlevel_config WHERE location_id = ?',
      [locationId]
    )

    if (!config) {
      logger.warn('No se encontró configuración de Stripe para este location')
      return null
    }

    // Elegir qué clave usar según el modo
    const isLiveMode = config.stripe_mode === 'live'
    const encryptedKey = isLiveMode
      ? config.stripe_live_secret_key_encrypted
      : config.stripe_test_secret_key_encrypted

    if (!encryptedKey) {
      logger.warn(`No hay clave de Stripe configurada para modo ${config.stripe_mode}`)
      return null
    }

    // Desencriptar clave
    const secretKey = decrypt(encryptedKey)

    // Crear instancia de Stripe
    return new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia'
    })
  } catch (error) {
    logger.warn('Error obteniendo cliente Stripe:', error)
    return null
  }
}

/**
 * Busca un cliente de Stripe por email
 */
export async function findCustomerByEmail(locationId, email) {
  try {
    const stripe = await getStripeClient(locationId)

    if (!stripe) {
      return null
    }

    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    })

    if (customers.data.length === 0) {
      return null
    }

    return customers.data[0]
  } catch (error) {
    logger.warn('Error buscando cliente por email:', error)
    return null
  }
}

/**
 * Crea un nuevo cliente en Stripe
 */
export async function createCustomer(locationId, contactData) {
  try {
    const stripe = await getStripeClient(locationId)

    const customer = await stripe.customers.create({
      email: contactData.email,
      name: contactData.name,
      phone: contactData.phone,
      metadata: {
        ghl_contact_id: contactData.contactId,
        ghl_location_id: locationId
      }
    })

    logger.info('Cliente creado en Stripe:', customer.id)
    return customer
  } catch (error) {
    logger.error('Error creando cliente en Stripe:', error)
    throw error
  }
}

/**
 * Lista todos los métodos de pago de un cliente
 */
export async function listPaymentMethods(locationId, customerId) {
  try {
    const stripe = await getStripeClient(locationId)

    if (!stripe) {
      return []
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    })

    return paymentMethods.data
  } catch (error) {
    logger.warn('Error listando métodos de pago:', error)
    return []
  }
}

/**
 * Obtiene los detalles de un payment method
 */
export async function getPaymentMethod(locationId, paymentMethodId) {
  try {
    const stripe = await getStripeClient(locationId)
    return await stripe.paymentMethods.retrieve(paymentMethodId)
  } catch (error) {
    logger.error('Error obteniendo payment method:', error)
    throw error
  }
}

/**
 * Cobra a un payment method específico
 */
export async function chargePaymentMethod(locationId, chargeData) {
  try {
    const stripe = await getStripeClient(locationId)

    const {
      customerId,
      paymentMethodId,
      amount,
      currency = 'mxn',
      description = 'Pago de servicios'
    } = chargeData

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description,
      metadata: {
        ghl_location_id: locationId,
        ghl_contact_id: chargeData.contactId || '',
        ghl_invoice_id: chargeData.invoiceId || ''
      }
    })

    logger.info('Cobro exitoso en Stripe:', paymentIntent.id)
    return paymentIntent
  } catch (error) {
    logger.error('Error cobrando a payment method:', error)
    throw error
  }
}

/**
 * Verifica el status de un PaymentIntent
 */
export async function getPaymentIntent(locationId, paymentIntentId) {
  try {
    const stripe = await getStripeClient(locationId)
    return await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch (error) {
    logger.error('Error obteniendo PaymentIntent:', error)
    throw error
  }
}

/**
 * Guarda un payment method en la base de datos local
 */
export async function savePaymentMethod(data) {
  try {
    const {
      locationId,
      contactId,
      contactName,
      contactEmail,
      stripeCustomerId,
      stripePaymentMethodId,
      brand,
      last4,
      expMonth,
      expYear,
      isDefault = false
    } = data

    const id = 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

    await db.run(
      `INSERT INTO payment_methods (
        id, location_id, contact_id, contact_name, contact_email,
        stripe_customer_id, stripe_payment_method_id,
        brand, last4, exp_month, exp_year, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stripe_payment_method_id) DO UPDATE SET
        contact_name = excluded.contact_name,
        contact_email = excluded.contact_email,
        updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        locationId,
        contactId,
        contactName,
        contactEmail,
        stripeCustomerId,
        stripePaymentMethodId,
        brand,
        last4,
        expMonth,
        expYear,
        isDefault ? 1 : 0
      ]
    )

    logger.info('Payment method guardado:', stripePaymentMethodId)
    return id
  } catch (error) {
    logger.error('Error guardando payment method:', error)
    throw error
  }
}

/**
 * Obtiene todos los payment methods de un contacto desde la DB local
 */
export async function getContactPaymentMethods(contactId) {
  try {
    const methods = await db.all(
      `SELECT * FROM payment_methods
       WHERE contact_id = ? AND is_active = 1
       ORDER BY is_default DESC, created_at DESC`,
      [contactId]
    )

    return methods
  } catch (error) {
    logger.error('Error obteniendo payment methods del contacto:', error)
    throw error
  }
}

/**
 * Marca un payment method como usado
 */
export async function markPaymentMethodAsUsed(paymentMethodId) {
  try {
    await db.run(
      'UPDATE payment_methods SET last_used_at = CURRENT_TIMESTAMP WHERE stripe_payment_method_id = ?',
      [paymentMethodId]
    )
  } catch (error) {
    logger.error('Error marcando payment method como usado:', error)
  }
}

/**
 * Desactiva un payment method (tarjeta expirada o eliminada)
 */
export async function deactivatePaymentMethod(paymentMethodId) {
  try {
    await db.run(
      'UPDATE payment_methods SET is_active = 0 WHERE stripe_payment_method_id = ?',
      [paymentMethodId]
    )
    logger.info('Payment method desactivado:', paymentMethodId)
  } catch (error) {
    logger.error('Error desactivando payment method:', error)
  }
}
