import express from 'express'
import { getMetrics, getChartData, getRoasData, getNewCustomersData, getLeadsData, getAppointmentsData, getSalesData, getStorageStatus } from '../controllers/dashboardController.js'

const router = express.Router()

router.get('/metrics', getMetrics)
router.get('/chart-data', getChartData)
router.get('/roas', getRoasData)
router.get('/new-customers', getNewCustomersData)
router.get('/leads', getLeadsData)
router.get('/appointments', getAppointmentsData)
router.get('/sales', getSalesData)
router.get('/storage-status', getStorageStatus)

export default router
