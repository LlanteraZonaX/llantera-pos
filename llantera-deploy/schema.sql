-- ============================================================
-- SISTEMA POS LLANTERA Y VULCANIZADORA
-- PostgreSQL Schema v1.0
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- búsqueda de texto

-- ============================================================
-- CATÁLOGOS BASE
-- ============================================================

CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50) NOT NULL UNIQUE,  -- admin, cajero, tecnico, gerente
  permisos    JSONB DEFAULT '{}'
);

CREATE TABLE usuarios (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol_id      INTEGER REFERENCES roles(id),
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTES Y VEHÍCULOS (CRM)
-- ============================================================

CREATE TABLE clientes (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  telefono    VARCHAR(20),
  email       VARCHAR(150),
  rfc         VARCHAR(20),
  direccion   TEXT,
  notas       TEXT,
  limite_credito  NUMERIC(10,2) DEFAULT 0,
  saldo_pendiente NUMERIC(10,2) DEFAULT 0,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehiculos (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id  UUID NOT NULL REFERENCES clientes(id),
  placa       VARCHAR(20) NOT NULL,
  marca       VARCHAR(80),
  modelo      VARCHAR(80),
  anio        SMALLINT,
  color       VARCHAR(40),
  num_serie   VARCHAR(50),
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehiculos_placa ON vehiculos USING gin(placa gin_trgm_ops);
CREATE INDEX idx_vehiculos_cliente ON vehiculos(cliente_id);

-- ============================================================
-- CATÁLOGO DE PRODUCTOS E INVENTARIO
-- ============================================================

CREATE TABLE categorias (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(80) NOT NULL,
  tipo        VARCHAR(20) CHECK (tipo IN ('llanta','refaccion','consumible','servicio'))
);

CREATE TABLE productos (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku         VARCHAR(60) UNIQUE,
  nombre      VARCHAR(200) NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id),
  -- Atributos específicos de llantas
  medida      VARCHAR(30),   -- ej: 205/65R16
  ancho       SMALLINT,      -- mm (205)
  perfil      SMALLINT,      -- % (65)
  aro         SMALLINT,      -- pulgadas (16)
  tipo_llanta VARCHAR(30),   -- radial, convencional, run-flat
  marca       VARCHAR(80),
  indice_carga VARCHAR(10),
  indice_vel  VARCHAR(5),
  -- Inventario y precios
  stock_actual     NUMERIC(10,2) DEFAULT 0,
  stock_minimo     NUMERIC(10,2) DEFAULT 0,
  precio_compra    NUMERIC(10,2) DEFAULT 0,
  precio_venta     NUMERIC(10,2) DEFAULT 0,
  precio_mayoreo   NUMERIC(10,2),
  unidad_medida    VARCHAR(20) DEFAULT 'pza',
  es_servicio      BOOLEAN DEFAULT false,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_productos_medida ON productos(medida);
CREATE INDEX idx_productos_nombre ON productos USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_productos_sku    ON productos(sku);

-- ============================================================
-- COMPRAS (PROVEEDORES Y RECEPCIONES)
-- ============================================================

CREATE TABLE proveedores (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  contacto    VARCHAR(100),
  telefono    VARCHAR(20),
  email       VARCHAR(150),
  rfc         VARCHAR(20),
  direccion   TEXT,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE compras (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  folio          VARCHAR(30) NOT NULL UNIQUE,
  proveedor_id   UUID REFERENCES proveedores(id),
  usuario_id     UUID REFERENCES usuarios(id),
  fecha_recepcion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_factura   DATE,
  num_factura     VARCHAR(60),
  subtotal       NUMERIC(10,2) DEFAULT 0,
  iva            NUMERIC(10,2) DEFAULT 0,
  total          NUMERIC(10,2) DEFAULT 0,
  estado         VARCHAR(20) DEFAULT 'recibida' CHECK (estado IN ('pendiente','recibida','cancelada')),
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE compras_detalle (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  compra_id       UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id     UUID NOT NULL REFERENCES productos(id),
  -- Datos de la llanta al momento de la compra (desnormalizado para historial)
  medida          VARCHAR(30),   -- copia de producto.medida
  descripcion     VARCHAR(200),  -- copia de producto.nombre
  cantidad        NUMERIC(10,2) NOT NULL,
  costo_unitario  NUMERIC(10,2) NOT NULL,
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED
);

-- ============================================================
-- SERVICIOS (ÓRDENES DE TRABAJO)
-- ============================================================

CREATE TABLE tipos_servicio (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,  -- balanceo, alineación, vulcanizado, montaje, etc.
  precio_base NUMERIC(10,2) DEFAULT 0,
  duracion_min INTEGER DEFAULT 30,    -- minutos estimados
  activo      BOOLEAN DEFAULT true
);

CREATE TABLE ordenes_servicio (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  folio           VARCHAR(30) NOT NULL UNIQUE,
  cliente_id      UUID REFERENCES clientes(id),
  vehiculo_id     UUID REFERENCES vehiculos(id),
  tecnico_id      UUID REFERENCES usuarios(id),
  cajero_id       UUID REFERENCES usuarios(id),
  fecha_ingreso   TIMESTAMPTZ DEFAULT NOW(),
  fecha_estimada  TIMESTAMPTZ,
  fecha_entrega   TIMESTAMPTZ,
  estado          VARCHAR(20) DEFAULT 'en_espera'
                  CHECK (estado IN ('en_espera','en_proceso','listo','entregado','cancelado')),
  km_vehiculo     INTEGER,
  observaciones   TEXT,
  subtotal        NUMERIC(10,2) DEFAULT 0,
  descuento       NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) DEFAULT 0,
  pagado          BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ordenes_detalle (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  orden_id        UUID NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
  tipo            VARCHAR(10) CHECK (tipo IN ('producto','servicio')),
  producto_id     UUID REFERENCES productos(id),
  servicio_id     INTEGER REFERENCES tipos_servicio(id),
  descripcion     VARCHAR(200) NOT NULL,
  cantidad        NUMERIC(10,2) DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  descuento       NUMERIC(10,2) DEFAULT 0,
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario - descuento) STORED
);

-- ============================================================
-- VENTAS (PUNTO DE VENTA DIRECTO)
-- ============================================================

CREATE TABLE ventas (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  folio          VARCHAR(30) NOT NULL UNIQUE,
  cliente_id     UUID REFERENCES clientes(id),
  usuario_id     UUID REFERENCES usuarios(id),
  orden_id       UUID REFERENCES ordenes_servicio(id),  -- si viene de una orden
  fecha          TIMESTAMPTZ DEFAULT NOW(),
  subtotal       NUMERIC(10,2) DEFAULT 0,
  descuento      NUMERIC(10,2) DEFAULT 0,
  iva            NUMERIC(10,2) DEFAULT 0,
  total          NUMERIC(10,2) DEFAULT 0,
  metodo_pago    VARCHAR(20) DEFAULT 'efectivo'
                 CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','credito','mixto')),
  monto_pagado   NUMERIC(10,2) DEFAULT 0,
  cambio         NUMERIC(10,2) DEFAULT 0,
  requiere_factura BOOLEAN DEFAULT false,
  cfdi_uuid      VARCHAR(100),
  estado         VARCHAR(20) DEFAULT 'pagada'
                 CHECK (estado IN ('pagada','pendiente','cancelada')),
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ventas_detalle (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venta_id        UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     UUID REFERENCES productos(id),
  descripcion     VARCHAR(200) NOT NULL,
  cantidad        NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  descuento       NUMERIC(10,2) DEFAULT 0,
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario - descuento) STORED
);

-- ============================================================
-- CUENTAS POR COBRAR / CRÉDITO
-- ============================================================

CREATE TABLE cuentas_cobrar (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id     UUID NOT NULL REFERENCES clientes(id),
  venta_id       UUID REFERENCES ventas(id),
  orden_id       UUID REFERENCES ordenes_servicio(id),
  monto_total    NUMERIC(10,2) NOT NULL,
  monto_pagado   NUMERIC(10,2) DEFAULT 0,
  saldo          NUMERIC(10,2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
  fecha_vencimiento DATE,
  estado         VARCHAR(20) DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','parcial','pagada','vencida')),
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pagos_credito (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cuenta_id      UUID NOT NULL REFERENCES cuentas_cobrar(id),
  usuario_id     UUID REFERENCES usuarios(id),
  monto          NUMERIC(10,2) NOT NULL,
  metodo_pago    VARCHAR(20) DEFAULT 'efectivo',
  referencia     VARCHAR(100),
  fecha          TIMESTAMPTZ DEFAULT NOW(),
  notas          TEXT
);

-- ============================================================
-- GASTOS
-- ============================================================

CREATE TABLE categorias_gasto (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,  -- renta, luz, agua, sueldos, combustible, etc.
  activo BOOLEAN DEFAULT true
);

CREATE TABLE gastos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  categoria_id    INTEGER REFERENCES categorias_gasto(id),
  usuario_id      UUID REFERENCES usuarios(id),
  descripcion     VARCHAR(255) NOT NULL,
  monto           NUMERIC(10,2) NOT NULL,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago     VARCHAR(20) DEFAULT 'efectivo',
  comprobante_url TEXT,          -- ruta del archivo adjunto
  proveedor_id    UUID REFERENCES proveedores(id),  -- opcional
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO (AUDITORÍA)
-- ============================================================

CREATE TABLE movimientos_inventario (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  producto_id    UUID NOT NULL REFERENCES productos(id),
  tipo           VARCHAR(20) CHECK (tipo IN ('entrada','salida','ajuste','devolucion')),
  cantidad       NUMERIC(10,2) NOT NULL,
  stock_antes    NUMERIC(10,2) NOT NULL,
  stock_despues  NUMERIC(10,2) NOT NULL,
  referencia_tipo VARCHAR(20),   -- 'compra','venta','orden','ajuste'
  referencia_id  UUID,
  usuario_id     UUID REFERENCES usuarios(id),
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DATOS INICIALES
-- ============================================================

INSERT INTO roles (nombre, permisos) VALUES
  ('admin',   '{"todo": true}'),
  ('gerente', '{"ventas":true,"compras":true,"reportes":true,"gastos":true}'),
  ('cajero',  '{"ventas":true,"ordenes":true,"clientes":true}'),
  ('tecnico', '{"ordenes":true}');

INSERT INTO categorias (nombre, tipo) VALUES
  ('Llantas nuevas',    'llanta'),
  ('Llantas de medio uso','llanta'),
  ('Refacciones',       'refaccion'),
  ('Consumibles',       'consumible'),
  ('Servicios',         'servicio');

INSERT INTO tipos_servicio (nombre, precio_base, duracion_min) VALUES
  ('Balanceo',           80,  20),
  ('Alineación 4 ruedas',350, 45),
  ('Vulcanizado',        60,  15),
  ('Montaje de llanta',  60,  10),
  ('Rotación de llantas',120, 20),
  ('Inflado de nitrógeno',50, 10),
  ('Reparación de pinchadura',80,15);

INSERT INTO categorias_gasto (nombre) VALUES
  ('Renta'),('Electricidad'),('Agua'),('Sueldos'),
  ('Combustible'),('Mantenimiento equipo'),('Papelería'),
  ('Publicidad'),('Otros');
