/**
 * Script de inicialización para un NEGOCIO NUEVO (cliente nuevo
 * al revender el sistema) o para la primera instalación.
 *
 * Qué hace:
 *  1. Corre todas las migraciones pendientes (crea tablas si no existen).
 *  2. Crea el negocio (tenant) con el nombre indicado.
 *  3. Crea el usuario administrador para ESE negocio.
 *
 * Uso:
 *   NEGOCIO_NOMBRE="Llantera Perez" NEGOCIO_SLUG="llantera-perez" \
 *   ADMIN_EMAIL="admin@llanteraperez.com" ADMIN_PASSWORD="claveSegura123" \
 *   node src/scripts/setup-db.js
 *
 * Si no se pasan NEGOCIO_NOMBRE / NEGOCIO_SLUG, usa el negocio default
 * (Llantera ZonaX) que ya viene de la migracion 002 - esto mantiene
 * compatible la instalacion original sin romper nada.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config();

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'llantera_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

const DEFAULT_NEGOCIO_ID = '00000000-0000-0000-0000-000000000001';

async function setup() {
  console.log('\n🔧  Paso 1/3 — Aplicando migraciones...');
  execSync('node ' + join(__dirname, 'migrate.js'), { stdio: 'inherit' });

  const client = new Client(config);
  await client.connect();

  try {
    console.log('\n🏢  Paso 2/3 — Configurando negocio...');

    const nombreNegocio = process.env.NEGOCIO_NOMBRE;
    const slugNegocio = process.env.NEGOCIO_SLUG;

    let negocioId = DEFAULT_NEGOCIO_ID;
    let negocioNombre = 'Llantera ZonaX';

    if (nombreNegocio && slugNegocio) {
      const { rows: existente } = await client.query('SELECT id FROM negocios WHERE slug = $1', [slugNegocio]);
      if (existente.length) {
        negocioId = existente[0].id;
        console.log(`    Negocio ya existia, usando: ${slugNegocio}`);
      } else {
        const { rows } = await client.query(
          `INSERT INTO negocios (nombre, slug) VALUES ($1, $2) RETURNING id`,
          [nombreNegocio, slugNegocio]
        );
        negocioId = rows[0].id;
        console.log(`    Negocio nuevo creado: ${nombreNegocio} (${slugNegocio})`);
      }
      negocioNombre = nombreNegocio;
    } else {
      console.log(`    Usando negocio por defecto: ${negocioNombre}`);
    }

    console.log('\n👤  Paso 3/3 — Creando usuario administrador...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@llantera.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin2024!';
    const hash = await bcrypt.hash(adminPass, 10);

    const { rows: [rol] } = await client.query("SELECT id FROM roles WHERE nombre='admin'");
    const { rows: existing } = await client.query(
      'SELECT id FROM usuarios WHERE email = $1 AND negocio_id = $2',
      [adminEmail, negocioId]
    );

    if (!existing.length) {
      await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id, negocio_id)
         VALUES ('Administrador', $1, $2, $3, $4)`,
        [adminEmail, hash, rol.id, negocioId]
      );
      console.log(`    Email    : ${adminEmail}`);
      console.log(`    Password : ${adminPass}`);
      console.log(`    ⚠️   CAMBIA LA CONTRASEÑA EN EL PRIMER INICIO DE SESION`);
    } else {
      console.log(`    El admin ${adminEmail} ya existe para este negocio.`);
    }

    console.log(`\n🎉  Listo. Negocio "${negocioNombre}" funcionando al 100%.\n`);
  } finally {
    await client.end();
  }
}

setup().catch(err => {
  console.error('\n❌  Error al inicializar:', err.message);
  process.exit(1);
});
