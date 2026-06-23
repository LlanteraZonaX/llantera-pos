-- ============================================================
-- MIGRACIÓN 003: Fotos de producto + rol Vendedor
-- ============================================================

-- 1. Fotos de producto (un producto puede tener varias fotos)
CREATE TABLE IF NOT EXISTS producto_fotos (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  producto_id  UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,         -- URL pública (storage externo o CDN)
  es_principal BOOLEAN DEFAULT false, -- foto destacada para compartir rápido
  orden        SMALLINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producto_fotos_producto ON producto_fotos(producto_id);

-- Solo una foto principal por producto
CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_fotos_principal
  ON producto_fotos(producto_id) WHERE es_principal = true;

-- 2. Rol de vendedor: ve catálogo, precios y fotos; NO ve compras,
--    gastos, reportes financieros ni datos de otros vendedores.
INSERT INTO roles (nombre, permisos)
VALUES ('vendedor', '{
  "ventas": true,
  "clientes": true,
  "productos_ver": true,
  "cotizaciones": true,
  "compras": false,
  "gastos": false,
  "reportes": false
}')
ON CONFLICT (nombre) DO NOTHING;

-- 3. Permiso explícito de "compartir catálogo" (granular, por si en el
--    futuro se quiere activar/desactivar sin tocar todo el rol)
UPDATE roles SET permisos = permisos || '{"compartir_catalogo": true}'::jsonb
WHERE nombre = 'vendedor';
