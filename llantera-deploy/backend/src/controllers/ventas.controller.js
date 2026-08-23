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
      cliente_id, items, metodo_pago, monto_pagado, pagos,
      descuento_global = 0, requiere_factura = false, notas,
      aplicar_iva = false, fecha
    } = req.body;

    if (!items?.length) throw new Error('La venta debe tener al menos un producto');

    // Desglose de pago: el frontend puede mandar `pagos` = [{metodo_pago, monto}, ...]
    // cuando el cajero divide el cobro en más de un método (ej. tarjeta + transferencia
    // + efectivo). Si no manda `pagos` (llamadas viejas a la API, o un solo método),
    // se arma un único renglón a partir de metodo_pago/monto_pagado, para no romper
    // nada de lo que ya funcionaba.
    const listaPagos = (Array.isArray(pagos) && pagos.length)
      ? pagos.map(p => ({ metodo_pago: p.metodo_pago, monto: parseFloat(p.monto) || 0 })).filter(p => p.monto > 0)
      : [{ metodo_pago: metodo_pago || 'efectivo', monto: parseFloat(monto_pagado) || 0 }];

    const metodosValidos = ['efectivo', 'tarjeta', 'transferencia'];
    for (const p of listaPagos) {
      if (!metodosValidos.includes(p.metodo_pago))
        throw new Error(`Método de pago no válido: ${p.metodo_pago}`);
    }

    const montoPagadoTotal = listaPagos.reduce((s, p) => s + p.monto, 0);
    const metodoPagoVenta = listaPagos.length > 1 ? 'mixto' : listaPagos[0].metodo_pago;

    // Validar que la fecha no sea futura. $fecha es "YYYY-MM-DD" o null.
    // Comparamos solo el string de fecha para evitar ambigüedades de timezone.
    if (fecha) {
      const hoyMexico = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
      if (fecha > hoyMexico) throw new Error('La fecha de la venta no puede ser en el futuro');
    }

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
    const cambio = Math.max(0, montoPagadoTotal - total);
    const estado = montoPagadoTotal >= total ? 'pagada' : 'pendiente';
    const folio = await generarFolio(client, negocio_id);

    const { rows: [venta] } = await client.query(
      `INSERT INTO ventas (folio, cliente_id, usuario_id, fecha, subtotal, descuento, iva, total,
         metodo_pago, monto_pagado, cambio, requiere_factura, estado, notas, negocio_id)
       VALUES ($1,$2,$3,
         COALESCE(
           ($4::date)::timestamp AT TIME ZONE 'America/Mexico_City',
           NOW()
         ),
         $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [folio, cliente_id, req.user.id, fecha || null, subtotal, descuento, iva, total,
       metodoPagoVenta, montoPagadoTotal, cambio,
       requiere_factura, estado, notas, negocio_id]
    );

    // Guarda el desglose real de cómo se pagó (una fila por método usado),
    // incluso cuando fue un solo método — así todo reporte futuro (cortes de
    // caja, análisis por método) puede depender siempre de esta tabla sin
    // tener que distinguir casos.
    for (const p of listaPagos) {
      await client.query(
        `INSERT INTO ventas_pagos (venta_id, metodo_pago, monto) VALUES ($1, $2, $3)`,
        [venta.id, p.metodo_pago, p.monto]
      );
    }

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
        [cliente_id, venta.id, total, montoPagadoTotal, negocio_id]
      );
      await client.query(
        'UPDATE clientes SET saldo_pendiente = saldo_pendiente + $1 WHERE id = $2 AND negocio_id = $3',
        [total - montoPagadoTotal, cliente_id, negocio_id]
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
         COALESCE((SELECT SUM(vp.monto) FROM ventas_pagos vp JOIN ventas v2 ON v2.id = vp.venta_id
                   WHERE v2.negocio_id = ventas.negocio_id AND v2.estado = 'pagada'
                     AND (v2.fecha AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
                     AND vp.metodo_pago = 'efectivo'), 0) as efectivo,
         COALESCE((SELECT SUM(vp.monto) FROM ventas_pagos vp JOIN ventas v2 ON v2.id = vp.venta_id
                   WHERE v2.negocio_id = ventas.negocio_id AND v2.estado = 'pagada'
                     AND (v2.fecha AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
                     AND vp.metodo_pago = 'tarjeta'), 0) as tarjeta,
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

// Actualizar método de pago de una venta existente
export const actualizarMetodoPago = async (req, res) => {
  const client = await getClient();
  try {
    const { metodo_pago } = req.body;
    const metodos = ['efectivo', 'tarjeta', 'transferencia'];
    if (!metodos.includes(metodo_pago))
      return res.status(400).json({ error: 'Método de pago no válido. Usa: efectivo, tarjeta o transferencia' });

    await client.query('BEGIN');
    const { rows: [venta] } = await client.query(
      `UPDATE ventas SET metodo_pago = $1
       WHERE id = $2 AND negocio_id = $3 AND estado = 'pagada'
       RETURNING id, folio, metodo_pago, total, monto_pagado`,
      [metodo_pago, req.params.id, req.user.negocio_id]
    );
    if (!venta) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venta no encontrada' }); }

    // Esta corrección manual siempre deja la venta en UN solo método — si
    // antes era un pago mixto (varias filas en ventas_pagos), se reemplazan
    // por una sola fila con el monto total, para no dejar el desglose viejo
    // desincronizado con lo que ahora dice la venta.
    await client.query(`DELETE FROM ventas_pagos WHERE venta_id = $1`, [venta.id]);
    await client.query(
      `INSERT INTO ventas_pagos (venta_id, metodo_pago, monto) VALUES ($1, $2, $3)`,
      [venta.id, metodo_pago, venta.monto_pagado]
    );

    await client.query('COMMIT');
    res.json({ ...venta, mensaje: `Método de pago actualizado a ${metodo_pago}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar método de pago' });
  } finally {
    client.release();
  }
};

// Detalle de una venta por ID (para preview de ticket)
export const obtener = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const { rows: [venta] } = await query(
      `SELECT v.*,
              (v.fecha AT TIME ZONE 'America/Mexico_City') as fecha_local,
              COALESCE(c.nombre, 'Cliente general') as cliente_nombre,
              u.nombre as cajero_nombre,
              n.nombre as negocio_nombre,
              n.logo_url, n.telefono as negocio_telefono,
              n.direccion as negocio_direccion
       FROM ventas v
       LEFT JOIN clientes c  ON v.cliente_id  = c.id
       LEFT JOIN usuarios u  ON v.usuario_id  = u.id
       JOIN negocios n       ON v.negocio_id  = n.id
       WHERE v.id = $1 AND v.negocio_id = $2`,
      [req.params.id, negocio_id]
    );
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const { rows: items } = await query(
      `SELECT vd.cantidad, vd.precio_unitario, vd.subtotal,
              p.nombre as producto_nombre, p.medida as producto_medida
       FROM ventas_detalle vd
       JOIN productos p ON vd.producto_id = p.id
       WHERE vd.venta_id = $1 ORDER BY p.nombre`,
      [venta.id]
    );

    const { rows: pagos } = await query(
      `SELECT metodo_pago, monto FROM ventas_pagos WHERE venta_id = $1 ORDER BY created_at`,
      [venta.id]
    );

    res.json({ ...venta, items, pagos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener detalle de la venta' });
  }
};

// Marcar una venta pendiente como pagada
export const marcarPagada = async (req, res) => {
  const client = await getClient();
  try {
    const { metodo_pago = 'efectivo' } = req.body;
    const metodos = ['efectivo', 'tarjeta', 'transferencia'];
    if (!metodos.includes(metodo_pago))
      return res.status(400).json({ error: 'Método de pago inválido' });

    await client.query('BEGIN');
    const { rows: [venta] } = await client.query(
      `UPDATE ventas
       SET estado = 'pagada', metodo_pago = $1, monto_pagado = total
       WHERE id = $2 AND negocio_id = $3 AND estado = 'pendiente'
       RETURNING id, folio, estado, total, metodo_pago, monto_pagado`,
      [metodo_pago, req.params.id, req.user.negocio_id]
    );
    if (!venta) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venta no encontrada o ya está pagada' }); }

    // El saldo que faltaba (total - lo ya abonado con pagos previos, si los
    // hubiera) se registra ahora en ventas_pagos con el método indicado.
    const { rows: [{ ya_pagado }] } = await client.query(
      `SELECT COALESCE(SUM(monto), 0) as ya_pagado FROM ventas_pagos WHERE venta_id = $1`,
      [venta.id]
    );
    const faltante = parseFloat(venta.total) - parseFloat(ya_pagado);
    if (faltante > 0) {
      await client.query(
        `INSERT INTO ventas_pagos (venta_id, metodo_pago, monto) VALUES ($1, $2, $3)`,
        [venta.id, metodo_pago, faltante]
      );
    }

    await client.query('COMMIT');
    res.json({ ...venta, mensaje: `Venta ${venta.folio} marcada como pagada` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la venta' });
  } finally {
    client.release();
  }
};
