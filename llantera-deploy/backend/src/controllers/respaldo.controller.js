/**
 * respaldo.controller.js
 * Backup y restauración completa de los datos de un negocio.
 * Solo accesible por administradores.
 *
 * POST /admin/respaldo       → genera JSON con todos los datos
 * POST /admin/restaurar      → restaura desde JSON (destructivo, con confirmación)
 */
import { query, getClient } from '../config/db.js';

// Tablas a respaldar y su orden de restauración (respetando FKs)
// El orden de RESTORE es crítico: primero tablas padre, luego hijas
const TABLAS_NEGOCIO = [
  'marcas',
  'clientes',
  'productos',
  'compras',
  'compras_detalle',
  'gastos',
  'cotizaciones',
  'cotizaciones_detalle',
  'ventas',
  'ventas_detalle',
  'ordenes_servicio',
  'ordenes_detalle',
  'lotes_llantas',
  'lotes_detalle',
  'movimientos_inventario',
  'cuentas_cobrar',
  'cortes_caja',
];

// ── Crear respaldo ─────────────────────────────────────────────────────────────
export const crearRespaldo = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;

    // Obtener datos del negocio
    const { rows: [negocio] } = await query(
      `SELECT * FROM negocios WHERE id = $1`, [negocio_id]
    );
    const { rows: usuarios } = await query(
      `SELECT id, nombre, email, rol_id, activo, created_at
       FROM usuarios WHERE negocio_id = $1`, [negocio_id]
    );

    const datos = { negocio, usuarios };

    // Extraer todas las tablas del negocio
    for (const tabla of TABLAS_NEGOCIO) {
      try {
        // Verificar si la tabla tiene columna negocio_id
        const { rows } = await query(
          `SELECT * FROM ${tabla} WHERE negocio_id = $1 ORDER BY created_at ASC NULLS FIRST`,
          [negocio_id]
        );
        datos[tabla] = rows;
      } catch (_) {
        // Tabla sin negocio_id directa — buscar vía join
        datos[tabla] = [];
      }
    }

    // ventas_detalle: no tiene negocio_id, se obtiene vía ventas
    if (datos['ventas'] && datos['ventas'].length > 0) {
      const ventaIds = datos['ventas'].map(v => v.id);
      const { rows: detalle } = await query(
        `SELECT * FROM ventas_detalle WHERE venta_id = ANY($1)`,
        [ventaIds]
      );
      datos['ventas_detalle'] = detalle;
    }

    // compras_detalle: vía compras
    if (datos['compras'] && datos['compras'].length > 0) {
      const compraIds = datos['compras'].map(c => c.id);
      const { rows: det } = await query(
        `SELECT * FROM compras_detalle WHERE compra_id = ANY($1)`, [compraIds]
      );
      datos['compras_detalle'] = det;
    }

    // ordenes_detalle: vía ordenes_servicio
    if (datos['ordenes_servicio'] && datos['ordenes_servicio'].length > 0) {
      const ordenIds = datos['ordenes_servicio'].map(o => o.id);
      const { rows: det } = await query(
        `SELECT * FROM ordenes_detalle WHERE orden_id = ANY($1)`, [ordenIds]
      );
      datos['ordenes_detalle'] = det;
    }

    // lotes_detalle: vía lotes_llantas
    if (datos['lotes_llantas'] && datos['lotes_llantas'].length > 0) {
      const loteIds = datos['lotes_llantas'].map(l => l.id);
      const { rows: det } = await query(
        `SELECT * FROM lotes_detalle WHERE lote_id = ANY($1)`, [loteIds]
      );
      datos['lotes_detalle'] = det;
    }

    // cotizaciones_detalle: vía cotizaciones
    if (datos['cotizaciones'] && datos['cotizaciones'].length > 0) {
      const cotIds = datos['cotizaciones'].map(c => c.id);
      const { rows: det } = await query(
        `SELECT * FROM cotizaciones_detalle WHERE cotizacion_id = ANY($1)`, [cotIds]
      );
      datos['cotizaciones_detalle'] = det;
    }

    const respaldo = {
      version:     '1.0',
      negocio_id,
      fecha:       new Date().toISOString(),
      negocio_nombre: negocio?.nombre || 'Negocio',
      tablas:      Object.fromEntries(
        Object.entries(datos).map(([k, v]) => [k, Array.isArray(v) ? v.length : (v ? 1 : 0)])
      ),
      datos,
    };

    res.json(respaldo);
  } catch (err) {
    console.error('[respaldo.crearRespaldo]', err);
    res.status(500).json({ error: 'Error al generar respaldo: ' + err.message });
  }
};

// ── Restaurar respaldo ────────────────────────────────────────────────────────
export const restaurar = async (req, res) => {
  const client = await getClient();
  try {
    const negocio_id = req.user.negocio_id;
    const { respaldo, confirmacion } = req.body;

    if (confirmacion !== 'RESTAURAR') {
      return res.status(400).json({ error: 'Debes confirmar con la palabra RESTAURAR' });
    }
    if (!respaldo?.datos) {
      return res.status(400).json({ error: 'Archivo de respaldo inválido o corrupto' });
    }
    if (respaldo.negocio_id !== negocio_id) {
      return res.status(403).json({ error: 'Este respaldo pertenece a otro negocio' });
    }

    await client.query('BEGIN');

    // Desactivar FKs temporalmente para simplificar el orden de inserción
    await client.query(`SET session_replication_role = replica`);

    const d = respaldo.datos;

    // ── Eliminar datos actuales (en orden inverso) ────────────────────────────
    const tablasBorrar = [...TABLAS_NEGOCIO].reverse();
    for (const tabla of tablasBorrar) {
      try {
        await client.query(`DELETE FROM ${tabla} WHERE negocio_id = $1`, [negocio_id]);
      } catch (_) {
        // Tablas sin negocio_id — borrar vía join
      }
    }
    // Tablas relacionadas sin negocio_id directo
    await client.query(`DELETE FROM ventas_detalle WHERE venta_id IN (SELECT id FROM ventas WHERE negocio_id = $1)`, [negocio_id]);
    await client.query(`DELETE FROM compras_detalle WHERE compra_id IN (SELECT id FROM compras WHERE negocio_id = $1)`, [negocio_id]);
    await client.query(`DELETE FROM ordenes_detalle WHERE orden_id IN (SELECT id FROM ordenes_servicio WHERE negocio_id = $1)`, [negocio_id]);
    await client.query(`DELETE FROM lotes_detalle WHERE lote_id IN (SELECT id FROM lotes_llantas WHERE negocio_id = $1)`, [negocio_id]);
    await client.query(`DELETE FROM cotizaciones_detalle WHERE cotizacion_id IN (SELECT id FROM cotizaciones WHERE negocio_id = $1)`, [negocio_id]);

    // ── Restaurar tablas en orden correcto ────────────────────────────────────
    const ORDEN_RESTORE = [
      'marcas', 'clientes', 'productos',
      'compras', 'compras_detalle',
      'gastos',
      'cotizaciones', 'cotizaciones_detalle',
      'ventas', 'ventas_detalle',
      'ordenes_servicio', 'ordenes_detalle',
      'lotes_llantas', 'lotes_detalle',
      'movimientos_inventario',
      'cuentas_cobrar',
      'cortes_caja',
    ];

    let totalRestaurado = 0;
    for (const tabla of ORDEN_RESTORE) {
      const filas = d[tabla];
      if (!Array.isArray(filas) || filas.length === 0) continue;

      for (const fila of filas) {
        const cols = Object.keys(fila).filter(k => fila[k] !== undefined);
        const vals = cols.map(c => fila[c]);
        const params = cols.map((_, i) => `$${i + 1}`);
        try {
          await client.query(
            `INSERT INTO ${tabla} (${cols.join(',')}) VALUES (${params.join(',')}) ON CONFLICT DO NOTHING`,
            vals
          );
          totalRestaurado++;
        } catch (e) {
          console.warn(`[restaurar] ${tabla} fila ${fila.id}: ${e.message.substring(0, 80)}`);
        }
      }
    }

    // Restaurar configuración del negocio (sin cambiar negocio_id)
    if (d.negocio) {
      const { nombre, telefono, direccion, facebook_url, logo_url } = d.negocio;
      await client.query(
        `UPDATE negocios SET nombre=$1, telefono=$2, direccion=$3, facebook_url=$4, logo_url=$5 WHERE id=$6`,
        [nombre, telefono, direccion, facebook_url, logo_url, negocio_id]
      );
    }

    // Re-activar FKs
    await client.query(`SET session_replication_role = DEFAULT`);
    await client.query('COMMIT');

    res.json({
      mensaje: `Restauración completada — ${totalRestaurado} registros restaurados`,
      fecha_respaldo: respaldo.fecha,
    });
  } catch (err) {
    await client.query(`SET session_replication_role = DEFAULT`).catch(() => {});
    await client.query('ROLLBACK');
    console.error('[respaldo.restaurar]', err);
    res.status(500).json({ error: 'Error al restaurar: ' + err.message });
  } finally {
    client.release();
  }
};
