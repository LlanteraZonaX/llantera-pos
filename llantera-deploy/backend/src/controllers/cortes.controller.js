import { query, getClient } from '../config/db.js';

// Corte actualmente abierto (si existe)
export const actual = async (req, res) => {
  try {
    const { rows: [corte] } = await query(
      `SELECT c.*, u.nombre as usuario_nombre
       FROM cortes_caja c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.negocio_id = $1 AND c.estado = 'abierto'
       ORDER BY c.fecha_apertura DESC LIMIT 1`,
      [req.user.negocio_id]
    );
    res.json({ corte: corte || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar corte actual' });
  }
};

// Abrir una nueva caja (solo si no hay una ya abierta)
export const abrir = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const { monto_inicial = 0, notas } = req.body;

    const { rows: [yaAbierto] } = await query(
      `SELECT id FROM cortes_caja WHERE negocio_id = $1 AND estado = 'abierto' LIMIT 1`,
      [negocio_id]
    );
    if (yaAbierto) return res.status(409).json({ error: 'Ya hay una caja abierta. Ciérrala antes de abrir otra.' });

    const { rows: [corte] } = await query(
      `INSERT INTO cortes_caja (negocio_id, usuario_id, fecha_apertura, monto_inicial, notas, estado)
       VALUES ($1, $2, NOW(), $3, $4, 'abierto') RETURNING *`,
      [negocio_id, req.user.id, parseFloat(monto_inicial) || 0, notas || null]
    );
    res.status(201).json({ corte, mensaje: 'Caja abierta correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al abrir caja' });
  }
};

// Cerrar la caja actualmente abierta.
// Calcula monto_esperado = monto_inicial + total efectivo de ventas en el turno.
export const cerrar = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { monto_final_contado, notas } = req.body;

    if (monto_final_contado === undefined || monto_final_contado === null)
      throw new Error('Debes ingresar el monto que contaste en caja');

    const { rows: [corte] } = await client.query(
      `SELECT * FROM cortes_caja WHERE negocio_id = $1 AND estado = 'abierto' ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocio_id]
    );
    if (!corte) throw new Error('No hay caja abierta que cerrar');

    // Calcular totales de ventas durante el turno
    const { rows: [totales] } = await client.query(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0) as total_ventas,
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada' AND metodo_pago = 'efectivo'), 0) as total_efectivo
       FROM ventas
       WHERE negocio_id = $1
         AND (fecha AT TIME ZONE 'America/Mexico_City') >= (corr.fecha_apertura AT TIME ZONE 'America/Mexico_City')
         AND fecha <= NOW()`,
      // Usamos subquery para pasar fecha_apertura del corte
      [negocio_id]
    );

    // Recalcular correctamente
    const { rows: [tots] } = await client.query(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0) as total_ventas,
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada' AND metodo_pago = 'efectivo'), 0) as total_efectivo
       FROM ventas
       WHERE negocio_id = $1
         AND fecha >= $2
         AND fecha <= NOW()`,
      [negocio_id, corte.fecha_apertura]
    );

    const montoFinal = parseFloat(monto_final_contado) || 0;
    const montoEsperado = parseFloat(corte.monto_inicial) + parseFloat(tots.total_efectivo);
    const diferencia = montoFinal - montoEsperado;

    const { rows: [actualizado] } = await client.query(
      `UPDATE cortes_caja SET
         fecha_cierre = NOW(),
         monto_final_contado = $1,
         monto_esperado = $2,
         total_ventas = $3,
         total_efectivo_ventas = $4,
         diferencia = $5,
         notas = COALESCE($6, notas),
         estado = 'cerrado'
       WHERE id = $7
       RETURNING *`,
      [montoFinal, montoEsperado, tots.total_ventas, tots.total_efectivo, diferencia, notas || null, corte.id]
    );

    await client.query('COMMIT');
    res.json({ corte: actualizado, mensaje: diferencia === 0 ? 'Caja cerrada — cuentas exactas ✓' : `Caja cerrada — diferencia de ${diferencia > 0 ? '+' : ''}$${Math.abs(diferencia).toFixed(2)}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al cerrar caja' });
  } finally {
    client.release();
  }
};

// Historial de cortes anteriores (cerrados)
export const historial = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { rows } = await query(
      `SELECT c.*, u.nombre as usuario_nombre
       FROM cortes_caja c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.negocio_id = $1
       ORDER BY c.fecha_apertura DESC
       LIMIT $2 OFFSET $3`,
      [req.user.negocio_id, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de cortes' });
  }
};
