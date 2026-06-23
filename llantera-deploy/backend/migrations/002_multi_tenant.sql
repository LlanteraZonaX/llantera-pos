-- ============================================================
-- MIGRACIÓN 002: Soporte multi-negocio (multi-tenant)
-- Permite revender el sistema a múltiples clientes con datos
-- completamente aislados entre sí, en la misma base de datos.
-- ============================================================

-- 1. Tabla de negocios (tenants)
CREATE TABLE IF NOT EXISTS negocios (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  slug          VARCHAR(60) NOT NULL UNIQUE,   -- usado en URLs, ej: llantera-zonax
  logo_url      TEXT,
  telefono      VARCHAR(20),
  direccion     TEXT,
  moneda        VARCHAR(10) DEFAULT 'MXN',
  zona_horaria  VARCHAR(50) DEFAULT 'America/Monterrey',
  activo        BOOLEAN DEFAULT true,
  plan          VARCHAR(20) DEFAULT 'basico',  -- basico, pro, enterprise (para futura facturación)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Negocio por defecto: aquí "caen" todos los datos que ya existían
--    antes de esta migración (tu llantera actual), para no perder nada.
INSERT INTO negocios (id, nombre, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Llantera ZonaX', 'llantera-zonax')
ON CONFLICT (id) DO NOTHING;

-- 3. Agregar negocio_id a cada tabla con datos propios del negocio.
--    Se agrega NULLABLE primero, se rellena con el negocio default,
--    y LUEGO se pone NOT NULL — así no truena con filas existentes.

DO $$
DECLARE
  default_negocio UUID := '00000000-0000-0000-0000-000000000001';
  t TEXT;
  tablas TEXT[] := ARRAY[
    'usuarios','clientes','vehiculos','productos',
    'proveedores','compras','ordenes_servicio',
    'ventas','cuentas_cobrar','gastos',
    'movimientos_inventario'
  ];
  -- NOTA: categorias, tipos_servicio y categorias_gasto NO llevan negocio_id
  -- a propósito: son catálogos genéricos (ej. "Balanceo", "Llantas nuevas")
  -- útiles para CUALQUIER negocio nuevo sin que tenga que recrearlos.
  -- Si en el futuro un cliente quiere categorías propias y exclusivas,
  -- se puede agregar negocio_id NULLABLE a esas tablas en una migración
  -- aparte (NULL = catálogo global, valor = catálogo exclusivo del negocio).
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'negocio_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN negocio_id UUID REFERENCES negocios(id)', t);
      EXECUTE format('UPDATE %I SET negocio_id = %L WHERE negocio_id IS NULL', t, default_negocio);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN negocio_id SET NOT NULL', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_negocio ON %I(negocio_id)', t, t);
    END IF;
  END LOOP;
END $$;

-- 4. Email de usuario único POR NEGOCIO, no global (dos negocios distintos
--    pueden tener un usuario admin@admin.com cada uno sin chocar)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_negocio
  ON usuarios(negocio_id, email);

-- 5. SKU único por negocio, no global
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_sku_negocio
  ON productos(negocio_id, sku) WHERE sku IS NOT NULL;

-- 6. Folio único por negocio (compras, órdenes, ventas)
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_folio_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_folio_negocio ON compras(negocio_id, folio);

ALTER TABLE ordenes_servicio DROP CONSTRAINT IF EXISTS ordenes_servicio_folio_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_folio_negocio ON ordenes_servicio(negocio_id, folio);

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_folio_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_folio_negocio ON ventas(negocio_id, folio);
