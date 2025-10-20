import express from 'express'
import {
  getHiddenFilters,
  addHiddenFilter,
  deleteHiddenFilter
} from '../controllers/hiddenContactsController.js'

const router = express.Router()

router.get('/', getHiddenFilters)
router.post('/', addHiddenFilter)
router.delete('/:id', deleteHiddenFilter)

export default router
