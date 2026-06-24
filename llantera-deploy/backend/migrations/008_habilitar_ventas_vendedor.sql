-- ============================================================
-- MIGRACIÓN 008: Habilitar Ventas para el rol vendedor
-- La migración 006 dejó "ventas": false para que el vendedor solo
-- pudiera cotizar, pero un vendedor sin poder cerrar una venta no
-- tiene sentido operativo. Se habilita el acceso a la pantalla de
-- Ventas/POS manteniendo el resto de restricciones (sin acceso a
-- Inventario, Clientes/CRM, Compras, Gastos, Reportes ni Órdenes).
-- ============================================================

UPDATE roles SET permisos = '{
  "reportes": false,
  "compras": false,
  "gastos": false,
  "ordenes": false,
  "clientes": false,
  "cotizaciones": true,
  "productos_ver": false,
  "ventas": true,
  "compartir_catalogo": true
}'::jsonb
WHERE nombre = 'vendedor';
