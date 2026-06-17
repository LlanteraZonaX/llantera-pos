/**
 * Script de inicialización de la base de datos
 * Uso: node src/scripts/setup-db.js
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV==='production' ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'llantera_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

async function setup() {
  const client = new Client(config);
  try {
    console.log('\n🔧  Conectando a PostgreSQL...');
    await client.connect();
    console.log('✅  Conexión exitosa');

    console.log('\n📋  Ejecutando schema...');
    const schemaPath = join(__dirname, '..', '..', '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('✅  Tablas y datos base creados');

    // Crear usuario administrador por defecto
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@llantera.com';
    const adminPass  = process.env.ADMIN_PASSWORD || 'Admin2024!';
    const hash = await bcrypt.hash(adminPass, 10);

    const { rows: [rol] } = await client.query("SELECT id FROM roles WHERE nombre='admin'");
    const { rows: existing } = await client.query('SELECT id FROM usuarios WHERE email=$1', [adminEmail]);

    if (!existing.length) {
      await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id)
         VALUES ('Administrador', $1, $2, $3)`,
        [adminEmail, hash, rol.id]
      );
      console.log(`\n👤  Usuario admin creado:`);
      console.log(`    Email    : ${adminEmail}`);
      console.log(`    Password : ${adminPass}`);
      console.log(`    ⚠️   CAMBIA LA CONTRASEÑA EN TU PRIMER INICIO DE SESIÓN`);
    } else {
      console.log(`\n👤  Usuario admin ya existe: ${adminEmail}`);
    }

    console.log('\n🎉  Base de datos lista. ¡Sistema listo para usar!\n');
  } catch (err) {
    console.error('\n❌  Error al inicializar:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
