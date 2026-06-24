import { query, getClient } from '../config/db.js';

// Listar lotes (cabecera) — incluye lo ya clasificado por medida y lo
// pendiente de clasificar/devolver, calculado al vuelo sin tocar columnas.
export const listar = async (req, res) => {
  try {
    const { desde, hasta, limit = 50, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    let where = ['l.negocio_id = $1'];
    const params = [negocio_id];

    if (desde) { params.push(desde); where.push(`l.fecha_recepcion >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`l.fecha_recepcion <= $${params.length}`); }

    const { rows } = await query(
      `SELECT l.*, p.nombre as proveedor_catalogo_nombre, u.nombre as usuario_nombre,
              COALESCE((SELECT SUM(cantidad_recibida) FROM lotes_detalle WHERE lote_id = l.id), 0) as total_clasificado
       FROM lotes_llantas l
       LEFT JOIN proveedores p ON l.proveedor_id = p.id
       LEFT JOIN usuarios u ON l.usuario_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY l.fecha_recepcion DESC, l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const data = rows.map(r => ({
      ...r,
      total_pendiente: parseFloat(r.cantidad_total) - parseFloat(r.total_clasificado) - parseFloat(r.cantidad_defectuosa),
    }));
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener lotes' });
  }
};

// Detalle de un lote: cabecera + líneas de clasificación (medida) + devoluciones
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

    const { rows: clasificacion } = await query(
      `SELECT ld.*, pr.medida as producto_medida, pr.nombre as producto_nombre
       FROM lotes_detalle ld
       JOIN productos pr ON ld.producto_id = pr.id
       WHERE ld.lote_id = $1 ORDER BY ld.descripcion`,
      [lote.id]
    );
    const { rows: devoluciones } = await query(
      `SELECT d.*, u.nombre as usuario_nombre
       FROM lotes_devoluciones d
       LEFT JOIN usuarios u ON d.usuario_id = u.id
       WHERE d.lote_id = $1 ORDER BY d.fecha_devolucion DESC`,
      [lote.id]
    );

    const total_clasificado = clasificacion.reduce((s, c) => s + parseFloat(c.cantidad_recibida), 0);
    res.json({
      ...lote, clasificacion, devoluciones,
      total_clasificado,
      total_pendiente: parseFloat(lote.cantidad_total) - total_clasificado - parseFloat(lote.cantidad_defectuosa),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el lote' });
  }
};

// Registrar un lote nuevo: el folio y la cantidad total que llegó
// físicamente los captura el usuario (ej. folio "LOTE150626", 72 piezas).
// Opcionalmente se puede clasificar por medida/producto desde aquí mismo,
// o dejarlo para después con el endpoint de "clasificar".
export const crear = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { folio, proveedor_id, proveedor_nombre, fecha_recepcion, cantidad_total, notas, items = [] } = req.body;

    if (!folio?.trim()) throw new Error('El folio del lote es obligatorio');
    if (!cantidad_total || parseFloat(cantidad_total) <= 0) throw new Error('La cantidad total recibida debe ser mayor a 0');

    const { rows: [existe] } = await client.query(
      'SELECT id FROM lotes_llantas WHERE negocio_id = $1 AND folio = $2', [negocio_id, folio.trim()]
    );
    if (existe) throw new Error(`Ya existe un lote con el folio "${folio.trim()}"`);

    const { rows: [lote] } = await client.query(
      `INSERT INTO lotes_llantas
         (negocio_id, folio, proveedor_id, proveedor_nombre, fecha_recepcion,
          cantidad_total, cantidad_defectuosa, cantidad_efectiva, notas, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,0,$6,$7,$8) RETURNING *`,
      [negocio_id, folio.trim(), proveedor_id || null, proveedor_nombre || null,
       fecha_recepcion || new Date(), parseFloat(cantidad_total), notas || null, req.user.id]
    );

    for (const item of items) {
      await insertarClasificacion(client, negocio_id, lote.id, lote.folio, item, req.user.id);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...lote, mensaje: `Lote ${lote.folio} registrado correctamente` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar el lote' });
  } finally {
    client.release();
  }
};

// Agregar más líneas de clasificación por medida/producto a un lote ya
// existente (ej. terminas de contar/clasificar después). Cada línea suma
// de inmediato al stock del producto correspondiente.
export const clasificar = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { items = [] } = req.body;
    if (!items.length) throw new Error('Agrega al menos una línea de clasificación');

    const { rows: [lote] } = await client.query(
      'SELECT * FROM lotes_llantas WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]
    );
    if (!lote) throw new Error('Lote no encontrado');

    for (const item of items) {
      await insertarClasificacion(client, negocio_id, lote.id, lote.folio, item, req.user.id);
    }

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Clasificación agregada y stock actualizado' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al clasificar el lote' });
  } finally {
    client.release();
  }
};

// Inserta una línea de clasificación (medida/producto + cantidad) y suma
// esa cantidad completa al stock — ya no se pide defectuosa por línea,
// eso ahora vive aparte en "Devolución de lotes".
async function insertarClasificacion(client, negocio_id, lote_id, folio, item, usuario_id) {
  const cantidad = parseFloat(item.cantidad) || 0;
  if (cantidad <= 0) throw new Error('Cada línea de clasificación debe tener una cantidad mayor a 0');

  const { rows: [prod] } = await client.query(
    'SELECT id, nombre, medida, stock_actual FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
    [item.producto_id, negocio_id]
  );
  if (!prod) throw new Error(`Producto ${item.producto_id} no encontrado`);

  await client.query(
    `INSERT INTO lotes_detalle (lote_id, producto_id, medida, descripcion, cantidad_recibida, cantidad_defectuosa, razon_defecto)
     VALUES ($1,$2,$3,$4,$5,0,NULL)`,
    [lote_id, prod.id, prod.medida, prod.nombre, cantidad]
  );

  const stock_nuevo = parseFloat(prod.stock_actual) + cantidad;
  await client.query('UPDATE productos SET stock_actual = $1, updated_at = NOW() WHERE id = $2', [stock_nuevo, prod.id]);
  await client.query(
    `INSERT INTO movimientos_inventario
       (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, usuario_id, negocio_id, notas)
     VALUES ($1,'entrada',$2,$3,$4,'lote',$5,$6,$7,$8)`,
    [prod.id, cantidad, prod.stock_actual, stock_nuevo, lote_id, usuario_id, negocio_id, `Lote ${folio}`]
  );
}

// Registrar una devolución sobre un lote existente — SOLO cantidad total
// y motivo, sin desglose por medida. No toca el stock (esas piezas nunca
// se clasificaron ni entraron al almacén). Mantiene sincronizadas las
// columnas cantidad_defectuosa/cantidad_efectiva de la cabecera del lote.
export const registrarDevolucion = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { cantidad, motivo, fecha_devolucion } = req.body;
    const cantidadNum = parseFloat(cantidad) || 0;

    if (cantidadNum <= 0) throw new Error('La cantidad devuelta debe ser mayor a 0');
    if (!motivo?.trim()) throw new Error('El motivo de la devolución es obligatorio');

    const { rows: [lote] } = await client.query(
      'SELECT * FROM lotes_llantas WHERE id = $1 AND negocio_id = $2 FOR UPDATE', [req.params.id, negocio_id]
    );
    if (!lote) throw new Error('Lote no encontrado');

    const { rows: [{ clasificado }] } = await client.query(
      'SELECT COALESCE(SUM(cantidad_recibida),0) as clasificado FROM lotes_detalle WHERE lote_id = $1', [lote.id]
    );
    const pendiente = parseFloat(lote.cantidad_total) - parseFloat(clasificado) - parseFloat(lote.cantidad_defectuosa);
    if (cantidadNum > pendiente) {
      throw new Error(`Solo quedan ${pendiente} piezas sin clasificar/devolver de este lote (intentaste devolver ${cantidadNum})`);
    }

    const { rows: [dev] } = await client.query(
      `INSERT INTO lotes_devoluciones (negocio_id, lote_id, cantidad, motivo, fecha_devolucion, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [negocio_id, lote.id, cantidadNum, motivo.trim(), fecha_devolucion || new Date(), req.user.id]
    );

    await client.query(
      `UPDATE lotes_llantas SET cantidad_defectuosa = cantidad_defectuosa + $1, cantidad_efectiva = cantidad_efectiva - $1 WHERE id = $2`,
      [cantidadNum, lote.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...dev, mensaje: 'Devolución registrada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al registrar la devolución' });
  } finally {
    client.release();
  }
};

// Historial de todas las devoluciones (para la pantalla "Devolución de lotes")
export const listarDevoluciones = async (req, res) => {
  try {
    const { desde, hasta, limit = 50, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    let where = ['d.negocio_id = $1'];
    const params = [negocio_id];

    if (desde) { params.push(desde); where.push(`d.fecha_devolucion >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`d.fecha_devolucion <= $${params.length}`); }

    const { rows } = await query(
      `SELECT d.*, l.folio, l.proveedor_nombre, l.fecha_recepcion, u.nombre as usuario_nombre
       FROM lotes_devoluciones d
       JOIN lotes_llantas l ON d.lote_id = l.id
       LEFT JOIN usuarios u ON d.usuario_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY d.fecha_devolucion DESC, d.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener devoluciones' });
  }
};
