-- 004_pagos_mixtos.sql
-- Permite que una venta se pague con más de un método (ej. $300 tarjeta +
-- $200 transferencia + resto efectivo). Antes, `ventas.metodo_pago` solo
-- guardaba UN método para el total completo.

CREATE TABLE IF NOT EXISTS ventas_pagos (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venta_id    UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia')),
  monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_pagos_venta ON ventas_pagos(venta_id);

-- Respaldo histórico: las ventas que ya existen antes de este cambio tenían
-- un solo método de pago por el monto total pagado. Les creamos su fila
-- correspondiente en ventas_pagos para que los reportes y cortes de caja
-- que a partir de ahora se calculan desde esta tabla sigan cuadrando con
-- el histórico, sin perder ni un dato de ventas pasadas.
INSERT INTO ventas_pagos (venta_id, metodo_pago, monto)
SELECT id, metodo_pago, monto_pagado
FROM ventas
WHERE metodo_pago IN ('efectivo','tarjeta','transferencia')
  AND monto_pagado > 0
  AND NOT EXISTS (SELECT 1 FROM ventas_pagos vp WHERE vp.venta_id = ventas.id);
