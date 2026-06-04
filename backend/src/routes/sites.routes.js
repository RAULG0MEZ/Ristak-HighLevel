import express from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import {
  createBlockHandler,
  createSiteHandler,
  deleteBlockHandler,
  deleteSiteHandler,
  getSiteHandler,
  getSitesHandler,
  reorderBlocksHandler,
  submitPublicSiteHandler,
  updateBlockHandler,
  updateSiteHandler,
  verifySiteDomainHandler
} from '../controllers/sitesController.js'

const router = express.Router()

router.post('/public/submit', submitPublicSiteHandler)

router.use(requireAuth)

router.get('/', getSitesHandler)
router.post('/', createSiteHandler)
router.get('/:siteId', getSiteHandler)
router.put('/:siteId', updateSiteHandler)
router.delete('/:siteId', deleteSiteHandler)
router.post('/:siteId/verify-domain', verifySiteDomainHandler)
router.post('/:siteId/blocks', createBlockHandler)
router.put('/:siteId/blocks/reorder', reorderBlocksHandler)
router.put('/:siteId/blocks/:blockId', updateBlockHandler)
router.delete('/:siteId/blocks/:blockId', deleteBlockHandler)

export default router
