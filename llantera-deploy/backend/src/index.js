import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import routes from './routes/index.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api/v1', routes);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n🚗  Llantera POS API v1.0`);
  console.log(`📡  Puerto : http://localhost:${PORT}`);
  console.log(`💚  Health : http://localhost:${PORT}/health`);
  console.log(`🔑  API    : http://localhost:${PORT}/api/v1\n`);
});

export default app;
