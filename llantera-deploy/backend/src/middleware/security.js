/**
 * security.js — Middleware de seguridad de Llantera ZonaX POS
 *
 * Capas implementadas:
 *  1. Helmet       — Headers HTTP que cierran vectores de ataque comunes
 *  2. Rate limiting — Límite de peticiones por IP para evitar fuerza bruta y DDoS
 *  3. Login guard  — Bloqueo temporal de IP tras N intentos fallidos
 *  4. Sanitización — Limpieza de strings en el body antes de llegar a los controllers
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ─── 1. Helmet: headers HTTP de seguridad ────────────────────────────────────
// Activa automáticamente: X-Frame-Options, X-Content-Type-Options,
// Strict-Transport-Security, X-XSS-Protection, Referrer-Policy, etc.
export const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false, // Cloudinary y recursos externos lo necesitan apagado
  contentSecurityPolicy: false,     // El frontend está en Vercel con su propio dominio; CSP se gestiona allá
});

// ─── 2. Rate limiting general ─────────────────────────────────────────────────
// Máximo 120 peticiones por IP cada 1 minuto para cualquier endpoint de la API.
// Un usuario normal nunca llega a eso; un script de ataque sí lo haría de inmediato.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // ventana de 1 minuto
  max: 120,              // máximo 120 peticiones por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
  skip: (req) => req.path === '/health', // el health check no está limitado
});

// ─── 3. Rate limiting estricto para login ────────────────────────────────────
// Máximo 10 intentos de login por IP cada 15 minutos.
// Después del intento 5 el atacante ya notará la ralentización de bcrypt + este límite.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo.' },
});

// ─── 4. Bloqueo por IP tras intentos fallidos en memoria ─────────────────────
// Complementa el rate limit: si una IP falla 5 veces el login, se bloquea
// 15 minutos. Se guarda en memoria (se resetea al reiniciar el servidor,
// lo cual es aceptable — cualquier ataque real requiere persistencia y
// para eso ya está el rate limiter basado en ventana de tiempo).
const loginAttempts = new Map(); // ip → { count, blockedUntil }
const MAX_ATTEMPTS  = 5;
const BLOCK_MS      = 15 * 60 * 1000; // 15 minutos

export const trackLoginAttempt = (ip, success) => {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };

  if (success) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }
  loginAttempts.set(ip, entry);
  return {
    blocked: entry.count >= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - entry.count),
  };
};

export const isLoginBlocked = (ip) => {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.blockedUntil && Date.now() < entry.blockedUntil) return true;
  if (entry.blockedUntil && Date.now() >= entry.blockedUntil) {
    loginAttempts.delete(ip); // se le pasó el bloqueo
  }
  return false;
};

// Limpieza periódica de entradas antiguas para no acumular en memoria
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.blockedUntil < now) loginAttempts.delete(ip);
  }
}, 60 * 60 * 1000); // cada hora

// ─── 5. Sanitización básica de inputs ────────────────────────────────────────
// Recorre el body y hace trim() a todos los strings antes de que lleguen
// al controller. Previene espacios accidentales en emails/folios/nombres,
// y corta strings que exceden 1000 caracteres (protección básica anti-flood).
export const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

const sanitizeObject = (obj) => {
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeObject(v)])
    );
  }
  if (typeof obj === 'string') {
    return obj.trim().slice(0, 2000); // trim + límite razonable
  }
  return obj;
};
