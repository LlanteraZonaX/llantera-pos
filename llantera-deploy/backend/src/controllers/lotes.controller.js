import { query, getClient } from '../config/db.js';

const generarFolio = async (client, negocio_id) => {
  const año = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM lotes_llantas WHERE EXTRACT(YEAR FROM created_at) = $1 AND negocio_id = $2`,
    [año, negocio_id]
  );
  const num = String(parseInt(rows[0].count) + 1).padStart(5, '0');
  return `LOTE-${año}-${num}`;
};

// Listar lotes recibidos (con totales) — filtrable por fecha
export const listar = async (req, res) => {
  try {
    const { desde, hasta, limit = 50, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    let where = ['l.negocio_id = $1'];
    const params = [negocio_id];

    if (desde) { params.push(desde); where.push(`l.fecha_recepcion >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`l.fecha_recepcion <= $${params.length}`); }

    const { rows } = await query(
      `SELECT l.*, p.nombre as proveedor_catalogo_nombre, u.nombre as usuario_nombre
       FROM lotes_llantas l
       LEFT JOIN proveedores p ON l.proveedor_id = p.id
       LEFT JOIN usuarios u ON l.usuario_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY l.fecha_recepcion DESC, l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener lotes' });
  }
};

// Detalle de un lote: sus líneas por producto/medida
export const obtener = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const { rows: [lote] } = await query(
      `SELECT l.*, p.nombre as proveedor_catalogo_nombre, u.nombre as usuario_nombre
       FROM lotes_llantas l
       LEFT JOIN proveedores p ON l.proveedor_id = p.id
       LEFT JOIN usuarios u ON l.usuario_id = u.id
       WHERE l.id = $1 AND l.negocio_id = $2`,
      [req.params.id, negocio_id]
    );
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

    const { rows: detalle } = await query(
      `SELECT ld.*, pr.medida as producto_medida, pr.nombre as producto_nombre
       FROM lotes_detalle ld
       JOIN productos pr ON ld.producto_id = pr.id
       WHERE ld.lote_id = $1
       ORDER BY ld.descripcion`,
      [lote.id]
    );
    res.json({ ...lote, detalle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el lote' });
  }
};

// Registrar un lote nuevo: clasificación por producto/medida + defectuosas.
// Al confirmarlo, se suma automáticamente el stock real (cantidad_efectiva)
// de cada producto y se deja registro en movimientos_inventario.
export const crear = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { proveedor_id, proveedor_nombre, fecha_recepcion, notas, items } = req.body;

    if (!items?.length) throw new Error('El lote necesita al menos una línea de producto/medida');

    let cantidad_total = 0;
    let cantidad_defectuosa = 0;
    const detalle = [];

    for (const item of items) {
      const recibida = parseFloat(item.cantidad_recibida) || 0;
      const defectuosa = parseFloat(item.cantidad_defectuosa) || 0;
      if (recibida <= 0) throw new Error('Cada línea debe tener una cantidad recibida mayor a 0');
      if (defectuosa > recibida) throw new Error('La cantidad defectuosa no puede ser mayor a la recibida');

      const { rows: [prod] } = await client.query(
        'SELECT id, nombre, medida, stock_actual FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
        [item.producto_id, negocio_id]
      );
      if (!prod) throw new Error(`Producto ${item.producto_id} no encontrado`);

      const efectiva = recibida - defectuosa;
      cantidad_total += recibida;
      cantidad_defectuosa += defectuosa;
      detalle.push({ producto: prod, recibida, defectuosa, efectiva, razon: item.razon_defecto || null });
    }

    const cantidad_efectiva = cantidad_total - cantidad_defectuosa;
    const folio = await generarFolio(client, negocio_id);

    const { rows: [lote] } = await client.query(
      `INSERT INTO lotes_llantas
         (negocio_id, folio, proveedor_id, proveedor_nombre, fecha_recepcion,
          cantidad_total, cantidad_defectuosa, cantidad_efectiva, notas, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [negocio_id, folio, proveedor_id || null, proveedor_nombre || null,
       fecha_recepcion || new Date(), cantidad_total, cantidad_defectuosa, cantidad_efectiva,
       notas || null, req.user.id]
    );

    for (const d of detalle) {
      await client.query(
        `INSERT INTO lotes_detalle
           (lote_id, producto_id, medida, descripcion, cantidad_recibida, cantidad_defectuosa, razon_defecto)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [lote.id, d.producto.id, d.producto.medida, d.producto.nombre, d.recibida, d.defectuosa, d.razon]
      );

      if (d.efectiva !== 0) {
        const stock_nuevo = parseFloat(d.producto.stock_actual) + d.efectiva;
        await client.query(
          'UPDATE productos SET stock_actual = $1, updated_at = NOW() WHERE id = $2',
          [stock_nuevo, d.producto.id]
        );
        await client.query(
          `INSERT INTO movimientos_inventario
             (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, usuario_id, negocio_id, notas)
           VALUES ($1,'entrada',$2,$3,$4,'lote',$5,$6,$7,$8)`,
          [d.producto.id, d.efectiva, d.producto.stock_actual, stock_nuevo, lote.id, req.user.id, negocio_id,
           d.defectuosa > 0 ? `Lote ${folio}: ${d.recibida} recibidas, ${d.defectuosa} defectuosas (${d.razon || 'sin motivo especificado'})` : `Lote ${folio}`]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...lote, mensaje: `Lote ${folio} registrado: ${cantidad_efectiva} piezas efectivas de ${cantidad_total} recibidas` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar el lote' });
  } finally {
    client.release();
  }
};
