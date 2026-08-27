// health.controller.js
// Verifica que el backend y su conexión a base de datos estén operando.
import pool from '../config/db.js';

export async function checkHealth(req, res) {
  const startedAt = Date.now();
  const result = {
    status: 'ok',
    servicio: 'llantera-backend',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  try {
    await pool.query('SELECT 1');
    result.checks.database = { status: 'ok' };
  } catch (err) {
    result.status = 'degraded';
    result.checks.database = { status: 'error', message: err.message };
  }

  result.response_time_ms = Date.now() - startedAt;

  const httpStatus = result.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(result);
}
