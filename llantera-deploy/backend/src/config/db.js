import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'llantera_db',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: false,
      }
);

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool:', err.message);
});

pool.on('connect', () => {
  console.log('[DB] Conexión establecida con PostgreSQL');
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
