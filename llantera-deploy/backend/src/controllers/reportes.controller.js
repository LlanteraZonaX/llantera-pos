import { query } from '../config/db.js';

export const dashboard = async (req, res) => {
  try {
    const [ventas_hoy, gastos_mes, inventario, ordenes, cxc] = await Promise.all([
      // Ventas del día
      query(`SELECT
               COALESCE(SUM(total) FILTER (WHERE estado='pagada'),0) as ingresos_hoy,
               COUNT(*) FILTER (WHERE estado='pagada') as num_ventas,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='efectivo'),0) as efectivo,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='tarjeta'),0) as tarjeta
             FROM ventas WHERE DATE(fecha) = CURRENT_DATE`),

      // Gastos del mes
      query(`SELECT COALESCE(SUM(monto),0) as gastos_mes
             FROM gastos
             WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)`),

      // Productos con stock bajo
      query(`SELECT COUNT(*) as stock_bajo
             FROM productos WHERE stock_actual <= stock_minimo AND activo = true AND es_servicio = false`),

      // Órdenes activas
      query(`SELECT
               COUNT(*) FILTER (WHERE estado = 'en_espera') as en_espera,
               COUNT(*) FILTER (WHERE estado = 'en_proceso') as en_proceso,
               COUNT(*) FILTER (WHERE estado = 'listo') as listo
             FROM ordenes_servicio
             WHERE fecha_ingreso >= CURRENT_DATE - INTERVAL '7 days'`),

      // Cuentas por cobrar
      query(`SELECT COALESCE(SUM(saldo),0) as total_cxc,
                    COUNT(*) as num_pendientes
             FROM cuentas_cobrar WHERE estado IN ('pendiente','parcial')`)
    ]);

    // Ventas últimos 7 días
    const { rows: ventas_semana } = await query(
      `SELECT DATE(fecha) as dia,
              COALESCE(SUM(total) FILTER (WHERE estado='pagada'),0) as total,
              COUNT(*) FILTER (WHERE estado='pagada') as cantidad
       FROM ventas
       WHERE fecha >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY DATE(fecha) ORDER BY dia`
    );

    // Top productos vendidos (mes)
    const { rows: top_productos } = await query(
      `SELECT p.nombre, p.medida, SUM(vd.cantidad) as unidades, SUM(vd.subtotal) as ingresos
       FROM ventas_detalle vd
       JOIN ventas v ON vd.venta_id = v.id
       JOIN productos p ON vd.producto_id = p.id
       WHERE v.fecha >= DATE_TRUNC('month', CURRENT_DATE) AND v.estado = 'pagada'
       GROUP BY p.id, p.nombre, p.medida
       ORDER BY ingresos DESC LIMIT 5`
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
    const formato = agrupacion === 'mes' ? 'YYYY-MM' : agrupacion === 'semana' ? 'IYYY-IW' : 'YYYY-MM-DD';

    const { rows } = await query(
      `SELECT TO_CHAR(fecha, $1) as periodo,
              SUM(total) as total, COUNT(*) as cantidad,
              SUM(total) FILTER (WHERE metodo_pago='efectivo') as efectivo,
              SUM(total) FILTER (WHERE metodo_pago='tarjeta') as tarjeta
       FROM ventas
       WHERE fecha BETWEEN $2 AND $3 AND estado = 'pagada'
       GROUP BY periodo ORDER BY periodo`,
      [formato, desde || 'NOW() - INTERVAL \'30 days\'', hasta || 'NOW()']
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reporte' });
  }
};

export const utilidadBruta = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
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
         WHERE fecha BETWEEN $1 AND $2
       ) g
       WHERE v.fecha BETWEEN $1 AND $2`,
      [desde || 'NOW() - INTERVAL \'30 days\'', hasta || 'NOW()']
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
