-- ============================================================
-- MIGRACIÓN 006: Restringir vendedor a solo Catálogo/Cotizar
-- La migración 005 le dio a 'vendedor' productos_ver=true y
-- clientes=true, lo cual sin querer le abrió acceso a las
-- pantallas completas de Inventario y Clientes/CRM (gestión,
-- edición, historial de crédito) — no solo lo necesario para
-- armar una cotización. El componente Catálogo hace sus propias
-- llamadas a la API de productos sin depender de este permiso,
-- así que es seguro quitarlo sin romper la función de cotizar.
-- ============================================================

UPDATE roles SET permisos = '{
  "reportes": false,
  "compras": false,
  "gastos": false,
  "ordenes": false,
  "clientes": false,
  "cotizaciones": true,
  "productos_ver": false,
  "ventas": false,
  "compartir_catalogo": true
}'::jsonb
WHERE nombre = 'vendedor';
