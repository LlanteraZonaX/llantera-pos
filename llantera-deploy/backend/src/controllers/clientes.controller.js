import { query } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { buscar, limit = 50, offset = 0 } = req.query;
    let where = ['c.activo = true'];
    const params = [];
    if (buscar) {
      params.push(`%${buscar}%`);
      where.push(`(c.nombre ILIKE $${params.length} OR c.telefono ILIKE $${params.length} OR c.rfc ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT c.*, COUNT(v.id) as num_vehiculos
       FROM clientes c
       LEFT JOIN vehiculos v ON v.cliente_id = c.id
       WHERE ${where.join(' AND ')}
       GROUP BY c.id ORDER BY c.nombre
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
};

export const obtener = async (req, res) => {
  try {
    const { rows: [cliente] } = await query('SELECT * FROM clientes WHERE id=$1', [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    const { rows: vehiculos } = await query('SELECT * FROM vehiculos WHERE cliente_id=$1 ORDER BY created_at DESC', [req.params.id]);
    const { rows: historial } = await query(
      `SELECT os.folio, os.fecha_ingreso, os.total, os.estado,
              v.placa, v.marca, v.modelo
       FROM ordenes_servicio os
       LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
       WHERE os.cliente_id=$1 ORDER BY os.fecha_ingreso DESC LIMIT 20`,
      [req.params.id]
    );
    res.json({ ...cliente, vehiculos, historial });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
};

export const crear = async (req, res) => {
  try {
    const { nombre, telefono, email, rfc, direccion, notas, limite_credito } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const { rows: [c] } = await query(
      `INSERT INTO clientes (nombre, telefono, email, rfc, direccion, notas, limite_credito)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, telefono, email, rfc, direccion, notas, limite_credito || 0]
    );
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
};

export const actualizar = async (req, res) => {
  try {
    const { nombre, telefono, email, rfc, direccion, notas, limite_credito } = req.body;
    const { rows } = await query(
      `UPDATE clientes SET nombre=$1,telefono=$2,email=$3,rfc=$4,
         direccion=$5,notas=$6,limite_credito=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [nombre, telefono, email, rfc, direccion, notas, limite_credito, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
};

export const crearVehiculo = async (req, res) => {
  try {
    const { placa, marca, modelo, anio, color, num_serie, notas } = req.body;
    if (!placa) return res.status(400).json({ error: 'La placa es requerida' });
    const { rows: [v] } = await query(
      `INSERT INTO vehiculos (cliente_id, placa, marca, modelo, anio, color, num_serie, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, placa.toUpperCase(), marca, modelo, anio, color, num_serie, notas]
    );
    res.status(201).json(v);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar vehículo' });
  }
};
