import { query, getClient } from '../config/db.js';

const generarFolio = async (client) => {
  const año = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT COUNT(*) FROM ordenes_servicio WHERE EXTRACT(YEAR FROM created_at)=$1`, [año]
  );
  return `ORD-${año}-${String(parseInt(rows[0].count)+1).padStart(5,'0')}`;
};

export const listar = async (req, res) => {
  try {
    const { estado, fecha, limit=30, offset=0 } = req.query;
    let where = ['1=1'];
    const params = [];
    if (estado) { params.push(estado); where.push(`os.estado=$${params.length}`); }
    if (fecha)  { params.push(fecha);  where.push(`DATE(os.fecha_ingreso)=$${params.length}`); }

    const { rows } = await query(
      `SELECT os.*, c.nombre as cliente_nombre, c.telefono as cliente_tel,
              v.placa, v.marca, v.modelo, v.color,
              u.nombre as tecnico_nombre
       FROM ordenes_servicio os
       LEFT JOIN clientes c ON os.cliente_id=c.id
       LEFT JOIN vehiculos v ON os.vehiculo_id=v.id
       LEFT JOIN usuarios u ON os.tecnico_id=u.id
       WHERE ${where.join(' AND ')}
       ORDER BY os.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};

export const obtener = async (req, res) => {
  try {
    const { rows: [orden] } = await query(
      `SELECT os.*, c.nombre as cliente_nombre, c.telefono,
              v.placa, v.marca, v.modelo, v.anio, v.color,
              u.nombre as tecnico_nombre, u2.nombre as cajero_nombre
       FROM ordenes_servicio os
       LEFT JOIN clientes c ON os.cliente_id=c.id
       LEFT JOIN vehiculos v ON os.vehiculo_id=v.id
       LEFT JOIN usuarios u ON os.tecnico_id=u.id
       LEFT JOIN usuarios u2 ON os.cajero_id=u2.id
       WHERE os.id=$1`, [req.params.id]
    );
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    const { rows: detalle } = await query(
      `SELECT od.*, p.nombre as producto_nombre, ts.nombre as servicio_nombre
       FROM ordenes_detalle od
       LEFT JOIN productos p ON od.producto_id=p.id
       LEFT JOIN tipos_servicio ts ON od.servicio_id=ts.id
       WHERE od.orden_id=$1`, [req.params.id]
    );
    res.json({ ...orden, detalle });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener orden' });
  }
};

export const crear = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { cliente_id, vehiculo_id, tecnico_id, km_vehiculo, observaciones, items, fecha_estimada } = req.body;
    if (!items?.length) throw new Error('La orden debe tener al menos un servicio o producto');

    let subtotal = 0;
    for (const item of items) {
      const precio = parseFloat(item.precio_unitario) || 0;
      subtotal += (parseFloat(item.cantidad)||1) * precio - (parseFloat(item.descuento)||0);
    }
    const total = subtotal;
    const folio = await generarFolio(client);

    const { rows: [orden] } = await client.query(
      `INSERT INTO ordenes_servicio
         (folio,cliente_id,vehiculo_id,tecnico_id,cajero_id,km_vehiculo,
          observaciones,subtotal,total,fecha_estimada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [folio,cliente_id,vehiculo_id,tecnico_id,req.user.id,km_vehiculo,
       observaciones,subtotal,total,fecha_estimada||null]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO ordenes_detalle
           (orden_id,tipo,producto_id,servicio_id,descripcion,cantidad,precio_unitario,descuento)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [orden.id, item.tipo||'servicio', item.producto_id||null, item.servicio_id||null,
         item.descripcion, item.cantidad||1, item.precio_unitario, item.descuento||0]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...orden, mensaje: `Orden ${folio} creada` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message || 'Error al crear orden' });
  } finally { client.release(); }
};

export const cambiarEstado = async (req, res) => {
  try {
    const { estado, tecnico_id } = req.body;
    const estados = ['en_espera','en_proceso','listo','entregado','cancelado'];
    if (!estados.includes(estado))
      return res.status(400).json({ error: `Estado inválido. Válidos: ${estados.join(', ')}` });

    const extra = estado === 'entregado' ? ', fecha_entrega=NOW(), pagado=true' : '';
    const { rows } = await query(
      `UPDATE ordenes_servicio
       SET estado=$1 ${tecnico_id ? ',tecnico_id=$3' : ''} ${extra}, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      tecnico_id ? [estado, req.params.id, tecnico_id] : [estado, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};
