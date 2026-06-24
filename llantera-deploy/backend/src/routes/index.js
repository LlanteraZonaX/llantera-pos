import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { login, me, cambiarPassword } from '../controllers/auth.controller.js';
import * as clientes   from '../controllers/clientes.controller.js';
import * as productos  from '../controllers/productos.controller.js';
import { uploadFoto } from '../middleware/upload.js';
import * as compras    from '../controllers/compras.controller.js';
import * as gastos     from '../controllers/gastos.controller.js';
import * as ventas     from '../controllers/ventas.controller.js';
import * as ordenes    from '../controllers/ordenes.controller.js';
import * as credito    from '../controllers/credito.controller.js';
import * as reportes   from '../controllers/reportes.controller.js';
import * as cotizaciones from '../controllers/cotizaciones.controller.js';
import * as usuarios   from '../controllers/usuarios.controller.js';
import * as negocio    from '../controllers/negocio.controller.js';
import * as lotes      from '../controllers/lotes.controller.js';

const r = Router();

// ── Auth ────────────────────────────────────────────
r.post('/auth/login',            login);
r.get ('/auth/me',               authenticate, me);
r.post('/auth/cambiar-password', authenticate, cambiarPassword);

// ── Clientes & Vehículos ────────────────────────────
r.get ('/clientes',                       authenticate, clientes.listar);
r.get ('/clientes/:id',                   authenticate, clientes.obtener);
r.post('/clientes',                       authenticate, clientes.crear);
r.put ('/clientes/:id',                   authenticate, clientes.actualizar);
r.post('/clientes/:id/vehiculos',         authenticate, clientes.crearVehiculo);

// ── Productos / Inventario ──────────────────────────
r.get ('/productos',                      authenticate, productos.listar);
r.get ('/productos/:id',                  authenticate, productos.obtener);
r.post('/productos',                      authenticate, productos.crear);
r.put ('/productos/:id',                  authenticate, productos.actualizar);
r.post('/productos/:id/stock',            authenticate, productos.ajustarStock);
r.post('/productos/:id/fotos',            authenticate, productos.agregarFoto);
r.post('/productos/:id/fotos/subir',      authenticate, (req, res, next) => {
  uploadFoto(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
    next();
  });
}, productos.subirFoto);
r.delete('/productos/fotos/:fotoId',      authenticate, productos.eliminarFoto);

// ── Compras ─────────────────────────────────────────
r.get ('/compras',                        authenticate, compras.listar);
r.get ('/compras/:id',                    authenticate, compras.obtener);
r.post('/compras',                        authenticate, compras.crear);

// ── Gastos ──────────────────────────────────────────
r.get ('/gastos',                         authenticate, gastos.listar);
r.get ('/gastos/resumen/categoria',       authenticate, gastos.resumenPorCategoria);
r.post('/gastos',                         authenticate, gastos.crear);
r.put ('/gastos/:id',                     authenticate, gastos.actualizar);
r.delete('/gastos/:id',                   authenticate, gastos.eliminar);

// ── Ventas ──────────────────────────────────────────
r.get ('/ventas',                         authenticate, ventas.listar);
r.get ('/ventas/resumen',                 authenticate, ventas.resumenDia);
r.post('/ventas',                         authenticate, ventas.crear);

// ── Órdenes de servicio ─────────────────────────────
r.get ('/ordenes',                        authenticate, ordenes.listar);
r.get ('/ordenes/:id',                    authenticate, ordenes.obtener);
r.post('/ordenes',                        authenticate, ordenes.crear);
r.patch('/ordenes/:id/estado',            authenticate, ordenes.cambiarEstado);

// ── Crédito / CxC ───────────────────────────────────
r.get ('/credito',                        authenticate, credito.listar);
r.post('/credito/:id/pago',               authenticate, credito.registrarPago);

// ── Reportes & Dashboard ────────────────────────────
r.get ('/reportes/dashboard',             authenticate, reportes.dashboard);
r.get ('/reportes/ventas',                authenticate, reportes.ventasPorPeriodo);
r.get ('/reportes/utilidad',              authenticate, reportes.utilidadBruta);
r.get ('/reportes/producto-mas-vendido',  authenticate, reportes.productoMasVendido);
r.get ('/reportes/cotizaciones-vendedor', authenticate, reportes.cotizacionesPorVendedor);
r.get ('/reportes/llantas-mes',           authenticate, reportes.llantasPorMes);

// ── Cotizaciones (vendedores) ───────────────────────
r.get ('/cotizaciones',                   authenticate, cotizaciones.listar);
r.post('/cotizaciones',                   authenticate, cotizaciones.crear);
r.post('/cotizaciones/:id/convertir',     authenticate, cotizaciones.convertirAVenta);
// Vista pública SIN autenticación — para compartir por WhatsApp/link directo
r.get ('/cotizaciones/publica/:token',    cotizaciones.verPublica);

// ── Usuarios (solo admin) ───────────────────────────
r.get ('/usuarios',                       authenticate, authorize('admin'), usuarios.listar);
r.get ('/usuarios/roles',                 authenticate, usuarios.roles);
r.post('/usuarios',                       authenticate, authorize('admin'), usuarios.crear);
r.put ('/usuarios/:id',                   authenticate, authorize('admin'), usuarios.actualizar);
r.post('/usuarios/:id/reset-password',    authenticate, authorize('admin'), usuarios.resetPassword);

// ── Negocio (datos para cotizaciones: logo, dirección, tel, Facebook) ──
r.get ('/negocio',                        authenticate, negocio.obtener);
r.put ('/negocio',                        authenticate, authorize('admin'), negocio.actualizar);

// ── Lotes de llantas (recepción, clasificación e inspección) ───────
r.get ('/lotes',                          authenticate, lotes.listar);
r.get ('/lotes-devoluciones',             authenticate, lotes.listarDevoluciones);
r.get ('/lotes/:id',                      authenticate, lotes.obtener);
r.post('/lotes',                          authenticate, lotes.crear);
r.post('/lotes/:id/clasificar',           authenticate, lotes.clasificar);
r.post('/lotes/:id/devolucion',           authenticate, lotes.registrarDevolucion);

export default r;
