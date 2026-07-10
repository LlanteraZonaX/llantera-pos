import { query, getClient } from '../config/db.js';

const generarFolio = async (client, negocio_id) => {
  const año = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM compras WHERE EXTRACT(YEAR FROM created_at) = $1 AND negocio_id = $2`,
    [año, negocio_id]
  );
  return `CPR-${año}-${String(parseInt(rows[0].count) + 1).padStart(5, '0')}`;
};

export const listar = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { rows } = await query(
      `SELECT c.*, u.nombre as usuario_nombre
       FROM compras c LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.negocio_id = $1 ORDER BY c.fecha_recepcion DESC
       LIMIT $2 OFFSET $3`,
      [req.user.negocio_id, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener compras' });
  }
};

export const obtener = async (req, res) => {
  try {
    const { rows: [compra] } = await query(
      `SELECT c.* FROM compras c WHERE c.id = $1 AND c.negocio_id = $2`,
      [req.params.id, req.user.negocio_id]
    );
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });

    const { rows: detalle } = await query(
      `SELECT cd.*, p.nombre as producto_nombre, p.medida
       FROM compras_detalle cd JOIN productos p ON cd.producto_id = p.id
       WHERE cd.compra_id = $1`,
      [compra.id]
    );
    res.json({ ...compra, detalle });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener compra' });
  }
};

export const crear = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;

    // aplicar_iva: false por defecto — el IVA solo se suma si el usuario lo activa
    const { proveedor, fecha_recepcion, num_factura, notas, items = [], aplicar_iva = false } = req.body;

    if (!items.length) throw new Error('La compra debe tener al menos un producto');

    let subtotal = 0;
    const detalles = [];

    for (const item of items) {
      const cant = parseFloat(item.cantidad) || 0;
      const costo = parseFloat(item.costo_unitario) || 0;
      if (cant <= 0 || costo <= 0) throw new Error('Cada producto debe tener cantidad y costo mayores a 0');

      const { rows: [prod] } = await client.query(
        'SELECT id, nombre, stock_actual FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
        [item.producto_id, negocio_id]
      );
      if (!prod) throw new Error(`Producto ${item.producto_id} no encontrado`);

      subtotal += cant * costo;
      detalles.push({ prod, cant, costo });
    }

    const iva = aplicar_iva ? subtotal * 0.16 : 0;
    const total = subtotal + iva;
    const folio = await generarFolio(client, negocio_id);

    const { rows: [compra] } = await client.query(
      `INSERT INTO compras (negocio_id, folio, proveedor, fecha_recepcion, num_factura, notas, subtotal, iva, total, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [negocio_id, folio, proveedor || null, fecha_recepcion || new Date(),
       num_factura || null, notas || null, subtotal, iva, total, req.user.id]
    );

    for (const { prod, cant, costo } of detalles) {
      await client.query(
        `INSERT INTO compras_detalle (compra_id, producto_id, cantidad, costo_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [compra.id, prod.id, cant, costo, cant * costo]
      );
      const stock_nuevo = parseFloat(prod.stock_actual) + cant;
      await client.query(
        'UPDATE productos SET stock_actual = $1, updated_at = NOW() WHERE id = $2',
        [stock_nuevo, prod.id]
      );
      await client.query(
        `INSERT INTO movimientos_inventario
           (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, usuario_id, negocio_id)
         VALUES ($1,'entrada',$2,$3,$4,'compra',$5,$6,$7)`,
        [prod.id, cant, prod.stock_actual, stock_nuevo, compra.id, req.user.id, negocio_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...compra, mensaje: `Compra ${folio} registrada correctamente` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar la compra' });
  } finally {
    client.release();
  }
};
