-- ============================================================
-- MIGRACIÓN 011: Catálogos auxiliares + Control de caja
-- Tablas:
--   marcas      — catálogo de marcas de llantas (aditivo, sin FK en productos)
--   cortes_caja — apertura y cierre de caja por turno
-- No se modifica ninguna tabla existente.
-- ============================================================

-- Catálogo de marcas (auxiliar, sin impacto en productos existentes)
CREATE TABLE IF NOT EXISTS marcas (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  negocio_id    UUID NOT NULL REFERENCES negocios(id),
  nombre        VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (negocio_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_marcas_negocio ON marcas(negocio_id);

-- Cortes de caja (apertura/cierre por turno de trabajo)
-- monto_esperado  = monto_inicial + total efectivo de ventas en el turno
-- diferencia      = monto_final_contado - monto_esperado
CREATE TABLE IF NOT EXISTS cortes_caja (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  negocio_id            UUID NOT NULL REFERENCES negocios(id),
  usuario_id            UUID REFERENCES usuarios(id),
  fecha_apertura        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre          TIMESTAMPTZ,
  monto_inicial         NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_final_contado   NUMERIC(12,2),
  monto_esperado        NUMERIC(12,2),
  total_ventas          NUMERIC(12,2),
  total_efectivo_ventas NUMERIC(12,2),
  diferencia            NUMERIC(12,2),
  notas                 TEXT,
  estado                VARCHAR(20) NOT NULL DEFAULT 'abierto',   -- abierto | cerrado
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cortes_caja_negocio ON cortes_caja(negocio_id);
CREATE INDEX IF NOT EXISTS idx_cortes_caja_estado  ON cortes_caja(negocio_id, estado);
