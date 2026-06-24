-- ============================================================
-- MIGRACIÓN 007: Datos de negocio para cotizaciones más completas
-- Agrega Facebook a los datos del negocio (ya existían logo_url,
-- telefono y direccion desde la migración 002) para poder mostrar
-- una cotización pública con identidad de marca completa.
-- ============================================================

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS facebook_url TEXT;
