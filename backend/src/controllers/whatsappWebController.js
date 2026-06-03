import {
  disconnectWhatsAppWebSession,
  getRecentWhatsAppWebMessages,
  getWhatsAppWebLogs,
  getWhatsAppWebStatus,
  startWhatsAppWebSession
} from '../services/whatsappWebService.js'
import { getWhatsAppWebAnalytics } from '../services/whatsappAnalyticsService.js'
import { logger } from '../utils/logger.js'

export async function getWhatsAppWebConnectionStatus(req, res) {
  try {
    const data = await getWhatsAppWebStatus()
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Error obteniendo estado de WhatsApp Business: ${error.message}`)
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado de WhatsApp Business'
    })
  }
}

export async function connectWhatsAppWeb(req, res) {
  try {
    const data = await startWhatsAppWebSession('default', { resetAuth: Boolean(req.body?.reset) })
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Error iniciando WhatsApp Business: ${error.message}`)
    res.status(500).json({
      success: false,
      error: 'Error iniciando WhatsApp Business'
    })
  }
}

export async function disconnectWhatsAppWeb(req, res) {
  try {
    const data = await disconnectWhatsAppWebSession()
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Error desconectando WhatsApp Business: ${error.message}`)
    res.status(500).json({
      success: false,
      error: 'Error desconectando WhatsApp Business'
    })
  }
}

export async function getWhatsAppWebMessages(req, res) {
  try {
    const data = await getRecentWhatsAppWebMessages('default', req.query.limit)
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Error leyendo mensajes de WhatsApp Business: ${error.message}`)
    res.status(500).json({
      success: false,
      error: 'Error leyendo mensajes de WhatsApp Business'
    })
  }
}

export async function getWhatsAppWebLogsView(req, res) {
  try {
    const data = await getWhatsAppWebLogs()
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Error leyendo logs de WhatsApp Business: ${error.message}`)
    res.status(500).json({
      success: false,
      error: 'Error leyendo logs de WhatsApp Business'
    })
  }
}

export async function getWhatsAppWebAnalyticsView(req, res) {
  try {
    const { start, end, startDate, endDate, groupBy = 'day' } = req.query
    const from = start || startDate
    const to = end || endDate

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren parámetros start y end'
      })
    }

    const data = await getWhatsAppWebAnalytics({
      startDate: from,
      endDate: to,
      groupBy
    })

    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Error leyendo analíticas de WhatsApp Business: ${error.message}`)
    res.status(500).json({
      success: false,
      error: 'Error leyendo analíticas de WhatsApp Business'
    })
  }
}
