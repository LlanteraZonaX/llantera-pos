/**
 * setup-demo.js
 * Crea el negocio "Demo Llantera POS" con datos de muestra realistas.
 * Credenciales: admin@demo.com / admin123
 *
 * Uso en Railway Console:
 *   node src/scripts/setup-demo.js
 *
 * Es idempotente — se puede correr múltiples veces sin duplicar datos.
 * Para resetear los datos de demo: node src/scripts/setup-demo.js --reset
 */

import { getClient, query } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const RESET = process.argv.includes('--reset');

// ── Helpers ───────────────────────────────────────────────────────────────────
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Fecha aleatoria dentro de los últimos N días, en horario de trabajo (9am-8pm MX)
const fechaAleatoria = (diasAtras) => {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(rndNum(9, 20), rndNum(0, 59), 0, 0);
  return d;
};

// Formatear dinero
const fmt2 = (n) => parseFloat(n.toFixed(2));

// ── Datos de muestra ──────────────────────────────────────────────────────────
const PRODUCTOS_DEMO = [
  // Llantas seminuevas
  { nombre: 'LLANTA SEMINUEVA', medida: '185/60/R14', marca: 'HANKOOK',      precio_venta: 650,  precio_compra: 400, stock: 18, tipo: 'llanta' },
  { nombre: 'LLANTA SEMINUEVA', medida: '195/65/R15', marca: 'GOODYEAR',     precio_venta: 750,  precio_compra: 480, stock: 14, tipo: 'llanta' },
  { nombre: 'LLANTA SEMINUEVA', medida: '205/55/R16', marca: 'BRIDGESTONE',  precio_venta: 850,  precio_compra: 550, stock: 10, tipo: 'llanta' },
  { nombre: 'LLANTA SEMINUEVA', medida: '225/45/R17', marca: 'MICHELIN',     precio_venta: 1100, precio_compra: 720, stock: 7,  tipo: 'llanta' },
  { nombre: 'LLANTA SEMINUEVA', medida: '235/55/R18', marca: 'CONTINENTAL',  precio_venta: 1350, precio_compra: 900, stock: 5,  tipo: 'llanta' },
  { nombre: 'LLANTA SEMINUEVA', medida: '215/60/R16', marca: 'YOKOHAMA',     precio_venta: 950,  precio_compra: 620, stock: 9,  tipo: 'llanta' },
  { nombre: 'LLANTA NUEVA',     medida: '185/60/R14', marca: 'HANKOOK',      precio_venta: 1200, precio_compra: 800, stock: 6,  tipo: 'llanta' },
  { nombre: 'LLANTA NUEVA',     medida: '195/65/R15', marca: 'GOODYEAR',     precio_venta: 1450, precio_compra: 950, stock: 4,  tipo: 'llanta' },
  // Refacciones / consumibles
  { nombre: 'PARCHE',           medida: '#4 GRANDE',  marca: 'REMA',         precio_venta: 25,   precio_compra: 10,  stock: 200, tipo: 'refaccion' },
  { nombre: 'PARCHE',           medida: '#3 MEDIANO', marca: 'REMA',         precio_venta: 18,   precio_compra: 7,   stock: 200, tipo: 'refaccion' },
  { nombre: 'PARCHE',           medida: '#2 PEQUEÑO', marca: 'REMA',         precio_venta: 12,   precio_compra: 5,   stock: 200, tipo: 'refaccion' },
  { nombre: 'VALVULA',          medida: 'TR4 ESTANDAR', marca: 'AIRTEC',    precio_venta: 15,   precio_compra: 5,   stock: 100, tipo: 'refaccion' },
  { nombre: 'LIQUIDO MONTA LLANTAS', medida: '1 LT',  marca: 'GENERICO',   precio_venta: 40,   precio_compra: 18,  stock: 30,  tipo: 'consumible' },
  { nombre: 'PESA BALANCEO',    medida: '5g',         marca: 'GENERICO',    precio_venta: 3,    precio_compra: 1,   stock: 500, tipo: 'refaccion' },
  // Servicios
  { nombre: 'BALANCEO',         medida: 'por llanta', marca: null,           precio_venta: 80,   precio_compra: 0,   stock: 0,   tipo: 'servicio', es_servicio: true },
  { nombre: 'MONTAJE',          medida: 'por llanta', marca: null,           precio_venta: 60,   precio_compra: 0,   stock: 0,   tipo: 'servicio', es_servicio: true },
  { nombre: 'ALINEACION',       medida: '4 ruedas',   marca: null,           precio_venta: 350,  precio_compra: 0,   stock: 0,   tipo: 'servicio', es_servicio: true },
  { nombre: 'REPARACION PONCHE',medida: 'parche interno', marca: null,      precio_venta: 120,  precio_compra: 15,  stock: 0,   tipo: 'servicio', es_servicio: true },
];

const CLIENTES_DEMO = [
  { nombre: 'Carlos Martínez López',   telefono: '8112345678', email: 'carlos.ml@gmail.com',  direccion: 'Av. Constitución 1500, Monterrey' },
  { nombre: 'María Fernanda García',   telefono: '8198765432', email: 'mfgarcia@hotmail.com', direccion: 'Calle Hidalgo 456, San Pedro' },
  { nombre: 'Roberto Sánchez Tirado',  telefono: '8187654321', email: null,                   direccion: 'Col. Industrial, Monterrey' },
  { nombre: 'Transporte Norteño S.A.', telefono: '8133445566', email: 'flota@transnorteno.mx', direccion: 'Blvd. Luis Donaldo Colosio 2200' },
  { nombre: 'Ana Lucía Reyes',         telefono: '8145678901', email: 'ana.reyes@gmail.com',  direccion: null },
  { nombre: 'Distribuidora del Norte', telefono: '8156789012', email: 'ventas@distnorte.com', direccion: 'Zona Industrial Apodaca' },
];

const GASTOS_DEMO = [
  { descripcion: 'RENTA DEL LOCAL',             monto: 8500, cat: 'Renta',     diasAtras: 25 },
  { descripcion: 'PAGO SERVICIO ELECTRICO CFE', monto: 1240, cat: 'Servicios', diasAtras: 22 },
  { descripcion: 'SUELDO TECNICO MARZO 1/2',    monto: 3500, cat: 'Sueldos',   diasAtras: 20 },
  { descripcion: 'COMPRA MATERIAL LIMPIEZA',    monto: 380,  cat: 'Materiales',diasAtras: 18 },
  { descripcion: 'PUBLICIDAD FACEBOOK ADS',     monto: 500,  cat: 'Publicidad',diasAtras: 15 },
  { descripcion: 'SUELDO TECNICO MARZO 2/2',    monto: 3500, cat: 'Sueldos',   diasAtras: 10 },
  { descripcion: 'AGUA PURIFICADA',             monto: 120,  cat: 'Servicios', diasAtras: 8  },
  { descripcion: 'HERRAMIENTA DESMONTADORA',    monto: 1800, cat: 'Equipos',   diasAtras: 5  },
  { descripcion: 'GASOLINA REPARTO',            monto: 650,  cat: 'Transporte',diasAtras: 3  },
  { descripcion: 'MATERIAL PAPELERIA',          monto: 220,  cat: 'Materiales',diasAtras: 1  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
const client = await getClient();
try {
  await client.query('BEGIN');

  console.log('\n🚗  Setup Demo — Llantera POS\n');

  // ── 0. Reset si se solicitó ──────────────────────────────────────────────
  if (RESET) {
    const { rows: [neg] } = await client.query(`SELECT id FROM negocios WHERE slug = 'demo' LIMIT 1`);
    if (neg) {
      const nid = neg.id;
      console.log('⚠  Modo reset: eliminando datos del demo...');
      await client.query(`DELETE FROM movimientos_inventario WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM ventas_detalle WHERE venta_id IN (SELECT id FROM ventas WHERE negocio_id = $1)`, [nid]);
      await client.query(`DELETE FROM ventas WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM gastos WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM clientes WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM productos WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM marcas WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM usuarios WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM roles WHERE negocio_id = $1`, [nid]);
      await client.query(`DELETE FROM negocios WHERE id = $1`, [nid]);
      console.log('✅  Datos del demo eliminados\n');
    }
  }

  // ── 1. Negocio ────────────────────────────────────────────────────────────
  let { rows: [negocio] } = await client.query(`SELECT id FROM negocios WHERE slug = 'demo' LIMIT 1`);
  if (!negocio) {
    const negId = uuid();
    await client.query(
      `INSERT INTO negocios (id, nombre, slug, activo, telefono, direccion)
       VALUES ($1, 'Demo Llantera POS', 'demo', true, '8110001234', 'Av. Ejemplo 100, Col. Centro, Monterrey NL')`,
      [negId]
    );
    negocio = { id: negId };
    console.log('✅  Negocio demo creado');
  } else {
    console.log('ℹ️   Negocio demo ya existe');
  }
  const negocio_id = negocio.id;

  // ── 2. Rol admin ─────────────────────────────────────────────────────────
  let { rows: [rol] } = await client.query(`SELECT id FROM roles WHERE negocio_id = $1 AND nombre = 'admin' LIMIT 1`, [negocio_id]);
  if (!rol) {
    const rolId = uuid();
    await client.query(
      `INSERT INTO roles (id, negocio_id, nombre, permisos) VALUES ($1, $2, 'admin', '{"todo":true}')`,
      [rolId, negocio_id]
    );
    rol = { id: rolId };
    console.log('✅  Rol admin creado');
  }

  // Rol vendedor
  let { rows: [rolVend] } = await client.query(`SELECT id FROM roles WHERE negocio_id = $1 AND nombre = 'vendedor' LIMIT 1`, [negocio_id]);
  if (!rolVend) {
    const rolVId = uuid();
    await client.query(
      `INSERT INTO roles (id, negocio_id, nombre, permisos)
       VALUES ($1, $2, 'vendedor', '{"ventas":true,"productos_ver":true,"cotizaciones":true,"clientes":true}')`,
      [rolVId, negocio_id]
    );
    rolVend = { id: rolVId };
  }

  // ── 3. Usuarios ───────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('admin123', 10);
  const { rows: [usuExiste] } = await client.query(
    `SELECT id FROM usuarios WHERE email = 'admin@demo.com' AND negocio_id = $1`, [negocio_id]
  );
  let adminId;
  if (!usuExiste) {
    adminId = uuid();
    await client.query(
      `INSERT INTO usuarios (id, negocio_id, nombre, email, password_hash, rol_id, activo)
       VALUES ($1, $2, 'Administrador Demo', 'admin@demo.com', $3, $4, true)`,
      [adminId, negocio_id, hash, rol.id]
    );
    console.log('✅  Usuario admin@demo.com creado (password: admin123)');
  } else {
    adminId = usuExiste.id;
    console.log('ℹ️   Usuario admin ya existe');
  }

  // Vendedor demo
  const hashVend = await bcrypt.hash('demo123', 10);
  const { rows: [vendExiste] } = await client.query(
    `SELECT id FROM usuarios WHERE email = 'vendedor@demo.com' AND negocio_id = $1`, [negocio_id]
  );
  let vendedorId;
  if (!vendExiste) {
    vendedorId = uuid();
    await client.query(
      `INSERT INTO usuarios (id, negocio_id, nombre, email, password_hash, rol_id, activo)
       VALUES ($1, $2, 'Vendedor Demo', 'vendedor@demo.com', $3, $4, true)`,
      [vendedorId, negocio_id, hashVend, rolVend.id]
    );
    console.log('✅  Usuario vendedor@demo.com creado (password: demo123)');
  } else {
    vendedorId = vendExiste.id;
  }

  // ── 4. Categorías (tabla global — solo las que no existen) ────────────────
  const tiposCategoria = ['llanta', 'refaccion', 'consumible', 'servicio'];
  const catMap = {};
  for (const tipo of tiposCategoria) {
    const nombre = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    let { rows: [cat] } = await client.query(`SELECT id FROM categorias WHERE LOWER(nombre) = $1 LIMIT 1`, [nombre.toLowerCase()]);
    if (!cat) {
      const catId = await client.query(`INSERT INTO categorias (nombre, tipo) VALUES ($1, $2) RETURNING id`, [nombre, tipo]);
      cat = catId.rows[0];
    }
    catMap[tipo] = cat.id;
  }
  console.log('✅  Categorías verificadas');

  // ── 5. Marcas ─────────────────────────────────────────────────────────────
  const marcasDemo = ['HANKOOK', 'GOODYEAR', 'BRIDGESTONE', 'MICHELIN', 'CONTINENTAL', 'YOKOHAMA', 'REMA', 'AIRTEC'];
  for (const m of marcasDemo) {
    await client.query(
      `INSERT INTO marcas (negocio_id, nombre) VALUES ($1, $2) ON CONFLICT (negocio_id, nombre) DO NOTHING`,
      [negocio_id, m]
    );
  }
  console.log('✅  Marcas creadas');

  // ── 6. Productos ──────────────────────────────────────────────────────────
  const prodIds = {};
  let prodCreados = 0;
  for (const p of PRODUCTOS_DEMO) {
    const sku = `DEMO-${p.nombre.substring(0,4).toUpperCase()}-${(p.medida||'SRV').replace(/[^a-zA-Z0-9]/g,'').substring(0,6).toUpperCase()}`;
    const { rows: [exProd] } = await client.query(
      `SELECT id FROM productos WHERE negocio_id = $1 AND nombre = $2 AND COALESCE(medida,'') = $3 LIMIT 1`,
      [negocio_id, p.nombre, p.medida || '']
    );
    if (!exProd) {
      const pid = uuid();
      await client.query(
        `INSERT INTO productos (id, negocio_id, nombre, medida, marca, sku, precio_venta, precio_compra, stock_actual, stock_minimo, categoria_id, activo, es_servicio)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)`,
        [pid, negocio_id, p.nombre, p.medida||null, p.marca||null, sku,
         p.precio_venta, p.precio_compra, p.stock, rndNum(2, 5),
         catMap[p.tipo]||null, p.es_servicio||false]
      );
      prodIds[`${p.nombre}_${p.medida}`] = pid;
      prodCreados++;
    } else {
      prodIds[`${p.nombre}_${p.medida}`] = exProd.id;
    }
  }
  console.log(`✅  ${prodCreados} producto(s) creado(s)`);

  // ── 7. Clientes ───────────────────────────────────────────────────────────
  const clienteIds = [];
  let clientesCreados = 0;
  for (const c of CLIENTES_DEMO) {
    const { rows: [exCli] } = await client.query(
      `SELECT id FROM clientes WHERE negocio_id = $1 AND nombre = $2 LIMIT 1`, [negocio_id, c.nombre]
    );
    if (!exCli) {
      const cid = uuid();
      await client.query(
        `INSERT INTO clientes (id, negocio_id, nombre, telefono, email, direccion) VALUES ($1,$2,$3,$4,$5,$6)`,
        [cid, negocio_id, c.nombre, c.telefono, c.email||null, c.direccion||null]
      );
      clienteIds.push(cid);
      clientesCreados++;
    } else {
      clienteIds.push(exCli.id);
    }
  }
  console.log(`✅  ${clientesCreados} cliente(s) creado(s)`);

  // ── 8. Ventas de los últimos 30 días ─────────────────────────────────────
  const { rows: existeVentas } = await client.query(
    `SELECT COUNT(*) as cnt FROM ventas WHERE negocio_id = $1`, [negocio_id]
  );
  let ventasCreadas = 0;

  if (parseInt(existeVentas[0].cnt) === 0) {
    // Productos más vendibles (llantas y servicios)
    const prodVendibles = [
      { key: 'LLANTA SEMINUEVA_185/60/R14', precio: 650,  costo: 400  },
      { key: 'LLANTA SEMINUEVA_195/65/R15', precio: 750,  costo: 480  },
      { key: 'LLANTA SEMINUEVA_205/55/R16', precio: 850,  costo: 550  },
      { key: 'LLANTA SEMINUEVA_225/45/R17', precio: 1100, costo: 720  },
      { key: 'LLANTA NUEVA_185/60/R14',     precio: 1200, costo: 800  },
      { key: 'PARCHE_#4 GRANDE',            precio: 25,   costo: 10   },
      { key: 'PARCHE_#3 MEDIANO',           precio: 18,   costo: 7    },
      { key: 'BALANCEO_por llanta',         precio: 80,   costo: 0    },
      { key: 'MONTAJE_por llanta',          precio: 60,   costo: 0    },
      { key: 'REPARACION PONCHE_parche interno', precio: 120, costo: 15 },
      { key: 'ALINEACION_4 ruedas',         precio: 350,  costo: 0    },
    ];

    const metodos = ['efectivo','efectivo','efectivo','tarjeta','tarjeta','transferencia'];

    // Generar ventas distribuidas en los últimos 30 días
    // Más ventas en los últimos 7 días (para el dashboard)
    const patronVentas = [
      ...Array(3).fill(29), ...Array(3).fill(27), ...Array(4).fill(25),
      ...Array(3).fill(22), ...Array(4).fill(20), ...Array(3).fill(18),
      ...Array(4).fill(15), ...Array(3).fill(12), ...Array(4).fill(10),
      ...Array(4).fill(7), ...Array(5).fill(6), ...Array(5).fill(5),
      ...Array(5).fill(4), ...Array(6).fill(3), ...Array(6).fill(2),
      ...Array(5).fill(1), ...Array(4).fill(0),
    ];

    let folioNum = 1;
    for (const diasAtras of patronVentas) {
      const fecha    = fechaAleatoria(diasAtras);
      const metodo   = rnd(metodos);
      const clientId = Math.random() > 0.4 ? rnd(clienteIds) : null;
      const numItems = rndNum(1, 3);

      // Seleccionar productos aleatorios para esta venta
      const itemsVenta = [];
      const prodSel    = [...prodVendibles].sort(() => Math.random() - 0.5).slice(0, numItems);
      let subtotalVenta = 0;

      for (const pv of prodSel) {
        const pid = prodIds[pv.key];
        if (!pid) continue;
        const cant      = pv.key.startsWith('LLANTA') ? rndNum(1, 2) : rndNum(1, 4);
        const precio    = pv.precio;
        const subtotal  = fmt2(cant * precio);
        subtotalVenta  += subtotal;
        itemsVenta.push({ pid, cant, precio, subtotal });
      }

      if (itemsVenta.length === 0) continue;

      const folio  = `VTA-2026-${String(folioNum++).padStart(6,'0')}`;
      const ventaId = uuid();

      await client.query(
        `INSERT INTO ventas (id, negocio_id, folio, cliente_id, usuario_id, fecha, subtotal, descuento, iva, total, metodo_pago, monto_pagado, cambio, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,$7,$8,$7,0,'pagada')`,
        [ventaId, negocio_id, folio, clientId, adminId, fecha.toISOString(), fmt2(subtotalVenta), metodo]
      );

      for (const item of itemsVenta) {
        await client.query(
          `INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1,$2,$3,$4,$5)`,
          [ventaId, item.pid, item.cant, item.precio, item.subtotal]
        );
      }

      ventasCreadas++;
    }
    console.log(`✅  ${ventasCreadas} venta(s) de muestra creada(s)`);
  } else {
    console.log('ℹ️   Ventas ya existen, se omiten');
  }

  // ── 9. Gastos ─────────────────────────────────────────────────────────────
  const { rows: existeGastos } = await client.query(
    `SELECT COUNT(*) as cnt FROM gastos WHERE negocio_id = $1`, [negocio_id]
  );
  if (parseInt(existeGastos[0].cnt) === 0) {
    // Categorías de gasto (tabla separada global)
    const catGastoMap = {};
    for (const g of GASTOS_DEMO) {
      if (!catGastoMap[g.cat]) {
        let { rows: [cg] } = await client.query(
          `SELECT id FROM categorias_gasto WHERE LOWER(nombre) = $1 LIMIT 1`, [g.cat.toLowerCase()]
        );
        if (!cg) {
          const { rows: [newCg] } = await client.query(
            `INSERT INTO categorias_gasto (nombre) VALUES ($1) RETURNING id`, [g.cat]
          );
          cg = newCg;
        }
        catGastoMap[g.cat] = cg.id;
      }
    }

    for (const g of GASTOS_DEMO) {
      const fecha = fechaAleatoria(g.diasAtras);
      await client.query(
        `INSERT INTO gastos (negocio_id, categoria_id, descripcion, monto, fecha, metodo_pago, usuario_id)
         VALUES ($1,$2,$3,$4,$5,'efectivo',$6)`,
        [negocio_id, catGastoMap[g.cat], g.descripcion, g.monto,
         fecha.toISOString().split('T')[0], adminId]
      );
    }
    console.log(`✅  ${GASTOS_DEMO.length} gasto(s) de muestra creado(s)`);
  } else {
    console.log('ℹ️   Gastos ya existen, se omiten');
  }

  await client.query('COMMIT');

  // ── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n🎉  Demo listo!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  URL:       (misma URL de producción)');
  console.log('  Email:     admin@demo.com');
  console.log('  Password:  admin123');
  console.log('');
  console.log('  Email vendedor:     vendedor@demo.com');
  console.log('  Password vendedor:  demo123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (err) {
  await client.query('ROLLBACK');
  console.error('\n❌  Error:', err.message);
  console.error(err);
  process.exit(1);
} finally {
  client.release();
  process.exit(0);
}
