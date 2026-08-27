// sentry.js
// Requiere: npm install @sentry/node
// Requiere variable de entorno SENTRY_DSN en Railway (Settings > Variables)
import * as Sentry from '@sentry/node';

export function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.warn('[Sentry] SENTRY_DSN no configurado - captura de errores desactivada');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.2,
  });

  // Debe registrarse DESPUÉS de todas las rutas y ANTES de cualquier otro
  // middleware de manejo de errores que ya tengas.
  Sentry.setupExpressErrorHandler(app);

  console.log('[Sentry] Captura de errores activa');
}

// Helper para etiquetar manualmente un error con el negocio afectado.
// Úsalo en catch blocks de puntos críticos (ventas, corte de caja, pagos):
//
//   import { tagBusinessContext, Sentry } from '../config/sentry.js';
//   try { ... } catch (err) {
//     tagBusinessContext(req.negocio_id, 'corte_de_caja');
//     Sentry.captureException(err);
//   }
export function tagBusinessContext(negocioId, modulo) {
  Sentry.setTag('negocio_id', negocioId || 'desconocido');
  Sentry.setTag('modulo', modulo || 'no_especificado');
}

export { Sentry };
