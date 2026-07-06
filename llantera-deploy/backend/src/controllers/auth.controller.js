import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { isLoginBlocked, trackLoginAttempt, loginLimiter } from '../middleware/security.js';

const SECRET = process.env.JWT_SECRET || 'llantera_secret_dev_2024';

export const login = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  // ── Verificar si la IP está bloqueada por demasiados intentos fallidos ──────
  if (isLoginBlocked(ip)) {
    return res.status(429).json({
      error: 'IP bloqueada temporalmente por demasiados intentos fallidos. Espera 15 minutos.',
    });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    // Validación básica de formato para no hacer query innecesario
    if (typeof email !== 'string' || email.length > 200)
      return res.status(400).json({ error: 'Email inválido' });

    const { rows } = await query(
      `SELECT u.id, u.nombre, u.email, u.password_hash, u.activo, u.negocio_id,
              r.nombre as rol, r.permisos, n.nombre as negocio_nombre, n.slug as negocio_slug
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       JOIN negocios n ON u.negocio_id = n.id
       WHERE u.email = $1 AND n.activo = true`,
      [email.toLowerCase().trim()]
    );

    // Comparación siempre con bcrypt aunque no exista el usuario (evita timing attacks)
    const user = rows[0];
    const hashDummy = '$2a$10$dummyhashfortimingatk.preventionXXXXXXXXXXXXXXXXXXXXXX';
    const valid = user?.activo
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, hashDummy).then(() => false);

    if (!valid) {
      const result = trackLoginAttempt(ip, false);
      const msg = result.blocked
        ? 'IP bloqueada temporalmente por demasiados intentos fallidos. Espera 15 minutos.'
        : `Credenciales inválidas${result.remaining <= 2 ? ` (${result.remaining} intento(s) restante(s) antes del bloqueo)` : ''}`;
      return res.status(401).json({ error: msg });
    }

    // Login exitoso — limpia el contador de intentos
    trackLoginAttempt(ip, true);

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
        permisos: user.permisos,
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
