import express from 'express';
import { getTimezone, setTimezone } from '../controllers/settingsController.js';

const router = express.Router();

// GET /api/settings/timezone
router.get('/timezone', getTimezone);

// POST /api/settings/timezone
router.post('/timezone', setTimezone);

export default router;
