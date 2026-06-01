import express from 'express'
import {
  completeSignup,
  getConfig,
  refreshStatus,
  saveConfig
} from '../controllers/whatsappController.js'

const router = express.Router()

router.get('/config', getConfig)
router.post('/config', saveConfig)
router.post('/embedded-signup/complete', completeSignup)
router.post('/status/refresh', refreshStatus)

export default router
