import express from 'express'
import {
  getTransactions,
  getTransactionById,
  getTransactionStats,
  getTransactionSummary,
  deleteTransaction
} from '../controllers/transactionsController.js'

const router = express.Router()

// Rutas principales
router.get('/', getTransactions)
router.get('/stats', getTransactionStats)
router.get('/summary', getTransactionSummary)
router.get('/:id', getTransactionById)
router.delete('/:id', deleteTransaction)

export default router