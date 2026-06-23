import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const SECRET = process.env.JWT_SECRET || 'llantera_secret_dev_2024';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await query(
      `SELECT u.id, u.nombre, u.email, u.password_hash, u.activo, u.negocio_id,
              r.nombre as rol, r.permisos, n.nombre as negocio_nombre, n.slug as negocio_slug
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       JOIN negocios n ON u.negocio_id = n.id
       WHERE u.email = $1 AND n.activo = true`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length || !rows[0].activo)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
        permisos: user.permisos,
        negocio_id: user.negocio_id,
        negocio_slug: user.negocio_slug,
      },
      SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        negocio: { id: user.negocio_id, nombre: user.negocio_nombre, slug: user.negocio_slug },
      },
    });
  } catch (err) {
    console.error('[auth.login]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const me = (req, res) => res.json(req.user);

export const cambiarPassword = async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    const { rows } = await query('SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(password_nuevo, 10);
    await query('UPDATE usuarios SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};
