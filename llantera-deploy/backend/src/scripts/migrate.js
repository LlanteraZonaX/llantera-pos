/**
 * Sistema de migraciones versionadas.
 *
 * Por qué existe: antes, "actualizar la base de datos" significaba
 * volver a correr schema.sql completo, lo cual NO es seguro si ya
 * hay datos reales (puede fallar o duplicar). Este runner:
 *
 *  1. Crea una tabla `_migraciones` que registra qué archivos ya se
 *     ejecutaron.
 *  2. Lee la carpeta /migrations en orden (001_, 002_, 003_...).
 *  3. Ejecuta SOLO los archivos que aún no están registrados.
 *  4. Cada migración corre dentro de una transacción: si falla,
 *     no deja la base de datos a medio actualizar.
 *
 * Uso:
 *   node src/scripts/migrate.js
 *
 * Para agregar un cambio nuevo en el futuro (ej. un campo nuevo):
 *   1. Crear backend/migrations/005_nombre_descriptivo.sql
 *   2. Escribir el SQL usando siempre "IF NOT EXISTS" / "IF EXISTS"
 *      para que sea seguro re-ejecutar.
 *   3. Correr este script en producción. Los negocios existentes
 *      no se ven afectados; solo se les agrega lo nuevo.
 */
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'llantera_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      id          SERIAL PRIMARY KEY,
      archivo     VARCHAR(255) NOT NULL UNIQUE,
      ejecutada_en TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function migracionesAplicadas(client) {
  const { rows } = await client.query('SELECT archivo FROM _migraciones');
  return new Set(rows.map(r => r.archivo));
}

async function run() {
  const client = new Client(config);
  await client.connect();
  console.log('🔧  Conectado a la base de datos');

  await ensureMigrationsTable(client);
  const aplicadas = await migracionesAplicadas(client);

  const archivos = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // 001_, 002_, 003_... el orden alfabético = orden de ejecución

  const pendientes = archivos.filter(f => !aplicadas.has(f));

  if (!pendientes.length) {
    console.log('✅  No hay migraciones pendientes. Base de datos al día.');
    await client.end();
    return;
  }

  console.log(`📋  Migraciones pendientes: ${pendientes.join(', ')}`);

  for (const archivo of pendientes) {
    const sql = readFileSync(join(MIGRATIONS_DIR, archivo), 'utf8');
    console.log(`\n▶️   Aplicando ${archivo}...`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migraciones (archivo) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      console.log(`✅  ${archivo} aplicada correctamente`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌  Error en ${archivo}:`, err.message);
      console.error('    La migración se revirtió por completo. La base de datos quedó como estaba antes de intentarla.');
      process.exit(1);
    }
  }

  console.log('\n🎉  Todas las migraciones aplicadas. Sistema actualizado al 100%.\n');
  await client.end();
}

run().catch(err => {
  console.error('❌  Error fatal en migraciones:', err.message);
  process.exit(1);
});
