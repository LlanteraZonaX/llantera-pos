import { query } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { desde, hasta, tipo, producto_id, limit = 60, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    const where = ['m.negocio_id = $1'];
    const params = [negocio_id];

    if (desde)       { params.push(desde);       where.push(`(m.created_at AT TIME ZONE 'America/Mexico_City')::date >= $${params.length}::date`); }
    if (hasta)       { params.push(hasta);        where.push(`(m.created_at AT TIME ZONE 'America/Mexico_City')::date <= $${params.length}::date`); }
    if (tipo)        { params.push(tipo);         where.push(`m.tipo = $${params.length}`); }
    if (producto_id) { params.push(producto_id);  where.push(`m.producto_id = $${params.length}`); }

    const { rows } = await query(
      `SELECT m.id, m.tipo, m.cantidad, m.stock_antes, m.stock_despues,
              m.referencia_tipo, m.notas, m.created_at,
              p.nombre as producto_nombre, p.medida as producto_medida,
              u.nombre as usuario_nombre
       FROM movimientos_inventario m
       JOIN  productos p ON m.producto_id = p.id
       LEFT JOIN usuarios u ON m.usuario_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY m.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener movimientos de inventario' });
  }
};
