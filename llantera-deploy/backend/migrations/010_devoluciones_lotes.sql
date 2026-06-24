-- ============================================================
-- MIGRACIÓN 010: Devoluciones de lote (sin tocar tablas existentes)
-- Flujo real: llega un lote completo (ej. 72 llantas), se CLASIFICA
-- por medida/producto (esto ya existía desde la migración 009, vía
-- lotes_llantas + lotes_detalle), y por separado, después de revisar
-- calidad, se registra una DEVOLUCIÓN con la cantidad total regresada
-- y el motivo — SIN desglose por medida.
--
-- No se modifica ni se elimina ninguna columna existente, solo se
-- agrega esta tabla nueva para no arriesgar datos ya capturados.
-- ============================================================

CREATE TABLE IF NOT EXISTS lotes_devoluciones (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  negocio_id        UUID NOT NULL REFERENCES negocios(id),
  lote_id           UUID NOT NULL REFERENCES lotes_llantas(id) ON DELETE CASCADE,
  cantidad          NUMERIC(10,2) NOT NULL,
  motivo            VARCHAR(300) NOT NULL,
  fecha_devolucion  DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id        UUID REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_devoluciones_lote    ON lotes_devoluciones(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_devoluciones_negocio ON lotes_devoluciones(negocio_id);
