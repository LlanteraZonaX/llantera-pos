// health.routes.js
import express from 'express';
import { checkHealth } from '../controllers/health.controller.js';

const router = express.Router();

// GET /health -> usado por UptimeRobot / Better Stack para monitoreo externo
router.get('/health', checkHealth);

export default router;
