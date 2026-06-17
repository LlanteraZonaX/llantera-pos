import { query, getClient } from '../config/db.js';

export const listar = async (req, res) => {
  try {
    const { estado, cliente_id, limit=50, offset=0 } = req.query;
    let where = ['1=1'];
    const params = [];
    if (estado)     { params.push(estado);     where.push(`cc.estado=$${params.length}`); }
    if (cliente_id) { params.push(cliente_id); where.push(`cc.cliente_id=$${params.length}`); }

    const { rows } = await query(
      `SELECT cc.*, c.nombre as cliente_nombre, c.telefono
       FROM cuentas_cobrar cc
       JOIN clientes c ON cc.cliente_id=c.id
       WHERE ${where.join(' AND ')}
       ORDER BY cc.fecha_vencimiento ASC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    const { rows: [totales] } = await query(
      `SELECT COALESCE(SUM(saldo),0) as total_saldo,
              COUNT(*) FILTER (WHERE fecha_vencimiento < CURRENT_DATE AND estado IN ('pendiente','parcial')) as vencidas
       FROM cuentas_cobrar cc WHERE ${where.join(' AND ')}`, params
    );
    res.json({ data: rows, ...totales });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cuentas por cobrar' });
  }
};

export const registrarPago = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { monto, metodo_pago='efectivo', referencia, notas } = req.body;
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Monto inválido' });

    const { rows: [cuenta] } = await client.query(
      'SELECT * FROM cuentas_cobrar WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
    if (cuenta.estado === 'pagada') return res.status(400).json({ error: 'Esta cuenta ya está pagada' });

    const nuevo_pagado = parseFloat(cuenta.monto_pagado) + parseFloat(monto);
    const nuevo_estado = nuevo_pagado >= parseFloat(cuenta.monto_total) ? 'pagada' : 'parcial';

    await client.query(
      `INSERT INTO pagos_credito (cuenta_id, usuario_id, monto, metodo_pago, referencia, notas)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [cuenta.id, req.user.id, monto, metodo_pago, referencia, notas]
    );
    await client.query(
      'UPDATE cuentas_cobrar SET monto_pagado=$1, estado=$2 WHERE id=$3',
      [nuevo_pagado, nuevo_estado, cuenta.id]
    );
    await client.query(
      'UPDATE clientes SET saldo_pendiente=GREATEST(0, saldo_pendiente-$1) WHERE id=$2',
      [monto, cuenta.cliente_id]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Pago registrado', nuevo_estado, monto_pagado: nuevo_pagado });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar pago' });
  } finally { client.release(); }
};
