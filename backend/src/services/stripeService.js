import Stripe from 'stripe'
import { logger } from '../utils/logger.js'

const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || '2024-06-20'
const STRIPE_MODE = (process.env.STRIPE_MODE || 'test').toLowerCase()
const STRIPE_TEST_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || ''
const STRIPE_LIVE_SECRET_KEY = process.env.STRIPE_LIVE_SECRET_KEY || ''

let cachedStripeKey = null
let cachedStripeClient = null

function resolveSecretKey() {
  if (STRIPE_MODE === 'live') {
    if (STRIPE_LIVE_SECRET_KEY) return STRIPE_LIVE_SECRET_KEY
    if (!STRIPE_TEST_SECRET_KEY) return ''
    logger.warn('STRIPE_MODE=live pero STRIPE_LIVE_SECRET_KEY no está configurado. Usando STRIPE_TEST_SECRET_KEY como fallback.')
    return STRIPE_TEST_SECRET_KEY
  }

  if (STRIPE_TEST_SECRET_KEY) return STRIPE_TEST_SECRET_KEY
  return STRIPE_LIVE_SECRET_KEY
}

function getStripeClient() {
  const secretKey = resolveSecretKey()
  if (!secretKey) {
    logger.warn('Stripe no está configurado. Define STRIPE_TEST_SECRET_KEY o STRIPE_LIVE_SECRET_KEY en el entorno.')
    return null
  }

  if (!cachedStripeClient || cachedStripeKey !== secretKey) {
    cachedStripeKey = secretKey
    cachedStripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    })
  }

  return cachedStripeClient
}

export async function findCustomerByEmail(email) {
  const stripe = getStripeClient()
  if (!stripe) {
    throw new Error('Stripe no está configurado')
  }

  if (!email) {
    throw new Error('Email del contacto no disponible')
  }

  const customers = await stripe.customers.list({
    email,
    limit: 1,
  })

  return customers.data.length > 0 ? customers.data[0] : null
}

export async function listPaymentMethods(customerId) {
  const stripe = getStripeClient()
  if (!stripe) {
    throw new Error('Stripe no está configurado')
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  })

  return paymentMethods.data
}

export async function chargePaymentMethod({ customerId, paymentMethodId, amount, currency, description }) {
  const stripe = getStripeClient()
  if (!stripe) {
    throw new Error('Stripe no está configurado')
  }

  if (!customerId || !paymentMethodId) {
    throw new Error('Faltan parámetros para procesar el pago')
  }

  const normalizedAmount = Math.round(Number(amount || 0) * 100)
  if (!normalizedAmount || normalizedAmount <= 0) {
    throw new Error('Monto inválido para procesar el pago')
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: normalizedAmount,
    currency: (currency || 'mxn').toLowerCase(),
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    description: description || 'Cobro manual',
  })

  return paymentIntent
}
