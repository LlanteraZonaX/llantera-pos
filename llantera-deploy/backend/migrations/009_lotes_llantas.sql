-- ============================================================
-- MIGRACIÓN 009: Control de lotes de llantas (recepción e inspección)
-- Permite registrar un lote físico que llega (ej. 60 llantas),
-- clasificarlo por producto/medida, marcar cuántas de cada medida
-- salieron defectuosas (con motivo) y calcular automáticamente
-- cuántas piezas efectivas entran al almacén (recibidas - defectuosas).
-- Al confirmar el lote, se suma el stock real de cada producto y
-- queda registro en movimientos_inventario para trazabilidad.
-- ============================================================

CREATE TABLE IF NOT EXISTS lotes_llantas (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  negocio_id           UUID NOT NULL REFERENCES negocios(id),
  folio                VARCHAR(30) NOT NULL,
  proveedor_id         UUID REFERENCES proveedores(id),
  proveedor_nombre     VARCHAR(150),   -- texto libre, por si no está en el catálogo de proveedores
  fecha_recepcion      DATE NOT NULL DEFAULT CURRENT_DATE,
  cantidad_total       NUMERIC(10,2) NOT NULL DEFAULT 0,  -- suma de todo lo que llegó físicamente
  cantidad_defectuosa  NUMERIC(10,2) NOT NULL DEFAULT 0,  -- suma de lo regresado/defectuoso
  cantidad_efectiva    NUMERIC(10,2) NOT NULL DEFAULT 0,  -- lo que realmente entró al almacén
  notas                TEXT,
  usuario_id           UUID REFERENCES usuarios(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lotes_detalle (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lote_id              UUID NOT NULL REFERENCES lotes_llantas(id) ON DELETE CASCADE,
  producto_id          UUID NOT NULL REFERENCES productos(id),
  medida               VARCHAR(30),    -- copia desnormalizada del producto al momento del lote
  descripcion          VARCHAR(200),
  cantidad_recibida    NUMERIC(10,2) NOT NULL,
  cantidad_defectuosa  NUMERIC(10,2) NOT NULL DEFAULT 0,
  razon_defecto        VARCHAR(200),
  cantidad_efectiva    NUMERIC(10,2) GENERATED ALWAYS AS (cantidad_recibida - cantidad_defectuosa) STORED
);

CREATE INDEX IF NOT EXISTS idx_lotes_llantas_negocio ON lotes_llantas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_lotes_llantas_fecha   ON lotes_llantas(fecha_recepcion);
CREATE INDEX IF NOT EXISTS idx_lotes_detalle_lote     ON lotes_detalle(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_detalle_producto ON lotes_detalle(producto_id);
