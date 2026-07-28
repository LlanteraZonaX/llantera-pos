import { query, getClient } from '../config/db.js';

// Corte actualmente abierto
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

// Abrir caja
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

// Cerrar caja
// monto_esperado = fondo_inicial + ventas_efectivo - gastos_efectivo_del_turno
export const cerrar = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { monto_final_contado, notas } = req.body;

    if (monto_final_contado === undefined || monto_final_contado === null)
      throw new Error('Debes ingresar el monto que contaste en caja');

    const { rows: [corte] } = await client.query(
      `SELECT * FROM cortes_caja
       WHERE negocio_id = $1 AND estado = 'abierto'
       ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE`,
      [negocio_id]
    );
    if (!corte) throw new Error('No hay caja abierta que cerrar');

    // Ventas capturadas durante el turno (created_at para incluir ventas atrasadas ingresadas hoy)
    const { rows: [tots] } = await client.query(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0)                              AS total_ventas,
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada' AND metodo_pago = 'efectivo'), 0) AS total_efectivo
       FROM ventas
       WHERE negocio_id = $1
         AND created_at >= $2
         AND created_at <= NOW()`,
      [negocio_id, corte.fecha_apertura]
    );

    // Gastos del turno — se restan del efectivo esperado en caja
    // Los gastos en efectivo salen físicamente de la caja durante el turno
    const { rows: [gastosTurno] } = await client.query(
      `SELECT
         COALESCE(SUM(monto), 0)                                        AS total_gastos,
         COALESCE(SUM(monto) FILTER (WHERE metodo_pago = 'efectivo'), 0) AS gastos_efectivo
       FROM gastos
       WHERE negocio_id = $1
         AND fecha >= $2::date
         AND fecha <= COALESCE($3::date, CURRENT_DATE)`,
      [negocio_id, corte.fecha_apertura, null]
    );

    const montoFinal    = parseFloat(monto_final_contado) || 0;
    const gastosEfectivo = parseFloat(gastosTurno.gastos_efectivo) || 0;

    // Fórmula correcta: lo que debería haber físicamente en caja
    // = fondo_inicial + lo que entró (ventas efectivo) - lo que salió (gastos efectivo)
    const montoEsperado = parseFloat(corte.monto_inicial)
                        + parseFloat(tots.total_efectivo)
                        - gastosEfectivo;

    const diferencia = montoFinal - montoEsperado;

    const { rows: [actualizado] } = await client.query(
      `UPDATE cortes_caja SET
         fecha_cierre          = NOW(),
         monto_final_contado   = $1,
         monto_esperado        = $2,
         total_ventas          = $3,
         total_efectivo_ventas = $4,
         diferencia            = $5,
         notas                 = COALESCE($6, notas),
         estado                = 'cerrado'
       WHERE id = $7
       RETURNING *`,
      [montoFinal, montoEsperado, tots.total_ventas, tots.total_efectivo,
       diferencia, notas || null, corte.id]
    );

    await client.query('COMMIT');

    const msgDif = diferencia === 0
      ? 'Caja cerrada — cuentas exactas ✓'
      : `Caja cerrada — diferencia de ${diferencia > 0 ? '+' : ''}$${Math.abs(diferencia).toFixed(2)}`;

    res.json({ corte: actualizado, mensaje: msgDif });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al cerrar caja' });
  } finally {
    client.release();
  }
};

// Historial de cortes
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

// Detalle completo de un corte — para el PDF
// Incluye ventas Y gastos del turno
export const detalle = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const { rows: [corte] } = await query(
      `SELECT c.*, u.nombre as usuario_nombre,
              n.nombre        as negocio_nombre,
              n.logo_url,
              n.telefono      as negocio_telefono,
              n.direccion     as negocio_direccion,
              n.facebook_url  as negocio_facebook
       FROM cortes_caja c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       JOIN negocios n      ON c.negocio_id = n.id
       WHERE c.id = $1 AND c.negocio_id = $2`,
      [req.params.id, negocio_id]
    );
    if (!corte) return res.status(404).json({ error: 'Corte no encontrado' });

    // Resumen de ventas del turno
    const { rows: ventas } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE estado = 'pagada')                                              AS num_ventas,
         COALESCE(SUM(total)     FILTER (WHERE estado = 'pagada'), 0)                          AS total_ventas,
         COALESCE(SUM(total)     FILTER (WHERE estado = 'pagada' AND metodo_pago = 'efectivo'),      0) AS efectivo,
         COALESCE(SUM(total)     FILTER (WHERE estado = 'pagada' AND metodo_pago = 'tarjeta'),       0) AS tarjeta,
         COALESCE(SUM(total)     FILTER (WHERE estado = 'pagada' AND metodo_pago = 'transferencia'), 0) AS transferencia,
         COALESCE(SUM(descuento) FILTER (WHERE estado = 'pagada'), 0)                          AS total_descuentos,
         COALESCE(SUM(iva)       FILTER (WHERE estado = 'pagada'), 0)                          AS total_iva
       FROM ventas
       WHERE negocio_id = $1
         AND created_at >= $2
         AND created_at <= COALESCE($3::timestamptz, NOW())`,
      [negocio_id, corte.fecha_apertura, corte.fecha_cierre]
    );

    // Gastos del turno (para mostrar en el PDF)
    const { rows: gastos } = await query(
      `SELECT g.descripcion, g.monto, g.metodo_pago,
              g.fecha,
              COALESCE(cg.nombre, 'Sin categoría') AS categoria
       FROM gastos g
       LEFT JOIN categorias_gasto cg ON g.categoria_id = cg.id
       WHERE g.negocio_id = $1
         AND g.fecha >= $2::date
         AND g.fecha <= COALESCE($3::date, CURRENT_DATE)
       ORDER BY g.fecha DESC`,
      [negocio_id, corte.fecha_apertura, corte.fecha_cierre]
    );

    const resumen_gastos = {
      total_gastos:    gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0),
      gastos_efectivo: gastos.filter(g => g.metodo_pago === 'efectivo').reduce((s, g) => s + parseFloat(g.monto || 0), 0),
      detalle: gastos,
    };

    // Últimas ventas del turno
    // Productos vendidos durante el turno (agrupados por producto)
    const { rows: productosTurno } = await query(
      `SELECT
         p.nombre, p.medida,
         SUM(vd.cantidad)  AS cantidad,
         SUM(vd.subtotal)  AS total,
         COUNT(DISTINCT v.id) AS num_ventas
       FROM ventas_detalle vd
       JOIN ventas    v  ON vd.venta_id   = v.id
       JOIN productos p  ON vd.producto_id = p.id
       WHERE v.negocio_id = $1
         AND v.created_at >= $2
         AND v.created_at <= COALESCE($3::timestamptz, NOW())
         AND v.estado = 'pagada'
       GROUP BY p.id, p.nombre, p.medida
       ORDER BY cantidad DESC`,
      [negocio_id, corte.fecha_apertura, corte.fecha_cierre]
    );

    const { rows: ultimas } = await query(
      `SELECT v.folio, (v.fecha AT TIME ZONE 'America/Mexico_City') AS fecha_local,
              v.total, v.metodo_pago, v.descuento,
              COALESCE(c.nombre, 'Cliente general') AS cliente_nombre
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.negocio_id = $1
         AND v.created_at >= $2
         AND v.created_at <= COALESCE($3::timestamptz, NOW())
         AND v.estado = 'pagada'
       ORDER BY v.fecha DESC LIMIT 20`,
      [negocio_id, corte.fecha_apertura, corte.fecha_cierre]
    );

    res.json({ ...corte, resumen_ventas: ventas[0], resumen_gastos, productos_turno: productosTurno, ultimas_ventas: ultimas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener detalle del corte' });
  }
};
