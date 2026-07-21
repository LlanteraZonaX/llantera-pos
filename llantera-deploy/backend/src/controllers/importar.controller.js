/**
 * importar — importación masiva de productos desde CSV.
 * Se añade como función exportable adicional a productos.controller.js
 * pero se mantiene en archivo separado para no tocar el controller existente.
 *
 * Llamado desde: POST /productos/importar
 *
 * Reglas:
 * - Solo inserta productos nuevos (ON CONFLICT en sku → SKIP).
 * - Campos obligatorios: nombre, precio_venta.
 * - Campos opcionales: medida, marca, sku, precio_compra, stock_actual,
 *   stock_minimo, descripcion, categoria.
 * - La columna "categoria" se empareja por nombre (case-insensitive) con
 *   la tabla global `categorias`. Si no coincide, el producto se crea sin categoría.
 * - es_servicio = false (los servicios no se importan por este flujo).
 */
import { query, getClient } from '../config/db.js';

export const importar = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const negocio_id = req.user.negocio_id;
    const { productos } = req.body;

    if (!Array.isArray(productos) || productos.length === 0)
      throw new Error('No se recibieron productos para importar');

    if (productos.length > 500)
      throw new Error('Máximo 500 productos por importación');

    // Cargar catálogo de categorías (tabla global sin negocio_id)
    const { rows: cats } = await client.query(
      `SELECT id, LOWER(TRIM(nombre)) AS nombre FROM categorias`
    );
    const catMap = {};
    cats.forEach(c => { catMap[c.nombre] = c.id; });

    const resultados = { creados: 0, omitidos: 0, errores: [] };

    for (let i = 0; i < productos.length; i++) {
      const p   = productos[i];
      const fila = i + 2; // fila 1 = encabezado, datos desde fila 2

      // ── Validaciones ────────────────────────────────────────────────────────
      if (!p.nombre?.toString().trim()) {
        resultados.errores.push({ fila, mensaje: 'Columna "nombre" vacía' });
        resultados.omitidos++;
        continue;
      }
      const precioVenta = parseFloat(p.precio_venta);
      if (isNaN(precioVenta) || precioVenta < 0) {
        resultados.errores.push({ fila, mensaje: `"${p.nombre}": precio_venta inválido ("${p.precio_venta}")` });
        resultados.omitidos++;
        continue;
      }

      // ── Campos opcionales ────────────────────────────────────────────────────
      const nombre        = p.nombre.toString().trim().substring(0, 200);
      const medida        = p.medida?.toString().trim().substring(0, 60)   || null;
      const marca         = p.marca?.toString().trim().substring(0, 80)    || null;
      const sku           = p.sku?.toString().trim().substring(0, 60)      || null;
      const descripcion   = p.descripcion?.toString().trim()               || null;
      const precioCompra  = parseFloat(p.precio_compra)  || 0;
      const stockActual   = parseInt(p.stock_actual)     || 0;
      const stockMinimo   = parseInt(p.stock_minimo)     || 0;
      const catKey        = p.categoria?.toString().trim().toLowerCase()   || null;
      const categoriaId   = catKey ? (catMap[catKey] || null) : null;

      try {
        const { rowCount } = await client.query(
          `INSERT INTO productos
             (negocio_id, nombre, medida, marca, sku, precio_venta, precio_compra,
              stock_actual, stock_minimo, descripcion, categoria_id, activo, es_servicio)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,false)
           ON CONFLICT (sku) WHERE sku IS NOT NULL DO NOTHING`,
          [negocio_id, nombre, medida, marca, sku, precioVenta, precioCompra,
           stockActual, stockMinimo, descripcion, categoriaId]
        );

        if (rowCount > 0) {
          resultados.creados++;
        } else {
          resultados.omitidos++;
          resultados.errores.push({ fila, mensaje: `"${nombre}": SKU "${sku}" ya existe — omitido` });
        }
      } catch (e) {
        resultados.omitidos++;
        resultados.errores.push({ fila, mensaje: `"${nombre}": ${e.message.substring(0, 100)}` });
      }
    }

    await client.query('COMMIT');
    res.json({
      ...resultados,
      mensaje: `${resultados.creados} producto(s) importado(s)${resultados.omitidos ? `, ${resultados.omitidos} omitido(s)` : ''}.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[importar]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
