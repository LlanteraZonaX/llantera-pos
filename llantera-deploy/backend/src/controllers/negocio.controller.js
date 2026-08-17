import { query } from '../config/db.js';
import cloudinary from '../config/cloudinary.js';

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

// Subida directa del logo (archivo, no URL) — mismo patrón que fotos de
// producto: buffer en memoria → Cloudinary, sin tocar disco. La transformación
// ajusta la imagen al tamaño ideal (300x300, fondo transparente si el PNG lo
// trae) sin deformarla ni recortarla, para que quepa bien en cualquier cuadro
// de logo del sistema (sidebar, cotizaciones, tickets).
export const subirLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `llantera/${req.user.negocio_id}/logo`,
          resource_type: 'image',
          transformation: [{ width: 300, height: 300, crop: 'pad', background: 'transparent', quality: 'auto' }],
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const { rows: [negocio] } = await query(
      `UPDATE negocios SET logo_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, nombre, slug, logo_url, telefono, direccion, facebook_url, moneda`,
      [resultado.secure_url, req.user.negocio_id]
    );
    res.status(201).json(negocio);
  } catch (err) {
    console.error('[negocio.subirLogo]', err.message);
    res.status(500).json({ error: 'Error al subir el logo. Intenta de nuevo.' });
  }
};
