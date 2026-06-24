import { query } from '../config/db.js';

export const dashboard = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const [ventas_hoy, gastos_mes, inventario, ordenes, cxc] = await Promise.all([
      query(`SELECT
               COALESCE(SUM(total) FILTER (WHERE estado='pagada'),0) as ingresos_hoy,
               COUNT(*) FILTER (WHERE estado='pagada') as num_ventas,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='efectivo'),0) as efectivo,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='tarjeta'),0) as tarjeta
             FROM ventas WHERE DATE(fecha) = CURRENT_DATE AND negocio_id = $1`, [negocio_id]),

      query(`SELECT COALESCE(SUM(monto),0) as gastos_mes
             FROM gastos
             WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE) AND negocio_id = $1`, [negocio_id]),

      query(`SELECT COUNT(*) as stock_bajo
             FROM productos WHERE stock_actual <= stock_minimo AND activo = true AND es_servicio = false AND negocio_id = $1`, [negocio_id]),

      query(`SELECT
               COUNT(*) FILTER (WHERE estado = 'en_espera') as en_espera,
               COUNT(*) FILTER (WHERE estado = 'en_proceso') as en_proceso,
               COUNT(*) FILTER (WHERE estado = 'listo') as listo
             FROM ordenes_servicio
             WHERE fecha_ingreso >= CURRENT_DATE - INTERVAL '7 days' AND negocio_id = $1`, [negocio_id]),

      query(`SELECT COALESCE(SUM(saldo),0) as total_cxc,
                    COUNT(*) as num_pendientes
             FROM cuentas_cobrar WHERE estado IN ('pendiente','parcial') AND negocio_id = $1`, [negocio_id])
    ]);

    const { rows: ventas_semana } = await query(
      `SELECT DATE(fecha) as dia,
              COALESCE(SUM(total) FILTER (WHERE estado='pagada'),0) as total,
              COUNT(*) FILTER (WHERE estado='pagada') as cantidad
       FROM ventas
       WHERE fecha >= CURRENT_DATE - INTERVAL '6 days' AND negocio_id = $1
       GROUP BY DATE(fecha) ORDER BY dia`,
      [negocio_id]
    );

    const { rows: top_productos } = await query(
      `SELECT p.nombre, p.medida, SUM(vd.cantidad) as unidades, SUM(vd.subtotal) as ingresos
       FROM ventas_detalle vd
       JOIN ventas v ON vd.venta_id = v.id
       JOIN productos p ON vd.producto_id = p.id
       WHERE v.fecha >= DATE_TRUNC('month', CURRENT_DATE) AND v.estado = 'pagada' AND v.negocio_id = $1
       GROUP BY p.id, p.nombre, p.medida
       ORDER BY ingresos DESC LIMIT 5`,
      [negocio_id]
    );

    res.json({
      kpis: {
        ...ventas_hoy.rows[0],
        gastos_mes: gastos_mes.rows[0].gastos_mes,
        stock_bajo: parseInt(inventario.rows[0].stock_bajo),
        ...ordenes.rows[0],
        ...cxc.rows[0],
        utilidad_hoy: ventas_hoy.rows[0].ingresos_hoy - 0
      },
      ventas_semana,
      top_productos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
};

export const ventasPorPeriodo = async (req, res) => {
  try {
    const { desde, hasta, agrupacion = 'dia' } = req.query;
    const negocio_id = req.user.negocio_id;
    const formato = agrupacion === 'mes' ? 'YYYY-MM' : agrupacion === 'semana' ? 'IYYY-IW' : 'YYYY-MM-DD';
    // Default: últimos 30 días, calculado en JS (antes se mandaba el texto
    // 'NOW() - INTERVAL...' como parámetro literal, lo cual rompía la consulta).
    const hastaVal = hasta || new Date().toISOString().slice(0, 10);
    const desdeVal = desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { rows } = await query(
      `SELECT TO_CHAR(fecha, $1) as periodo,
              SUM(total) as total, COUNT(*) as cantidad,
              SUM(total) FILTER (WHERE metodo_pago='efectivo') as efectivo,
              SUM(total) FILTER (WHERE metodo_pago='tarjeta') as tarjeta,
              SUM(total) FILTER (WHERE metodo_pago='transferencia') as transferencia
       FROM ventas
       WHERE fecha BETWEEN $2 AND $3 AND estado = 'pagada' AND negocio_id = $4
       GROUP BY periodo ORDER BY periodo`,
      [formato, desdeVal, hastaVal, negocio_id]
    );
    res.json({ data: rows, desde: desdeVal, hasta: hastaVal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

// Producto más vendido — por unidades y por ingresos, en un rango de fechas
export const productoMasVendido = async (req, res) => {
  try {
    const { desde, hasta, limit = 20 } = req.query;
    const negocio_id = req.user.negocio_id;
    const hastaVal = hasta || new Date().toISOString().slice(0, 10);
    const desdeVal = desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { rows } = await query(
      `SELECT p.id, p.nombre, p.medida, p.marca,
              SUM(vd.cantidad) as unidades_vendidas,
              SUM(vd.subtotal) as ingresos,
              COUNT(DISTINCT v.id) as num_ventas
       FROM ventas_detalle vd
       JOIN ventas v ON vd.venta_id = v.id
       JOIN productos p ON vd.producto_id = p.id
       WHERE v.fecha::date BETWEEN $1 AND $2 AND v.estado = 'pagada' AND v.negocio_id = $3
       GROUP BY p.id, p.nombre, p.medida, p.marca
       ORDER BY unidades_vendidas DESC
       LIMIT $4`,
      [desdeVal, hastaVal, negocio_id, limit]
    );
    res.json({ data: rows, desde: desdeVal, hasta: hastaVal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener producto más vendido' });
  }
};

// Cotizaciones por vendedor — totales, convertidas a venta y tasa de conversión
export const cotizacionesPorVendedor = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const negocio_id = req.user.negocio_id;
    const hastaVal = hasta || new Date().toISOString().slice(0, 10);
    const desdeVal = desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { rows } = await query(
      `SELECT u.id as vendedor_id, u.nombre as vendedor_nombre,
              COUNT(*) as total_cotizaciones,
              COALESCE(SUM(c.total), 0) as monto_cotizado,
              COUNT(*) FILTER (WHERE c.estado = 'convertida') as convertidas,
              COALESCE(SUM(c.total) FILTER (WHERE c.estado = 'convertida'), 0) as monto_convertido
       FROM cotizaciones c
       JOIN usuarios u ON c.vendedor_id = u.id
       WHERE c.created_at::date BETWEEN $1 AND $2 AND c.negocio_id = $3
       GROUP BY u.id, u.nombre
       ORDER BY total_cotizaciones DESC`,
      [desdeVal, hastaVal, negocio_id]
    );

    const data = rows.map(r => ({
      ...r,
      tasa_conversion: r.total_cotizaciones > 0
        ? ((parseInt(r.convertidas) / parseInt(r.total_cotizaciones)) * 100).toFixed(1)
        : '0.0',
    }));
    res.json({ data, desde: desdeVal, hasta: hastaVal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cotizaciones por vendedor' });
  }
};

// Recepción de llantas por mes — basado en los lotes registrados
// (recibidas, defectuosas y las que realmente entraron a almacén)
export const llantasPorMes = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const negocio_id = req.user.negocio_id;
    const hastaVal = hasta || new Date().toISOString().slice(0, 10);
    const desdeVal = desde || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { rows } = await query(
      `SELECT TO_CHAR(fecha_recepcion, 'YYYY-MM') as mes,
              COUNT(*) as num_lotes,
              COALESCE(SUM(cantidad_total), 0) as total_recibidas,
              COALESCE(SUM(cantidad_defectuosa), 0) as total_defectuosas,
              COALESCE(SUM(cantidad_efectiva), 0) as total_efectivas
       FROM lotes_llantas
       WHERE fecha_recepcion BETWEEN $1 AND $2 AND negocio_id = $3
       GROUP BY mes ORDER BY mes`,
      [desdeVal, hastaVal, negocio_id]
    );
    res.json({ data: rows, desde: desdeVal, hasta: hastaVal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener recepción de llantas por mes' });
  }
};

export const utilidadBruta = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const negocio_id = req.user.negocio_id;
    const { rows } = await query(
      `SELECT
         COALESCE(SUM(v.total) FILTER (WHERE v.estado='pagada'),0) as ingresos,
         COALESCE(
           SUM(vd.cantidad * p.precio_compra)
           FILTER (WHERE v.estado='pagada' AND NOT p.es_servicio), 0
         ) as costo_ventas,
         COALESCE(SUM(g.monto),0) as gastos
       FROM ventas v
       LEFT JOIN ventas_detalle vd ON vd.venta_id = v.id
       LEFT JOIN productos p ON vd.producto_id = p.id
       CROSS JOIN (
         SELECT COALESCE(SUM(monto),0) as monto FROM gastos
         WHERE fecha BETWEEN $1 AND $2 AND negocio_id = $3
       ) g
       WHERE v.fecha BETWEEN $1 AND $2 AND v.negocio_id = $3`,
      [desde || 'NOW() - INTERVAL \'30 days\'', hasta || 'NOW()', negocio_id]
    );

    const { ingresos, costo_ventas, gastos } = rows[0];
    res.json({
      ingresos: parseFloat(ingresos),
      costo_ventas: parseFloat(costo_ventas),
      utilidad_bruta: ingresos - costo_ventas,
      gastos: parseFloat(gastos),
      utilidad_neta: ingresos - costo_ventas - gastos,
      margen_bruto: ingresos > 0 ? ((ingresos - costo_ventas) / ingresos * 100).toFixed(2) : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener utilidad' });
  }
};
