-- ============================================================
-- MIGRACIÓN 004: Sistema de cotizaciones
-- Permite a un vendedor armar una cotización desde el catálogo
-- y compartirla por enlace público (WhatsApp, etc.) sin exponer
-- el sistema completo al cliente final.
-- ============================================================

CREATE TABLE IF NOT EXISTS cotizaciones (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  negocio_id    UUID NOT NULL REFERENCES negocios(id),
  folio         VARCHAR(30) NOT NULL,
  vendedor_id   UUID NOT NULL REFERENCES usuarios(id),
  cliente_id    UUID REFERENCES clientes(id),       -- opcional, puede ser prospecto sin registrar
  cliente_nombre VARCHAR(150),                        -- si no es cliente registrado aún
  cliente_telefono VARCHAR(20),
  subtotal      NUMERIC(10,2) DEFAULT 0,
  descuento     NUMERIC(10,2) DEFAULT 0,
  total         NUMERIC(10,2) DEFAULT 0,
  vigencia_dias SMALLINT DEFAULT 3,
  token_publico VARCHAR(40) NOT NULL UNIQUE,  -- para el enlace compartible, sin login
  estado        VARCHAR(20) DEFAULT 'enviada'
                CHECK (estado IN ('borrador','enviada','vista','aceptada','vencida','convertida')),
  venta_id      UUID REFERENCES ventas(id),  -- si el cliente acepta y se convierte en venta
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  visto_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizaciones_folio_negocio ON cotizaciones(negocio_id, folio);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_token ON cotizaciones(token_publico);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_vendedor ON cotizaciones(vendedor_id);

CREATE TABLE IF NOT EXISTS cotizaciones_detalle (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cotizacion_id   UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  producto_id     UUID REFERENCES productos(id),
  descripcion     VARCHAR(200) NOT NULL,    -- copia, por si el producto cambia después
  foto_url        TEXT,                      -- copia de la foto principal al momento de cotizar
  cantidad        NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_detalle_cot ON cotizaciones_detalle(cotizacion_id);
