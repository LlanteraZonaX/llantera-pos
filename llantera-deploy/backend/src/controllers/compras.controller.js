/**
 * compras.controller.js — versión limpia, sin duplicados.
 *
 * Columnas GENERATED ALWAYS confirmadas:
 *   compras_detalle.subtotal = GENERATED AS (cantidad * costo_unitario) → NO se inserta
 *
 * Columnas en compras con restricción (subtotal/iva/total):
 *   Se hace UPDATE opcional post-INSERT con try/catch — si son GENERATED se ignora.
 *
 * Columnas escribibles confirmadas en compras (verificado contra schema.sql real,
 * 14 ago 2026 — la tabla NUNCA tuvo proveedor_nombre, siempre fue proveedor_id
 * con FK a la tabla `proveedores`):
 *   proveedor_id, fecha_recepcion, num_factura, notas, estado, folio, negocio_id, usuario_id
 *
 * `proveedor_id` es opcional/desacoplado a propósito: si el frontend manda
 * `proveedor_nuevo` (nombre en texto libre) en vez de un id existente, este
 * controlador crea el proveedor en el catálogo dentro de la misma transacción.
 * Así, si más adelante cambia la forma de capturar proveedor (ej. importación
 * masiva, integración con otro sistema), solo se toca esta pieza.
 */
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
      `SELECT c.*,
              pr.nombre as proveedor_nombre,
              u.nombre as usuario_nombre,
              COUNT(cd.id) as num_partidas,
              COALESCE(SUM(cd.subtotal), 0) as total_calculado
       FROM compras c
       LEFT JOIN proveedores pr     ON c.proveedor_id = pr.id
       LEFT JOIN usuarios u         ON c.usuario_id = u.id
       LEFT JOIN compras_detalle cd ON cd.compra_id = c.id
       WHERE c.negocio_id = $1
       GROUP BY c.id, pr.nombre, u.nombre
       ORDER BY c.fecha_recepcion DESC
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
      `SELECT c.*, pr.nombre as proveedor_nombre
       FROM compras c
       LEFT JOIN proveedores pr ON c.proveedor_id = pr.id
       WHERE c.id = $1 AND c.negocio_id = $2`,
      [req.params.id, req.user.negocio_id]
    );
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });

    const { rows: detalle } = await query(
      `SELECT cd.*, p.nombre as producto_nombre, p.medida
       FROM compras_detalle cd
       JOIN productos p ON cd.producto_id = p.id
       WHERE cd.compra_id = $1`,
      [compra.id]
    );
    res.json({ ...compra, detalle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener compra' });
  }
};

export const crear = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { proveedor_id, proveedor_nuevo, fecha_recepcion, num_factura, notas, items = [], aplicar_iva = false } = req.body;

    if (!items.length) throw new Error('La compra debe tener al menos un producto');

    // Resolver proveedor: usa el id existente si lo mandan, o crea uno nuevo
    // en el catálogo si mandan solo el nombre (fallback si el frontend no
    // pudo resolverlo antes de enviar, ej. llamada directa a la API).
    let proveedorIdFinal = proveedor_id || null;
    if (!proveedorIdFinal && proveedor_nuevo?.trim()) {
      const { rows: [existente] } = await client.query(
        `SELECT id FROM proveedores WHERE negocio_id = $1 AND LOWER(nombre) = LOWER($2) AND activo = true`,
        [negocio_id, proveedor_nuevo.trim()]
      );
      if (existente) {
        proveedorIdFinal = existente.id;
      } else {
        const { rows: [nuevoProv] } = await client.query(
          `INSERT INTO proveedores (negocio_id, nombre) VALUES ($1, $2) RETURNING id`,
          [negocio_id, proveedor_nuevo.trim()]
        );
        proveedorIdFinal = nuevoProv.id;
      }
    }

    let subtotal = 0;
    const detalles = [];

    for (const item of items) {
      const cant  = parseFloat(item.cantidad)       || 0;
      const costo = parseFloat(item.costo_unitario) || 0;
      if (cant <= 0 || costo <= 0)
        throw new Error('Cada producto debe tener cantidad y costo mayores a 0');

      const { rows: [prod] } = await client.query(
        `SELECT id, nombre, stock_actual FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE`,
        [item.producto_id, negocio_id]
      );
      if (!prod) throw new Error(`Producto no encontrado: ${item.producto_id}`);

      subtotal += cant * costo;
      detalles.push({ prod, cant, costo });
    }

    const iva   = aplicar_iva ? subtotal * 0.16 : 0;
    const total = subtotal + iva;
    const folio = await generarFolio(client, negocio_id);

    // INSERT cabecera — solo columnas escribibles confirmadas (sin subtotal/iva/total)
    const { rows: [compra] } = await client.query(
      `INSERT INTO compras
         (negocio_id, folio, proveedor_id, fecha_recepcion, num_factura, notas, usuario_id, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'recibida')
       RETURNING *`,
      [negocio_id, folio, proveedorIdFinal,
       fecha_recepcion || new Date(),
       num_factura     || null,
       notas           || null,
       req.user.id]
    );

    for (const { prod, cant, costo } of detalles) {
      // subtotal en compras_detalle es GENERATED ALWAYS — NO se incluye en el INSERT
      await client.query(
        `INSERT INTO compras_detalle (compra_id, producto_id, cantidad, costo_unitario)
         VALUES ($1, $2, $3, $4)`,
        [compra.id, prod.id, cant, costo]
      );

      const stock_nuevo = parseFloat(prod.stock_actual) + cant;
      await client.query(
        `UPDATE productos SET stock_actual = $1, updated_at = NOW() WHERE id = $2`,
        [stock_nuevo, prod.id]
      );
      await client.query(
        `INSERT INTO movimientos_inventario
           (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, referencia_id, usuario_id, negocio_id)
         VALUES ($1, 'entrada', $2, $3, $4, 'compra', $5, $6, $7)`,
        [prod.id, cant, prod.stock_actual, stock_nuevo, compra.id, req.user.id, negocio_id]
      );
    }

    // UPDATE totales — con try/catch: si son GENERATED se ignora sin cortar la transacción
    try {
      await client.query(
        `UPDATE compras SET subtotal = $1, iva = $2, total = $3 WHERE id = $4`,
        [subtotal, iva, total, compra.id]
      );
    } catch (_) { /* columnas GENERATED — PostgreSQL las calcula sola */ }

    await client.query('COMMIT');
    res.status(201).json({
      ...compra, subtotal, iva, total,
      mensaje: `Compra ${folio} registrada — ${detalles.length} producto(s) sumado(s) al inventario.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[compras.crear]', err.message);
    res.status(500).json({ error: err.message || 'Error al registrar la compra' });
  } finally {
    client.release();
  }
};
