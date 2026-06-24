import { query } from '../config/db.js';

// Datos públicos del negocio del usuario autenticado (para pantalla de Configuración)
export const obtener = async (req, res) => {
  try {
    const { rows: [negocio] } = await query(
      `SELECT id, nombre, slug, logo_url, telefono, direccion, facebook_url, moneda
       FROM negocios WHERE id = $1`,
      [req.user.negocio_id]
    );
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(negocio);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos del negocio' });
  }
};

// Solo admin puede editar los datos del negocio (logo, dirección, teléfono, Facebook)
export const actualizar = async (req, res) => {
  try {
    const { nombre, logo_url, telefono, direccion, facebook_url } = req.body;
    const { rows: [negocio] } = await query(
      `UPDATE negocios SET
         nombre = COALESCE($1, nombre),
         logo_url = $2,
         telefono = $3,
         direccion = $4,
         facebook_url = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, nombre, slug, logo_url, telefono, direccion, facebook_url, moneda`,
      [nombre, logo_url || null, telefono || null, direccion || null, facebook_url || null, req.user.negocio_id]
    );
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });
    res.json(negocio);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar datos del negocio' });
  }
};
