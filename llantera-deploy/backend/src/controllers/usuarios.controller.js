import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

// Listar usuarios del negocio actual (admin/gerente)
export const listar = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.nombre, u.email, u.activo, u.created_at, r.nombre as rol
       FROM usuarios u JOIN roles r ON u.rol_id = r.id
       WHERE u.negocio_id = $1
       ORDER BY u.created_at DESC`,
      [req.user.negocio_id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// Catálogo de roles disponibles (para llenar el selector del formulario)
export const roles = async (_req, res) => {
  try {
    const { rows } = await query('SELECT id, nombre FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener roles' });
  }
};

export const crear = async (req, res) => {
  try {
    const { nombre, email, password, rol_id } = req.body;
    if (!nombre || !email || !password || !rol_id)
      return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const emailNorm = email.toLowerCase().trim();
    const { rows: existe } = await query(
      'SELECT id FROM usuarios WHERE email = $1 AND negocio_id = $2',
      [emailNorm, req.user.negocio_id]
    );
    if (existe.length) return res.status(409).json({ error: 'Ya existe un usuario con ese email en este negocio' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id, negocio_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, nombre, email, activo, created_at`,
      [nombre, emailNorm, hash, rol_id, req.user.negocio_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

export const actualizar = async (req, res) => {
  try {
    const { nombre, rol_id, activo } = req.body;
    const { rows } = await query(
      `UPDATE usuarios SET nombre = COALESCE($1, nombre), rol_id = COALESCE($2, rol_id),
         activo = COALESCE($3, activo), updated_at = NOW()
       WHERE id = $4 AND negocio_id = $5
       RETURNING id, nombre, email, activo`,
      [nombre, rol_id, activo, req.params.id, req.user.negocio_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// Eliminar usuario PERMANENTEMENTE — solo si nunca generó historial
// (ventas, cotizaciones, gastos, compras, lotes, etc). Si ya tiene
// movimientos asociados, se rechaza para no perder ese rastro: en ese
// caso se recomienda desactivarlo en vez de borrarlo.
export const eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    const negocio_id = req.user.negocio_id;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario mientras tienes la sesión iniciada con él' });
    }

    const { rows: [usuario] } = await query('SELECT id FROM usuarios WHERE id = $1 AND negocio_id = $2', [id, negocio_id]);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { rows: [conteo] } = await query(
      `SELECT
         (SELECT COUNT(*) FROM ventas WHERE usuario_id = $1) +
         (SELECT COUNT(*) FROM cotizaciones WHERE vendedor_id = $1) +
         (SELECT COUNT(*) FROM gastos WHERE usuario_id = $1) +
         (SELECT COUNT(*) FROM compras WHERE usuario_id = $1) +
         (SELECT COUNT(*) FROM ordenes_servicio WHERE tecnico_id = $1 OR cajero_id = $1) +
         (SELECT COUNT(*) FROM pagos_credito WHERE usuario_id = $1) +
         (SELECT COUNT(*) FROM movimientos_inventario WHERE usuario_id = $1) +
         (SELECT COUNT(*) FROM lotes_llantas WHERE usuario_id = $1) +
         (SELECT COUNT(*) FROM lotes_devoluciones WHERE usuario_id = $1)
         as total`,
      [id]
    );

    if (parseInt(conteo.total) > 0) {
      return res.status(409).json({
        error: `Este usuario ya tiene ${conteo.total} movimiento(s) registrados (ventas, cotizaciones, gastos, etc). No se puede eliminar sin perder ese historial — usa "Desactivar" en su lugar para bloquear su acceso sin borrar nada.`
      });
    }

    await query('DELETE FROM usuarios WHERE id = $1 AND negocio_id = $2', [id, negocio_id]);
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};
export const resetPassword = async (req, res) => {
  try {
    const { password_nuevo } = req.body;
    if (!password_nuevo || password_nuevo.length < 6)
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

    const hash = await bcrypt.hash(password_nuevo, 10);
    const { rows } = await query(
      'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND negocio_id = $3 RETURNING id',
      [hash, req.params.id, req.user.negocio_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Contraseña restablecida correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
};
