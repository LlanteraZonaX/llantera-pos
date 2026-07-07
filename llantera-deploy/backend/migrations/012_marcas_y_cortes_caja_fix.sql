-- ============================================================
-- MIGRACIÓN 012: Marcas y Cortes de caja (recuperación)
-- Esta migración crea las tablas que debió crear la 011 pero que
-- el runner pudo haber marcado como aplicadas sin ejecutarlas.
-- Usa IF NOT EXISTS en todo — es segura de correr más de una vez.
-- ============================================================

-- Catálogo de marcas de llantas
CREATE TABLE IF NOT EXISTS marcas (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  negocio_id    UUID NOT NULL REFERENCES negocios(id),
  nombre        VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (negocio_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_marcas_negocio ON marcas(negocio_id);

-- Cortes de caja por turno
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
  estado                VARCHAR(20) NOT NULL DEFAULT 'abierto',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cortes_caja_negocio ON cortes_caja(negocio_id);
CREATE INDEX IF NOT EXISTS idx_cortes_caja_estado  ON cortes_caja(negocio_id, estado);
