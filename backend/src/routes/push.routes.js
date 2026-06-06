import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import {
  disableMobileDevice,
  disableSubscription,
  getPushPublicKey,
  saveMobileDevice,
  saveSubscription
} from '../controllers/pushController.js'

const router = express.Router()

router.get('/public-key', getPushPublicKey)
router.post('/subscriptions', requireAuth, saveSubscription)
router.delete('/subscriptions', requireAuth, disableSubscription)
router.post('/mobile-devices', requireAuth, saveMobileDevice)
router.delete('/mobile-devices', requireAuth, disableMobileDevice)

export default router
