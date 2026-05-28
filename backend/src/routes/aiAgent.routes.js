import express from 'express'
import { chat, deleteConfig, getConfig, saveConfig } from '../controllers/aiAgentController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(requireAuth)

router.get('/config', getConfig)
router.post('/config', saveConfig)
router.delete('/config', deleteConfig)
router.post('/chat', chat)

export default router
