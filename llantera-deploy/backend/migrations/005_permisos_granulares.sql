-- ============================================================
-- MIGRACIÓN 005: Corrección de permisos granulares por rol
-- El frontend ahora niega por defecto cualquier permiso no
-- declarado explícitamente (más seguro). Esta migración asegura
-- que cada rol tenga todas las claves relevantes declaradas,
-- para que el menú lateral muestre solo lo que corresponde.
-- ============================================================

UPDATE roles SET permisos = '{"todo": true}'::jsonb
WHERE nombre = 'admin';

UPDATE roles SET permisos = '{
  "reportes": true,
  "compras": true,
  "gastos": true,
  "ordenes": true,
  "clientes": true,
  "cotizaciones": true,
  "productos_ver": true,
  "ventas": true
}'::jsonb
WHERE nombre = 'gerente';

UPDATE roles SET permisos = '{
  "reportes": false,
  "compras": false,
  "gastos": false,
  "ordenes": true,
  "clientes": true,
  "cotizaciones": true,
  "productos_ver": true,
  "ventas": true
}'::jsonb
WHERE nombre = 'cajero';

UPDATE roles SET permisos = '{
  "reportes": false,
  "compras": false,
  "gastos": false,
  "ordenes": true,
  "clientes": false,
  "cotizaciones": false,
  "productos_ver": false,
  "ventas": false
}'::jsonb
WHERE nombre = 'tecnico';

UPDATE roles SET permisos = '{
  "reportes": false,
  "compras": false,
  "gastos": false,
  "ordenes": false,
  "clientes": true,
  "cotizaciones": true,
  "productos_ver": true,
  "ventas": false,
  "compartir_catalogo": true
}'::jsonb
WHERE nombre = 'vendedor';
