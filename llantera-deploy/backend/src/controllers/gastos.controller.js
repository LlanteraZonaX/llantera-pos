import { query } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { desde, hasta, categoria_id, limit = 50, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    let where = ['g.negocio_id = $1'];
    const params = [negocio_id];

    if (desde) { params.push(desde); where.push(`g.fecha >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`g.fecha <= $${params.length}`); }
    if (categoria_id) { params.push(categoria_id); where.push(`g.categoria_id = $${params.length}`); }

    const { rows } = await query(
      `SELECT g.*, cg.nombre as categoria_nombre, u.nombre as usuario_nombre,
              p.nombre as proveedor_nombre
       FROM gastos g
       LEFT JOIN categorias_gasto cg ON g.categoria_id = cg.id
       LEFT JOIN usuarios u ON g.usuario_id = u.id
       LEFT JOIN proveedores p ON g.proveedor_id = p.id
       WHERE ${where.join(' AND ')}
       ORDER BY g.fecha DESC, g.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const { rows: [totales] } = await query(
      `SELECT COALESCE(SUM(g.monto),0) as total,
              COUNT(*) as cantidad
       FROM gastos g WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({ data: rows, total_monto: totales.total, cantidad: parseInt(totales.cantidad) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
};

export const crear = async (req, res) => {
  try {
    const { categoria_id, descripcion, monto, fecha, metodo_pago, proveedor_id, notas } = req.body;

    if (!descripcion || !monto || !categoria_id)
      return res.status(400).json({ error: 'Categoría, descripción y monto son requeridos' });

    const { rows: [gasto] } = await query(
      `INSERT INTO gastos (categoria_id, usuario_id, descripcion, monto, fecha, metodo_pago, proveedor_id, notas, negocio_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [categoria_id, req.user.id, descripcion, monto, fecha || new Date(),
       metodo_pago || 'efectivo', proveedor_id || null, notas, req.user.negocio_id]
    );
    res.status(201).json(gasto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar gasto' });
  }
};

export const actualizar = async (req, res) => {
  try {
    const { categoria_id, descripcion, monto, fecha, metodo_pago, notas } = req.body;
    const { rows } = await query(
      `UPDATE gastos SET categoria_id=$1, descripcion=$2, monto=$3, fecha=$4,
         metodo_pago=$5, notas=$6 WHERE id=$7 AND negocio_id=$8 RETURNING *`,
      [categoria_id, descripcion, monto, fecha, metodo_pago, notas, req.params.id, req.user.negocio_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
};

export const eliminar = async (req, res) => {
  try {
    const { rows } = await query(
      'DELETE FROM gastos WHERE id=$1 AND negocio_id=$2 RETURNING id',
      [req.params.id, req.user.negocio_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json({ mensaje: 'Gasto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
};

export const resumenPorCategoria = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const negocio_id = req.user.negocio_id;
    let where = ['g.negocio_id = $1'];
    const params = [negocio_id];
    if (desde) { params.push(desde); where.push(`g.fecha >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`g.fecha <= $${params.length}`); }

    const { rows } = await query(
      `SELECT cg.nombre, SUM(g.monto) as total, COUNT(*) as cantidad
       FROM gastos g
       LEFT JOIN categorias_gasto cg ON g.categoria_id = cg.id
       WHERE ${where.join(' AND ')}
       GROUP BY cg.nombre ORDER BY total DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen de gastos' });
  }
};
