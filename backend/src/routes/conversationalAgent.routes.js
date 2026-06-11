import express from 'express'
import {
  getConfig,
  saveConfig,
  listStates,
  getState,
  updateState,
  testAgent,
  listEvents
} from '../controllers/conversationalAgentController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(requireAuth)

router.get('/config', getConfig)
router.post('/config', saveConfig)
router.get('/states', listStates)
router.get('/states/:contactId', getState)
router.post('/states/:contactId', updateState)
router.post('/test', testAgent)
router.get('/events', listEvents)

export default router
