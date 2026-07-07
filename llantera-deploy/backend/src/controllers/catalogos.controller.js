import { query } from '../config/db.js';

// ── Categorías (tabla global, sin negocio_id por diseño original) ─────────────
export const listarCategorias = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.nombre, c.tipo,
              COUNT(p.id) as num_productos
       FROM categorias c
       LEFT JOIN productos p ON p.categoria_id = c.id AND p.negocio_id = $1
       GROUP BY c.id, c.nombre, c.tipo
       ORDER BY c.nombre`,
      [req.user.negocio_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const crearCategoria = async (req, res) => {
  try {
    const { nombre, tipo } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const tiposValidos = ['llanta','refaccion','consumible','servicio'];
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : null;

    const { rows: [cat] } = await query(
      `INSERT INTO categorias (nombre, tipo) VALUES ($1, $2) RETURNING *`,
      [nombre.trim(), tipoFinal]
    );
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

export const actualizarCategoria = async (req, res) => {
  try {
    const { nombre, tipo } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const tiposValidos = ['llanta','refaccion','consumible','servicio'];
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : null;

    const { rows: [cat] } = await query(
      `UPDATE categorias SET nombre = $1, tipo = $2 WHERE id = $3 RETURNING *`,
      [nombre.trim(), tipoFinal, req.params.id]
    );
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

export const eliminarCategoria = async (req, res) => {
  try {
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM productos WHERE categoria_id = $1 AND negocio_id = $2`,
      [req.params.id, req.user.negocio_id]
    );
    if (parseInt(count) > 0)
      return res.status(409).json({ error: `No se puede eliminar: tiene ${count} producto(s) asociado(s). Reasígnalos primero.` });

    await query(`DELETE FROM categorias WHERE id = $1`, [req.params.id]);
    res.json({ mensaje: 'Categoría eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
};

// ── Marcas (nueva tabla de migración 011) ─────────────────────────────────────
export const listarMarcas = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT m.id, m.nombre, m.created_at,
              COUNT(p.id) as num_productos
       FROM marcas m
       LEFT JOIN productos p ON LOWER(p.marca) = LOWER(m.nombre) AND p.negocio_id = m.negocio_id
       WHERE m.negocio_id = $1
       GROUP BY m.id, m.nombre, m.created_at
       ORDER BY m.nombre`,
      [req.user.negocio_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
};

export const crearMarca = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const { rows: [marca] } = await query(
      `INSERT INTO marcas (negocio_id, nombre) VALUES ($1, $2) RETURNING *`,
      [req.user.negocio_id, nombre.trim()]
    );
    res.status(201).json(marca);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una marca con ese nombre' });
    res.status(500).json({ error: 'Error al crear marca' });
  }
};

export const eliminarMarca = async (req, res) => {
  try {
    await query(`DELETE FROM marcas WHERE id = $1 AND negocio_id = $2`, [req.params.id, req.user.negocio_id]);
    res.json({ mensaje: 'Marca eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar marca' });
  }
};
