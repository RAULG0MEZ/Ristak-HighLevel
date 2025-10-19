import express from 'express';
import { fixVisitorIds } from '../controllers/maintenanceController.js';

const router = express.Router();

// Endpoint de mantenimiento para actualizar visitor_ids
router.post('/fix-visitor-ids', fixVisitorIds);

export default router;
