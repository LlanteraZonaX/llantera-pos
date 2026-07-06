import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { helmetMiddleware, apiLimiter, sanitizeBody } from './middleware/security.js';
dotenv.config();

// Advertencia clara si el JWT_SECRET no está configurado en producción
if (!process.env.JWT_SECRET) {
  console.warn('\n⚠️  ADVERTENCIA DE SEGURIDAD: JWT_SECRET no está configurado en las variables de entorno.');
  console.warn('   Usando secreto de desarrollo — NUNCA dejarlo así en producción.\n');
}

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── SEGURIDAD: headers HTTP + rate limiting global ───────────────────────────
app.use(helmetMiddleware);
app.use(apiLimiter);

// ── BODY PARSING (límite 500kb — más que suficiente para este sistema) ────────
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// ── SANITIZACIÓN de inputs (trim + corte de strings demasiado largos) ────────
app.use(sanitizeBody);

// ── LOGS (solo en desarrollo para no saturar logs en producción) ──────────────
if (!isProd) app.use(morgan('dev'));

// ── RUTAS ────────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── HEALTH CHECK (info mínima, sin exponer versión ni stack) ─────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── ERROR HANDLER (en producción no filtra detalles internos al cliente) ──────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: isProd ? 'Error interno del servidor' : (err.message || 'Error interno'),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚗  Llantera POS API`);
  console.log(`📡  Puerto  : http://localhost:${PORT}`);
  console.log(`💚  Health  : http://localhost:${PORT}/health`);
  console.log(`🔒  Seguridad: Helmet ✓  Rate limiting ✓  Sanitización ✓\n`);
});

export default app;
