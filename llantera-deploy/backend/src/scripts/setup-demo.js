/**
 * setup-demo.js — Crea el negocio "Demo Llantera POS" con datos de muestra.
 * Credenciales: admin@demo.com / admin123
 *
 * Uso:   node src/scripts/setup-demo.js
 * Reset: node src/scripts/setup-demo.js --reset
 *
 * Es IDEMPOTENTE: se puede correr múltiples veces sin errores ni duplicados.
 */
import { getClient } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const RESET = process.argv.includes('--reset');
const rnd    = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndN   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const fmt2   = (n) => parseFloat(parseFloat(n).toFixed(2));

const fechaAleatoria = (diasAtras) => {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(rndN(9, 20), rndN(0, 59), 0, 0);
  return d;
};

// ── Datos de muestra ──────────────────────────────────────────────────────────
const PRODUCTOS = [
  { nombre:'LLANTA SEMINUEVA', medida:'185/60/R14', marca:'HANKOOK',     pv:650,  pc:400, stock:18, tipo:'llanta'    },
  { nombre:'LLANTA SEMINUEVA', medida:'195/65/R15', marca:'GOODYEAR',    pv:750,  pc:480, stock:14, tipo:'llanta'    },
  { nombre:'LLANTA SEMINUEVA', medida:'205/55/R16', marca:'BRIDGESTONE', pv:850,  pc:550, stock:10, tipo:'llanta'    },
  { nombre:'LLANTA SEMINUEVA', medida:'225/45/R17', marca:'MICHELIN',    pv:1100, pc:720, stock:7,  tipo:'llanta'    },
  { nombre:'LLANTA SEMINUEVA', medida:'235/55/R18', marca:'CONTINENTAL', pv:1350, pc:900, stock:5,  tipo:'llanta'    },
  { nombre:'LLANTA SEMINUEVA', medida:'215/60/R16', marca:'YOKOHAMA',    pv:950,  pc:620, stock:9,  tipo:'llanta'    },
  { nombre:'LLANTA NUEVA',     medida:'185/60/R14', marca:'HANKOOK',     pv:1200, pc:800, stock:6,  tipo:'llanta'    },
  { nombre:'LLANTA NUEVA',     medida:'195/65/R15', marca:'GOODYEAR',    pv:1450, pc:950, stock:4,  tipo:'llanta'    },
  { nombre:'PARCHE',           medida:'#4 GRANDE',  marca:'REMA',        pv:25,   pc:10,  stock:200,tipo:'refaccion'  },
  { nombre:'PARCHE',           medida:'#3 MEDIANO', marca:'REMA',        pv:18,   pc:7,   stock:200,tipo:'refaccion'  },
  { nombre:'PARCHE',           medida:'#2 PEQUENO', marca:'REMA',        pv:12,   pc:5,   stock:200,tipo:'refaccion'  },
  { nombre:'VALVULA',          medida:'TR4',        marca:'AIRTEC',      pv:15,   pc:5,   stock:100,tipo:'refaccion'  },
  { nombre:'LIQUIDO MONTA',    medida:'1 LT',       marca:'GENERICO',    pv:40,   pc:18,  stock:30, tipo:'consumible' },
  { nombre:'PESA BALANCEO',    medida:'5g',         marca:'GENERICO',    pv:3,    pc:1,   stock:500,tipo:'refaccion'  },
  { nombre:'BALANCEO',         medida:'x llanta',   marca:null,          pv:80,   pc:0,   stock:0,  tipo:'servicio', svc:true },
  { nombre:'MONTAJE',          medida:'x llanta',   marca:null,          pv:60,   pc:0,   stock:0,  tipo:'servicio', svc:true },
  { nombre:'ALINEACION',       medida:'4 ruedas',   marca:null,          pv:350,  pc:0,   stock:0,  tipo:'servicio', svc:true },
  { nombre:'REPARACION PONCHE',medida:'parche int', marca:null,          pv:120,  pc:15,  stock:0,  tipo:'servicio', svc:true },
];

const CLIENTES = [
  { nombre:'Carlos Martinez Lopez',   tel:'8112345678', email:'carlos.ml@gmail.com'  },
  { nombre:'Maria Fernanda Garcia',   tel:'8198765432', email:'mfgarcia@hotmail.com' },
  { nombre:'Roberto Sanchez Tirado',  tel:'8187654321', email:null                   },
  { nombre:'Transporte Norteno SA',   tel:'8133445566', email:'flota@transnorteno.mx'},
  { nombre:'Ana Lucia Reyes',         tel:'8145678901', email:'ana.reyes@gmail.com'  },
  { nombre:'Distribuidora del Norte', tel:'8156789012', email:'ventas@distnorte.com' },
];

const GASTOS = [
  { desc:'RENTA DEL LOCAL',            monto:8500, cat:'Renta',      dias:25 },
  { desc:'PAGO SERVICIO ELECTRICO CFE',monto:1240, cat:'Servicios',  dias:22 },
  { desc:'SUELDO TECNICO 1era QUINCENA',monto:3500,cat:'Sueldos',    dias:20 },
  { desc:'COMPRA MATERIAL LIMPIEZA',   monto:380,  cat:'Materiales', dias:18 },
  { desc:'PUBLICIDAD FACEBOOK ADS',    monto:500,  cat:'Publicidad', dias:15 },
  { desc:'SUELDO TECNICO 2da QUINCENA',monto:3500, cat:'Sueldos',    dias:10 },
  { desc:'AGUA PURIFICADA',            monto:120,  cat:'Servicios',  dias:8  },
  { desc:'HERRAMIENTA DESMONTADORA',   monto:1800, cat:'Equipos',    dias:5  },
  { desc:'GASOLINA REPARTO',           monto:650,  cat:'Transporte', dias:3  },
  { desc:'MATERIAL PAPELERIA',         monto:220,  cat:'Materiales', dias:1  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
const client = await getClient();
try {
  await client.query('BEGIN');
  console.log('\n🚗  Setup Demo — Llantera POS\n');

  // ── 0. Reset ──────────────────────────────────────────────────────────────
  if (RESET) {
    const { rows:[neg] } = await client.query(`SELECT id FROM negocios WHERE slug='demo' LIMIT 1`);
    if (neg) {
      const nid = neg.id;
      console.log('⚠  Reseteando datos del demo...');
      await client.query(`DELETE FROM movimientos_inventario WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM ventas_detalle WHERE venta_id IN (SELECT id FROM ventas WHERE negocio_id=$1)`,[nid]);
      await client.query(`DELETE FROM ventas     WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM gastos     WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM clientes   WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM productos  WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM marcas     WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM usuarios   WHERE negocio_id=$1`,[nid]);
      await client.query(`DELETE FROM negocios   WHERE id=$1`,[nid]);
      console.log('✅  Reset completo\n');
    } else {
      console.log('ℹ️  No hay demo que resetear\n');
    }
  }

  // ── 1. Negocio ────────────────────────────────────────────────────────────
  let { rows:[negocio] } = await client.query(`SELECT id FROM negocios WHERE slug='demo' LIMIT 1`);
  if (!negocio) {
    const negId = uuid();
    await client.query(
      `INSERT INTO negocios (id,nombre,slug,activo,telefono,direccion)
       VALUES ($1,'Demo Llantera POS','demo',true,'8110001234','Av. Ejemplo 100, Monterrey NL')`,
      [negId]
    );
    negocio = { id: negId };
    console.log('✅  Negocio demo creado');
  } else {
    console.log('ℹ️  Negocio demo ya existe');
  }
  const NID = negocio.id;

  // ── 2. Roles (tabla global — sin negocio_id) ──────────────────────────────
  let { rows:[rolAdmin] } = await client.query(`SELECT id FROM roles WHERE nombre='admin' LIMIT 1`);
  if (!rolAdmin) {
    const rid = uuid();
    await client.query(`INSERT INTO roles (id,nombre,permisos) VALUES ($1,'admin','{"todo":true}')`, [rid]);
    rolAdmin = { id: rid };
    console.log('✅  Rol admin creado');
  } else {
    console.log('ℹ️  Rol admin ya existe');
  }

  let { rows:[rolVend] } = await client.query(`SELECT id FROM roles WHERE nombre='vendedor' LIMIT 1`);
  if (!rolVend) {
    const rid = uuid();
    await client.query(
      `INSERT INTO roles (id,nombre,permisos) VALUES ($1,'vendedor','{"ventas":true,"productos_ver":true,"cotizaciones":true,"clientes":true}')`,
      [rid]
    );
    rolVend = { id: rid };
  }

  // ── 3. Usuarios ───────────────────────────────────────────────────────────
  const hashAdmin = await bcrypt.hash('admin123', 10);
  let { rows:[uAdmin] } = await client.query(`SELECT id FROM usuarios WHERE email='admin@demo.com' AND negocio_id=$1`,[NID]);
  let adminId;
  if (!uAdmin) {
    adminId = uuid();
    await client.query(
      `INSERT INTO usuarios (id,negocio_id,nombre,email,password_hash,rol_id,activo)
       VALUES ($1,$2,'Administrador Demo','admin@demo.com',$3,$4,true)`,
      [adminId, NID, hashAdmin, rolAdmin.id]
    );
    console.log('✅  admin@demo.com creado (admin123)');
  } else {
    adminId = uAdmin.id;
    console.log('ℹ️  admin@demo.com ya existe');
  }

  const hashVend = await bcrypt.hash('demo123', 10);
  let { rows:[uVend] } = await client.query(`SELECT id FROM usuarios WHERE email='vendedor@demo.com' AND negocio_id=$1`,[NID]);
  if (!uVend) {
    await client.query(
      `INSERT INTO usuarios (id,negocio_id,nombre,email,password_hash,rol_id,activo)
       VALUES ($1,$2,'Vendedor Demo','vendedor@demo.com',$3,$4,true)`,
      [uuid(), NID, hashVend, rolVend.id]
    );
    console.log('✅  vendedor@demo.com creado (demo123)');
  }

  // ── 4. Categorías (tabla global) ──────────────────────────────────────────
  const tiposCat = { llanta:'llanta', refaccion:'refaccion', consumible:'consumible', servicio:'servicio' };
  const catMap = {};
  for (const [tipo, tipoval] of Object.entries(tiposCat)) {
    const nombre = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    let { rows:[cat] } = await client.query(
      `SELECT id FROM categorias WHERE LOWER(TRIM(nombre))=$1 LIMIT 1`,[tipo]
    );
    if (!cat) {
      const { rows:[nc] } = await client.query(
        `INSERT INTO categorias (nombre,tipo) VALUES ($1,$2) RETURNING id`,[nombre, tipoval]
      );
      cat = nc;
    }
    catMap[tipo] = cat.id;
  }
  console.log('✅  Categorías verificadas');

  // ── 5. Marcas ─────────────────────────────────────────────────────────────
  const marcas = ['HANKOOK','GOODYEAR','BRIDGESTONE','MICHELIN','CONTINENTAL','YOKOHAMA','REMA','AIRTEC','GENERICO'];
  for (const m of marcas) {
    await client.query(
      `INSERT INTO marcas (negocio_id,nombre) VALUES ($1,$2) ON CONFLICT (negocio_id,nombre) DO NOTHING`,
      [NID, m]
    );
  }
  console.log('✅  Marcas creadas');

  // ── 6. Productos ──────────────────────────────────────────────────────────
  // FIX: ON CONFLICT usa (negocio_id, sku) — constraint real: idx_productos_sku_negocio
  // Además verificamos por nombre+medida para productos sin SKU
  const prodMap = {};
  let prodCreados = 0;
  for (const p of PRODUCTOS) {
    const key = `${p.nombre}_${p.medida}`;
    // Verificar si ya existe por nombre+medida en este negocio
    const { rows:[exProd] } = await client.query(
      `SELECT id FROM productos WHERE negocio_id=$1 AND nombre=$2 AND COALESCE(medida,'')=$3 LIMIT 1`,
      [NID, p.nombre, p.medida || '']
    );
    if (exProd) {
      prodMap[key] = exProd.id;
      continue;
    }
    // SKU único por negocio — prefijo DEMO para no colisionar con datos reales
    const sku = `DEMO-${p.nombre.replace(/\s+/g,'').substring(0,5)}-${(p.medida||'SVC').replace(/[^A-Z0-9]/gi,'').substring(0,6)}`.toUpperCase();
    const pid = uuid();
    await client.query(
      `INSERT INTO productos
         (id,negocio_id,nombre,medida,marca,sku,precio_venta,precio_compra,
          stock_actual,stock_minimo,categoria_id,activo,es_servicio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)
       ON CONFLICT (negocio_id,sku) WHERE sku IS NOT NULL DO NOTHING`,
      [pid, NID, p.nombre, p.medida||null, p.marca||null, sku,
       p.pv, p.pc, p.stock, rndN(2,5), catMap[p.tipo]||null, p.svc||false]
    );
    // Reconfirmar el id (puede que ON CONFLICT haya ignorado)
    const { rows:[conf] } = await client.query(
      `SELECT id FROM productos WHERE negocio_id=$1 AND nombre=$2 AND COALESCE(medida,'')=$3 LIMIT 1`,
      [NID, p.nombre, p.medida || '']
    );
    if (conf) { prodMap[key] = conf.id; prodCreados++; }
  }
  console.log(`✅  ${prodCreados} producto(s) creado(s)`);

  // ── 7. Clientes ───────────────────────────────────────────────────────────
  const clientIds = [];
  let clientesCreados = 0;
  for (const c of CLIENTES) {
    let { rows:[ex] } = await client.query(
      `SELECT id FROM clientes WHERE negocio_id=$1 AND nombre=$2 LIMIT 1`,[NID, c.nombre]
    );
    if (!ex) {
      const cid = uuid();
      await client.query(
        `INSERT INTO clientes (id,negocio_id,nombre,telefono,email) VALUES ($1,$2,$3,$4,$5)`,
        [cid, NID, c.nombre, c.tel, c.email||null]
      );
      clientIds.push(cid); clientesCreados++;
    } else {
      clientIds.push(ex.id);
    }
  }
  console.log(`✅  ${clientesCreados} cliente(s) creado(s)`);

  // ── 8. Ventas (últimos 30 días) ───────────────────────────────────────────
  // FIX: Folio con prefijo "D-" para no colisionar con ventas reales de ZonaX
  //      que usan "VTA-2026-XXXXXX"
  const { rows:[cv] } = await client.query(`SELECT COUNT(*) AS cnt FROM ventas WHERE negocio_id=$1`,[NID]);
  let ventasCreadas = 0;

  if (parseInt(cv.cnt) === 0) {
    const vendibles = [
      { key:'LLANTA SEMINUEVA_185/60/R14', pv:650  },
      { key:'LLANTA SEMINUEVA_195/65/R15', pv:750  },
      { key:'LLANTA SEMINUEVA_205/55/R16', pv:850  },
      { key:'LLANTA SEMINUEVA_225/45/R17', pv:1100 },
      { key:'LLANTA NUEVA_185/60/R14',     pv:1200 },
      { key:'PARCHE_#4 GRANDE',            pv:25   },
      { key:'PARCHE_#3 MEDIANO',           pv:18   },
      { key:'BALANCEO_x llanta',           pv:80   },
      { key:'MONTAJE_x llanta',            pv:60   },
      { key:'REPARACION PONCHE_parche int',pv:120  },
      { key:'ALINEACION_4 ruedas',         pv:350  },
    ];
    const metodos = ['efectivo','efectivo','efectivo','tarjeta','tarjeta','transferencia'];
    // Distribución: más ventas en los últimos 7 días para que el dashboard se vea activo
    const patronDias = [
      ...Array(3).fill(29),...Array(3).fill(27),...Array(4).fill(25),
      ...Array(3).fill(22),...Array(4).fill(20),...Array(3).fill(18),
      ...Array(4).fill(15),...Array(3).fill(12),...Array(4).fill(10),
      ...Array(4).fill(7), ...Array(5).fill(6), ...Array(5).fill(5),
      ...Array(5).fill(4), ...Array(6).fill(3), ...Array(6).fill(2),
      ...Array(5).fill(1), ...Array(4).fill(0),
    ];

    let folioN = 1;
    for (const dias of patronDias) {
      const fecha  = fechaAleatoria(dias);
      const metodo = rnd(metodos);
      const cliId  = Math.random() > 0.4 ? rnd(clientIds) : null;
      const prods  = [...vendibles].sort(() => Math.random()-0.5).slice(0, rndN(1,3));

      const items = [];
      let total = 0;
      for (const pv of prods) {
        const pid = prodMap[pv.key];
        if (!pid) continue;
        const cant  = pv.key.startsWith('LLANTA') ? rndN(1,2) : rndN(1,4);
        const sub   = fmt2(cant * pv.pv);
        total += sub;
        items.push({ pid, cant, precio: pv.pv, sub });
      }
      if (!items.length) continue;

      total = fmt2(total);
      // FIX: prefijo "D-" en lugar de "VTA-" para no colisionar con ZonaX
      const folio   = `D-2026-${String(folioN++).padStart(6,'0')}`;
      const ventaId = uuid();
      // No insertar subtotal/iva/total directamente — pueden ser GENERATED.
      // Se calculan/actualizan después de insertar el detalle.
      await client.query(
        `INSERT INTO ventas
           (id,negocio_id,folio,cliente_id,usuario_id,fecha,
            metodo_pago,monto_pagado,cambio,estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,0,'pagada')
         ON CONFLICT DO NOTHING`,
        [ventaId, NID, folio, cliId, adminId, fecha.toISOString(), metodo, total]
      );

      for (const it of items) {
        await client.query(
          `INSERT INTO ventas_detalle (venta_id,producto_id,cantidad,precio_unitario,subtotal)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [ventaId, it.pid, it.cant, it.precio, it.sub]
        );
      }

      // Intentar actualizar totales (con try/catch: si son GENERATED se ignora)
      try {
        await client.query(
          `UPDATE ventas SET subtotal=$1, descuento=0, iva=0, total=$1, monto_pagado=$1 WHERE id=$2`,
          [total, ventaId]
        );
      } catch (_) { /* columnas GENERATED — PostgreSQL las calcula sola */ }
      ventasCreadas++;
    }
    console.log(`✅  ${ventasCreadas} venta(s) de muestra creada(s)`);
  } else {
    console.log('ℹ️  Ventas ya existen, se omiten');
  }

  // ── 9. Gastos ─────────────────────────────────────────────────────────────
  const { rows:[cg] } = await client.query(`SELECT COUNT(*) AS cnt FROM gastos WHERE negocio_id=$1`,[NID]);
  if (parseInt(cg.cnt) === 0) {
    const cgMap = {};
    for (const g of GASTOS) {
      if (!cgMap[g.cat]) {
        let { rows:[cat] } = await client.query(
          `SELECT id FROM categorias_gasto WHERE LOWER(nombre)=$1 LIMIT 1`,[g.cat.toLowerCase()]
        );
        if (!cat) {
          const { rows:[nc] } = await client.query(
            `INSERT INTO categorias_gasto (nombre) VALUES ($1) RETURNING id`,[g.cat]
          );
          cat = nc;
        }
        cgMap[g.cat] = cat.id;
      }
    }
    for (const g of GASTOS) {
      const f = fechaAleatoria(g.dias);
      await client.query(
        `INSERT INTO gastos (negocio_id,categoria_id,descripcion,monto,fecha,metodo_pago,usuario_id)
         VALUES ($1,$2,$3,$4,$5,'efectivo',$6)`,
        [NID, cgMap[g.cat], g.desc, g.monto, f.toISOString().split('T')[0], adminId]
      );
    }
    console.log(`✅  ${GASTOS.length} gasto(s) de muestra creado(s)`);
  } else {
    console.log('ℹ️  Gastos ya existen, se omiten');
  }

  await client.query('COMMIT');

  console.log('\n🎉  Demo listo!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  URL:      (misma URL de producción)');
  console.log('  Admin:    admin@demo.com    /  admin123');
  console.log('  Vendedor: vendedor@demo.com /  demo123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (err) {
  await client.query('ROLLBACK');
  console.error('\n❌  Error:', err.message);
  process.exit(1);
} finally {
  client.release();
  process.exit(0);
}
