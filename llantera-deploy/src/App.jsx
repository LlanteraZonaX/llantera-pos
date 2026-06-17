import { useState, useEffect, useCallback } from "react";

// ─── Datos simulados (en producción vienen del API) ──────────────────────────
const MOCK = {
  kpis: {
    ingresos_hoy: 14850,
    num_ventas: 12,
    efectivo: 9200,
    tarjeta: 5650,
    gastos_mes: 28400,
    stock_bajo: 4,
    en_espera: 2,
    en_proceso: 3,
    listo: 1,
    total_cxc: 6200,
    num_pendientes: 5,
  },
  ventas_semana: [
    { dia: "Lun", total: 8200 },
    { dia: "Mar", total: 11500 },
    { dia: "Mié", total: 7800 },
    { dia: "Jue", total: 13200 },
    { dia: "Vie", total: 9400 },
    { dia: "Sáb", total: 16800 },
    { dia: "Hoy", total: 14850 },
  ],
  ordenes: [
    { folio: "ORD-2024-00421", cliente: "Juan Pérez", placa: "ABC-123", vehiculo: "Nissan Sentra 2019", servicios: ["Balanceo", "Montaje x4"], estado: "en_proceso", tecnico: "Carlos M.", total: 680 },
    { folio: "ORD-2024-00422", cliente: "María López", placa: "XYZ-789", vehiculo: "Toyota Corolla 2021", servicios: ["Alineación 4 ruedas"], estado: "en_espera", tecnico: "—", total: 350 },
    { folio: "ORD-2024-00423", cliente: "Pedro Soto", placa: "DEF-456", vehiculo: "Chevrolet Aveo 2017", servicios: ["Vulcanizado", "Inflado nitrógeno"], estado: "listo", tecnico: "Luis R.", total: 110 },
    { folio: "ORD-2024-00420", cliente: "Ana Torres", placa: "GHI-321", vehiculo: "Volkswagen Jetta 2020", servicios: ["Balanceo", "Rotación"], estado: "en_espera", tecnico: "—", total: 200 },
  ],
  inventario_bajo: [
    { nombre: "Llanta 205/65R16 Bridgestone", medida: "205/65R16", stock: 2, minimo: 4 },
    { nombre: "Llanta 185/70R14 General", medida: "185/70R14", stock: 1, minimo: 4 },
    { nombre: "Válvulas TR413", medida: "—", stock: 5, minimo: 20 },
    { nombre: "Pesas balanceo 5g", medida: "—", stock: 30, minimo: 100 },
  ],
  compras_recientes: [
    { folio: "CMP-2024-00089", proveedor: "Distribuidora Llantas MX", fecha: "2024-06-10", total: 45200, items: 12 },
    { folio: "CMP-2024-00088", proveedor: "Grupo Automotriz Norte", fecha: "2024-06-07", total: 18600, items: 5 },
  ],
  gastos_semana: [
    { categoria: "Sueldos", monto: 14000 },
    { categoria: "Renta", monto: 8000 },
    { categoria: "Electricidad", monto: 2800 },
    { categoria: "Combustible", monto: 1200 },
    { categoria: "Otros", monto: 2400 },
  ],
};

// ─── Utilidades ──────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ESTADO_COLORES = {
  en_espera: { bg: "#FEF3C7", color: "#92400E", label: "En espera" },
  en_proceso: { bg: "#DBEAFE", color: "#1E40AF", label: "En proceso" },
  listo: { bg: "#D1FAE5", color: "#065F46", label: "Listo" },
  entregado: { bg: "#F3F4F6", color: "#374151", label: "Entregado" },
};

// ─── Componentes ─────────────────────────────────────────────────────────────
function KpiCard({ icono, label, valor, sub, color = "#1D4ED8", alerta }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, padding: "18px 20px", border: "1px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", gap: 4, position: "relative", overflow: "hidden" }}>
      {alerta && (
        <span style={{ position: "absolute", top: 10, right: 10, background: "#FEE2E2", color: "#B91C1C", fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20 }}>
          ⚠ Atención
        </span>
      )}
      <span style={{ fontSize: 22 }}>{icono}</span>
      <span style={{ fontSize: 24, fontWeight: 600, color, lineHeight: 1.2, marginTop: 4 }}>{valor}</span>
      <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{label}</span>
      {sub && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{sub}</span>}
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.total));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 4px" }}>
      {data.map((d) => (
        <div key={d.dia} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{fmt(d.total).replace("$", "").split(".")[0]}</span>
          <div style={{ width: "100%", background: d.dia === "Hoy" ? "#1D4ED8" : "var(--color-border-secondary)", borderRadius: "4px 4px 0 0", height: `${Math.round((d.total / max) * 90)}px`, transition: "height 0.6s ease" }} />
          <span style={{ fontSize: 11, color: d.dia === "Hoy" ? "#1D4ED8" : "var(--color-text-secondary)", fontWeight: d.dia === "Hoy" ? 600 : 400 }}>{d.dia}</span>
        </div>
      ))}
    </div>
  );
}

function DonutGastos({ data }) {
  const total = data.reduce((s, g) => s + g.monto, 0);
  const COLORS = ["#1D4ED8", "#0F766E", "#B45309", "#7C3AED", "#64748B"];
  let cum = 0;
  const slices = data.map((g, i) => {
    const pct = g.monto / total;
    const start = cum;
    cum += pct;
    return { ...g, pct, start, color: COLORS[i % COLORS.length] };
  });

  const polarToCartesian = (pct) => {
    const angle = pct * 2 * Math.PI - Math.PI / 2;
    return { x: 50 + 38 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) };
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg viewBox="0 0 100 100" width={110} height={110}>
        {slices.map((s, i) => {
          const a1 = polarToCartesian(s.start);
          const a2 = polarToCartesian(s.start + s.pct);
          const large = s.pct > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M50,50 L${a1.x},${a1.y} A38,38,0,${large},1,${a2.x},${a2.y} Z`}
              fill={s.color}
              stroke="var(--color-background-secondary)"
              strokeWidth={2}
            />
          );
        })}
        <circle cx={50} cy={50} r={22} fill="var(--color-background-secondary)" />
        <text x={50} y={47} textAnchor="middle" fontSize={9} fill="var(--color-text-secondary)" fontFamily="sans-serif">Total</text>
        <text x={50} y={57} textAnchor="middle" fontSize={10} fontWeight="600" fill="var(--color-text-primary)" fontFamily="sans-serif">${(total / 1000).toFixed(1)}k</text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)", flex: 1 }}>{s.categoria}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{fmt(s.monto)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ estado }) {
  const c = ESTADO_COLORES[estado] || ESTADO_COLORES.entregado;
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

function SeccionCard({ titulo, children, accion, onAccion }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--color-border-tertiary)" }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)" }}>{titulo}</span>
        {accion && (
          <button onClick={onAccion} style={{ fontSize: 12, color: "#1D4ED8", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
            {accion}
          </button>
        )}
      </div>
      <div style={{ padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

// ─── Modal Nueva Compra ───────────────────────────────────────────────────────
function ModalCompra({ onClose }) {
  const [form, setForm] = useState({
    proveedor: "", fecha_recepcion: new Date().toISOString().split("T")[0],
    num_factura: "", notas: "",
  });
  const [items, setItems] = useState([{ medida: "", descripcion: "", cantidad: "", costo_unitario: "" }]);
  const [guardado, setGuardado] = useState(false);

  const total = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.costo_unitario) || 0), 0);

  const addItem = () => setItems([...items, { medida: "", descripcion: "", cantidad: "", costo_unitario: "" }]);
  const updateItem = (idx, campo, val) => {
    const arr = [...items];
    arr[idx][campo] = val;
    setItems(arr);
  };
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const guardar = () => {
    setGuardado(true);
    setTimeout(() => { setGuardado(false); onClose(); }, 1200);
  };

  if (guardado) return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Compra registrada</div>
        <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginTop: 6 }}>Folio: CMP-2024-00090</div>
      </div>
    </div>
  );

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width: 680, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Nueva recepción de compra</h2>
          <button onClick={onClose} style={btnClose}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Proveedor</label>
            <input style={inputStyle} placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Fecha de recepción *</label>
            <input type="date" style={inputStyle} value={form.fecha_recepcion} onChange={e => setForm({ ...form, fecha_recepcion: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>No. de factura</label>
            <input style={inputStyle} placeholder="Ej: FAC-2024-0512" value={form.num_factura} onChange={e => setForm({ ...form, num_factura: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Notas</label>
            <input style={inputStyle} placeholder="Observaciones..." value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>

        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--color-text-primary)" }}>Productos / Llantas recibidos</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1fr 1.2fr 32px", gap: 6, marginBottom: 6 }}>
          {["Medida", "Descripción", "Cantidad", "Costo unit.", ""].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
          ))}
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 1fr 1.2fr 32px", gap: 6, marginBottom: 8 }}>
            <input style={inputStyle} placeholder="205/65R16" value={item.medida} onChange={e => updateItem(idx, "medida", e.target.value)} />
            <input style={inputStyle} placeholder="Bridgestone Ecopia..." value={item.descripcion} onChange={e => updateItem(idx, "descripcion", e.target.value)} />
            <input type="number" style={inputStyle} placeholder="4" value={item.cantidad} onChange={e => updateItem(idx, "cantidad", e.target.value)} />
            <input type="number" style={inputStyle} placeholder="0.00" value={item.costo_unitario} onChange={e => updateItem(idx, "costo_unitario", e.target.value)} />
            <button onClick={() => removeItem(idx)} style={{ ...btnClose, padding: "6px 8px", fontSize: 14, height: 38, marginTop: 0 }} disabled={items.length === 1}>✕</button>
          </div>
        ))}

        <button onClick={addItem} style={{ fontSize: 13, color: "#1D4ED8", background: "none", border: "1px dashed #93C5FD", borderRadius: 8, padding: "6px 14px", cursor: "pointer", marginBottom: 16, width: "100%" }}>
          + Agregar producto
        </button>

        <div style={{ background: "var(--color-background-tertiary)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Subtotal</span>
            <span style={{ fontSize: 13 }}>{fmt(total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>IVA 16%</span>
            <span style={{ fontSize: 13 }}>{fmt(total * 0.16)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
            <span style={{ fontWeight: 600, fontSize: 16, color: "#1D4ED8" }}>{fmt(total * 1.16)}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Guardar compra</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nuevo Gasto ────────────────────────────────────────────────────────
function ModalGasto({ onClose }) {
  const CATEGORIAS = ["Renta", "Electricidad", "Agua", "Sueldos", "Combustible", "Mantenimiento equipo", "Papelería", "Publicidad", "Otros"];
  const [form, setForm] = useState({ categoria: "", descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0], metodo_pago: "efectivo", notas: "" });
  const [guardado, setGuardado] = useState(false);

  const guardar = () => {
    if (!form.categoria || !form.descripcion || !form.monto) return;
    setGuardado(true);
    setTimeout(() => { setGuardado(false); onClose(); }, 1200);
  };

  if (guardado) return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Gasto registrado</div>
      </div>
    </div>
  );

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, width: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Registrar gasto</h2>
          <button onClick={onClose} style={btnClose}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Categoría *</label>
            <select style={inputStyle} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
              <option value="">— Seleccionar —</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Descripción *</label>
            <input style={inputStyle} placeholder="Ej: Pago renta local junio 2024" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Monto *</label>
              <input type="number" style={inputStyle} placeholder="0.00" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" style={inputStyle} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Método de pago</label>
            <select style={inputStyle} value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notas</label>
            <input style={inputStyle} placeholder="Referencia, número de recibo..." value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} style={{ padding: "9px 24px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Guardar gasto</button>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos globales ─────────────────────────────────────────────────────────
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 };
const modalStyle = { background: "var(--color-background-primary)", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: 700 };
const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", boxSizing: "border-box", fontFamily: "inherit" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };
const btnClose = { background: "var(--color-background-tertiary)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0 };

// ─── App principal ────────────────────────────────────────────────────────────
export default function LlanteraPOS() {
  const [seccion, setSeccion] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const d = MOCK;

  const NAV = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "ordenes", icon: "🔧", label: "Órdenes de servicio" },
    { id: "ventas", icon: "🛒", label: "Ventas / POS" },
    { id: "inventario", icon: "📦", label: "Inventario" },
    { id: "compras", icon: "🚚", label: "Compras" },
    { id: "gastos", icon: "💸", label: "Gastos" },
    { id: "clientes", icon: "👥", label: "Clientes / CRM" },
    { id: "credito", icon: "💳", label: "Cuentas por cobrar" },
    { id: "reportes", icon: "📊", label: "Reportes" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-sans, system-ui)", color: "var(--color-text-primary)", background: "var(--color-background-tertiary)" }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 220 : 56, background: "#0F172A", flexShrink: 0, transition: "width 0.25s", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ padding: sidebarOpen ? "20px 16px 12px" : "20px 8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🚗</span>
          {sidebarOpen && <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>Llantera POS</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, padding: 2 }}>
            {sidebarOpen ? "◂" : "▸"}
          </button>
        </div>

        <nav style={{ flex: 1, padding: "10px 0" }}>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setSeccion(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: sidebarOpen ? "10px 16px" : "10px 0", justifyContent: sidebarOpen ? "flex-start" : "center",
                background: seccion === item.id ? "rgba(29,78,216,0.35)" : "none",
                borderLeft: seccion === item.id ? "3px solid #60A5FA" : "3px solid transparent",
                border: "none", cursor: "pointer", color: seccion === item.id ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 13, fontWeight: seccion === item.id ? 600 : 400, transition: "all 0.15s", textAlign: "left"
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div style={{ padding: sidebarOpen ? "12px 16px" : "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>A</div>
            {sidebarOpen && (
              <div>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>Admin</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Administrador</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {NAV.find(n => n.id === seccion)?.label}
            </h1>
            <p style={{ margin: "2px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
              {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {seccion === "compras" && (
              <button onClick={() => setModal("compra")} style={{ padding: "9px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                + Nueva compra
              </button>
            )}
            {seccion === "gastos" && (
              <button onClick={() => setModal("gasto")} style={{ padding: "9px 18px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                + Registrar gasto
              </button>
            )}
            {seccion === "dashboard" && (
              <>
                <button onClick={() => setModal("compra")} style={{ padding: "9px 16px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-secondary)", borderRadius: 9, cursor: "pointer", fontSize: 13 }}>
                  🚚 Nueva compra
                </button>
                <button onClick={() => setModal("gasto")} style={{ padding: "9px 16px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  + Gasto
                </button>
              </>
            )}
          </div>
        </div>

        {/* ──── DASHBOARD ──── */}
        {seccion === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              <KpiCard icono="💰" label="Ingresos hoy" valor={fmt(d.kpis.ingresos_hoy)} sub={`${d.kpis.num_ventas} ventas`} color="#1D4ED8" />
              <KpiCard icono="💵" label="Efectivo" valor={fmt(d.kpis.efectivo)} sub="del día" color="#065F46" />
              <KpiCard icono="💳" label="Tarjeta" valor={fmt(d.kpis.tarjeta)} sub="del día" color="#7C3AED" />
              <KpiCard icono="🔧" label="Órdenes activas" valor={d.kpis.en_espera + d.kpis.en_proceso + d.kpis.listo} sub={`${d.kpis.listo} listas p/ entregar`} color="#B45309" />
              <KpiCard icono="📦" label="Stock bajo" valor={d.kpis.stock_bajo} sub="productos" color="#DC2626" alerta={d.kpis.stock_bajo > 0} />
              <KpiCard icono="💳" label="Cuentas × cobrar" valor={fmt(d.kpis.total_cxc)} sub={`${d.kpis.num_pendientes} clientes`} color="#92400E" />
            </div>

            {/* Gráficas */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 16 }}>
              <SeccionCard titulo="Ventas — últimos 7 días">
                <BarChart data={d.ventas_semana} />
              </SeccionCard>
              <SeccionCard titulo="Gastos del mes por categoría">
                <DonutGastos data={d.gastos_semana} />
              </SeccionCard>
            </div>

            {/* Órdenes y alertas */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
              <SeccionCard titulo="Órdenes activas" accion="Ver todas" onAccion={() => setSeccion("ordenes")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {d.ordenes.filter(o => o.estado !== "entregado").slice(0, 3).map(o => (
                    <div key={o.folio} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--color-background-tertiary)", borderRadius: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.cliente} — {o.placa}</div>
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{o.servicios.join(", ")}</div>
                      </div>
                      <Badge estado={o.estado} />
                      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(o.total)}</span>
                    </div>
                  ))}
                </div>
              </SeccionCard>
              <SeccionCard titulo="Productos con stock bajo" accion="Ver inventario" onAccion={() => setSeccion("inventario")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {d.inventario_bajo.map(p => (
                    <div key={p.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                        {p.medida !== "—" && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{p.medida}</div>}
                      </div>
                      <span style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, flexShrink: 0 }}>
                        {p.stock} / {p.minimo}
                      </span>
                    </div>
                  ))}
                </div>
              </SeccionCard>
            </div>
          </div>
        )}

        {/* ──── ÓRDENES ──── */}
        {seccion === "ordenes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Todas", "En espera", "En proceso", "Listo"].map(f => (
                <button key={f} style={{ padding: "6px 14px", border: "1px solid var(--color-border-secondary)", borderRadius: 20, background: f === "Todas" ? "#1D4ED8" : "var(--color-background-secondary)", color: f === "Todas" ? "#fff" : "var(--color-text-primary)", fontSize: 12, cursor: "pointer", fontWeight: f === "Todas" ? 600 : 400 }}>{f}</button>
              ))}
              <div style={{ marginLeft: "auto" }}>
                <button style={{ padding: "6px 16px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva orden</button>
              </div>
            </div>
            {d.ordenes.map(o => (
              <div key={o.folio} style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--color-border-tertiary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{o.folio}</span>
                      <Badge estado={o.estado} />
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{o.cliente}</span>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}> · {o.placa} · {o.vehiculo}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--color-text-secondary)" }}>
                      Servicios: <span style={{ color: "var(--color-text-primary)" }}>{o.servicios.join(", ")}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-secondary)" }}>
                      Técnico: {o.tecnico}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1D4ED8" }}>{fmt(o.total)}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                      <button style={{ padding: "5px 12px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>Ver detalle</button>
                      {o.estado === "listo" && (
                        <button style={{ padding: "5px 12px", background: "#065F46", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Cobrar y entregar</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ──── COMPRAS ──── */}
        {seccion === "compras" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <KpiCard icono="🚚" label="Compras este mes" valor="2" sub="recepciones" color="#1D4ED8" />
              <KpiCard icono="💰" label="Total invertido" valor={fmt(63800)} sub="mes actual" color="#7C3AED" />
              <KpiCard icono="📋" label="Proveedores activos" valor="6" sub="registrados" color="#065F46" />
            </div>
            {d.compras_recientes.map(c => (
              <div key={c.folio} style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.folio}</div>
                  <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginTop: 3 }}>{c.proveedor}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Recibido: {c.fecha} · {c.items} productos</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1D4ED8" }}>{fmt(c.total)}</div>
                  <button style={{ marginTop: 8, padding: "5px 14px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>Ver detalle</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ──── GASTOS ──── */}
        {seccion === "gastos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <KpiCard icono="💸" label="Gastos del mes" valor={fmt(d.kpis.gastos_mes)} sub="junio 2024" color="#DC2626" />
              <KpiCard icono="📅" label="Gastos de hoy" valor={fmt(1200)} sub="2 registros" color="#B45309" />
              <KpiCard icono="📊" label="Mayor gasto" valor="Sueldos" sub={fmt(14000)} color="#7C3AED" />
            </div>
            <SeccionCard titulo="Gastos del mes por categoría">
              <DonutGastos data={d.gastos_semana} />
            </SeccionCard>
            <SeccionCard titulo="Últimos gastos registrados">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { cat: "Combustible", desc: "Gasolina para combi de reparto", monto: 800, fecha: "2024-06-12", metodo: "efectivo" },
                  { cat: "Electricidad", desc: "Pago CFE bimestre mayo-junio", monto: 2800, fecha: "2024-06-10", metodo: "transferencia" },
                  { cat: "Mantenimiento equipo", desc: "Servicio balanceadora Hunter", monto: 1500, fecha: "2024-06-08", metodo: "tarjeta" },
                ].map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--color-background-tertiary)", borderRadius: 10 }}>
                    <div>
                      <span style={{ background: "var(--color-border-tertiary)", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600, marginRight: 8 }}>{g.cat}</span>
                      <span style={{ fontSize: 13 }}>{g.desc}</span>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>{g.fecha} · {g.metodo}</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#DC2626", whiteSpace: "nowrap" }}>{fmt(g.monto)}</span>
                  </div>
                ))}
              </div>
            </SeccionCard>
          </div>
        )}

        {/* ──── PANTALLAS EN CONSTRUCCIÓN ──── */}
        {!["dashboard", "ordenes", "compras", "gastos"].includes(seccion) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--color-text-secondary)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{NAV.find(n => n.id === seccion)?.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>Módulo en desarrollo</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Este módulo se agregará en la siguiente iteración.</div>
          </div>
        )}
      </main>

      {/* Modales */}
      {modal === "compra" && <ModalCompra onClose={() => setModal(null)} />}
      {modal === "gasto" && <ModalGasto onClose={() => setModal(null)} />}
    </div>
  );
}
