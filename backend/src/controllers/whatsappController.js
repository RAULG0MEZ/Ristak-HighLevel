import {
  completeEmbeddedSignup,
  getWhatsAppConfig,
  getWhatsAppStorageSummary,
  logWhatsAppServiceError,
  refreshWhatsAppConnectionStatus,
  saveWhatsAppConfig
} from '../services/whatsappCoexistenceService.js'

export const getConfig = async (req, res) => {
  try {
    const [config, storage] = await Promise.all([
      getWhatsAppConfig(),
      getWhatsAppStorageSummary()
    ])

    res.json({ success: true, data: { config, storage } })
  } catch (error) {
    logWhatsAppServiceError('getConfig', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const saveConfig = async (req, res) => {
  try {
    const config = await saveWhatsAppConfig(req.body || {})
    res.json({ success: true, data: config })
  } catch (error) {
    logWhatsAppServiceError('saveConfig', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

export const completeSignup = async (req, res) => {
  try {
    const config = await completeEmbeddedSignup({
      code: req.body?.code,
      sessionPayload: req.body?.sessionPayload || req.body?.sessionInfo || {},
      responsePayload: req.body?.responsePayload || req.body?.authResponse || {}
    })
    const storage = await getWhatsAppStorageSummary()

    res.json({ success: true, data: { config, storage } })
  } catch (error) {
    logWhatsAppServiceError('completeSignup', error)
    res.status(400).json({
      success: false,
      error: error.message,
      meta: error.meta || undefined
    })
  }
}

export const refreshStatus = async (req, res) => {
  try {
    const config = await refreshWhatsAppConnectionStatus()
    const storage = await getWhatsAppStorageSummary()
    res.json({ success: true, data: { config, storage } })
  } catch (error) {
    logWhatsAppServiceError('refreshStatus', error)
    res.status(400).json({
      success: false,
      error: error.message,
      meta: error.meta || undefined
    })
  }
}
