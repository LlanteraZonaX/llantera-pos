import { query, getClient } from '../config/db.js';

const generarFolio = async (client, negocio_id) => {
  const año = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ventas WHERE EXTRACT(YEAR FROM created_at) = $1 AND negocio_id = $2`, [año, negocio_id]
  );
  const num = String(parseInt(rows[0].count) + 1).padStart(6, '0');
  return `VTA-${año}-${num}`;
};

export const listar = async (req, res) => {
  try {
    const { desde, hasta, cliente_id, estado, limit = 30, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    let where = ['v.negocio_id = $1'];
    const params = [negocio_id];

    if (desde) { params.push(desde); where.push(`(v.fecha AT TIME ZONE 'America/Mexico_City')::date >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); where.push(`(v.fecha AT TIME ZONE 'America/Mexico_City')::date <= $${params.length}::date`); }
    if (cliente_id) { params.push(cliente_id); where.push(`v.cliente_id = $${params.length}`); }
    if (estado) { params.push(estado); where.push(`v.estado = $${params.length}`); }

    const { rows } = await query(
      `SELECT v.*, c.nombre as cliente_nombre, u.nombre as cajero_nombre
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       LEFT JOIN usuarios u ON v.usuario_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY v.fecha DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
};

export const crear = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;

    const {
      cliente_id, items, metodo_pago, monto_pagado,
      descuento_global = 0, requiere_factura = false, notas,
      aplicar_iva = false
    } = req.body;

    if (!items?.length) throw new Error('La venta debe tener al menos un producto');

    let subtotal = 0;
    const detalle = [];

    // Validar stock y calcular subtotales (siempre dentro del mismo negocio)
    for (const item of items) {
      const { rows: [prod] } = await client.query(
        'SELECT id, nombre, precio_venta, stock_actual, es_servicio FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
        [item.producto_id, negocio_id]
      );
      if (!prod) throw new Error(`Producto ${item.producto_id} no encontrado`);
      if (!prod.es_servicio && prod.stock_actual < item.cantidad)
        throw new Error(`Stock insuficiente para ${prod.nombre}: disponible ${prod.stock_actual}`);

      const precio = item.precio_unitario ?? prod.precio_venta;
      const desc_item = item.descuento ?? 0;
      const sub = (item.cantidad * precio) - desc_item;
      subtotal += sub;
      detalle.push({ ...item, producto: prod, precio_unitario: precio, descuento: desc_item, sub });
    }

    const descuento = descuento_global || 0;
    const base = subtotal - descuento;
    const iva = aplicar_iva ? base * 0.16 : 0;
    const total = base + iva;
    const cambio = Math.max(0, (monto_pagado || 0) - total);
    const estado = (monto_pagado || 0) >= total ? 'pagada' : 'pendiente';
    const folio = await generarFolio(client, negocio_id);

    const { rows: [venta] } = await client.query(
      `INSERT INTO ventas (folio, cliente_id, usuario_id, subtotal, descuento, iva, total,
         metodo_pago, monto_pagado, cambio, requiere_factura, estado, notas, negocio_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [folio, cliente_id, req.user.id, subtotal, descuento, iva, total,
       metodo_pago || 'efectivo', monto_pagado || total, cambio,
       requiere_factura, estado, notas, negocio_id]
    );

    for (const item of detalle) {
      await client.query(
        `INSERT INTO ventas_detalle (venta_id, producto_id, descripcion, cantidad, precio_unitario, descuento)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [venta.id, item.producto_id, item.producto.nombre, item.cantidad, item.precio_unitario, item.descuento]
      );

      if (!item.producto.es_servicio) {
        const stock_nuevo = item.producto.stock_actual - item.cantidad;
        await client.query(
          'UPDATE productos SET stock_actual = $1, updated_at = NOW() WHERE id = $2',
          [stock_nuevo, item.producto.id]
        );
        await client.query(
          `INSERT INTO movimientos_inventario
             (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, usuario_id, negocio_id)
           VALUES ($1,'salida',$2,$3,$4,'venta',$5,$6,$7)`,
          [item.producto.id, item.cantidad, item.producto.stock_actual, stock_nuevo, venta.id, req.user.id, negocio_id]
        );
      }
    }

    // Si es a crédito, generar cuenta por cobrar
    if (estado === 'pendiente' && cliente_id) {
      await client.query(
        `INSERT INTO cuentas_cobrar (cliente_id, venta_id, monto_total, monto_pagado, fecha_vencimiento, negocio_id)
         VALUES ($1,$2,$3,$4, CURRENT_DATE + INTERVAL '30 days', $5)`,
        [cliente_id, venta.id, total, monto_pagado || 0, negocio_id]
      );
      await client.query(
        'UPDATE clientes SET saldo_pendiente = saldo_pendiente + $1 WHERE id = $2 AND negocio_id = $3',
        [total - (monto_pagado || 0), cliente_id, negocio_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...venta, folio, cambio, mensaje: `Venta ${folio} registrada` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar venta' });
  } finally {
    client.release();
  }
};

export const resumenDia = async (req, res) => {
  try {
    const { rows: [resumen] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE estado = 'pagada') as ventas_pagadas,
         COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0) as ingresos,
         COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'efectivo' AND estado = 'pagada'), 0) as efectivo,
         COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'tarjeta' AND estado = 'pagada'), 0) as tarjeta,
         COALESCE(SUM(total) FILTER (WHERE estado = 'pendiente'), 0) as pendiente_cobro
       FROM ventas
       WHERE (fecha AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date AND negocio_id = $1`,
      [req.user.negocio_id]
    );
    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen del día' });
  }
};
