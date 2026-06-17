# 🚗 Llantera POS v1.0
Sistema Punto de Venta para Llanterías y Vulcanizadoras

---

## 📦 Módulos incluidos
- ✅ Dashboard con KPIs en tiempo real
- ✅ Ventas y facturación (con cambio automático)
- ✅ Inventario de llantas y refacciones (búsqueda por medida)
- ✅ Compras — recepción con fecha, medida, cantidad, costo
- ✅ Gastos — por categoría con resumen mensual
- ✅ Órdenes de servicio (balanceo, alineación, vulcanizado...)
- ✅ CRM de clientes con historial por vehículo
- ✅ Cuentas por cobrar / crédito
- ✅ Reportes y estadísticas

---

## 🖥️ Instalación en Windows (local)

### Requisitos previos
1. **Node.js 18+** → https://nodejs.org/es/download/
2. **PostgreSQL 14+** → https://www.postgresql.org/download/windows/

### Instalar y ejecutar
```
1. Abre la carpeta  windows\
2. Doble clic en   INSTALAR.bat  (como Administrador)
3. Sigue las instrucciones en pantalla
4. Para iniciar el sistema:  INICIAR.bat
5. Para detenerlo:           DETENER.bat
```

---

## ☁️ Despliegue en la nube (gratis)

### Frontend → Vercel
```bash
npm install -g vercel
vercel --prod
# Te da: https://llantera-pos.vercel.app
```

### Backend → Railway
1. Ir a https://railway.app → New Project → Deploy from GitHub
2. Conectar este repositorio, seleccionar carpeta `backend/`
3. Agregar base de datos: `+ New` → `PostgreSQL`
4. En Variables de entorno agregar:
   - `DATABASE_URL` ← se llena automático por Railway
   - `JWT_SECRET`   ← una clave segura
   - `FRONTEND_URL` ← tu URL de Vercel
5. Ejecutar `npm run setup` en el terminal de Railway

### Backend → Render
1. Ir a https://render.com → New Web Service
2. Conectar repo, `Root Directory: backend`
3. Build: `npm install`, Start: `node src/index.js`
4. Agregar PostgreSQL desde Render Dashboard
5. Agregar variable `DATABASE_URL` automáticamente

---

## 🔑 Credenciales por defecto
| Campo    | Valor                  |
|----------|------------------------|
| Email    | admin@llantera.com     |
| Password | Admin2024!             |
⚠️ **Cambia la contraseña al primer inicio de sesión**

---

## 🔌 API Endpoints principales
```
POST /api/v1/auth/login          # Login
GET  /api/v1/reportes/dashboard  # Dashboard KPIs
GET  /api/v1/productos           # Inventario
POST /api/v1/compras             # Nueva compra
POST /api/v1/gastos              # Nuevo gasto
POST /api/v1/ventas              # Nueva venta
GET  /api/v1/ordenes             # Órdenes de servicio
```

---

## 🛠️ Stack tecnológico
- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Auth:** JWT
- **Deploy:** Vercel (frontend) + Railway/Render (backend)
