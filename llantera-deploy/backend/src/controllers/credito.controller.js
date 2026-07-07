/**
 * credito.controller.js
 * Módulo de Crédito / Cuentas por Cobrar.
 * ESTADO: creado y funcional como módulo independiente.
 * PENDIENTE DE INTEGRAR: el botón "Cobrar a crédito" en el POS.
 */
import { query, getClient } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { estado, limit = 50, offset = 0 } = req.query;
    const negocio_id = req.user.negocio_id;
    const where = ['cc.negocio_id = $1'];
    const params = [negocio_id];

    if (estado) { params.push(estado); where.push(`cc.estado = $${params.length}`); }
    else         where.push(`cc.estado IN ('pendiente','parcial')`);

    const { rows } = await query(
      `SELECT cc.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
              u.nombre as vendedor_nombre
       FROM cuentas_cobrar cc
       LEFT JOIN clientes c ON cc.cliente_id = c.id
       LEFT JOIN usuarios u ON cc.usuario_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY cc.vencimiento ASC NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cuentas por cobrar' });
  }
};

export const detalle = async (req, res) => {
  try {
    const { rows: [cuenta] } = await query(
      `SELECT cc.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
       FROM cuentas_cobrar cc LEFT JOIN clientes c ON cc.cliente_id = c.id
       WHERE cc.id = $1 AND cc.negocio_id = $2`,
      [req.params.id, req.user.negocio_id]
    );
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const { rows: pagos } = await query(
      `SELECT p.*, u.nombre as usuario_nombre
       FROM pagos_credito p LEFT JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.cuenta_id = $1 ORDER BY p.created_at DESC`,
      [cuenta.id]
    );
    res.json({ ...cuenta, pagos });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener detalle de cuenta' });
  }
};

export const crear = async (req, res) => {
  try {
    const { cliente_id, total, descripcion, vencimiento, notas } = req.body;
    if (!total || parseFloat(total) <= 0) return res.status(400).json({ error: 'El total debe ser mayor a 0' });

    const folio = `CXC-${Date.now()}`;
    const { rows: [cuenta] } = await query(
      `INSERT INTO cuentas_cobrar
         (negocio_id, cliente_id, usuario_id, folio, total, saldo, descripcion, vencimiento, notas, estado)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,'pendiente') RETURNING *`,
      [req.user.negocio_id, cliente_id || null, req.user.id, folio,
       parseFloat(total), descripcion?.trim() || null, vencimiento || null, notas?.trim() || null]
    );
    res.status(201).json({ ...cuenta, mensaje: 'Venta a crédito registrada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar venta a crédito' });
  }
};

export const registrarPago = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { monto, metodo_pago, notas } = req.body;
    const montoNum = parseFloat(monto) || 0;
    if (montoNum <= 0) throw new Error('El monto del pago debe ser mayor a 0');

    const { rows: [cuenta] } = await client.query(
      `SELECT * FROM cuentas_cobrar WHERE id = $1 AND negocio_id = $2 FOR UPDATE`,
      [req.params.id, req.user.negocio_id]
    );
    if (!cuenta)                    throw new Error('Cuenta no encontrada');
    if (cuenta.estado === 'pagada') throw new Error('Esta cuenta ya está liquidada');
    if (montoNum > parseFloat(cuenta.saldo)) throw new Error(`El pago excede el saldo pendiente ($${cuenta.saldo})`);

    await client.query(
      `INSERT INTO pagos_credito (cuenta_id, usuario_id, monto, metodo_pago, notas)
       VALUES ($1,$2,$3,$4,$5)`,
      [cuenta.id, req.user.id, montoNum, metodo_pago || 'efectivo', notas || null]
    );

    const saldoNuevo = parseFloat(cuenta.saldo) - montoNum;
    const estadoNuevo = saldoNuevo <= 0 ? 'pagada' : 'parcial';
    const { rows: [actualizada] } = await client.query(
      `UPDATE cuentas_cobrar SET saldo = $1, estado = $2 WHERE id = $3 RETURNING *`,
      [saldoNuevo, estadoNuevo, cuenta.id]
    );

    await client.query('COMMIT');
    res.json({ cuenta: actualizada, mensaje: estadoNuevo === 'pagada' ? 'Cuenta liquidada completamente ✓' : `Pago registrado. Saldo pendiente: $${saldoNuevo.toFixed(2)}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message || 'Error al registrar pago' });
  } finally {
    client.release();
  }
};
