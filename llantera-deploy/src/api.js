// ─── Cliente API centralizado ─────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

const getToken = () => localStorage.getItem('llantera_token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const handle = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
};

export const api = {
  // Auth
  login: (email, password) =>
    fetch(`${BASE}/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) }).then(handle),
  me: () =>
    fetch(`${BASE}/auth/me`, { headers: headers() }).then(handle),
  cambiarPassword: (password_actual, password_nuevo) =>
    fetch(`${BASE}/auth/cambiar-password`, { method: 'POST', headers: headers(), body: JSON.stringify({ password_actual, password_nuevo }) }).then(handle),

  // Dashboard
  dashboard: () =>
    fetch(`${BASE}/reportes/dashboard`, { headers: headers() }).then(handle),

  // Órdenes
  ordenes: (params = '') =>
    fetch(`${BASE}/ordenes?${params}`, { headers: headers() }).then(handle),
  crearOrden: (data) =>
    fetch(`${BASE}/ordenes`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  cambiarEstadoOrden: (id, estado) =>
    fetch(`${BASE}/ordenes/${id}/estado`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ estado }) }).then(handle),

  // Productos / Inventario
  productos: (params = '') =>
    fetch(`${BASE}/productos?${params}`, { headers: headers() }).then(handle),
  crearProducto: (data) =>
    fetch(`${BASE}/productos`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  actualizarProducto: (id, data) =>
    fetch(`${BASE}/productos/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Ventas
  ventas: (params = '') =>
    fetch(`${BASE}/ventas?${params}`, { headers: headers() }).then(handle),
  crearVenta: (data) =>
    fetch(`${BASE}/ventas`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Compras
  compras: (params = '') =>
    fetch(`${BASE}/compras?${params}`, { headers: headers() }).then(handle),
  crearCompra: (data) =>
    fetch(`${BASE}/compras`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Gastos
  gastos: (params = '') =>
    fetch(`${BASE}/gastos?${params}`, { headers: headers() }).then(handle),
  crearGasto: (data) =>
    fetch(`${BASE}/gastos`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  actualizarGasto: (id, data) =>
    fetch(`${BASE}/gastos/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),
  eliminarGasto: (id) =>
    fetch(`${BASE}/gastos/${id}`, { method: 'DELETE', headers: headers() }).then(handle),

  // Clientes
  clientes: (params = '') =>
    fetch(`${BASE}/clientes?${params}`, { headers: headers() }).then(handle),
  crearCliente: (data) =>
    fetch(`${BASE}/clientes`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  actualizarCliente: (id, data) =>
    fetch(`${BASE}/clientes/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Crédito
  credito: (params = '') =>
    fetch(`${BASE}/credito?${params}`, { headers: headers() }).then(handle),
  registrarPago: (id, data) =>
    fetch(`${BASE}/credito/${id}/pago`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Fotos de producto
  agregarFotoProducto: (productoId, data) =>
    fetch(`${BASE}/productos/${productoId}/fotos`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  subirFotoProducto: (productoId, archivo) => {
    const form = new FormData();
    form.append('foto', archivo);
    return fetch(`${BASE}/productos/${productoId}/fotos/subir`, {
      method: 'POST',
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, // sin Content-Type: el navegador lo pone solo con el boundary correcto
      body: form,
    }).then(handle);
  },
  eliminarFotoProducto: (fotoId) =>
    fetch(`${BASE}/productos/fotos/${fotoId}`, { method: 'DELETE', headers: headers() }).then(handle),

  // Cotizaciones (vendedores)
  cotizaciones: () =>
    fetch(`${BASE}/cotizaciones`, { headers: headers() }).then(handle),
  crearCotizacion: (data) =>
    fetch(`${BASE}/cotizaciones`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  convertirCotizacionAVenta: (id) =>
    fetch(`${BASE}/cotizaciones/${id}/convertir`, { method: 'POST', headers: headers() }).then(handle),
  // Esta SÍ es pública, no requiere headers de auth (la usa el cliente final)
  verCotizacionPublica: (token) =>
    fetch(`${BASE}/cotizaciones/publica/${token}`).then(handle),

  // Gestión de usuarios (solo admin)
  usuarios: () =>
    fetch(`${BASE}/usuarios`, { headers: headers() }).then(handle),
  rolesDisponibles: () =>
    fetch(`${BASE}/usuarios/roles`, { headers: headers() }).then(handle),
  crearUsuario: (data) =>
    fetch(`${BASE}/usuarios`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  actualizarUsuario: (id, data) =>
    fetch(`${BASE}/usuarios/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),
  resetPasswordUsuario: (id, password_nuevo) =>
    fetch(`${BASE}/usuarios/${id}/reset-password`, { method: 'POST', headers: headers(), body: JSON.stringify({ password_nuevo }) }).then(handle),

  // Datos del negocio (logo, dirección, teléfono, Facebook — para cotizaciones)
  negocio: () =>
    fetch(`${BASE}/negocio`, { headers: headers() }).then(handle),
  actualizarNegocio: (data) =>
    fetch(`${BASE}/negocio`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),

  // Lotes de llantas (recepción, clasificación y devolución)
  lotes: (params = '') =>
    fetch(`${BASE}/lotes?${params}`, { headers: headers() }).then(handle),
  obtenerLote: (id) =>
    fetch(`${BASE}/lotes/${id}`, { headers: headers() }).then(handle),
  crearLote: (data) =>
    fetch(`${BASE}/lotes`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  clasificarLote: (id, data) =>
    fetch(`${BASE}/lotes/${id}/clasificar`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  devolverLote: (id, data) =>
    fetch(`${BASE}/lotes/${id}/devolucion`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  devolucionesLotes: (params = '') =>
    fetch(`${BASE}/lotes-devoluciones?${params}`, { headers: headers() }).then(handle),

  // Reportes
  reporteVentas: (params = '') =>
    fetch(`${BASE}/reportes/ventas?${params}`, { headers: headers() }).then(handle),
  reporteProductoMasVendido: (params = '') =>
    fetch(`${BASE}/reportes/producto-mas-vendido?${params}`, { headers: headers() }).then(handle),
  reporteCotizacionesVendedor: (params = '') =>
    fetch(`${BASE}/reportes/cotizaciones-vendedor?${params}`, { headers: headers() }).then(handle),
  reporteLlantasMes: (params = '') =>
    fetch(`${BASE}/reportes/llantas-mes?${params}`, { headers: headers() }).then(handle),
};

export default api;
