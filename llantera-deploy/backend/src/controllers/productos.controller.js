import { query, getClient } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { buscar, medida, categoria, tipo, stock_bajo, limit = 50, offset = 0 } = req.query;

    let where = ['p.activo = true'];
    const params = [];

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
      SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo
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
      `SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo
       FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
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

    const { rows } = await query(
      `INSERT INTO productos
         (sku, nombre, categoria_id, medida, ancho, perfil, aro, tipo_llanta, marca,
          indice_carga, indice_vel, stock_actual, stock_minimo, precio_compra,
          precio_venta, precio_mayoreo, unidad_medida, es_servicio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [sku, nombre, categoria_id, medida, ancho, perfil, aro, tipo_llanta, marca,
       indice_carga, indice_vel, stock_actual || 0, stock_minimo || 0,
       precio_compra || 0, precio_venta || 0, precio_mayoreo, unidad_medida || 'pza', es_servicio || false]
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
    const campos = Object.keys(req.body).filter(k => k !== 'id');
    if (!campos.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

    const sets = campos.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const valores = campos.map(k => req.body[k]);

    const { rows } = await query(
      `UPDATE productos SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...valores]
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
      'SELECT id, stock_actual FROM productos WHERE id = $1 FOR UPDATE',
      [req.params.id]
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
         (producto_id, tipo, cantidad, stock_antes, stock_despues, referencia_tipo, usuario_id, notas)
       VALUES ($1, $2, $3, $4, $5, 'ajuste', $6, $7)`,
      [prod.id, tipo, Math.abs(cantidad), prod.stock_actual, nuevo_stock, req.user.id, notas]
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
