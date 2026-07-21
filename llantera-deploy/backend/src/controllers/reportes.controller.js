import { query } from '../config/db.js';

const SEMANA = `(NOW() AT TIME ZONE 'America/Mexico_City')::date - INTERVAL '6 days'`;

export const dashboard = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;

    const [ventasSemana, costoSemana, gastosSemana, alertas, ordenes,
           ventasPorDia, productosSemana, ultimasVentas] = await Promise.all([

      // 1. Ventas últimos 7 días
      query(`SELECT
               COALESCE(SUM(total) FILTER (WHERE estado='pagada'), 0) AS total_ventas,
               COUNT(*) FILTER (WHERE estado='pagada') AS num_ventas,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='efectivo'), 0) AS efectivo,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='tarjeta'), 0) AS tarjeta,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada' AND metodo_pago='transferencia'), 0) AS transferencia,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada') /
                 NULLIF(COUNT(*) FILTER (WHERE estado='pagada'), 0), 0) AS ticket_promedio
             FROM ventas
             WHERE negocio_id = $1
               AND (fecha AT TIME ZONE 'America/Mexico_City')::date >= ${SEMANA}`,
        [negocio_id]),

      // 2. Costo de lo vendido (precio_compra × unidades vendidas)
      query(`SELECT COALESCE(SUM(vd.cantidad * p.precio_compra), 0) AS costo_total
             FROM ventas_detalle vd
             JOIN ventas v    ON vd.venta_id   = v.id
             JOIN productos p ON vd.producto_id = p.id
             WHERE v.negocio_id = $1 AND v.estado = 'pagada'
               AND (v.fecha AT TIME ZONE 'America/Mexico_City')::date >= ${SEMANA}`,
        [negocio_id]),

      // 3. Gastos de la semana
      query(`SELECT
               COALESCE(SUM(g.monto), 0) AS total_gastos,
               COUNT(*) AS num_gastos,
               json_agg(json_build_object(
                 'categoria', COALESCE(cg.nombre, 'Sin categoría'),
                 'monto', g.monto,
                 'descripcion', g.descripcion
               ) ORDER BY g.fecha DESC) AS detalle
             FROM gastos g
             LEFT JOIN categorias_gasto cg ON g.categoria_id = cg.id
             WHERE g.negocio_id = $1
               AND (g.fecha AT TIME ZONE 'America/Mexico_City')::date >= ${SEMANA}`,
        [negocio_id]),

      // 4. Alertas: stock bajo + CxC
      query(`SELECT
               (SELECT COUNT(*) FROM productos WHERE negocio_id = $1
                AND activo = true AND es_servicio = false
                AND stock_actual <= stock_minimo) AS stock_bajo,
               (SELECT COALESCE(SUM(saldo), 0) FROM cuentas_cobrar
                WHERE negocio_id = $1 AND estado IN ('pendiente','parcial')) AS total_cxc,
               (SELECT COUNT(*) FROM cuentas_cobrar
                WHERE negocio_id = $1 AND estado IN ('pendiente','parcial')) AS num_cxc`,
        [negocio_id]),

      // 5. Órdenes activas
      query(`SELECT
               COUNT(*) FILTER (WHERE estado = 'en_espera')  AS en_espera,
               COUNT(*) FILTER (WHERE estado = 'en_proceso') AS en_proceso,
               COUNT(*) FILTER (WHERE estado = 'listo')      AS listo
             FROM ordenes_servicio
             WHERE negocio_id = $1
               AND fecha_ingreso >= CURRENT_DATE - INTERVAL '7 days'`,
        [negocio_id]),

      // 6. Ventas por día (gráfica)
      query(`SELECT
               (fecha AT TIME ZONE 'America/Mexico_City')::date AS dia,
               COALESCE(SUM(total) FILTER (WHERE estado='pagada'), 0) AS total,
               COUNT(*) FILTER (WHERE estado='pagada') AS cantidad
             FROM ventas
             WHERE negocio_id = $1
               AND (fecha AT TIME ZONE 'America/Mexico_City')::date >= ${SEMANA}
             GROUP BY dia ORDER BY dia`,
        [negocio_id]),

      // 7. Productos vendidos esta semana con costo y margen
      query(`SELECT
               p.nombre, p.medida, p.marca,
               COALESCE(SUM(vd.cantidad), 0) AS cantidad_vendida,
               COALESCE(SUM(vd.subtotal), 0) AS ingresos,
               COALESCE(SUM(vd.cantidad * p.precio_compra), 0) AS costo
             FROM ventas_detalle vd
             JOIN ventas v    ON vd.venta_id   = v.id
             JOIN productos p ON vd.producto_id = p.id
             WHERE v.negocio_id = $1 AND v.estado = 'pagada'
               AND (v.fecha AT TIME ZONE 'America/Mexico_City')::date >= ${SEMANA}
             GROUP BY p.id, p.nombre, p.medida, p.marca
             ORDER BY cantidad_vendida DESC
             LIMIT 25`,
        [negocio_id]),

      // 8. Últimas 5 ventas
      query(`SELECT v.folio, v.total, v.metodo_pago,
                    (v.fecha AT TIME ZONE 'America/Mexico_City') AS fecha_local,
                    COALESCE(c.nombre, 'Cliente general') AS cliente_nombre
             FROM ventas v
             LEFT JOIN clientes c ON v.cliente_id = c.id
             WHERE v.negocio_id = $1 AND v.estado = 'pagada'
             ORDER BY v.fecha DESC LIMIT 5`,
        [negocio_id]),
    ]);

    const total_ventas   = parseFloat(ventasSemana.rows[0].total_ventas)  || 0;
    const costo_total    = parseFloat(costoSemana.rows[0].costo_total)    || 0;
    const total_gastos   = parseFloat(gastosSemana.rows[0].total_gastos)  || 0;
    const utilidad_bruta = total_ventas - costo_total;
    const utilidad_neta  = utilidad_bruta - total_gastos;
    const margen_bruto   = total_ventas > 0 ? (utilidad_bruta / total_ventas) * 100 : 0;

    res.json({
      semana: {
        ...ventasSemana.rows[0],
        costo_total,
        total_gastos,
        utilidad_bruta,
        utilidad_neta,
        margen_bruto:  parseFloat(margen_bruto.toFixed(1)),
        num_gastos:    parseInt(gastosSemana.rows[0].num_gastos) || 0,
        gastos_detalle: gastosSemana.rows[0].detalle || [],
      },
      alertas: {
        stock_bajo: parseInt(alertas.rows[0].stock_bajo) || 0,
        total_cxc:  parseFloat(alertas.rows[0].total_cxc) || 0,
        num_cxc:    parseInt(alertas.rows[0].num_cxc) || 0,
        ...ordenes.rows[0],
      },
      ventas_por_dia:   ventasPorDia.rows,
      productos_semana: productosSemana.rows,
      ultimas_ventas:   ultimasVentas.rows,
    });
  } catch (err) {
    console.error('[dashboard]', err);
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

    // IMPORTANTE: fecha es TIMESTAMPTZ (guardada en UTC) — se convierte a hora
    // de México antes de agrupar/comparar por día, para que una venta hecha
    // a las 8pm no se cuente como "del día siguiente".
    const { rows } = await query(
      `SELECT TO_CHAR(fecha AT TIME ZONE 'America/Mexico_City', $1) as periodo,
              SUM(total) as total, COUNT(*) as cantidad,
              SUM(total) FILTER (WHERE metodo_pago='efectivo') as efectivo,
              SUM(total) FILTER (WHERE metodo_pago='tarjeta') as tarjeta,
              SUM(total) FILTER (WHERE metodo_pago='transferencia') as transferencia
       FROM ventas
       WHERE (fecha AT TIME ZONE 'America/Mexico_City')::date BETWEEN $2::date AND $3::date AND estado = 'pagada' AND negocio_id = $4
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
       WHERE (v.fecha AT TIME ZONE 'America/Mexico_City')::date BETWEEN $1::date AND $2::date AND v.estado = 'pagada' AND v.negocio_id = $3
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
       WHERE (c.created_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN $1::date AND $2::date AND c.negocio_id = $3
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

// ── Reporte de inventario actual (solo productos con stock > 0) ───────────────
export const inventarioActual = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         p.id, p.sku, p.nombre, p.medida, p.marca,
         p.stock_actual, p.stock_minimo, p.precio_venta, p.precio_compra,
         cat.nombre AS categoria,
         COALESCE(SUM(vd.cantidad), 0) AS total_vendido,
         ROUND(p.stock_actual * p.precio_venta, 2) AS valor_inventario
       FROM productos p
       LEFT JOIN categorias       cat ON p.categoria_id   = cat.id
       LEFT JOIN ventas_detalle   vd  ON vd.producto_id   = p.id
         AND vd.venta_id IN (
           SELECT id FROM ventas WHERE negocio_id = $1 AND estado = 'pagada'
         )
       WHERE p.negocio_id = $1
         AND p.activo       = true
         AND p.es_servicio  = false
         AND p.stock_actual > 0
       GROUP BY p.id, p.sku, p.nombre, p.medida, p.marca,
                p.stock_actual, p.stock_minimo, p.precio_venta, p.precio_compra,
                cat.nombre
       ORDER BY cat.nombre NULLS LAST, p.nombre`,
      [req.user.negocio_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('[inventarioActual]', err);
    res.status(500).json({ error: 'Error al obtener inventario actual' });
  }
};

// ── Historial de ventas de un producto específico ────────────────────────────
export const ventasPorProducto = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const { producto_id } = req.params;

    // Totales generales
    const { rows: [resumen] } = await query(
      `SELECT
         COALESCE(SUM(vd.cantidad), 0)   AS total_unidades,
         COALESCE(SUM(vd.subtotal), 0)   AS total_ingresos,
         COUNT(DISTINCT v.id)            AS num_ventas
       FROM ventas_detalle vd
       JOIN ventas v ON vd.venta_id = v.id
       WHERE vd.producto_id = $1
         AND v.negocio_id   = $2
         AND v.estado       = 'pagada'`,
      [producto_id, negocio_id]
    );

    // Detalle de cada venta
    const { rows: ventas } = await query(
      `SELECT
         v.id AS venta_id, v.folio, v.metodo_pago,
         (v.fecha AT TIME ZONE 'America/Mexico_City') AS fecha_local,
         vd.cantidad, vd.precio_unitario, vd.subtotal,
         COALESCE(c.nombre, 'Cliente general') AS cliente_nombre,
         u.nombre AS cajero_nombre
       FROM ventas_detalle vd
       JOIN ventas    v  ON vd.venta_id  = v.id
       LEFT JOIN clientes  c  ON v.cliente_id = c.id
       LEFT JOIN usuarios  u  ON v.usuario_id = u.id
       WHERE vd.producto_id = $1
         AND v.negocio_id   = $2
         AND v.estado       = 'pagada'
       ORDER BY v.fecha DESC
       LIMIT 100`,
      [producto_id, negocio_id]
    );

    res.json({ resumen, ventas });
  } catch (err) {
    console.error('[ventasPorProducto]', err);
    res.status(500).json({ error: 'Error al obtener historial de ventas del producto' });
  }
};
