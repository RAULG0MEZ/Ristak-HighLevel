import express from 'express'
import {
  connectWhatsAppWeb,
  disconnectWhatsAppWeb,
  getWhatsAppWebAnalyticsView,
  getWhatsAppWebConnectionStatus,
  getWhatsAppWebLogsView,
  getWhatsAppWebMessages
} from '../controllers/whatsappWebController.js'

const router = express.Router()

router.get('/status', getWhatsAppWebConnectionStatus)
router.post('/connect', connectWhatsAppWeb)
router.post('/disconnect', disconnectWhatsAppWeb)
router.get('/messages', getWhatsAppWebMessages)
router.get('/logs', getWhatsAppWebLogsView)
router.get('/analytics', getWhatsAppWebAnalyticsView)

export default router
