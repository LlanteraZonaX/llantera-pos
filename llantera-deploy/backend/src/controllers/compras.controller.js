import { query, getClient } from '../config/db.js';

const generarFolio = async (client) => {
  const año = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM compras WHERE EXTRACT(YEAR FROM created_at) = $1`, [año]
  );
  const num = String(parseInt(rows[0].count) + 1).padStart(5, '0');
  return `CMP-${año}-${num}`;
};

export const listar = async (req, res) => {
  try {
    const { desde, hasta, proveedor_id, limit = 20, offset = 0 } = req.query;
    let where = ['1=1'];
    const params = [];

    if (desde) { params.push(desde); where.push(`c.fecha_recepcion >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`c.fecha_recepcion <= $${params.length}`); }
    if (proveedor_id) { params.push(proveedor_id); where.push(`c.proveedor_id = $${params.length}`); }

    const { rows } = await query(
      `SELECT c.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre,
              COUNT(cd.id) as num_partidas
       FROM compras c
       LEFT JOIN proveedores p ON c.proveedor_id = p.id
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       LEFT JOIN compras_detalle cd ON cd.compra_id = c.id
       WHERE ${where.join(' AND ')}
       GROUP BY c.id, p.nombre, u.nombre
       ORDER BY c.fecha_recepcion DESC, c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
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
      `SELECT c.*, p.nombre as proveedor_nombre
       FROM compras c LEFT JOIN proveedores p ON c.proveedor_id = p.id
       WHERE c.id = $1`, [req.params.id]
    );
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });

    const { rows: detalle } = await query(
      `SELECT cd.*, pr.nombre as producto_nombre, pr.medida
       FROM compras_detalle cd
       LEFT JOIN productos pr ON cd.producto_id = pr.id
       WHERE cd.compra_id = $1
       ORDER BY cd.id`, [req.params.id]
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

    const { proveedor_id, fecha_recepcion, fecha_factura, num_factura, notas, items } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'La compra debe tener al menos un producto' });

    // Calcular totales
    let subtotal = 0;
    for (const item of items) {
      if (!item.producto_id || !item.cantidad || !item.costo_unitario)
        throw new Error(`Datos incompletos en partida: ${JSON.stringify(item)}`);
      subtotal += item.cantidad * item.costo_unitario;
    }
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    const folio = await generarFolio(client);

    // Insertar cabecera
    const { rows: [compra] } = await client.query(
      `INSERT INTO compras (folio, proveedor_id, usuario_id, fecha_recepcion, fecha_factura,
         num_factura, subtotal, iva, total, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [folio, proveedor_id, req.user.id, fecha_recepcion || new Date(),
       fecha_factura, num_factura, subtotal, iva, total, notas]
    );

    // Insertar partidas y actualizar stock
    for (const item of items) {
      // Obtener datos del producto para desnormalizar
      const { rows: [prod] } = await client.query(
        'SELECT id, nombre, medida, stock_actual FROM productos WHERE id = $1 FOR UPDATE',
        [item.producto_id]
      );
      if (!prod) throw new Error(`Producto ${item.producto_id} no encontrado`);

      await client.query(
        `INSERT INTO compras_detalle (compra_id, producto_id, medida, descripcion, cantidad, costo_unitario)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [compra.id, prod.id, prod.medida, prod.nombre, item.cantidad, item.costo_unitario]
      );

      // Actualizar stock y registrar movimiento
      const stock_despues = prod.stock_actual + item.cantidad;
      await client.query(
        'UPDATE productos SET stock_actual = $1, precio_compra = $2, updated_at = NOW() WHERE id = $3',
        [stock_despues, item.costo_unitario, prod.id]
      );
      await client.query(
        `INSERT INTO movimientos_inventario
           (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, usuario_id, notas)
         VALUES ($1,'entrada',$2,$3,$4,'compra',$5,$6,$7)`,
        [prod.id, item.cantidad, prod.stock_actual, stock_despues, compra.id, req.user.id, `Compra ${folio}`]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...compra, mensaje: `Compra ${folio} registrada correctamente` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar compra' });
  } finally {
    client.release();
  }
};
