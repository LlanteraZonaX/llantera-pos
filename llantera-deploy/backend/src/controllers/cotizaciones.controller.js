import { query, getClient } from '../config/db.js';
import { randomBytes } from 'crypto';

const generarFolio = async (negocio_id) => {
  const { rows } = await query(
    `SELECT COUNT(*) FROM cotizaciones WHERE negocio_id = $1`,
    [negocio_id]
  );
  const num = parseInt(rows[0].count) + 1;
  return `COT-${String(num).padStart(5, '0')}`;
};

const generarToken = () => randomBytes(12).toString('hex'); // token corto, único, no adivinable

// Crear cotización a partir de productos seleccionados (vendedor)
export const crear = async (req, res) => {
  const client = await getClient();
  try {
    const { cliente_id, cliente_nombre, cliente_telefono, items, descuento = 0, vigencia_dias = 3 } = req.body;
    const negocio_id = req.user.negocio_id;

    if (!items?.length) return res.status(400).json({ error: 'La cotización necesita al menos un producto' });

    await client.query('BEGIN');

    const folio = await generarFolio(negocio_id);
    const token_publico = generarToken();

    let subtotal = 0;
    const detalles = [];
    for (const item of items) {
      const { rows: [prod] } = await client.query(
        `SELECT p.id, p.nombre, p.precio_venta,
           (SELECT url FROM producto_fotos pf WHERE pf.producto_id = p.id AND pf.es_principal = true LIMIT 1) as foto_url
         FROM productos p WHERE p.id = $1 AND p.negocio_id = $2`,
        [item.producto_id, negocio_id]
      );
      if (!prod) continue;
      const cantidad = item.cantidad || 1;
      const precio = item.precio_unitario ?? prod.precio_venta;
      subtotal += cantidad * precio;
      detalles.push({ ...prod, cantidad, precio_unitario: precio });
    }

    const total = subtotal - descuento;

    const { rows: [cot] } = await client.query(
      `INSERT INTO cotizaciones
         (negocio_id, folio, vendedor_id, cliente_id, cliente_nombre, cliente_telefono,
          subtotal, descuento, total, vigencia_dias, token_publico)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [negocio_id, folio, req.user.id, cliente_id || null, cliente_nombre, cliente_telefono,
       subtotal, descuento, total, vigencia_dias, token_publico]
    );

    for (const d of detalles) {
      await client.query(
        `INSERT INTO cotizaciones_detalle (cotizacion_id, producto_id, descripcion, foto_url, cantidad, precio_unitario)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [cot.id, d.id, d.nombre, d.foto_url, d.cantidad, d.precio_unitario]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...cot,
      url_publica: `/cotizacion/${token_publico}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear cotización' });
  } finally {
    client.release();
  }
};

// Listar cotizaciones del negocio (un vendedor solo ve las suyas, salvo admin/gerente)
export const listar = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const verTodas = req.user.permisos?.todo || req.user.permisos?.reportes;

    let where = ['c.negocio_id = $1'];
    const params = [negocio_id];

    if (!verTodas) {
      params.push(req.user.id);
      where.push(`c.vendedor_id = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT c.*, u.nombre as vendedor_nombre
       FROM cotizaciones c
       JOIN usuarios u ON c.vendedor_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC
       LIMIT 100`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar cotizaciones' });
  }
};

// Vista pública por token — SIN autenticación, para que el cliente final la abra desde WhatsApp
export const verPublica = async (req, res) => {
  try {
    const { rows: [cot] } = await query(
      `SELECT c.id, c.folio, c.cliente_nombre, c.subtotal, c.descuento, c.total,
              c.estado, c.created_at, c.vigencia_dias,
              n.nombre as negocio_nombre, n.logo_url, n.telefono as negocio_telefono,
              n.direccion as negocio_direccion, n.facebook_url as negocio_facebook,
              u.nombre as vendedor_nombre
       FROM cotizaciones c
       JOIN negocios n ON c.negocio_id = n.id
       JOIN usuarios u ON c.vendedor_id = u.id
       WHERE c.token_publico = $1`,
      [req.params.token]
    );
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });

    const { rows: items } = await query(
      `SELECT descripcion, foto_url, cantidad, precio_unitario, subtotal
       FROM cotizaciones_detalle WHERE cotizacion_id = $1`,
      [cot.id]
    );

    // Marcar como vista la primera vez que el cliente la abre
    if (cot.estado === 'enviada') {
      await query(`UPDATE cotizaciones SET estado = 'vista', visto_at = NOW() WHERE id = $1`, [cot.id]);
    }

    res.json({ ...cot, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
};

// Convertir cotización aceptada en venta real
export const convertirAVenta = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: [cot] } = await client.query(
      `SELECT * FROM cotizaciones WHERE id = $1 AND negocio_id = $2`,
      [req.params.id, req.user.negocio_id]
    );
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (cot.venta_id) return res.status(409).json({ error: 'Esta cotización ya fue convertida en venta' });

    const { rows: items } = await client.query(
      `SELECT * FROM cotizaciones_detalle WHERE cotizacion_id = $1`,
      [cot.id]
    );

    const { rows: [folioRow] } = await client.query(
      `SELECT COUNT(*) FROM ventas WHERE negocio_id = $1`, [req.user.negocio_id]
    );
    const folio = `V-${String(parseInt(folioRow.count) + 1).padStart(6, '0')}`;

    const { rows: [venta] } = await client.query(
      `INSERT INTO ventas (negocio_id, folio, cliente_id, usuario_id, subtotal, descuento, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.negocio_id, folio, cot.cliente_id, req.user.id, cot.subtotal, cot.descuento, cot.total]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO ventas_detalle (venta_id, producto_id, descripcion, cantidad, precio_unitario)
         VALUES ($1,$2,$3,$4,$5)`,
        [venta.id, item.producto_id, item.descripcion, item.cantidad, item.precio_unitario]
      );
    }

    await client.query(
      `UPDATE cotizaciones SET estado = 'convertida', venta_id = $1 WHERE id = $2`,
      [venta.id, cot.id]
    );

    await client.query('COMMIT');
    res.json({ venta, mensaje: 'Cotización convertida en venta correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al convertir cotización en venta' });
  } finally {
    client.release();
  }
};
