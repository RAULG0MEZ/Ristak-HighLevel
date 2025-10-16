import express from 'express'
import * as paymentMethodsController from '../controllers/paymentMethodsController.js'

const router = express.Router()

// GET /api/payment-methods/contact/:contactId
// Obtiene todas las tarjetas guardadas de un contacto
router.get('/contact/:contactId', paymentMethodsController.getContactPaymentMethods)

// POST /api/payment-methods/charge
// Cobra a una tarjeta guardada
router.post('/charge', paymentMethodsController.chargePaymentMethod)

// POST /api/payment-methods/save
// Guarda un payment method manualmente
router.post('/save', paymentMethodsController.savePaymentMethod)

export default router
