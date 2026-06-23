import { query, getClient } from '../config/db.js';
import cloudinary from '../config/cloudinary.js';

export const listar = async (req, res) => {
  try {
    const { buscar, medida, categoria, tipo, stock_bajo, limit = 50, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;

    let where = ['p.activo = true', 'p.negocio_id = $1'];
    const params = [negocio_id];

    if (buscar) {
      params.push(`%${buscar}%`);
      where.push(`(p.nombre ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.medida ILIKE $${params.length})`);
    }
    if (medida) {
      params.push(medida);
      where.push(`p.medida = $${params.length}`);
    }
    if (categoria) {
      params.push(categoria);
      where.push(`p.categoria_id = $${params.length}`);
    }
    if (tipo) {
      params.push(tipo);
      where.push(`c.tipo = $${params.length}`);
    }
    if (stock_bajo === 'true') {
      where.push('p.stock_actual <= p.stock_minimo');
    }

    const sql = `
      SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo,
        (SELECT url FROM producto_fotos pf WHERE pf.producto_id = p.id AND pf.es_principal = true LIMIT 1) as foto_principal,
        (SELECT json_agg(json_build_object('id', pf2.id, 'url', pf2.url, 'es_principal', pf2.es_principal) ORDER BY pf2.orden)
           FROM producto_fotos pf2 WHERE pf2.producto_id = p.id) as fotos
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.nombre
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    const total = await query(`SELECT COUNT(*) FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE ${where.join(' AND ')}`, params.slice(0, -2));

    res.json({ data: rows, total: parseInt(total.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

export const obtener = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo,
        (SELECT json_agg(json_build_object('id', pf.id, 'url', pf.url, 'es_principal', pf.es_principal) ORDER BY pf.orden)
           FROM producto_fotos pf WHERE pf.producto_id = p.id) as fotos
       FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = $1 AND p.negocio_id = $2`,
      [req.params.id, req.user.negocio_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

export const crear = async (req, res) => {
  try {
    const {
      sku, nombre, categoria_id, medida, ancho, perfil, aro,
      tipo_llanta, marca, indice_carga, indice_vel,
      stock_actual, stock_minimo, precio_compra, precio_venta,
      precio_mayoreo, unidad_medida, es_servicio
    } = req.body;
    const negocio_id = req.user.negocio_id;

    const { rows } = await query(
      `INSERT INTO productos
         (sku, nombre, categoria_id, medida, ancho, perfil, aro, tipo_llanta, marca,
          indice_carga, indice_vel, stock_actual, stock_minimo, precio_compra,
          precio_venta, precio_mayoreo, unidad_medida, es_servicio, negocio_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [sku, nombre, categoria_id, medida, ancho, perfil, aro, tipo_llanta, marca,
       indice_carga, indice_vel, stock_actual || 0, stock_minimo || 0,
       precio_compra || 0, precio_venta || 0, precio_mayoreo, unidad_medida || 'pza', es_servicio || false,
       negocio_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El SKU ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

export const actualizar = async (req, res) => {
  try {
    const campos = Object.keys(req.body).filter(k => k !== 'id' && k !== 'negocio_id');
    if (!campos.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

    const sets = campos.map((k, i) => `${k} = $${i + 3}`).join(', ');
    const valores = campos.map(k => req.body[k]);

    const { rows } = await query(
      `UPDATE productos SET ${sets}, updated_at = NOW() WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [req.params.id, req.user.negocio_id, ...valores]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

export const ajustarStock = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { cantidad, tipo, notas } = req.body; // tipo: entrada|salida|ajuste

    const { rows: [prod] } = await client.query(
      'SELECT id, stock_actual FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [req.params.id, req.user.negocio_id]
    );
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

    const delta = tipo === 'salida' ? -Math.abs(cantidad) : Math.abs(cantidad);
    const nuevo_stock = tipo === 'ajuste' ? cantidad : prod.stock_actual + delta;

    await client.query(
      'UPDATE productos SET stock_actual = $1, updated_at = NOW() WHERE id = $2',
      [nuevo_stock, prod.id]
    );
    await client.query(
      `INSERT INTO movimientos_inventario
         (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, usuario_id, notas, negocio_id)
       VALUES ($1, $2, $3, $4, $5, 'ajuste', $6, $7, $8)`,
      [prod.id, tipo, Math.abs(cantidad), prod.stock_actual, nuevo_stock, req.user.id, notas, req.user.negocio_id]
    );

    await client.query('COMMIT');
    res.json({ stock_anterior: prod.stock_actual, stock_actual: nuevo_stock });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al ajustar stock' });
  } finally {
    client.release();
  }
};

// Subir un archivo de imagen real (no una URL externa) — lo manda a Cloudinary
// y guarda la URL estable que Cloudinary devuelve, evitando los problemas de
// bloqueo/inestabilidad de servicios como Google Drive.
export const subirFoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const { rows: [prod] } = await query(
      'SELECT id FROM productos WHERE id = $1 AND negocio_id = $2',
      [req.params.id, req.user.negocio_id]
    );
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

    const { rows: existentes } = await query(
      'SELECT COUNT(*) FROM producto_fotos WHERE producto_id = $1', [req.params.id]
    );
    const esPrincipal = parseInt(existentes[0].count) === 0;

    // Subimos el buffer del archivo directamente a Cloudinary (sin guardarlo en disco)
    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `llantera/${req.user.negocio_id}/productos`,
          resource_type: 'image',
          transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    if (esPrincipal) {
      await query('UPDATE producto_fotos SET es_principal = false WHERE producto_id = $1', [req.params.id]);
    }

    const { rows } = await query(
      `INSERT INTO producto_fotos (producto_id, url, es_principal) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, resultado.secure_url, esPrincipal]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[subirFoto]', err.message);
    res.status(500).json({ error: 'Error al subir la foto. Intenta de nuevo.' });
  }
};

// Agregar una foto a un producto (URL ya subida a un storage externo)
export const agregarFoto = async (req, res) => {
  try {
    const { url, es_principal } = req.body;
    if (!url) return res.status(400).json({ error: 'URL de la foto requerida' });

    const { rows: [prod] } = await query(
      'SELECT id FROM productos WHERE id = $1 AND negocio_id = $2',
      [req.params.id, req.user.negocio_id]
    );
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

    if (es_principal) {
      await query('UPDATE producto_fotos SET es_principal = false WHERE producto_id = $1', [req.params.id]);
    }

    const { rows } = await query(
      `INSERT INTO producto_fotos (producto_id, url, es_principal) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, url, !!es_principal]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar foto' });
  }
};

export const eliminarFoto = async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM producto_fotos pf
       USING productos p
       WHERE pf.id = $1 AND pf.producto_id = p.id AND p.negocio_id = $2
       RETURNING pf.id`,
      [req.params.fotoId, req.user.negocio_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Foto no encontrada' });
    res.json({ mensaje: 'Foto eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar foto' });
  }
};
