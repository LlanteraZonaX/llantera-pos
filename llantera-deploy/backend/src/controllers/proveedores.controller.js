/**
 * proveedores.controller.js
 *
 * Catálogo de proveedores, scoped por negocio_id (tabla `proveedores`
 * ya existía en el schema baseline con FK desde compras/lotes/gastos,
 * pero nunca tuvo endpoints propios — este archivo los agrega).
 */
import { query } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre, contacto, telefono, email, rfc, direccion, created_at
       FROM proveedores
       WHERE negocio_id = $1 AND activo = true
       ORDER BY nombre`,
      [req.user.negocio_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('[proveedores.listar]', err);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
};

export const crear = async (req, res) => {
  try {
    const { nombre, contacto, telefono, email, rfc, direccion } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });

    const { rows: [existente] } = await query(
      `SELECT id, nombre, contacto, telefono, email, rfc, direccion, created_at
       FROM proveedores WHERE negocio_id = $1 AND LOWER(nombre) = LOWER($2) AND activo = true`,
      [req.user.negocio_id, nombre.trim()]
    );
    if (existente) return res.status(200).json(existente); // idempotente: si ya existe, lo regresa en vez de duplicar

    const { rows: [prov] } = await query(
      `INSERT INTO proveedores (negocio_id, nombre, contacto, telefono, email, rfc, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, contacto, telefono, email, rfc, direccion, created_at`,
      [req.user.negocio_id, nombre.trim(), contacto || null, telefono || null, email || null, rfc || null, direccion || null]
    );
    res.status(201).json(prov);
  } catch (err) {
    console.error('[proveedores.crear]', err);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
};

export const actualizar = async (req, res) => {
  try {
    const { nombre, contacto, telefono, email, rfc, direccion } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });

    const { rows: [prov] } = await query(
      `UPDATE proveedores
       SET nombre = $1, contacto = $2, telefono = $3, email = $4, rfc = $5, direccion = $6
       WHERE id = $7 AND negocio_id = $8
       RETURNING id, nombre, contacto, telefono, email, rfc, direccion, created_at`,
      [nombre.trim(), contacto || null, telefono || null, email || null, rfc || null, direccion || null, req.params.id, req.user.negocio_id]
    );
    if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(prov);
  } catch (err) {
    console.error('[proveedores.actualizar]', err);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
};

export const eliminar = async (req, res) => {
  try {
    // Baja lógica (activo = false), nunca DELETE físico: compras/lotes/gastos
    // pasados siguen referenciando este proveedor y no deben perder el dato.
    const { rows: [prov] } = await query(
      `UPDATE proveedores SET activo = false WHERE id = $1 AND negocio_id = $2 RETURNING id`,
      [req.params.id, req.user.negocio_id]
    );
    if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ mensaje: 'Proveedor eliminado' });
  } catch (err) {
    console.error('[proveedores.eliminar]', err);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
};
