import { useState, useEffect, useCallback, useRef } from "react";
import api from "./api";

// ─── Utilidades ───────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (f) => {
  if (!f) return "—";
  const s = typeof f === "string" ? f : new Date(f).toISOString();
  const [y, m, d] = s.substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

const ESTADO_COLORES = {
  en_espera:  { bg: "#FEF3C7", color: "#92400E", label: "En espera" },
  en_proceso: { bg: "#DBEAFE", color: "#1E40AF", label: "En proceso" },
  listo:      { bg: "#D1FAE5", color: "#065F46", label: "Listo" },
  entregado:  { bg: "#F3F4F6", color: "#374151", label: "Entregado" },
  cancelado:  { bg: "#FEE2E2", color: "#B91C1C", label: "Cancelado" },
};

// ─── Pantalla de Login ────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await api.login(form.email, form.password);
      localStorage.setItem("llantera_token", data.token);
      localStorage.setItem("llantera_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Credenciales incorrectas");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A", padding: 16 }}>
      <div style={{ background: "#1E293B", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 40 }}>🚗</span>
          <h1 style={{ color: "#F1F5F9", fontSize: 22, fontWeight: 700, margin: "8px 0 4px" }}>Llantera POS</h1>
          <p style={{ color: "#64748B", fontSize: 13 }}>Inicia sesión para continuar</p>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "#F1F5F9", fontSize: 14, boxSizing: "border-box" }}
              placeholder="admin@llantera.com" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contraseña</label>
            <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "#F1F5F9", fontSize: 14, boxSizing: "border-box" }}
              placeholder="••••••••" />
          </div>
          {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "11px", background: loading ? "#334155" : "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Componentes reutilizables ────────────────────────────────────────────────
function KpiCard({ icono, label, valor, sub, color = "#1D4ED8", alerta, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "var(--color-background-secondary)", borderRadius: 14, padding: "18px 20px", border: "1px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", gap: 4, position: "relative", cursor: onClick ? "pointer" : "default" }}>
      {alerta && <span style={{ position: "absolute", top: 10, right: 10, background: "#FEE2E2", color: "#B91C1C", fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20 }}>⚠ Atención</span>}
      <span style={{ fontSize: 22 }}>{icono}</span>
      <span style={{ fontSize: 24, fontWeight: 600, color, lineHeight: 1.2, marginTop: 4 }}>{valor}</span>
      <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{label}</span>
      {sub && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{sub}</span>}
    </div>
  );
}

function Badge({ estado }) {
  const c = ESTADO_COLORES[estado] || ESTADO_COLORES.entregado;
  return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{c.label}</span>;
}

function Card({ titulo, children, accion, onAccion }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--color-border-tertiary)" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</span>
        {accion && <button onClick={onAccion} style={{ fontSize: 12, color: "#1D4ED8", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>{accion}</button>}
      </div>
      <div style={{ padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

function BarChart({ data }) {
  if (!data?.length) return <div style={{ color: "var(--color-text-secondary)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin datos aún</div>;
  const max = Math.max(...data.map(d => d.total), 1);
  const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 4px" }}>
      {data.map((d, i) => {
        const dia = d.dia ? d.dia : dias[new Date(d.dia || Date.now()).getDay()];
        const esHoy = i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{(d.total/1000).toFixed(1)}k</span>
            <div style={{ width: "100%", background: esHoy ? "#1D4ED8" : "var(--color-border-secondary)", borderRadius: "4px 4px 0 0", height: `${Math.round((d.total / max) * 90)}px`, minHeight: 4, transition: "height 0.6s ease" }} />
            <span style={{ fontSize: 11, color: esHoy ? "#1D4ED8" : "var(--color-text-secondary)", fontWeight: esHoy ? 600 : 400 }}>{dia}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 };
const modalBase = { background: "var(--color-background-primary)", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", width: "100%", maxHeight: "90vh", overflowY: "auto" };
const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", boxSizing: "border-box", fontFamily: "inherit" };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };

// ─── Modal Nuevo Producto ─────────────────────────────────────────────────────
function ModalProducto({ producto, onClose, onSaved }) {
  const esEdicion = !!producto;
  const [form, setForm] = useState(producto ? {
    nombre: producto.nombre || "", medida: producto.medida || "", marca: producto.marca || "",
    categoria_id: producto.categoria_id || 1,
    precio_compra: producto.precio_compra ?? "", precio_venta: producto.precio_venta ?? "",
    stock_actual: producto.stock_actual ?? "", stock_minimo: producto.stock_minimo ?? "",
    es_servicio: !!producto.es_servicio,
  } : { nombre: "", medida: "", marca: "", categoria_id: 1, precio_compra: "", precio_venta: "", stock_actual: "", stock_minimo: "", es_servicio: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre || !form.precio_venta) return setError("Nombre y precio de venta son requeridos");
    setLoading(true); setError("");
    const datos = { ...form, precio_compra: parseFloat(form.precio_compra)||0, precio_venta: parseFloat(form.precio_venta)||0, stock_actual: parseFloat(form.stock_actual)||0, stock_minimo: parseFloat(form.stock_minimo)||0 };
    try {
      if (esEdicion) await api.actualizarProducto(producto.id, datos);
      else await api.crearProducto(datos);
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>📦 {esEdicion ? "Editar producto / llanta" : "Nuevo producto / llanta"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>Nombre / descripción *</label>
            <input style={inputStyle} placeholder="Ej: Llanta Bridgestone Ecopia 205/65R16" value={form.nombre} onChange={e => f("nombre", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Medida de llanta</label>
            <input style={inputStyle} placeholder="205/65R16" value={form.medida} onChange={e => f("medida", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Marca</label>
            <input style={inputStyle} placeholder="Bridgestone, Michelin..." value={form.marca} onChange={e => f("marca", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Precio de compra</label>
            <input type="number" style={inputStyle} placeholder="0.00" value={form.precio_compra} onChange={e => f("precio_compra", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Precio de venta *</label>
            <input type="number" style={inputStyle} placeholder="0.00" value={form.precio_venta} onChange={e => f("precio_venta", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Stock actual</label>
            <input type="number" style={inputStyle} placeholder="0" value={form.stock_actual} onChange={e => f("stock_actual", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Stock mínimo</label>
            <input type="number" style={inputStyle} placeholder="2" value={form.stock_minimo} onChange={e => f("stock_minimo", e.target.value)} />
          </div>
          <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="es_srv" checked={form.es_servicio} onChange={e => f("es_servicio", e.target.checked)} />
            <label htmlFor="es_srv" style={{ fontSize: 13 }}>Es un servicio (no maneja inventario físico)</label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {loading ? "Guardando..." : esEdicion ? "Guardar cambios" : "Guardar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nueva Compra ───────────────────────────────────────────────────────
function ModalCompra({ onClose, onSaved, productos }) {
  const [form, setForm] = useState({ proveedor: "", fecha_recepcion: hoyISO(), num_factura: "", notas: "" });
  const [items, setItems] = useState([{ producto_id: "", medida: "", cantidad: "", costo_unitario: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = items.reduce((s, i) => s + (parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0), 0);
  const addItem = () => setItems(p => [...p, { producto_id: "", medida: "", cantidad: "", costo_unitario: "" }]);
  const upd = (idx, k, v) => setItems(p => { const a = [...p]; a[idx][k] = v; return a; });

  const guardar = async () => {
    const validItems = items.filter(i => i.producto_id && i.cantidad && i.costo_unitario);
    if (!validItems.length) return setError("Agrega al menos un producto con cantidad y costo");
    setLoading(true); setError("");
    try {
      await api.crearCompra({ ...form, items: validItems.map(i => ({ producto_id: i.producto_id, cantidad: parseFloat(i.cantidad), costo_unitario: parseFloat(i.costo_unitario) })) });
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>🚚 Nueva recepción de compra</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div><label style={labelStyle}>Proveedor</label><input style={inputStyle} placeholder="Nombre del proveedor" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} /></div>
          <div><label style={labelStyle}>Fecha de recepción *</label><input type="date" style={inputStyle} value={form.fecha_recepcion} onChange={e => setForm(p => ({ ...p, fecha_recepcion: e.target.value }))} /></div>
          <div><label style={labelStyle}>No. factura</label><input style={inputStyle} placeholder="FAC-0001" value={form.num_factura} onChange={e => setForm(p => ({ ...p, num_factura: e.target.value }))} /></div>
          <div><label style={labelStyle}>Notas</label><input style={inputStyle} placeholder="Observaciones..." value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Productos recibidos</div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 32px", gap: 6, marginBottom: 8 }}>
            <select style={inputStyle} value={item.producto_id} onChange={e => upd(idx, "producto_id", e.target.value)}>
              <option value="">— Seleccionar producto —</option>
              {(productos||[]).map(p => <option key={p.id} value={p.id}>{p.nombre}{p.medida ? ` (${p.medida})` : ""}</option>)}
            </select>
            <input type="number" style={inputStyle} placeholder="Cantidad" value={item.cantidad} onChange={e => upd(idx, "cantidad", e.target.value)} />
            <input type="number" style={inputStyle} placeholder="Costo unit." value={item.costo_unitario} onChange={e => upd(idx, "costo_unitario", e.target.value)} />
            <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, cursor: "pointer", color: "#B91C1C", fontSize: 14 }}>✕</button>
          </div>
        ))}
        <button onClick={addItem} style={{ width: "100%", padding: "7px", border: "1px dashed #93C5FD", borderRadius: 8, background: "none", color: "#1D4ED8", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>+ Agregar producto</button>
        <div style={{ background: "var(--color-background-tertiary)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--color-text-secondary)" }}>Subtotal</span><span>{fmt(total)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--color-text-secondary)" }}>IVA 16%</span><span>{fmt(total * 0.16)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 15, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border-tertiary)" }}><span>Total</span><span style={{ color: "#1D4ED8" }}>{fmt(total * 1.16)}</span></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar compra"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nuevo Gasto ────────────────────────────────────────────────────────
function ModalGasto({ onClose, onSaved }) {
  const CATS = ["Renta","Electricidad","Agua","Sueldos","Combustible","Mantenimiento equipo","Papelería","Publicidad","Otros"];
  const [form, setForm] = useState({ categoria_id: 9, descripcion: "", monto: "", fecha: hoyISO(), metodo_pago: "efectivo", notas: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.descripcion || !form.monto) return setError("Descripción y monto son requeridos");
    setLoading(true); setError("");
    try {
      await api.crearGasto({ ...form, monto: parseFloat(form.monto) });
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>💸 Registrar gasto</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={labelStyle}>Categoría *</label>
            <select style={inputStyle} value={form.categoria_id} onChange={e => f("categoria_id", parseInt(e.target.value))}>
              {CATS.map((c, i) => <option key={i+1} value={i+1}>{c}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Descripción *</label><input style={inputStyle} placeholder="Ej: Pago renta local junio" value={form.descripcion} onChange={e => f("descripcion", e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={labelStyle}>Monto *</label><input type="number" style={inputStyle} placeholder="0.00" value={form.monto} onChange={e => f("monto", e.target.value)} /></div>
            <div><label style={labelStyle}>Fecha</label><input type="date" style={inputStyle} value={form.fecha} onChange={e => f("fecha", e.target.value)} /></div>
          </div>
          <div><label style={labelStyle}>Método de pago</label>
            <select style={inputStyle} value={form.metodo_pago} onChange={e => f("metodo_pago", e.target.value)}>
              <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div><label style={labelStyle}>Notas</label><input style={inputStyle} placeholder="Referencia, número de recibo..." value={form.notas} onChange={e => f("notas", e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar gasto"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setSeccion, onNuevaCompra, onNuevoGasto, onVerStockBajo }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setData(await api.dashboard()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "var(--color-text-secondary)" }}>Cargando datos...</div>;

  const k = data?.kpis || {};
  const semana = data?.ventas_semana || [];
  const top = data?.top_productos || [];
  const ultimas = data?.ultimas_ventas || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Banner "Vender ahora" ─────────────────────────────────────────── */}
      <button onClick={() => setSeccion("ventas")} style={{ display: "flex", alignItems: "center", gap: 20, background: "linear-gradient(135deg, #1D4ED8 0%, #1e40af 100%)", borderRadius: 14, padding: isMobile ? "18px 20px" : "22px 28px", border: "none", cursor: "pointer", color: "#fff", textAlign: "left", boxShadow: "0 6px 24px rgba(29,78,216,0.35)", transition: "transform 0.15s" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🛒</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 17 : 20, letterSpacing: "-0.02em" }}>Punto de venta</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>Registrar una nueva venta</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 22, opacity: 0.6 }}>→</div>
      </button>

      {/* ── Acciones rápidas ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={onNuevaCompra} style={{ padding: "8px 16px", background: "var(--color-background-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: 9, cursor: "pointer", fontSize: 13, color: "#fff" }}>🚚 Nueva compra</button>
        <button onClick={onNuevoGasto} style={{ padding: "8px 16px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Gasto</button>
        <button onClick={cargar} style={{ padding: "8px 12px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 9, cursor: "pointer", fontSize: 13, color: "#fff" }}>↻ Actualizar</button>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        <KpiCard icono="💰" label="Ingresos hoy" valor={fmt(k.ingresos_hoy)} sub={`${k.num_ventas||0} ventas`} color="#1D4ED8" />
        <KpiCard icono="💵" label="Efectivo" valor={fmt(k.efectivo)} sub="del día" color="#065F46" />
        <KpiCard icono="💳" label="Tarjeta" valor={fmt(k.tarjeta)} sub="del día" color="#7C3AED" />
        <KpiCard icono="🔧" label="Órdenes activas" valor={(k.en_espera||0)+(k.en_proceso||0)+(k.listo||0)} sub={`${k.listo||0} lista(s) p/ entregar`} color="#B45309" />
        <KpiCard icono="📦" label="Stock bajo" valor={k.stock_bajo||0} sub="productos" color="#DC2626" alerta={(k.stock_bajo||0) > 0} onClick={onVerStockBajo} />
        <KpiCard icono="💳" label="Cuentas × cobrar" valor={fmt(k.total_cxc)} sub={`${k.num_pendientes||0} clientes`} color="#92400E" />
      </div>

      {/* ── Gráfica + Top productos + Últimas ventas ──────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1.2fr", gap: 16 }}>
        <Card titulo="Ventas — últimos 7 días">
          <BarChart data={semana.map((d, i) => ({ ...d, dia: i === semana.length-1 ? "Hoy" : ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date(d.dia).getDay()] }))} />
        </Card>
        <Card titulo="Top productos del mes">
          {top.length === 0
            ? <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Sin ventas registradas aún</p>
            : top.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--color-border-tertiary)", fontSize: 13 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{p.nombre}</span>
                <span style={{ fontWeight: 600, color: "#1D4ED8", whiteSpace: "nowrap" }}>{fmt(p.ingresos)}</span>
              </div>
            ))
          }
        </Card>
      </div>

      {/* ── Últimas ventas ────────────────────────────────────────────────── */}
      <Card titulo="Últimas ventas">
        {ultimas.length === 0
          ? <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Sin ventas registradas hoy</p>
          : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
                  {["Folio", "Hora", "Cliente", "Método", "Total"].map(h =>
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Total" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {ultimas.map(v => (
                    <tr key={v.folio} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{v.folio}</td>
                      <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{new Date(v.fecha_local).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "8px 12px" }}>{v.cliente_nombre}</td>
                      <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>{v.metodo_pago}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#60A5FA" }}>{fmt(v.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>
    </div>
  );
}

// ─── Módulo Inventario ────────────────────────────────────────────────────────
function Inventario({ onNuevoProducto, filtroStockBajoInicial = false }) {
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);
  const [fotoModal, setFotoModal] = useState(null); // producto seleccionado
  const [soloStockBajo, setSoloStockBajo] = useState(filtroStockBajoInicial);
  const [editando, setEditando] = useState(null); // producto que se está editando

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.productos(buscar ? `buscar=${encodeURIComponent(buscar)}` : "");
      setProductos(r.data || []);
    } catch {}
    setLoading(false);
  }, [buscar]);

  useEffect(() => { const t = setTimeout(cargar, 400); return () => clearTimeout(t); }, [cargar]);

  const productosVisibles = soloStockBajo ? productos.filter(p => p.stock_actual <= p.stock_minimo) : productos;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 200 }} placeholder="🔍 Buscar por nombre, medida o SKU..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        <button onClick={() => setSoloStockBajo(v => !v)} style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${soloStockBajo ? "#EF4444" : "var(--color-border-secondary)"}`, background: soloStockBajo ? "rgba(239,68,68,0.12)" : "none", color: soloStockBajo ? "#EF4444" : "var(--color-text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: soloStockBajo ? 700 : 400, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          ⚠ Stock bajo {soloStockBajo ? "✓" : ""}
        </button>
        <button onClick={onNuevoProducto} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Producto</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-tertiary)" }}>
                {["Foto", "Nombre", "Medida", "Marca", "Precio venta", "Stock", "Estado", ""].map(h =>
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {productosVisibles.length === 0
                ? <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>{soloStockBajo ? "No hay productos con stock bajo 🎉" : "No hay productos. ¡Agrega tu primer producto!"}</td></tr>
                : productosVisibles.map(p => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "8px 14px" }}>
                      <button onClick={() => setFotoModal(p)} style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-tertiary)", overflow: "hidden", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.foto_principal ? <img src={p.foto_principal} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, opacity: 0.4 }}>📷</span>}
                      </button>
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 500 }}>{p.nombre}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{p.medida || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>{p.marca || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1D4ED8" }}>{fmt(p.precio_venta)}</td>
                    <td style={{ padding: "10px 14px" }}>{p.stock_actual}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {p.stock_actual <= p.stock_minimo
                        ? <span style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>Stock bajo</span>
                        : <span style={{ background: "#D1FAE5", color: "#065F46", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>OK</span>}
                    </td>
                    <td style={{ padding: "8px 14px" }}>
                      <button onClick={() => setEditando(p)} style={{ padding: "5px 12px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>✏️ Editar</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {fotoModal && <ModalFotosProducto producto={fotoModal} onClose={() => setFotoModal(null)} onSaved={() => { setFotoModal(null); cargar(); }} />}
      {editando && <ModalProducto producto={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); cargar(); }} />}
    </div>
  );
}

// ─── Modal Fotos de Producto ──────────────────────────────────────────────────
// Convierte links de Google Drive (vista compartida) a formato de imagen directa.
// Si la URL no es de Drive, la regresa tal cual sin tocarla.
function normalizarUrlFoto(url) {
  const limpia = url.trim();
  const match = limpia.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return limpia;
}

function ModalFotosProducto({ producto, onClose, onSaved }) {
  const [url, setUrl] = useState("");
  const [mostrarUrl, setMostrarUrl] = useState(false);
  const [fotos, setFotos] = useState(producto.fotos || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const subirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (archivo.size > 5 * 1024 * 1024) { setError("La foto no debe pesar más de 5MB"); return; }
    setLoading(true); setError("");
    try {
      const nueva = await api.subirFotoProducto(producto.id, archivo);
      setFotos(p => [...p, nueva]);
    } catch (e) { setError(e.message || "Error al subir la foto"); } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const agregarPorUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setError("");
    try {
      const urlFinal = normalizarUrlFoto(url);
      const nueva = await api.agregarFotoProducto(producto.id, { url: urlFinal, es_principal: fotos.length === 0 });
      setFotos(p => [...p, nueva]);
      setUrl("");
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const eliminar = async (fotoId) => {
    try { await api.eliminarFotoProducto(fotoId); setFotos(p => p.filter(f => f.id !== fotoId)); } catch {}
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📷 Fotos de {producto.nombre}</h2>
          <button onClick={() => { onSaved(); onClose(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={subirArchivo} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={loading}
          style={{ width: "100%", padding: "14px", border: "2px dashed var(--color-border-secondary)", borderRadius: 10, background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>
          {loading ? "Subiendo..." : "📤 Subir foto desde el celular o computadora"}
        </button>

        <button onClick={() => setMostrarUrl(v => !v)} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", fontSize: 11, cursor: "pointer", marginBottom: 12, textDecoration: "underline" }}>
          {mostrarUrl ? "Ocultar opción de enlace externo" : "¿Prefieres pegar un enlace en su lugar?"}
        </button>

        {mostrarUrl && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
            <button onClick={agregarPorUrl} disabled={loading} style={{ padding: "8px 16px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Agregar</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {fotos.map(f => (
            <div key={f.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: f.es_principal ? "2px solid #1D4ED8" : "1px solid var(--color-border-secondary)", aspectRatio: "1" }}>
              <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => eliminar(f.id)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 4, width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>✕</button>
              {f.es_principal && <span style={{ position: "absolute", bottom: 2, left: 2, background: "#1D4ED8", color: "#fff", fontSize: 9, padding: "1px 4px", borderRadius: 4 }}>Principal</span>}
            </div>
          ))}
          {!fotos.length && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 20, color: "var(--color-text-secondary)", fontSize: 12 }}>Sin fotos aún</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Módulo Órdenes ───────────────────────────────────────────────────────────
function Ordenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.ordenes(filtro ? `estado=${filtro}` : "");
      setOrdenes(r.data || []);
    } catch {}
    setLoading(false);
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (id, estado) => {
    try { await api.cambiarEstadoOrden(id, estado); cargar(); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["", "Todas"], ["en_espera", "En espera"], ["en_proceso", "En proceso"], ["listo", "Listo"]].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            style={{ padding: "6px 14px", border: "1px solid var(--color-border-secondary)", borderRadius: 20, background: filtro === v ? "#1D4ED8" : "var(--color-background-secondary)", color: filtro === v ? "#fff" : "var(--color-text-primary)", fontSize: 12, cursor: "pointer", fontWeight: filtro === v ? 600 : 400 }}>
            {l}
          </button>
        ))}
        <button onClick={cargar} style={{ marginLeft: "auto", padding: "6px 14px", border: "1px solid var(--color-border-secondary)", borderRadius: 20, background: "var(--color-background-secondary)", fontSize: 12, cursor: "pointer", color: "#fff" }}>↻</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        ordenes.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay órdenes{filtro ? " con ese estado" : ""}.</div>
          : ordenes.map(o => (
            <div key={o.id} style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--color-border-tertiary)", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{o.folio}</span>
                    <Badge estado={o.estado} />
                  </div>
                  <div style={{ fontSize: 14 }}><strong>{o.cliente_nombre || "Sin cliente"}</strong> · {o.placa || "—"} · {o.marca || ""} {o.modelo || ""}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>Ingreso: {fmtFecha(o.fecha_ingreso)} · Técnico: {o.tecnico_nombre || "Sin asignar"}</div>
                  {o.observaciones && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>{o.observaciones}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1D4ED8" }}>{fmt(o.total)}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {o.estado === "en_espera" && <button onClick={() => cambiarEstado(o.id, "en_proceso")} style={{ padding: "5px 12px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>Iniciar</button>}
                    {o.estado === "en_proceso" && <button onClick={() => cambiarEstado(o.id, "listo")} style={{ padding: "5px 12px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>Marcar listo</button>}
                    {o.estado === "listo" && <button onClick={() => cambiarEstado(o.id, "entregado")} style={{ padding: "5px 12px", background: "#065F46", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Entregar</button>}
                  </div>
                </div>
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ─── Módulo Lotes: Recepción (clasificación por medida) ───────────────────────
const sugerirFolio = (fechaISO) => {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-");
  return `LOTE${d}${m}${y.slice(2)}`;
};

function RecepcionLotes() {
  const [lotes, setLotes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { tipo: 'nuevo' } | { tipo: 'clasificar', lote }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [l, p] = await Promise.all([api.lotes(), api.productos()]);
      setLotes(l.data || []);
      setProductos((p.data || []).filter(x => !x.es_servicio));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>
        Registra el lote que llega (folio, proveedor y cantidad total física) y clasifícalo por medida/producto. Cada línea clasificada suma de inmediato al almacén. Si después de revisar calidad hay piezas para regresar, usa "Devolución de lotes" con el mismo folio.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setModal({ tipo: "nuevo" })} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nuevo lote</button>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        lotes.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay lotes registrados todavía.</div>
          : lotes.map(l => (
            <div key={l.id} style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--color-border-tertiary)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{l.folio}</div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginTop: 3 }}>{l.proveedor_nombre || l.proveedor_catalogo_nombre || "Sin proveedor"}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Recibido: {fmtFecha(l.fecha_recepcion)}</div>
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Total lote</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{parseFloat(l.cantidad_total)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Clasificado</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#059669" }}>{parseFloat(l.total_clasificado)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Devuelto</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: parseFloat(l.cantidad_defectuosa) > 0 ? "#B91C1C" : "var(--color-text-primary)" }}>{parseFloat(l.cantidad_defectuosa)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Pendiente</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: l.total_pendiente > 0 ? "#D97706" : "var(--color-text-primary)" }}>{l.total_pendiente}</div>
                </div>
                <button onClick={() => setModal({ tipo: "clasificar", lote: l })} style={{ padding: "7px 14px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Clasificar</button>
              </div>
            </div>
          ))
      }

      {modal?.tipo === "nuevo" && <ModalNuevoLote productos={productos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />}
      {modal?.tipo === "clasificar" && <ModalClasificarLote lote={modal.lote} productos={productos} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />}
    </div>
  );
}

function LineasClasificacion({ items, setItems, productos }) {
  const addItem = () => setItems(p => [...p, { producto_id: "", cantidad: "" }]);
  const upd = (idx, k, v) => setItems(p => { const a = [...p]; a[idx] = { ...a[idx], [k]: v }; return a; });
  const total = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Clasificación por medida / producto</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: 6, marginBottom: 6, fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600 }}>
        <div>Producto / medida</div><div>Cantidad</div><div></div>
      </div>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: 6, marginBottom: 8 }}>
          <select style={inputStyle} value={item.producto_id} onChange={e => upd(idx, "producto_id", e.target.value)}>
            <option value="">— Seleccionar producto/medida —</option>
            {(productos || []).map(p => <option key={p.id} value={p.id}>{p.nombre}{p.medida ? ` (${p.medida})` : ""}</option>)}
          </select>
          <input type="number" min={0} style={inputStyle} placeholder="Cantidad" value={item.cantidad} onChange={e => upd(idx, "cantidad", e.target.value)} />
          <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1} style={{ background: "#FEE2E2", border: "none", borderRadius: 8, cursor: "pointer", color: "#B91C1C", fontSize: 14 }}>✕</button>
        </div>
      ))}
      <button onClick={addItem} style={{ width: "100%", padding: "7px", border: "1px dashed #93C5FD", borderRadius: 8, background: "none", color: "#1D4ED8", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>+ Agregar otra medida</button>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right", marginBottom: 16 }}>Total clasificado en esta captura: <strong style={{ color: "#059669" }}>{total}</strong></div>
    </div>
  );
}

function ModalNuevoLote({ productos, onClose, onSaved }) {
  const [form, setForm] = useState({ folio: "", proveedor_nombre: "", fecha_recepcion: hoyISO(), cantidad_total: "", notas: "" });
  const [folioTocado, setFolioTocado] = useState(false);
  const [items, setItems] = useState([{ producto_id: "", cantidad: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!folioTocado) setForm(p => ({ ...p, folio: sugerirFolio(p.fecha_recepcion) }));
  }, [form.fecha_recepcion, folioTocado]);

  const guardar = async () => {
    if (!form.folio.trim()) return setError("El folio del lote es obligatorio (ej. LOTE150626)");
    if (!form.cantidad_total || parseFloat(form.cantidad_total) <= 0) return setError("Indica la cantidad total que llegó físicamente en el lote");
    const validItems = items.filter(i => i.producto_id && parseFloat(i.cantidad) > 0);
    setLoading(true); setError("");
    try {
      await api.crearLote({
        ...form,
        cantidad_total: parseFloat(form.cantidad_total),
        items: validItems.map(i => ({ producto_id: i.producto_id, cantidad: parseFloat(i.cantidad) })),
      });
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 700 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>📥 Nuevo lote de llantas</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={labelStyle}>Folio del lote *</label><input style={inputStyle} placeholder="LOTE150626" value={form.folio} onChange={e => { setFolioTocado(true); setForm(p => ({ ...p, folio: e.target.value })); }} /></div>
          <div><label style={labelStyle}>Fecha de recepción *</label><input type="date" style={inputStyle} value={form.fecha_recepcion} onChange={e => setForm(p => ({ ...p, fecha_recepcion: e.target.value }))} /></div>
          <div><label style={labelStyle}>Proveedor</label><input style={inputStyle} placeholder="Nombre del proveedor" value={form.proveedor_nombre} onChange={e => setForm(p => ({ ...p, proveedor_nombre: e.target.value }))} /></div>
          <div><label style={labelStyle}>Cantidad total recibida *</label><input type="number" min={0} style={inputStyle} placeholder="Ej. 72" value={form.cantidad_total} onChange={e => setForm(p => ({ ...p, cantidad_total: e.target.value }))} /></div>
        </div>
        <div><label style={labelStyle}>Notas</label><input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Observaciones del lote..." value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>

        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 12 }}>Puedes clasificar ahora mismo o dejarlo para después con el botón "+ Clasificar" en la lista.</p>
        <LineasClasificacion items={items} setItems={setItems} productos={productos} />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar lote"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalClasificarLote({ lote, productos, onClose, onSaved }) {
  const [items, setItems] = useState([{ producto_id: "", cantidad: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    const validItems = items.filter(i => i.producto_id && parseFloat(i.cantidad) > 0);
    if (!validItems.length) return setError("Agrega al menos una línea con producto/medida y cantidad");
    setLoading(true); setError("");
    try {
      await api.clasificarLote(lote.id, { items: validItems.map(i => ({ producto_id: i.producto_id, cantidad: parseFloat(i.cantidad) })) });
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>📦 Clasificar lote {lote.folio}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>
          Total del lote: {parseFloat(lote.cantidad_total)} · Ya clasificado: {parseFloat(lote.total_clasificado)} · Pendiente: {lote.total_pendiente}
        </p>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <LineasClasificacion items={items} setItems={setItems} productos={productos} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Agregar clasificación"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Módulo Lotes: Devolución (solo cantidad total + motivo, sin medida) ──────
function DevolucionLotes() {
  const [devoluciones, setDevoluciones] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([api.devolucionesLotes(), api.lotes()]);
      setDevoluciones(d.data || []);
      setLotes(l.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>
        Registra aquí las piezas que se regresan al proveedor después de revisar calidad — solo cantidad total y motivo, sin desglose por medida. No afecta el inventario (esas piezas nunca llegaron a clasificarse).
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setModal(true)} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva devolución</button>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        devoluciones.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay devoluciones registradas todavía.</div>
          : (
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
                  {["Lote", "Proveedor", "Fecha devolución", "Cantidad", "Motivo"].map(h =>
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {devoluciones.map(d => (
                    <tr key={d.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.folio}</td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{d.proveedor_nombre || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{fmtFecha(d.fecha_devolucion)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#B91C1C" }}>{parseFloat(d.cantidad)}</td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{d.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      {modal && <ModalNuevaDevolucion lotes={lotes} onClose={() => setModal(false)} onSaved={() => { setModal(false); cargar(); }} />}
    </div>
  );
}

function ModalNuevaDevolucion({ lotes, onClose, onSaved }) {
  const [loteId, setLoteId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loteSeleccionado = lotes.find(l => l.id === loteId);

  const guardar = async () => {
    if (!loteId) return setError("Selecciona a qué lote pertenece esta devolución");
    if (!cantidad || parseFloat(cantidad) <= 0) return setError("La cantidad devuelta debe ser mayor a 0");
    if (!motivo.trim()) return setError("Indica el motivo de la devolución");
    setLoading(true); setError("");
    try {
      await api.devolverLote(loteId, { cantidad: parseFloat(cantidad), motivo: motivo.trim(), fecha_devolucion: fecha });
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>↩️ Nueva devolución de lote</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Lote *</label>
          <select style={inputStyle} value={loteId} onChange={e => setLoteId(e.target.value)}>
            <option value="">— Seleccionar lote —</option>
            {lotes.map(l => <option key={l.id} value={l.id}>{l.folio} · {l.proveedor_nombre || "Sin proveedor"} ({fmtFecha(l.fecha_recepcion)})</option>)}
          </select>
          {loteSeleccionado && (
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
              Pendiente sin clasificar/devolver en este lote: <strong>{loteSeleccionado.total_pendiente}</strong>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 12 }}><label style={labelStyle}>Cantidad devuelta *</label><input type="number" min={0} style={inputStyle} placeholder="Ej. 20" value={cantidad} onChange={e => setCantidad(e.target.value)} /></div>
        <div style={{ marginBottom: 16 }}><label style={labelStyle}>Motivo de la devolución *</label><input style={inputStyle} placeholder='Ej. "doble golpe y seccionadas"' value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
        <div style={{ marginBottom: 16 }}><label style={labelStyle}>Fecha de devolución</label><input type="date" style={inputStyle} value={fecha} onChange={e => setFecha(e.target.value)} /></div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Registrar devolución"}</button>
        </div>
      </div>
    </div>
  );
}


// ─── Movimientos de inventario ───────────────────────────────────────────────
function MovimientosInventario() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [tipo, setTipo] = useState("");

  const cargar = useCallback(() => {
    setLoading(true);
    const p = [`desde=${desde}`, `hasta=${hasta}`, tipo ? `tipo=${tipo}` : ""].filter(Boolean).join("&");
    api.movimientos(p).then(r => { setData(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [desde, hasta, tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  const TIPO_INFO = {
    entrada:  { label: "Entrada",   color: "#059669", bg: "#D1FAE5" },
    salida:   { label: "Salida",    color: "#B91C1C", bg: "#FEE2E2" },
    ajuste:   { label: "Ajuste",    color: "#D97706", bg: "#FEF3C7" },
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div><label style={labelStyle}>Del</label><input type="date" style={{ ...inputStyle, width: 155 }} value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div><label style={labelStyle}>Al</label><input type="date" style={{ ...inputStyle, width: 155 }} value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        <div>
          <label style={labelStyle}>Tipo</label>
          <select style={{ ...inputStyle, width: 130 }} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>
        <button onClick={cargar} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#fff" }}>↻ Actualizar</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Fecha/Hora", "Producto", "Tipo", "Cantidad", "Stock antes", "Stock después", "Referencia", "Usuario"].map(h =>
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.length === 0
                ? <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin movimientos en este rango</td></tr>
                : data.map(m => {
                  const info = TIPO_INFO[m.tipo] || { label: m.tipo, color: "var(--color-text-primary)", bg: "transparent" };
                  return (
                    <tr key={m.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "var(--color-text-secondary)" }}>{fmtFecha(m.created_at)} {new Date(m.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "9px 12px" }}><div style={{ fontWeight: 600 }}>{m.producto_nombre}</div>{m.producto_medida && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{m.producto_medida}</div>}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{info.label}</span></td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: m.tipo === "entrada" ? "#059669" : m.tipo === "salida" ? "#B91C1C" : "var(--color-text-primary)" }}>{m.tipo === "salida" ? "-" : "+"}{parseFloat(m.cantidad)}</td>
                      <td style={{ padding: "9px 12px", color: "var(--color-text-secondary)" }}>{parseFloat(m.stock_antes)}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{parseFloat(m.stock_despues)}</td>
                      <td style={{ padding: "9px 12px", color: "var(--color-text-secondary)", fontSize: 11 }}>{m.referencia_tipo || "—"}{m.notas ? ` · ${m.notas.slice(0, 30)}` : ""}</td>
                      <td style={{ padding: "9px 12px", color: "var(--color-text-secondary)" }}>{m.usuario_nombre || "—"}</td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Cortes de caja ───────────────────────────────────────────────────────────
// Función de generación de PDF del corte (HTML imprimible en ventana nueva)
const generarPDFCorte = async (corteId) => {
  try {
    const d = await api.corteDetalle(corteId);
    const fmtH = (ts) => ts ? new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";
    const fmtD = (ts) => ts ? new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) : "—";
    const diff = parseFloat(d.diferencia || 0);
    const diffColor = diff === 0 ? "#059669" : diff > 0 ? "#1D4ED8" : "#B91C1C";
    const diffLabel = diff === 0 ? "Exacto ✓" : diff > 0 ? `Sobrante: $${Math.abs(diff).toFixed(2)}` : `Faltante: $${Math.abs(diff).toFixed(2)}`;
    const rv = d.resumen_ventas || {};
    const rg = d.resumen_gastos  || {};
    const gastosEfectivo = parseFloat(rg.gastos_efectivo || 0);
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Corte de Caja ${d.fecha_apertura ? fmtD(d.fecha_apertura) : ""}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 24px; max-width: 680px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 16px; }
  .logo { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; }
  .logo-placeholder { width: 56px; height: 56px; border-radius: 8px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .negocio-nombre { font-size: 18px; font-weight: 700; }
  .negocio-info { font-size: 11px; color: #555; margin-top: 3px; }
  h1 { font-size: 15px; font-weight: 700; text-align: center; background: #111; color: #fff; padding: 8px; margin-bottom: 16px; letter-spacing: 0.05em; }
  .fila { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
  .fila strong { font-weight: 600; }
  .fila.neg strong { color: #B91C1C; }
  .seccion { background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px; }
  .seccion h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #555; margin-bottom: 8px; }
  .resultado { font-size: 16px; font-weight: 800; color: ${diffColor}; text-align: right; padding: 10px 16px; border: 2px solid ${diffColor}; border-radius: 8px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { background: #f0f0f0; text-align: left; padding: 5px 8px; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #777; text-align: center; }
  @media print { body { padding: 12px; } button { display: none !important; } }
</style></head><body>
<div class="header">
  ${d.logo_url ? `<img src="${d.logo_url}" class="logo" alt="logo">` : `<div class="logo-placeholder">🛞</div>`}
  <div>
    <div class="negocio-nombre">${d.negocio_nombre || "Negocio"}</div>
    <div class="negocio-info">${[d.negocio_direccion, d.negocio_telefono, d.negocio_facebook].filter(Boolean).join(" · ")}</div>
  </div>
</div>

<h1>CORTE DE CAJA</h1>

<div class="seccion">
  <h2>Información del turno</h2>
  <div class="fila"><span>Cajero</span><strong>${d.usuario_nombre || "—"}</strong></div>
  <div class="fila"><span>Fecha</span><strong>${fmtD(d.fecha_apertura)}</strong></div>
  <div class="fila"><span>Apertura</span><strong>${fmtH(d.fecha_apertura)}</strong></div>
  <div class="fila"><span>Cierre</span><strong>${fmtH(d.fecha_cierre)}</strong></div>
  ${d.notas ? `<div class="fila"><span>Notas</span><strong>${d.notas}</strong></div>` : ""}
</div>

<div class="seccion">
  <h2>Ventas del turno</h2>
  <div class="fila"><span># Transacciones</span><strong>${rv.num_ventas || 0}</strong></div>
  <div class="fila"><span>Total ventas</span><strong>$${parseFloat(rv.total_ventas||0).toFixed(2)}</strong></div>
  <div class="fila"><span>· Efectivo</span><strong>$${parseFloat(rv.efectivo||0).toFixed(2)}</strong></div>
  <div class="fila"><span>· Tarjeta</span><strong>$${parseFloat(rv.tarjeta||0).toFixed(2)}</strong></div>
  <div class="fila"><span>· Transferencia</span><strong>$${parseFloat(rv.transferencia||0).toFixed(2)}</strong></div>
  ${parseFloat(rv.total_descuentos||0) > 0 ? `<div class="fila"><span>Descuentos aplicados</span><strong>-$${parseFloat(rv.total_descuentos).toFixed(2)}</strong></div>` : ""}
</div>

${(rg.detalle||[]).length > 0 ? `
<div class="seccion">
  <h2>Gastos del turno</h2>
  ${(rg.detalle||[]).map(g => `<div class="fila${g.metodo_pago==='efectivo'?' neg':''}">
    <span>${g.categoria} — ${g.descripcion}</span>
    <strong>-$${parseFloat(g.monto).toFixed(2)} ${g.metodo_pago==='efectivo'?'(efectivo)':''}</strong>
  </div>`).join("")}
  <div class="fila" style="margin-top:6px;font-weight:700"><span>Total gastos efectivo</span><strong style="color:#B91C1C">-$${gastosEfectivo.toFixed(2)}</strong></div>
</div>` : ""}

<div class="seccion">
  <h2>Arqueo de caja (efectivo físico)</h2>
  <div class="fila"><span>Fondo inicial</span><strong>$${parseFloat(d.monto_inicial||0).toFixed(2)}</strong></div>
  <div class="fila"><span>+ Ventas en efectivo</span><strong>$${parseFloat(rv.efectivo||0).toFixed(2)}</strong></div>
  ${gastosEfectivo > 0 ? `<div class="fila neg"><span>− Gastos en efectivo</span><strong>-$${gastosEfectivo.toFixed(2)}</strong></div>` : ""}
  <div class="fila" style="font-weight:700;margin-top:4px;padding-top:4px;border-top:2px solid #ccc"><span>= Efectivo esperado</span><strong>$${parseFloat(d.monto_esperado||0).toFixed(2)}</strong></div>
  <div class="fila"><span>Efectivo contado</span><strong>$${parseFloat(d.monto_final_contado||0).toFixed(2)}</strong></div>
</div>

<div class="resultado">${diffLabel}</div>

${(d.productos_turno || []).length > 0 ? `
<div class="seccion">
  <h2>Productos vendidos en el turno</h2>
  <table><thead><tr><th>Producto</th><th>Medida</th><th style="text-align:right">Cant.</th><th style="text-align:right">Total</th></tr></thead><tbody>
  ${(d.productos_turno || []).map(p => `<tr>
    <td style="font-weight:600">${p.nombre}</td>
    <td style="color:#555">${p.medida || '—'}</td>
    <td style="text-align:right">${parseFloat(p.cantidad)}</td>
    <td style="text-align:right;font-weight:600">$${parseFloat(p.total).toFixed(2)}</td>
  </tr>`).join("")}
  </tbody>
  <tfoot><tr style="border-top:2px solid #ccc;font-weight:700">
    <td colspan="2">TOTAL</td>
    <td style="text-align:right">${(d.productos_turno||[]).reduce((s,p)=>s+parseFloat(p.cantidad),0)}</td>
    <td style="text-align:right">$${parseFloat(d.resumen_ventas?.total_ventas||0).toFixed(2)}</td>
  </tr></tfoot>
  </table>
</div>` : ""}

<div style="text-align:center;margin:16px 0">
  <button onclick="window.print()" style="padding:10px 28px;background:#111;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">🖨 Imprimir / Guardar PDF</button>
</div>

<div class="footer">
  Generado el ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} ·
  ${d.negocio_nombre || ""}
</div>
</body></html>`;

    const ventana = window.open("", "_blank", "width=720,height=900");
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
  } catch (e) {
    alert("Error al generar el PDF: " + e.message);
  }
};

function CortesCaja() {
  const [corteActual, setCorteActual] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("principal");
  const [montoInicial, setMontoInicial] = useState("");
  const [montoCierre, setMontoCierre] = useState("");
  const [notasCierre, setNotasCierre] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [ultimoCorteId, setUltimoCorteId] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [actual, hist] = await Promise.all([api.corteActual(), api.cortesHistorial()]);
      setCorteActual(actual.corte || null);
      setHistorial(hist.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = async () => {
    setProcesando(true); setError("");
    try {
      const r = await api.abrirCorte({ monto_inicial: parseFloat(montoInicial) || 0 });
      setMsg(r.mensaje); setCorteActual(r.corte); setVista("principal"); setMontoInicial(""); cargar();
    } catch (e) { setError(e.message); } finally { setProcesando(false); }
  };

  const cerrar = async () => {
    if (!montoCierre) return setError("Ingresa el monto que contaste físicamente en caja");
    setProcesando(true); setError("");
    try {
      const r = await api.cerrarCorte({ monto_final_contado: parseFloat(montoCierre), notas: notasCierre || null });
      setMsg(r.mensaje);
      setUltimoCorteId(corteActual?.id || null);
      setCorteActual(null); setVista("principal"); setMontoCierre(""); setNotasCierre(""); cargar();
    } catch (e) { setError(e.message); } finally { setProcesando(false); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 680 }}>
      {msg && (
        <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span>{msg}</span>
          {ultimoCorteId && (
            <button onClick={() => generarPDFCorte(ultimoCorteId)} style={{ padding: "7px 16px", background: "#065F46", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📄 Descargar PDF del cierre
            </button>
          )}
        </div>
      )}
      {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {vista === "principal" && (
        <>
          <div style={{ background: corteActual ? "rgba(5,150,105,0.08)" : "var(--color-background-secondary)", borderRadius: 14, border: `1px solid ${corteActual ? "#059669" : "var(--color-border-tertiary)"}`, padding: 20, marginBottom: 20 }}>
            {corteActual ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div><div style={{ fontWeight: 700, fontSize: 16 }}>🟢 Caja abierta</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Desde {fmtFecha(corteActual.fecha_apertura)} a las {new Date(corteActual.fecha_apertura).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div></div>
                  <button onClick={() => { setVista("cerrar"); setError(""); }} style={{ padding: "9px 18px", background: "#B91C1C", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cerrar caja</button>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Fondo inicial</div><div style={{ fontWeight: 700, fontSize: 17 }}>{fmt(corteActual.monto_inicial)}</div></div>
                  <div><div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Responsable</div><div style={{ fontWeight: 600 }}>{corteActual.usuario_nombre}</div></div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 700, fontSize: 16 }}>⚪ Caja cerrada</div><div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Abre caja para empezar a registrar ventas del turno</div></div>
                <button onClick={() => { setVista("abrir"); setError(""); }} style={{ padding: "9px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Abrir caja</button>
              </div>
            )}
          </div>

          <div style={{ fontWeight: 600, marginBottom: 10 }}>Historial de cortes</div>
          {historial.filter(c => c.estado === "cerrado").length === 0
            ? <p style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Sin cortes registrados.</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {historial.filter(c => c.estado === "cerrado").map(c => (
                  <div key={c.id} style={{ background: "var(--color-background-secondary)", borderRadius: 10, border: "1px solid var(--color-border-tertiary)", padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{fmtFecha(c.fecha_apertura)}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{new Date(c.fecha_apertura).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} — {c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                      <div><div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Ventas</div><div style={{ fontWeight: 600 }}>{fmt(c.total_ventas || 0)}</div></div>
                      <div><div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Contado</div><div style={{ fontWeight: 600 }}>{fmt(c.monto_final_contado || 0)}</div></div>
                      <div><div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Diferencia</div><div style={{ fontWeight: 700, color: parseFloat(c.diferencia||0) === 0 ? "#059669" : parseFloat(c.diferencia||0) > 0 ? "#1D4ED8" : "#B91C1C" }}>{parseFloat(c.diferencia||0) >= 0 ? "+" : ""}{fmt(c.diferencia||0)}</div></div>
                      <button onClick={() => generarPDFCorte(c.id)} style={{ padding: "6px 14px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>📄 PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}

      {vista === "abrir" && (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Abrir caja</h3>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Fondo inicial en efectivo (dinero que hay en caja al inicio)</label><input type="number" min={0} style={inputStyle} placeholder="$0.00" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setVista("principal"); setError(""); }} style={{ padding: "9px 18px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
            <button onClick={abrir} disabled={procesando} style={{ padding: "9px 24px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{procesando ? "Abriendo..." : "Abrir caja"}</button>
          </div>
        </div>
      )}

      {vista === "cerrar" && (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", padding: 24 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Cierre de caja</h3>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>Cuenta el efectivo físico que hay en la caja y escribe la cantidad. El sistema calculará si cuadra con las ventas del turno.</p>
          <div style={{ marginBottom: 12 }}><label style={labelStyle}>Efectivo contado físicamente en caja *</label><input type="number" min={0} style={inputStyle} placeholder="$0.00" value={montoCierre} onChange={e => setMontoCierre(e.target.value)} autoFocus /></div>
          <div style={{ marginBottom: 16 }}><label style={labelStyle}>Notas (opcional)</label><input style={inputStyle} placeholder="Observaciones del cierre..." value={notasCierre} onChange={e => setNotasCierre(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setVista("principal"); setError(""); }} style={{ padding: "9px 18px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
            <button onClick={cerrar} disabled={procesando} style={{ padding: "9px 24px", background: "#B91C1C", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{procesando ? "Cerrando..." : "Cerrar caja"}</button>
          </div>
        </div>
      )}
    </div>
  );
}


function Catalogos() {
  const [tab, setTab] = useState("categorias");
  const [cats, setCats] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: "", tipo: "" });
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([api.categorias(), api.marcas()]);
      setCats(c.data || []); setMarcas(m.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const TIPOS = [
    { value: "llanta",      label: "Llanta" },
    { value: "refaccion",   label: "Refacción" },
    { value: "consumible",  label: "Consumible" },
    { value: "servicio",    label: "Servicio" },
  ];

  const guardarCategoria = async () => {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    setGuardando(true); setError("");
    try {
      if (editandoId) await api.actualizarCategoria(editandoId, { nombre: form.nombre, tipo: form.tipo || null });
      else await api.crearCategoria({ nombre: form.nombre, tipo: form.tipo || null });
      setForm({ nombre: "", tipo: "" }); setEditandoId(null); cargar();
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  const guardarMarca = async () => {
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    setGuardando(true); setError("");
    try {
      await api.crearMarca({ nombre: form.nombre });
      setForm({ nombre: "", tipo: "" }); cargar();
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  const eliminarCat = async (id) => {
    if (!window.confirm("¿Eliminar esta categoría?")) return;
    try { await api.eliminarCategoria(id); cargar(); } catch (e) { setError(e.message); }
  };

  const eliminarMarca = async (id) => {
    if (!window.confirm("¿Eliminar esta marca?")) return;
    try { await api.eliminarMarca(id); cargar(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "var(--color-background-secondary)", borderRadius: 10, padding: 6, border: "1px solid var(--color-border-tertiary)", width: "fit-content" }}>
        {[["categorias", "📁 Categorías"], ["marcas", "🏷️ Marcas"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setForm({ nombre: "", tipo: "" }); setEditandoId(null); setError(""); }} style={{ padding: "8px 18px", background: tab === id ? "#1D4ED8" : "none", color: tab === id ? "#fff" : "var(--color-text-secondary)", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400 }}>{label}</button>
        ))}
      </div>

      {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === "categorias" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "flex-start" }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
            {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Cargando...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
                  {["Categoría", "Tipo", "Productos", ""].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {cats.length === 0 ? <tr><td colSpan={4} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin categorías — agrega la primera</td></tr>
                    : cats.map(c => (
                      <tr key={c.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.nombre}</td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", textTransform: "capitalize" }}>{c.tipo || "—"}</td>
                        <td style={{ padding: "10px 14px" }}>{c.num_productos}</td>
                        <td style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                          <button onClick={() => { setEditandoId(c.id); setForm({ nombre: c.nombre, tipo: c.tipo || "" }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#1D4ED8" }}>✏️</button>
                          <button onClick={() => eliminarCat(c.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#B91C1C" }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{editandoId ? "Editar categoría" : "Nueva categoría"}</div>
            <div style={{ marginBottom: 10 }}><label style={labelStyle}>Nombre *</label><input style={inputStyle} placeholder="Ej: Seminueva, Servicio..." value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="">— Sin tipo —</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {editandoId && <button onClick={() => { setEditandoId(null); setForm({ nombre: "", tipo: "" }); }} style={{ flex: 1, padding: "8px", border: "1px solid var(--color-border-secondary)", borderRadius: 7, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>}
              <button onClick={guardarCategoria} disabled={guardando} style={{ flex: 1, padding: "8px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{guardando ? "..." : editandoId ? "Guardar" : "Agregar"}</button>
            </div>
          </div>
        </div>
      )}

      {tab === "marcas" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "flex-start" }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
            {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Cargando...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
                  {["Marca", "En productos", ""].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {marcas.length === 0 ? <tr><td colSpan={3} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin marcas</td></tr>
                    : marcas.map(m => (
                      <tr key={m.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600 }}>{m.nombre}</td>
                        <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{m.num_productos}</td>
                        <td style={{ padding: "10px 14px" }}><button onClick={() => eliminarMarca(m.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#B91C1C" }}>🗑</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Nueva marca</div>
            <div style={{ marginBottom: 12 }}><label style={labelStyle}>Nombre *</label><input style={inputStyle} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <button onClick={guardarMarca} disabled={guardando} style={{ width: "100%", padding: "8px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{guardando ? "..." : "Agregar marca"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Crédito / Cuentas por cobrar (módulo independiente) ─────────────────────
// PENDIENTE: integrar "Cobrar a crédito" en el POS. Por ahora se registra aquí.
function CreditoVentas() {
  const [cuentas, setCuentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("pendientes");
  const [modal, setModal] = useState(null); // { tipo: 'nueva' } | { tipo: 'pago', cuenta }
  const [error, setError] = useState("");
  const [form, setForm] = useState({ cliente_id: "", total: "", descripcion: "", vencimiento: "", notas: "" });
  const [formPago, setFormPago] = useState({ monto: "", metodo_pago: "efectivo", notas: "" });
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const estado = filtro === "todas" ? "todas" : filtro;
      const [c, cl] = await Promise.all([api.cuentasCredito(estado !== "todas" ? `estado=${estado}` : "estado=todas"), api.clientes()]);
      setCuentas(c.data || []); setClientes(cl.data || []);
    } catch {} finally { setLoading(false); }
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const crearCuenta = async () => {
    if (!form.total || parseFloat(form.total) <= 0) return setError("El total debe ser mayor a 0");
    setProcesando(true); setError("");
    try { await api.crearCuentaCredito(form); setModal(null); setForm({ cliente_id: "", total: "", descripcion: "", vencimiento: "", notas: "" }); cargar(); }
    catch (e) { setError(e.message); } finally { setProcesando(false); }
  };

  const registrarPago = async () => {
    if (!formPago.monto || parseFloat(formPago.monto) <= 0) return setError("El monto debe ser mayor a 0");
    setProcesando(true); setError("");
    try { await api.registrarPagoCredito(modal.cuenta.id, formPago); setModal(null); setFormPago({ monto: "", metodo_pago: "efectivo", notas: "" }); cargar(); }
    catch (e) { setError(e.message); } finally { setProcesando(false); }
  };

  const ESTADO_INFO = {
    pendiente: { label: "Pendiente", bg: "#FEF3C7", color: "#92400E" },
    parcial:   { label: "Parcial",   bg: "#DBEAFE", color: "#1E40AF" },
    pagada:    { label: "Liquidada", bg: "#D1FAE5", color: "#065F46" },
  };

  const totalPendiente = cuentas.filter(c => ["pendiente","parcial"].includes(c.estado)).reduce((s, c) => s + parseFloat(c.saldo||0), 0);

  return (
    <div>
      <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400E" }}>
        ⚠ <strong>Módulo pendiente de integración al POS.</strong> Por ahora las ventas a crédito se registran manualmente desde aquí. La integración con el botón "Cobrar" en Ventas estará disponible próximamente.
      </div>
      {totalPendiente > 0 && (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Total pendiente de cobrar</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#F59E0B" }}>{fmt(totalPendiente)}</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["pendientes","Pendientes"],["todas","Todas"],["pagada","Liquidadas"]].map(([val, label]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${filtro === val ? "#1D4ED8" : "var(--color-border-secondary)"}`, background: filtro === val ? "#1D4ED8" : "none", color: filtro === val ? "#fff" : "var(--color-text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: filtro === val ? 700 : 400 }}>{label}</button>
          ))}
        </div>
        <button onClick={() => { setModal({ tipo: "nueva" }); setError(""); }} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva venta a crédito</button>
      </div>

      {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Folio","Cliente","Descripción","Total","Saldo","Vence","Estado",""].map(h =>
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {cuentas.length === 0 ? <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin cuentas en este filtro.</td></tr>
                : cuentas.map(c => {
                  const info = ESTADO_INFO[c.estado] || ESTADO_INFO.pendiente;
                  const vencida = c.vencimiento && new Date(c.vencimiento) < new Date() && c.estado !== "pagada";
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--color-border-tertiary)", background: vencida ? "rgba(185,28,28,0.04)" : "none" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{c.folio}</td>
                      <td style={{ padding: "9px 12px" }}>{c.cliente_nombre || "—"}<div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{c.cliente_telefono || ""}</div></td>
                      <td style={{ padding: "9px 12px", color: "var(--color-text-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.descripcion || "—"}</td>
                      <td style={{ padding: "9px 12px" }}>{fmt(c.total)}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: parseFloat(c.saldo) > 0 ? "#F59E0B" : "#059669" }}>{fmt(c.saldo)}</td>
                      <td style={{ padding: "9px 12px", color: vencida ? "#B91C1C" : "var(--color-text-secondary)", fontWeight: vencida ? 700 : 400 }}>{c.vencimiento ? fmtFecha(c.vencimiento) : "—"}{vencida ? " ⚠" : ""}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{info.label}</span></td>
                      <td style={{ padding: "9px 12px" }}>
                        {c.estado !== "pagada" && <button onClick={() => { setModal({ tipo: "pago", cuenta: c }); setError(""); }} style={{ padding: "5px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Registrar pago</button>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.tipo === "nueva" && (
        <div style={overlayStyle}>
          <div style={{ ...modalBase, maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>💳 Nueva venta a crédito</h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
            </div>
            {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelStyle}>Cliente</label><select style={inputStyle} value={form.cliente_id} onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}><option value="">— Sin cliente —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
              <div><label style={labelStyle}>Total *</label><input type="number" min={0} style={inputStyle} placeholder="$0.00" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} /></div>
              <div><label style={labelStyle}>Descripción</label><input style={inputStyle} placeholder="Ej: 2 llantas 185/60/R14" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} /></div>
              <div><label style={labelStyle}>Fecha de vencimiento</label><input type="date" style={inputStyle} value={form.vencimiento} onChange={e => setForm(p => ({ ...p, vencimiento: e.target.value }))} /></div>
              <div><label style={labelStyle}>Notas</label><input style={inputStyle} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ padding: "9px 18px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
              <button onClick={crearCuenta} disabled={procesando} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{procesando ? "Guardando..." : "Crear cuenta"}</button>
            </div>
          </div>
        </div>
      )}

      {modal?.tipo === "pago" && (
        <div style={overlayStyle}>
          <div style={{ ...modalBase, maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Registrar pago</h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>{modal.cuenta.cliente_nombre || "Sin cliente"} · Saldo: <strong>{fmt(modal.cuenta.saldo)}</strong></p>
            {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelStyle}>Monto *</label><input type="number" min={0} style={inputStyle} placeholder={`Máx ${fmt(modal.cuenta.saldo)}`} value={formPago.monto} onChange={e => setFormPago(p => ({ ...p, monto: e.target.value }))} autoFocus /></div>
              <div><label style={labelStyle}>Método de pago</label><select style={inputStyle} value={formPago.metodo_pago} onChange={e => setFormPago(p => ({ ...p, metodo_pago: e.target.value }))}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select></div>
              <div><label style={labelStyle}>Notas</label><input style={inputStyle} value={formPago.notas} onChange={e => setFormPago(p => ({ ...p, notas: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ padding: "9px 18px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
              <button onClick={registrarPago} disabled={procesando} style={{ padding: "9px 24px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{procesando ? "Guardando..." : "Registrar pago"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Módulo Compras ───────────────────────────────────────────────────────────
function Compras({ onNuevaCompra }) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.compras().then(r => { setCompras(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={onNuevaCompra} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva compra</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        compras.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay compras registradas. ¡Registra tu primera compra!</div>
          : compras.map(c => (
            <div key={c.id} style={{ background: "var(--color-background-secondary)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--color-border-tertiary)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.folio}</div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: 13, marginTop: 3 }}>{c.proveedor_nombre || "Sin proveedor"}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Recibido: {fmtFecha(c.fecha_recepcion)} · {c.num_partidas || 0} productos</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D4ED8" }}>{fmt(c.total)}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{c.estado}</div>
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ─── Módulo Gastos ────────────────────────────────────────────────────────────
function Gastos({ onNuevoGasto }) {
  const [gastos, setGastos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const cargar = () => {
    api.gastos().then(r => { setGastos(r.data || []); setTotal(parseFloat(r.total_monto)||0); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { cargar(); }, []);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "10px 16px", border: "1px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Total gastos</span>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#DC2626" }}>{fmt(total)}</div>
        </div>
        <button onClick={onNuevoGasto} style={{ padding: "8px 18px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Registrar gasto</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        gastos.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay gastos registrados.</div>
          : gastos.map(g => (
            <div key={g.id} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--color-border-tertiary)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ background: "var(--color-background-tertiary)", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600, marginRight: 8 }}>{g.categoria_nombre}</span>
                <span style={{ fontSize: 13 }}>{g.descripcion}</span>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{fmtFecha(g.fecha)} · {g.metodo_pago}</div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", whiteSpace: "nowrap" }}>{fmt(g.monto)}</span>
            </div>
          ))
      }
    </div>
  );
}

// ─── Módulo Clientes ──────────────────────────────────────────────────────────
function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    api.clientes(buscar ? `buscar=${encodeURIComponent(buscar)}` : "")
      .then(r => { setClientes(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [buscar]);

  useEffect(() => { const t = setTimeout(cargar, 400); return () => clearTimeout(t); }, [cargar]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Buscar por nombre, teléfono o RFC..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        <button onClick={() => setModal(true)} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>+ Nuevo cliente</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        clientes.length === 0
          ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay clientes registrados aún.</div>
          : clientes.map(c => (
            <div key={c.id} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--color-border-tertiary)", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{c.telefono || "Sin teléfono"} · {c.num_vehiculos || 0} vehículo(s)</div>
              </div>
              {parseFloat(c.saldo_pendiente) > 0 && <span style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, alignSelf: "center" }}>Debe {fmt(c.saldo_pendiente)}</span>}
            </div>
          ))
      }
      {modal && <ModalCliente onClose={() => setModal(false)} onSaved={() => { setModal(false); cargar(); }} />}
    </div>
  );
}

function ModalCliente({ onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", rfc: "", direccion: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.crearCliente(form);
      onSaved();
    } catch (err) { setError(err.message || "Error al crear cliente"); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <form onSubmit={submit} style={{ ...modalBase, maxWidth: 400 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>👤 Nuevo cliente</h2>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input style={inputStyle} placeholder="Nombre completo *" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <input style={inputStyle} placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
          <input style={inputStyle} type="email" placeholder="Email (opcional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input style={inputStyle} placeholder="RFC (opcional)" value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value })} />
          <input style={inputStyle} placeholder="Dirección (opcional)" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: "9px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Crear cliente"}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Gestión de Usuarios (solo admin) ─────────────────────────────────────────
// ─── Módulo Reportes ──────────────────────────────────────────────────────────
// IMPORTANTE: usamos fecha LOCAL (no toISOString, que es UTC) porque México
// está detrás de UTC — usar UTC hace que después de ~6pm hora local el
// sistema ya piense que es "el día siguiente".
const fechaLocalISO = (date) => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const hoyISO = () => fechaLocalISO(new Date());
const haceDiasISO = (dias) => fechaLocalISO(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));

function FiltroFechas({ desde, hasta, setDesde, setHasta, agrupacion, setAgrupacion }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
      <div><label style={labelStyle}>Del</label><input type="date" style={{ ...inputStyle, width: isMobile ? 140 : 160 }} value={desde} onChange={e => setDesde(e.target.value)} /></div>
      <div><label style={labelStyle}>Al</label><input type="date" style={{ ...inputStyle, width: isMobile ? 140 : 160 }} value={hasta} onChange={e => setHasta(e.target.value)} /></div>
      {setAgrupacion && (
        <div><label style={labelStyle}>Agrupar por</label>
          <select style={{ ...inputStyle, width: 130 }} value={agrupacion} onChange={e => setAgrupacion(e.target.value)}>
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ReporteVentas() {
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [agrupacion, setAgrupacion] = useState("dia");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.reporteVentas(`desde=${desde}&hasta=${hasta}&agrupacion=${agrupacion}`)
      .then(r => { setData(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [desde, hasta, agrupacion]);

  const totalGeneral = data.reduce((s, d) => s + parseFloat(d.total || 0), 0);

  return (
    <div>
      <FiltroFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} agrupacion={agrupacion} setAgrupacion={setAgrupacion} />
      {!loading && !!data.length && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { label: "# Ventas",   valor: data.reduce((s,d)=>s+parseInt(d.cantidad||0),0), color: "var(--color-text-primary)", f: v => v },
            { label: "Total",      valor: totalGeneral,                                     color: "#60A5FA", f: fmt },
            { label: "Efectivo",   valor: data.reduce((s,d)=>s+parseFloat(d.efectivo||0),0), color: "#34D399", f: fmt },
            { label: "Tarjeta",    valor: data.reduce((s,d)=>s+parseFloat(d.tarjeta||0),0),  color: "#A78BFA", f: fmt },
            { label: "Transfer.",  valor: data.reduce((s,d)=>s+parseFloat(d.transferencia||0),0), color: "#FB923C", f: fmt },
          ].map(({ label, valor, color, f }) => (
            <div key={label} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--color-border-tertiary)", flex: 1, minWidth: 80 }}>
              <div style={{ fontSize: 9, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color }}>{f(valor)}</div>
            </div>
          ))}
        </div>
      )}
      {loading ? <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Periodo", "# Ventas", "Efectivo", "Tarjeta", "Transferencia", "Total"].map(h =>
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Periodo" ? "left" : "right", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(d => (
                <tr key={d.periodo} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "10px 14px" }}>{d.periodo}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{d.cantidad}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmt(d.efectivo)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmt(d.tarjeta)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmt(d.transferencia)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#1D4ED8" }}>{fmt(d.total)}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin ventas en este rango</td></tr>}
            </tbody>
            {!!data.length && <tfoot><tr style={{ borderTop: "2px solid var(--color-border-tertiary)" }}>
              <td colSpan={5} style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Total del periodo</td>
              <td style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right", color: "#1D4ED8" }}>{fmt(totalGeneral)}</td>
            </tr></tfoot>}
          </table>
        </div>
      )}
    </div>
  );
}

function ReporteProductoMasVendido() {
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.reporteProductoMasVendido(`desde=${desde}&hasta=${hasta}&limit=30`)
      .then(r => { setData(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [desde, hasta]);

  return (
    <div>
      <FiltroFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
      {loading ? <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["#", "Producto", "Medida", "Unidades vendidas", "Ingresos", "# Ventas"].map(h =>
                <th key={h} style={{ padding: "10px 14px", textAlign: (h === "Producto" || h === "Medida") ? "left" : "right", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{i + 1}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.nombre}</td>
                  <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{d.medida || "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{parseFloat(d.unidades_vendidas)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#1D4ED8" }}>{fmt(d.ingresos)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{d.num_ventas}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin ventas en este rango</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReporteCotizacionesPorVendedor() {
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.reporteCotizacionesVendedor(`desde=${desde}&hasta=${hasta}`)
      .then(r => { setData(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [desde, hasta]);

  return (
    <div>
      <FiltroFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
      {loading ? <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Vendedor", "Cotizaciones", "Monto cotizado", "Convertidas", "Monto convertido", "% Conversión"].map(h =>
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Vendedor" ? "left" : "right", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(d => (
                <tr key={d.vendedor_id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.vendedor_nombre}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{d.total_cotizaciones}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmt(d.monto_cotizado)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#059669" }}>{d.convertidas}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#1D4ED8" }}>{fmt(d.monto_convertido)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{d.tasa_conversion}%</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin cotizaciones en este rango</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReporteLlantasPorMes() {
  const [desde, setDesde] = useState(haceDiasISO(365));
  const [hasta, setHasta] = useState(hoyISO());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.reporteLlantasMes(`desde=${desde}&hasta=${hasta}`)
      .then(r => { setData(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, [desde, hasta]);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 12 }}>
        Basado en los lotes registrados en "Lotes → Recepción/Devolución" (no en compras a proveedor).
      </p>
      <FiltroFechas desde={desde} hasta={hasta} setDesde={setDesde} setHasta={setHasta} />
      {loading ? <div style={{ textAlign: "center", padding: 30, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Mes", "# Lotes", "Recibidas", "Devueltas", "No devueltas"].map(h =>
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Mes" ? "left" : "right", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(d => (
                <tr key={d.mes} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{d.mes}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{d.num_lotes}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>{parseFloat(d.total_recibidas)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#B91C1C" }}>{parseFloat(d.total_defectuosas)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#059669" }}>{parseFloat(d.total_efectivas)}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin lotes en este rango</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Reportes() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("ventas");
  const TABS = [
    { id: "ventas",     label: "Ventas",                   icon: "💰" },
    { id: "productos",  label: "Más vendido",               icon: "🏆" },
    { id: "vendedores", label: "Por vendedor",              icon: "🧾" },
    { id: "llantas",    label: "Llantas recibidas",         icon: "📥" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap", background: "var(--color-background-secondary)", borderRadius: 12, padding: 6, border: "1px solid var(--color-border-tertiary)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: isMobile ? "calc(50% - 6px)" : 0,
            padding: "9px 12px", background: tab === t.id ? "#1D4ED8" : "none",
            border: "none", borderRadius: 8,
            color: tab === t.id ? "#fff" : "var(--color-text-secondary)",
            fontWeight: tab === t.id ? 700 : 400,
            fontSize: isMobile ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>
      {tab === "ventas" && <ReporteVentas />}
      {tab === "productos" && <ReporteProductoMasVendido />}
      {tab === "vendedores" && <ReporteCotizacionesPorVendedor />}
      {tab === "llantas" && <ReporteLlantasPorMes />}
    </div>
  );
}

function Configuracion() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.negocio().then(setDatos).catch(() => setError("No se pudieron cargar los datos del negocio")).finally(() => setLoading(false));
  }, []);

  const cambiar = (campo, valor) => setDatos(prev => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true); setMensaje(""); setError("");
    try {
      const actualizado = await api.actualizarNegocio({
        nombre: datos.nombre, logo_url: datos.logo_url, telefono: datos.telefono,
        direccion: datos.direccion, facebook_url: datos.facebook_url,
      });
      setDatos(actualizado);
      setMensaje("Datos guardados correctamente");
    } catch (e) { setError(e.message || "Error al guardar"); } finally { setGuardando(false); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div>;
  if (!datos) return <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>{error || "No se pudo cargar"}</div>;

  return (
    <div style={{ maxWidth: 480 }}>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 20 }}>
        Estos datos aparecen en las cotizaciones que comparten con tus clientes por WhatsApp.
      </p>

      <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
        {mensaje && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{mensaje}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {datos.logo_url
            ? <img src={datos.logo_url} alt="Logo" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid var(--color-border-tertiary)" }} />
            : <div style={{ width: 56, height: 56, borderRadius: 10, background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🛞</div>}
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Logo del negocio (URL de imagen)</label>
            <input style={inputStyle} placeholder="https://..." value={datos.logo_url || ""} onChange={e => cambiar("logo_url", e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Nombre del negocio</label>
          <input style={inputStyle} value={datos.nombre || ""} onChange={e => cambiar("nombre", e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Dirección</label>
          <input style={inputStyle} placeholder="Calle, número, colonia, ciudad" value={datos.direccion || ""} onChange={e => cambiar("direccion", e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Teléfono / WhatsApp</label>
          <input style={inputStyle} placeholder="10 dígitos" value={datos.telefono || ""} onChange={e => cambiar("telefono", e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Página de Facebook</label>
          <input style={inputStyle} placeholder="https://facebook.com/tu-negocio" value={datos.facebook_url || ""} onChange={e => cambiar("facebook_url", e.target.value)} />
        </div>

        <button onClick={guardar} disabled={guardando} style={{ marginTop: 4, padding: "10px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function Usuarios() {
  const [lista, setLista] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { tipo: 'nuevo'|'editar'|'password', usuario }
  const [eliminandoId, setEliminandoId] = useState(null);
  const [errorEliminar, setErrorEliminar] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.usuarios(), api.rolesDisponibles()]);
      setLista(u.data || []);
      setRoles(r || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (u) => {
    try { await api.actualizarUsuario(u.id, { activo: !u.activo }); cargar(); } catch {}
  };

  const eliminar = async (u) => {
    if (!window.confirm(`¿Eliminar permanentemente a "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    setEliminandoId(u.id); setErrorEliminar("");
    try {
      await api.eliminarUsuario(u.id);
      cargar();
    } catch (e) {
      setErrorEliminar(e.message || "No se pudo eliminar el usuario");
    } finally {
      setEliminandoId(null);
    }
  };

  const ROL_INFO = {
    admin:   { color: "#7C3AED", label: "Administrador", desc: "Acceso total al sistema" },
    gerente: { color: "#0EA5E9", label: "Gerente",        desc: "Ventas, compras, reportes y gastos" },
    cajero:  { color: "#059669", label: "Cajero",         desc: "Ventas, órdenes y clientes" },
    tecnico: { color: "#D97706", label: "Técnico",        desc: "Órdenes de servicio" },
    vendedor:{ color: "#DB2777", label: "Vendedor",       desc: "Solo catálogo, precios, fotos y cotizaciones" },
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setModal({ tipo: "nuevo" })} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nuevo usuario</button>
      </div>

      {errorEliminar && (
        <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{errorEliminar}</div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-tertiary)" }}>
                {["Nombre", "Email", "Rol", "Estado", ""].map(h =>
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map(u => {
                const info = ROL_INFO[u.rol] || { color: "#64748B", label: u.rol };
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 500 }}>{u.nombre}</td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{u.email}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: info.color + "22", color: info.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{info.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: u.activo ? "#D1FAE5" : "#FEE2E2", color: u.activo ? "#065F46" : "#B91C1C", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{u.activo ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => setModal({ tipo: "password", usuario: u })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#1D4ED8", marginRight: 12 }}>Resetear clave</button>
                      <button onClick={() => toggleActivo(u)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: u.activo ? "#B91C1C" : "#059669", marginRight: u.activo ? 0 : 12 }}>{u.activo ? "Desactivar" : "Activar"}</button>
                      {!u.activo && (
                        <button onClick={() => eliminar(u)} disabled={eliminandoId === u.id} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>{eliminandoId === u.id ? "Eliminando..." : "🗑 Eliminar"}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Sin usuarios todavía</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--color-text-secondary)" }}>
        <strong>Roles disponibles:</strong> {Object.values(ROL_INFO).map(r => r.label).join(" · ")}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-text-secondary)" }}>
        "Eliminar" solo aparece en usuarios desactivados, y el sistema no deja borrar a quien ya tiene ventas, cotizaciones u otro historial registrado (para no perder esos datos) — en ese caso, deja al usuario solo desactivado.
      </div>

      {modal?.tipo === "nuevo"    && <ModalUsuario roles={roles} onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />}
      {modal?.tipo === "password" && <ModalResetPassword usuario={modal.usuario} onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
    </div>
  );
}

function ModalUsuario({ roles, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol_id: roles.find(r => r.nombre === "vendedor")?.id || roles[0]?.id || "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.crearUsuario(form);
      onSaved();
    } catch (err) { setError(err.message || "Error al crear usuario"); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <form onSubmit={submit} style={{ ...modalBase, maxWidth: 380 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>👤 Nuevo usuario</h2>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input style={inputStyle} placeholder="Nombre completo" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <input style={inputStyle} type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input style={inputStyle} type="password" placeholder="Contraseña (mínimo 6 caracteres)" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <select style={inputStyle} value={form.rol_id} onChange={e => setForm({ ...form, rol_id: e.target.value })}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: "9px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Creando..." : "Crear usuario"}</button>
        </div>
      </form>
    </div>
  );
}

function ModalResetPassword({ usuario, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.resetPasswordUsuario(usuario.id, password);
      setOk(true);
    } catch (err) { setError(err.message || "Error al restablecer contraseña"); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 360 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>🔑 Restablecer clave de {usuario.nombre}</h2>
        {ok ? (
          <div>
            <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 16 }}>Contraseña actualizada correctamente.</div>
            <button onClick={() => { onSaved(); onClose(); }} style={{ width: "100%", padding: "9px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <input style={inputStyle} type="password" placeholder="Nueva contraseña (mínimo 6 caracteres)" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: "9px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Restablecer"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


function ModalMiPassword({ onClose }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.cambiarPassword(actual, nueva);
      setOk(true);
    } catch (err) { setError(err.message || "Error al cambiar contraseña"); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 360 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>🔑 Cambiar mi contraseña</h2>
        {ok ? (
          <div>
            <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 16 }}>Contraseña actualizada correctamente.</div>
            <button onClick={onClose} style={{ width: "100%", padding: "9px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={inputStyle} type="password" placeholder="Contraseña actual" required value={actual} onChange={e => setActual(e.target.value)} autoFocus />
              <input style={inputStyle} type="password" placeholder="Nueva contraseña (mínimo 6 caracteres)" required minLength={6} value={nueva} onChange={e => setNueva(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13, color: "#fff" }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: "9px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Cambiar"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Punto de Venta ────────────────────────────────────────────────────────────
function Ventas() {
  const isMobile = useIsMobile();
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);
  const [carrito, setCarrito] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [montoPagado, setMontoPagado] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [notas, setNotas] = useState("");
  const [fechaVenta, setFechaVenta] = useState(""); // vacío = usar la fecha/hora actual
  const [cobrarIva, setCobrarIva] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [ventaLista, setVentaLista] = useState(null);
  const [opcionesAvanzadas, setOpcionesAvanzadas] = useState(false);

  useEffect(() => {
    api.clientes().then(r => setClientes(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.productos(buscar ? `buscar=${encodeURIComponent(buscar)}` : "")
        .then(r => { setProductos(r.data || []); setLoading(false); })
        .catch(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [buscar]);

  // Cada línea del carrito guarda su precio normal (producto.precio_venta) y,
  // por separado, el "monto a cobrar" para esa línea — que por default es
  // cantidad x precio, pero el cajero puede editarlo libremente (no es un
  // descuento, es lo que realmente se le va a cobrar al cliente por esa línea).
  const agregar = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id === producto.id);
      if (existe) {
        const cantidad = existe.cantidad + 1;
        return prev.map(i => i.producto.id === producto.id
          ? { ...i, cantidad, montoCobrado: i.montoEditado ? i.montoCobrado : cantidad * i.producto.precio_venta }
          : i);
      }
      return [...prev, { producto, cantidad: 1, montoCobrado: producto.precio_venta, montoEditado: false }];
    });
  };
  const quitar = (id) => setCarrito(prev => prev.filter(i => i.producto.id !== id));
  const cambiarCantidad = (id, cantidad) => setCarrito(prev => prev.map(i => {
    if (i.producto.id !== id) return i;
    const nuevaCantidad = Math.max(1, cantidad);
    // Si el cajero no había tocado el monto de esa línea, lo recalculamos normal.
    // Si ya lo había editado a mano, respetamos su ajuste y no lo pisamos.
    const montoCobrado = i.montoEditado ? i.montoCobrado : nuevaCantidad * i.producto.precio_venta;
    return { ...i, cantidad: nuevaCantidad, montoCobrado };
  }));
  const cambiarMontoCobrado = (id, monto) => setCarrito(prev => prev.map(i =>
    i.producto.id === id ? { ...i, montoCobrado: Math.max(0, monto), montoEditado: true } : i
  ));

  const subtotal = carrito.reduce((s, i) => s + (parseFloat(i.montoCobrado) || 0), 0);
  const base = Math.max(0, subtotal - (parseFloat(descuento) || 0));
  const iva = cobrarIva ? base * 0.16 : 0;
  const total = base + iva;

  const cobrar = async () => {
    if (!carrito.length) return setError("Agrega al menos un producto a la venta");
    setProcesando(true); setError("");
    try {
      const data = await api.crearVenta({
        cliente_id: clienteId || null,
        // Se envía el precio unitario efectivo (monto a cobrar / cantidad) para
        // que el total de esa línea coincida con lo que el cajero ajustó.
        items: carrito.map(i => ({
          producto_id: i.producto.id,
          cantidad: i.cantidad,
          precio_unitario: i.cantidad > 0 ? (parseFloat(i.montoCobrado) || 0) / i.cantidad : 0,
        })),
        metodo_pago: metodoPago,
        monto_pagado: montoPagado ? parseFloat(montoPagado) : total,
        descuento_global: parseFloat(descuento) || 0,
        aplicar_iva: cobrarIva,
        notas: notas || null,
        fecha: fechaVenta || null,   // solo "YYYY-MM-DD" o null (el backend calcula la hora)
      });
      setVentaLista(data);
    } catch (e) { setError(e.message || "Error al registrar la venta"); } finally { setProcesando(false); }
  };

  const nuevaVenta = () => {
    setCarrito([]); setClienteId(""); setMontoPagado(""); setDescuento(0); setNotas(""); setFechaVenta(""); setCobrarIva(false); setVentaLista(null); setOpcionesAvanzadas(false);
  };

  if (ventaLista) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Venta {ventaLista.folio} registrada</h2>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 4 }}>Total: {fmt(ventaLista.total)}</p>
        {parseFloat(ventaLista.cambio) > 0 && <p style={{ color: "#059669", fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Cambio: {fmt(ventaLista.cambio)}</p>}
        <button onClick={nuevaVenta} style={{ padding: "10px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva venta</button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20, alignItems: "flex-start" }}>
      <div>
        <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Buscar producto, medida o marca..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando catálogo...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {productos.map(p => (
              <button key={p.id} onClick={() => agregar(p)} style={{ textAlign: "left", background: "var(--color-background-secondary)", borderRadius: 10, border: "1px solid var(--color-border-tertiary)", padding: 10, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: "#fff" }}>{p.nombre}</div>
                {p.medida && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{p.medida}</div>}
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1D4ED8" }}>{fmt(p.precio_venta)}</div>
                <div style={{ fontSize: 10, color: p.stock_actual > 0 ? "#059669" : "#B91C1C" }}>
                  {p.es_servicio ? "Servicio" : p.stock_actual > 0 ? `${p.stock_actual} disp.` : "Sin stock"}
                </div>
              </button>
            ))}
            {!productos.length && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Sin resultados</div>}
          </div>
        )}
      </div>

      <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", padding: 16, position: isMobile ? "static" : "sticky", top: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🧾 Venta actual ({carrito.length})</div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        {!carrito.length ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "center", padding: "20px 0" }}>Toca un producto para agregarlo</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>
            {carrito.map(i => {
              const precioNormal = i.cantidad * i.producto.precio_venta;
              const montoNum = parseFloat(i.montoCobrado) || 0;
              const ajustado = i.montoEditado && Math.abs(montoNum - precioNormal) > 0.001;
              return (
                <div key={i.producto.id} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 6, borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.producto.nombre}</div>
                    <input type="number" min={1} value={i.cantidad} onChange={e => cambiarCantidad(i.producto.id, parseInt(e.target.value) || 1)} style={{ width: 40, padding: "2px 4px", fontSize: 11, border: "1px solid var(--color-border-secondary)", borderRadius: 4, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
                    <button onClick={() => quitar(i.producto.id)} style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: 13 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                      {fmt(i.producto.precio_venta)} c/u {ajustado && <span style={{ textDecoration: "line-through" }}>{fmt(precioNormal)}</span>}
                    </span>
                    <input
                      type="number" min={0} step="0.01"
                      value={i.montoCobrado}
                      onChange={e => cambiarMontoCobrado(i.producto.id, parseFloat(e.target.value) || 0)}
                      title="Monto a cobrar por esta línea (puedes editarlo)"
                      style={{ width: 80, padding: "2px 6px", fontSize: 12, fontWeight: 700, textAlign: "right", border: `1px solid ${ajustado ? "#F59E0B" : "var(--color-border-secondary)"}`, borderRadius: 4, background: "var(--color-background-primary)", color: ajustado ? "#B45309" : "var(--color-text-primary)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <select style={{ ...inputStyle, marginBottom: 10 }} value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">👤 Cliente general (sin registrar)</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Método de pago</label>
            <select style={inputStyle} value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
              <option value="efectivo">💵 Efectivo</option>
              <option value="tarjeta">💳 Tarjeta</option>
              <option value="transferencia">🏦 Transferencia</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Descuento en pesos ($)</label>
            <input style={inputStyle} type="number" min={0} placeholder="0" value={descuento} onChange={e => setDescuento(e.target.value)} />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 10, cursor: "pointer", userSelect: "none", padding: "6px 8px", borderRadius: 6, border: cobrarIva ? "1px solid #3B82F6" : "1px solid var(--color-border-tertiary)", background: cobrarIva ? "rgba(59,130,246,0.08)" : "transparent" }}>
          <input type="checkbox" checked={cobrarIva} onChange={e => setCobrarIva(e.target.checked)} style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#3B82F6" }} />
          <span>Cobrar IVA <strong>+16%</strong></span>
          {cobrarIva && <span style={{ marginLeft: "auto", fontSize: 11, color: "#60A5FA" }}>+{fmt(iva)}</span>}
        </label>

        {/* ── Totales ──────────────────────────────────────────────────────── */}
        <div style={{ background: "var(--color-background-tertiary)", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
          {(parseFloat(descuento) > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
          )}
          {(parseFloat(descuento) > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#059669", marginBottom: 4 }}>
              <span>Descuento</span><span>-{fmt(parseFloat(descuento))}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: (parseFloat(descuento) > 0) ? "8px" : 0, borderTop: (parseFloat(descuento) > 0) ? "1px solid var(--color-border-tertiary)" : "none" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 22, color: "#60A5FA", letterSpacing: "-0.5px" }}>{fmt(total)}</span>
          </div>
        </div>

        {/* ── Monto recibido + cambio ───────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Monto recibido del cliente</label>
          <input style={inputStyle} type="number" min={0} placeholder={`${fmt(total)}`} value={montoPagado} onChange={e => setMontoPagado(e.target.value)} />
          {montoPagado && parseFloat(montoPagado) > total && (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, padding: "6px 10px", background: "rgba(5,150,105,0.12)", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#10B981" }}>
              <span>Cambio</span><span>{fmt(parseFloat(montoPagado) - total)}</span>
            </div>
          )}
          {montoPagado && parseFloat(montoPagado) < total && (
            <div style={{ marginTop: 6, padding: "4px 10px", background: "rgba(245,158,11,0.1)", borderRadius: 6, fontSize: 11, color: "#F59E0B" }}>
              ⚠ Monto incompleto — quedará como crédito pendiente
            </div>
          )}
        </div>

        {/* ── Opciones avanzadas (colapsables) ─────────────────────────────── */}
        <button onClick={() => setOpcionesAvanzadas(v => !v)} style={{ width: "100%", background: "none", border: "1px dashed var(--color-border-tertiary)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, color: "var(--color-text-secondary)", textAlign: "left", marginBottom: opcionesAvanzadas ? 8 : 12 }}>
          {opcionesAvanzadas ? "▾" : "▸"} Opciones avanzadas {(notas || fechaVenta) ? "●" : ""}
        </button>

        {opcionesAvanzadas && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: "10px 12px", background: "var(--color-background-tertiary)", borderRadius: 8 }}>
            <div>
              <label style={labelStyle}>Notas (motivo de descuento u observaciones)</label>
              <input style={inputStyle} placeholder="Ej: descuento por cliente frecuente" value={notas} onChange={e => setNotas(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Fecha de la venta</label>
              <input type="date" style={inputStyle} max={hoyISO()} value={fechaVenta} onChange={e => setFechaVenta(e.target.value)} />
              {fechaVenta && fechaVenta !== hoyISO() && (
                <div style={{ fontSize: 11, color: "#fff", marginTop: 4 }}>
                  ⚠ Se registrará con fecha {(() => { const [y,m,d] = fechaVenta.split("-"); return `${parseInt(d)} ${["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][parseInt(m)]} ${y}`; })()}
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={cobrar} disabled={procesando || !carrito.length} style={{ width: "100%", padding: "13px", background: carrito.length ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "var(--color-background-tertiary)", color: carrito.length ? "#fff" : "var(--color-text-secondary)", border: "none", borderRadius: 10, cursor: carrito.length ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 700, letterSpacing: "0.02em", boxShadow: carrito.length ? "0 4px 14px rgba(5,150,105,0.3)" : "none", transition: "all 0.15s" }}>
          {procesando ? "Procesando..." : carrito.length ? `💰 Cobrar ${fmt(total)}` : "Agrega productos"}
        </button>
      </div>
    </div>
  );
}


// ─── Historial de ventas del día (o del rango que elijas) ─────────────────────
// ─── Modal previsualización de ticket de venta ───────────────────────────────
function ModalTicket({ ventaId, onClose }) {
  const [venta, setVenta]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.ventaDetalle(ventaId)
      .then(setVenta)
      .catch(e => setError(e.message || "No se pudo cargar el ticket"))
      .finally(() => setLoading(false));
  }, [ventaId]);

  const imprimir = () => {
    if (!venta) return;
    const fmtH = ts => new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const fmtD = ts => new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Ticket ${venta.folio}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;max-width:320px;margin:0 auto;padding:16px}
  .center{text-align:center}.sep{border:none;border-top:1px dashed #888;margin:8px 0}
  h1{font-size:14px;font-weight:700;text-align:center;margin:4px 0}.sub{font-size:10px;color:#555;text-align:center}
  table{width:100%;border-collapse:collapse;font-size:11px}td{padding:3px 0;vertical-align:top}td.r{text-align:right;white-space:nowrap}
  .total-row{font-weight:700;font-size:13px;border-top:1px solid #111;padding-top:4px}
  .footer{font-size:10px;color:#777;text-align:center;margin-top:12px}
  button{display:block;margin:12px auto 0;padding:8px 24px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer}
  @media print{button{display:none!important}}
</style></head><body>
<div class="center">
  ${venta.logo_url ? `<img src="${venta.logo_url}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;margin-bottom:6px">` : ""}
  <h1>${venta.negocio_nombre || "Ticket de venta"}</h1>
  ${venta.negocio_direccion ? `<div class="sub">${venta.negocio_direccion}</div>` : ""}
</div>
<hr class="sep">
<div style="font-size:11px">
  <div><b>Folio:</b> ${venta.folio}</div>
  <div><b>Fecha:</b> ${fmtD(venta.fecha_local || venta.fecha)}</div>
  <div><b>Hora:</b> ${fmtH(venta.fecha_local || venta.fecha)}</div>
  <div><b>Cliente:</b> ${venta.cliente_nombre || "Cliente general"}</div>
  <div><b>Cajero:</b> ${venta.cajero_nombre || "—"}</div>
  <div><b>Pago:</b> <span style="text-transform:capitalize">${venta.metodo_pago}</span></div>
</div>
<hr class="sep">
<table>
  <thead><tr><td><b>Producto</b></td><td class="r"><b>Cant</b></td><td class="r"><b>P.U.</b></td><td class="r"><b>Importe</b></td></tr></thead>
  <tbody>${(venta.items||[]).map(i=>`<tr>
    <td>${i.producto_nombre}${i.producto_medida?`<br><span style="font-size:10px;color:#555">${i.producto_medida}</span>`:""}</td>
    <td class="r">${parseFloat(i.cantidad)}</td>
    <td class="r">$${parseFloat(i.precio_unitario).toFixed(2)}</td>
    <td class="r">$${parseFloat(i.subtotal).toFixed(2)}</td>
  </tr>`).join("")}</tbody>
</table>
<hr class="sep">
<table>
  ${parseFloat(venta.descuento||0)>0?`<tr><td>Descuento</td><td class="r">-$${parseFloat(venta.descuento).toFixed(2)}</td></tr>`:""}
  ${parseFloat(venta.iva||0)>0?`<tr><td>IVA 16%</td><td class="r">$${parseFloat(venta.iva).toFixed(2)}</td></tr>`:""}
  <tr class="total-row"><td>TOTAL</td><td class="r">$${parseFloat(venta.total).toFixed(2)}</td></tr>
  ${parseFloat(venta.cambio||0)>0?`<tr><td style="color:#059669">Cambio</td><td class="r" style="color:#059669">$${parseFloat(venta.cambio).toFixed(2)}</td></tr>`:""}
</table>
${venta.notas?`<hr class="sep"><div style="font-size:10px;color:#555">Nota: ${venta.notas}</div>`:""}
<div class="footer">¡Gracias por su compra!</div>
<button onclick="window.print()">🖨 Imprimir ticket</button>
</body></html>`;
    const w = window.open("","_blank","width=380,height=700");
    w.document.write(html); w.document.close(); w.focus();
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 540 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🧾 {venta ? venta.folio : "Cargando..."}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}>✕</button>
        </div>
        {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div>}
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{error}</div>}
        {venta && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14, fontSize: 13 }}>
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "var(--color-text-secondary)", textTransform: "uppercase", marginBottom: 2 }}>Fecha / Hora</div>
                <div style={{ fontWeight: 600 }}>{new Date(venta.fecha_local||venta.fecha).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{new Date(venta.fecha_local||venta.fecha).toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "var(--color-text-secondary)", textTransform: "uppercase", marginBottom: 2 }}>Cliente / Cajero</div>
                <div style={{ fontWeight: 600 }}>{venta.cliente_nombre || "Cliente general"}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{venta.cajero_nombre}</div>
              </div>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, border: "1px solid var(--color-border-tertiary)", marginBottom: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
                  {["Producto","Cant.","P.U.","Importe"].map((h,i)=>
                    <th key={h} style={{ padding:"8px 10px",textAlign:i>1?"right":"left",fontSize:10,fontWeight:600,color:"var(--color-text-secondary)",textTransform:"uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(venta.items||[]).map((item,i)=>(
                    <tr key={i} style={{ borderTop:"1px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding:"8px 10px" }}><div style={{ fontWeight:600,fontSize:12 }}>{item.producto_nombre}</div>{item.producto_medida&&<div style={{ fontSize:10,color:"var(--color-text-secondary)" }}>{item.producto_medida}</div>}</td>
                      <td style={{ padding:"8px 10px",textAlign:"right" }}>{parseFloat(item.cantidad)}</td>
                      <td style={{ padding:"8px 10px",textAlign:"right",color:"var(--color-text-secondary)" }}>{fmt(item.precio_unitario)}</td>
                      <td style={{ padding:"8px 10px",textAlign:"right",fontWeight:600 }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background:"var(--color-background-tertiary)",borderRadius:8,padding:"10px 14px",marginBottom:12 }}>
              {parseFloat(venta.descuento||0)>0&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4 }}><span style={{ color:"var(--color-text-secondary)" }}>Descuento</span><span style={{ color:"#059669" }}>-{fmt(venta.descuento)}</span></div>}
              {parseFloat(venta.iva||0)>0&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4 }}><span style={{ color:"var(--color-text-secondary)" }}>IVA 16%</span><span>{fmt(venta.iva)}</span></div>}
              <div style={{ display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:18 }}><span>Total</span><span style={{ color:"#60A5FA" }}>{fmt(venta.total)}</span></div>
              {parseFloat(venta.cambio||0)>0&&<div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginTop:4 }}><span style={{ color:"#059669" }}>Cambio</span><span style={{ color:"#059669",fontWeight:600 }}>{fmt(venta.cambio)}</span></div>}
            </div>
            {venta.notas&&<div style={{ fontSize:12,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",borderRadius:6,padding:"8px 12px",marginBottom:12 }}>📝 {venta.notas}</div>}
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <button onClick={onClose} style={{ padding:"9px 18px",border:"1px solid var(--color-border-secondary)",borderRadius:8,background:"none",cursor:"pointer",fontSize:13,color:"#fff" }}>Cerrar</button>
              <button onClick={imprimir} style={{ padding:"9px 20px",background:"#111",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>🖨 Imprimir</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const ESTADO_VENTA_INFO = {
  pagada: { label: "Pagada", bg: "#D1FAE5", color: "#065F46" },
  pendiente: { label: "Pendiente", bg: "#FEF3C7", color: "#92400E" },
  cancelada: { label: "Cancelada", bg: "#FEE2E2", color: "#B91C1C" },
};

function HistorialVentas() {
  const [desde, setDesde]       = useState(hoyISO());
  const [hasta, setHasta]       = useState(hoyISO());
  const [ventas, setVentas]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editandoId, setEditandoId] = useState(null); // id de venta cuyo método se está editando
  const [ticketId, setTicketId] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    api.ventas(`desde=${desde}&hasta=${hasta}&limit=200`)
      .then(r => { setVentas(r.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarMetodo = async (ventaId, nuevoMetodo) => {
    try {
      await api.actualizarMetodoPago(ventaId, nuevoMetodo);
      setVentas(prev => prev.map(v => v.id === ventaId ? { ...v, metodo_pago: nuevoMetodo } : v));
    } catch (e) {
      alert('Error al cambiar método de pago: ' + e.message);
    } finally {
      setEditandoId(null);
    }
  };

  const totales = ventas.reduce((acc, v) => {
    if (v.estado === "pagada") {
      acc.total    += parseFloat(v.total);
      acc.pagadas  += 1;
      acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + parseFloat(v.total);
    }
    return acc;
  }, { total: 0, pagadas: 0 });

  const esHoy = desde === hoyISO() && hasta === hoyISO();

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div><label style={labelStyle}>Del</label><input type="date" style={{ ...inputStyle, width: 160 }} value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div><label style={labelStyle}>Al</label><input type="date" style={{ ...inputStyle, width: 160 }} value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        <button onClick={() => { setDesde(hoyISO()); setHasta(hoyISO()); }} style={{ padding: "8px 16px", background: esHoy ? "#1D4ED8" : "var(--color-background-tertiary)", color: "#fff", border: "1px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Hoy</button>
        <button onClick={cargar} style={{ padding: "8px 16px", background: "none", border: "1px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#fff" }}>↻ Actualizar</button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {[["Ventas pagadas", totales.pagadas, "#fff", v => v],
          ["Total cobrado", totales.total, "#60A5FA", fmt],
          ["Efectivo", totales.efectivo || 0, "#fff", fmt],
          ["Tarjeta", totales.tarjeta || 0, "#fff", fmt],
          ["Transferencia", totales.transferencia || 0, "#fff", fmt],
        ].map(([label, val, color, f]) => (
          <div key={label} style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "12px 18px", border: "1px solid var(--color-border-tertiary)" }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{f(val)}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Folio","Hora","Cliente","Cajero","Método de pago","Notas","Total","Estado",""].map(h =>
                <th key={h} style={{ padding: "10px 14px", textAlign: h==="Total"?"right":"left", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ventas.length === 0
                ? <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>No hay ventas en este rango de fechas.</td></tr>
                : ventas.map(v => {
                  const estadoInfo = ESTADO_VENTA_INFO[v.estado] || ESTADO_VENTA_INFO.pagada;
                  return (
                    <tr key={v.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{v.folio}</td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{new Date(v.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "10px 14px" }}>{v.cliente_nombre || "Cliente general"}</td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{v.cajero_nombre || "—"}</td>
                      <td style={{ padding: "8px 14px" }}>
                        {editandoId === v.id ? (
                          <select autoFocus defaultValue={v.metodo_pago}
                            onChange={e => cambiarMetodo(v.id, e.target.value)}
                            onBlur={() => setEditandoId(null)}
                            style={{ ...inputStyle, padding: "4px 8px", width: "auto", fontSize: 12 }}>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="transferencia">Transferencia</option>
                          </select>
                        ) : (
                          <span onClick={() => v.estado === "pagada" && setEditandoId(v.id)}
                            title={v.estado === "pagada" ? "Clic para cambiar" : ""}
                            style={{ textTransform: "capitalize", cursor: v.estado === "pagada" ? "pointer" : "default",
                              padding: "3px 8px", borderRadius: 6,
                              border: v.estado === "pagada" ? "1px dashed var(--color-border-secondary)" : "none" }}>
                            {v.metodo_pago} {v.estado === "pagada" ? "✎" : ""}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.notas || "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#60A5FA" }}>{fmt(v.total)}</td>
                      <td style={{ padding: "10px 14px" }}><span style={{ background: estadoInfo.bg, color: estadoInfo.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{estadoInfo.label}</span></td>
                      <td style={{ padding: "8px 14px" }}>
                        <button onClick={() => setTicketId(v.id)} style={{ padding: "5px 10px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 11, color: "#fff", whiteSpace: "nowrap" }}>🧾 Ver</button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {ticketId && <ModalTicket ventaId={ticketId} onClose={() => setTicketId(null)} />}
    </div>
  );
}

// ─── Cotizaciones: vista de seguimiento (admin ve todas, vendedor ve las suyas) ─
const ESTADO_COT_INFO = {
  borrador:   { label: "Borrador",   bg: "#E5E7EB", color: "#374151" },
  enviada:    { label: "Enviada",    bg: "#DBEAFE", color: "#1E40AF" },
  vista:      { label: "Vista",      bg: "#EDE9FE", color: "#5B21B6" },
  aceptada:   { label: "Aceptada",   bg: "#D1FAE5", color: "#065F46" },
  vencida:    { label: "Vencida",    bg: "#FEE2E2", color: "#B91C1C" },
  convertida: { label: "✓ Cerrada (venta)", bg: "#A7F3D0", color: "#064E3B" },
};

function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [copiado, setCopiado] = useState(""); // id de lo que se acaba de copiar, para feedback visual

  useEffect(() => {
    api.cotizaciones().then(r => { setCotizaciones(r.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const copiar = (texto, key) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(key);
    setTimeout(() => setCopiado(""), 1500);
  };

  const visibles = filtroEstado === "todas" ? cotizaciones
    : filtroEstado === "pendientes" ? cotizaciones.filter(c => ["borrador", "enviada", "vista"].includes(c.estado))
    : cotizaciones.filter(c => c.estado === filtroEstado);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>
        Aquí ves las cotizaciones de todos tus vendedores: cuáles ya se cerraron como venta y cuáles siguen pendientes. Copia el teléfono del cliente para pasarlo a otro vendedor si hace falta dar seguimiento.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["todas", "Todas"], ["pendientes", "Pendientes"], ["convertida", "Cerradas"], ["vencida", "Vencidas"]].map(([val, label]) => (
          <button key={val} onClick={() => setFiltroEstado(val)} style={{ padding: "7px 16px", borderRadius: 20, border: "1px solid var(--color-border-secondary)", background: filtroEstado === val ? "#1D4ED8" : "none", color: filtroEstado === val ? "#fff" : "var(--color-text-primary)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> :
        visibles.length === 0 ? <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-secondary)" }}>No hay cotizaciones en este filtro.</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "var(--color-background-tertiary)" }}>
              {["Folio", "Cliente", "Teléfono", "Vendedor", "Total", "Estado", "Fecha", ""].map(h =>
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Total" ? "right" : "left", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {visibles.map(c => {
                const info = ESTADO_COT_INFO[c.estado] || ESTADO_COT_INFO.borrador;
                const link = `${window.location.origin}/cotizacion/${c.token_publico}`;
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.folio}</td>
                    <td style={{ padding: "10px 14px" }}>{c.cliente_nombre || "Sin nombre"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {c.cliente_telefono ? (
                        <button onClick={() => copiar(c.cliente_telefono, `tel-${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--color-border-secondary)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>
                          {c.cliente_telefono} {copiado === `tel-${c.id}` ? "✅" : "📋"}
                        </button>
                      ) : <span style={{ color: "var(--color-text-secondary)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{c.vendedor_nombre}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#1D4ED8" }}>{fmt(c.total)}</td>
                    <td style={{ padding: "10px 14px" }}><span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{info.label}</span></td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)" }}>{fmtFecha(c.created_at)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => copiar(link, `link-${c.id}`)} style={{ background: "none", border: "1px solid var(--color-border-secondary)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>{copiado === `link-${c.id}` ? "✅ Copiado" : "📋 Copiar enlace"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Catalogo() {
  const isMobile = useIsMobile();
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);
  const [carrito, setCarrito] = useState([]); // [{producto, cantidad}]
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [generando, setGenerando] = useState(false);
  const [cotizacionLista, setCotizacionLista] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.productos(buscar ? `buscar=${encodeURIComponent(buscar)}` : "")
        .then(r => { setProductos(r.data || []); setLoading(false); })
        .catch(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [buscar]);

  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id === producto.id);
      if (existe) return prev.map(i => i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const quitarDelCarrito = (id) => setCarrito(prev => prev.filter(i => i.producto.id !== id));
  const cambiarCantidad = (id, cantidad) => setCarrito(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.max(1, cantidad) } : i));

  const total = carrito.reduce((s, i) => s + i.cantidad * i.producto.precio_venta, 0);

  const compartirWhatsApp = (url) => {
    const mensaje = encodeURIComponent(`Hola${clienteNombre ? " " + clienteNombre : ""}, aquí está tu cotización: ${url}`);
    window.open(`https://wa.me/${clienteTelefono ? clienteTelefono.replace(/\D/g, "") : ""}?text=${mensaje}`, "_blank");
  };

  const generarCotizacion = async () => {
    if (!carrito.length) return setError("Agrega al menos un producto a la cotización");
    setGenerando(true); setError("");
    try {
      const data = await api.crearCotizacion({
        cliente_nombre: clienteNombre || null,
        cliente_telefono: clienteTelefono || null,
        items: carrito.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad, precio_unitario: i.producto.precio_venta })),
      });
      const urlCompleta = `${window.location.origin}${data.url_publica}`;
      setCotizacionLista({ ...data, urlCompleta });
    } catch (e) {
      setError(e.message || "Error al generar la cotización");
    } finally {
      setGenerando(false);
    }
  };

  const nuevaCotizacion = () => {
    setCarrito([]); setClienteNombre(""); setClienteTelefono(""); setCotizacionLista(null);
  };

  if (cotizacionLista) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Cotización {cotizacionLista.folio} generada</h2>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginBottom: 20 }}>Total: {fmt(cotizacionLista.total)}</p>
        <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 10, padding: 12, marginBottom: 20, wordBreak: "break-all", fontSize: 12, color: "var(--color-text-secondary)" }}>
          {cotizacionLista.urlCompleta}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
          <button onClick={() => compartirWhatsApp(cotizacionLista.urlCompleta)} style={{ padding: "10px 20px", background: "#25D366", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>📲 Enviar por WhatsApp</button>
          <button onClick={() => navigator.clipboard?.writeText(cotizacionLista.urlCompleta)} style={{ padding: "10px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>📋 Copiar enlace</button>
        </div>
        <button onClick={nuevaCotizacion} style={{ background: "none", border: "none", color: "#1D4ED8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nueva cotización</button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 340px", gap: 20, alignItems: "flex-start" }}>
      {/* Catálogo */}
      <div>
        <input style={{ ...inputStyle, marginBottom: 16 }} placeholder="Buscar producto, medida o marca..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando catálogo...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {productos.map(p => (
              <div key={p.id} style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ height: 120, background: "var(--color-background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {p.foto_principal
                    ? <img src={p.foto_principal} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 32, opacity: 0.3 }}>🛞</span>}
                </div>
                <div style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{p.nombre}</div>
                  {p.medida && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{p.medida}</div>}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1D4ED8", marginTop: 2 }}>{fmt(p.precio_venta)}</div>
                  <div style={{ fontSize: 10, color: p.stock_actual > 0 ? "#059669" : "#B91C1C" }}>
                    {p.es_servicio ? "Servicio" : p.stock_actual > 0 ? `${p.stock_actual} disponibles` : "Sin stock"}
                  </div>
                  <button onClick={() => agregarAlCarrito(p)} style={{ marginTop: 6, padding: "6px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+ Agregar</button>
                </div>
              </div>
            ))}
            {!productos.length && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Sin resultados</div>}
          </div>
        )}
      </div>

      {/* Carrito / cotización */}
      <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, border: "1px solid var(--color-border-tertiary)", padding: 16, position: "sticky", top: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🧾 Cotización ({carrito.length})</div>
        {error && <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        {!carrito.length ? (
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "center", padding: "20px 0" }}>Agrega productos del catálogo</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 280, overflowY: "auto" }}>
            {carrito.map(i => (
              <div key={i.producto.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 12 }}>
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.producto.nombre}</div>
                <input type="number" min={1} value={i.cantidad} onChange={e => cambiarCantidad(i.producto.id, parseInt(e.target.value) || 1)} style={{ width: 40, padding: "2px 4px", fontSize: 11, border: "1px solid var(--color-border-secondary)", borderRadius: 4, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
                <span style={{ fontWeight: 600, minWidth: 60, textAlign: "right" }}>{fmt(i.cantidad * i.producto.precio_venta)}</span>
                <button onClick={() => quitarDelCarrito(i.producto.id)} style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: 13 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, padding: "10px 0", borderTop: "1px solid var(--color-border-tertiary)", marginBottom: 12 }}>
          <span>Total</span><span style={{ color: "#1D4ED8" }}>{fmt(total)}</span>
        </div>
        <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Nombre del cliente (opcional)" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
        <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="WhatsApp del cliente (10 dígitos)" value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} />
        <button onClick={generarCotizacion} disabled={generando || !carrito.length} style={{ width: "100%", padding: "10px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: !carrito.length ? 0.5 : 1 }}>
          {generando ? "Generando..." : "Generar y compartir cotización"}
        </button>
      </div>
    </div>
  );
}


const NAV = [
  { id: "dashboard",          icon: "🏠", label: "Dashboard",         permiso: "reportes" },

  // ── CAJA ────────────────────────────────────────────────────────────────────
  { id: "ventas",             icon: "🛒", label: "Punto de venta",     permiso: "ventas",        sectionLabel: "CAJA" },
  { id: "cortes_caja",        icon: "💰", label: "Cortes de caja",     permiso: "ventas" },
  { id: "historial_ventas",   icon: "🧾", label: "Historial",          permiso: "ventas" },

  // ── VENTAS ──────────────────────────────────────────────────────────────────
  { id: "credito",            icon: "💳", label: "Crédito / CxC",      permiso: "todo",          sectionLabel: "VENTAS" },
  { id: "catalogo",           icon: "🛞", label: "Cotizar",            permiso: "cotizaciones" },
  { id: "cotizaciones_lista", icon: "📋", label: "Cotizaciones",       permiso: "cotizaciones" },

  // ── OPERACIONES ─────────────────────────────────────────────────────────────
  { id: "ordenes",            icon: "🔧", label: "Órdenes",            permiso: "ordenes",       sectionLabel: "OPERACIONES" },
  { id: "inventario",         icon: "📦", label: "Inventario",         permiso: "productos_ver" },
  { id: "movimientos",        icon: "📈", label: "Movimientos",        permiso: "productos_ver" },
  { id: "lotes",              icon: "📥", label: "Lotes",              permiso: "compras", children: [
      { id: "lotes_recepcion",  icon: "📦", label: "Recepción" },
      { id: "lotes_devolucion", icon: "↩️", label: "Devolución" },
  ]},
  { id: "compras",            icon: "🚚", label: "Compras",            permiso: "compras" },
  { id: "gastos",             icon: "💸", label: "Gastos",             permiso: "gastos" },
  { id: "clientes",           icon: "👥", label: "Clientes",           permiso: "clientes" },

  // ── ANÁLISIS ────────────────────────────────────────────────────────────────
  { id: "reportes",           icon: "📊", label: "Reportes",           permiso: "reportes",      sectionLabel: "ANÁLISIS" },

  // ── ADMINISTRACIÓN ──────────────────────────────────────────────────────────
  { id: "catalogos",          icon: "🗂️",  label: "Catálogos",          permiso: "todo",          sectionLabel: "ADMIN" },
  { id: "usuarios",           icon: "🔐", label: "Usuarios",           permiso: "todo" },
  { id: "configuracion",      icon: "🏢", label: "Configuración",      permiso: "todo" },
];

// Lista "plana" de secciones reales (hijos de un grupo, o el ítem mismo si no
// tiene hijos) — se usa para validar permisos y resolver título/sección activa.
const NAV_HOJAS = NAV.flatMap(item => item.children
  ? item.children.map(c => ({ ...c, permiso: item.permiso }))
  : [item]);

const puedeVer = (permisos, clave) => {
  if (!permisos) return true; // sin objeto de permisos en absoluto: compatibilidad total (no debería pasar en la práctica)
  if (permisos.todo) return true;
  return !!permisos[clave]; // si la clave no está declarada, se deniega (negar por defecto es lo seguro)
};

// ─── Vista pública de cotización (sin login, abierta desde WhatsApp) ──────────
function CotizacionPublica({ token }) {
  const [cot, setCot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.verCotizacionPublica(token)
      .then(setCot)
      .catch(e => setError(e.message || "No se pudo cargar la cotización"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>Cargando cotización...</div>;
  if (error || !cot) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <div style={{ color: "#64748B", fontSize: 14 }}>{error || "Cotización no encontrada"}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", padding: "24px 16px", fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", color: "#fff", padding: "24px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: cot.negocio_direccion ? 10 : 0 }}>
            {cot.logo_url ? (
              <img src={cot.logo_url} alt={cot.negocio_nombre} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", background: "#fff", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🛞</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cot.negocio_nombre}</div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>Cotización {cot.folio} · {fmtFecha(cot.created_at)}</div>
            </div>
          </div>
          {cot.negocio_direccion && (
            <div style={{ fontSize: 11, opacity: 0.7, paddingLeft: 60 }}>📍 {cot.negocio_direccion}</div>
          )}
        </div>
        <div style={{ padding: 24 }}>
          {cot.cliente_nombre && <p style={{ fontSize: 14, marginBottom: 16 }}>Hola <strong>{cot.cliente_nombre}</strong>, aquí está tu cotización:</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {cot.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid #F1F5F9", paddingBottom: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, background: "#F1F5F9", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.foto_url ? <img src={item.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20, opacity: 0.3 }}>🛞</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.descripcion}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{item.cantidad} x {fmt(item.precio_unitario)}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(item.subtotal)}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: "#64748B" }}>Subtotal</span><span>{fmt(cot.subtotal)}</span></div>
            {parseFloat(cot.descuento) > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: "#64748B" }}>Descuento</span><span>-{fmt(cot.descuento)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 17, marginTop: 8, paddingTop: 8, borderTop: "1px solid #E2E8F0" }}><span>Total</span><span style={{ color: "#1D4ED8" }}>{fmt(cot.total)}</span></div>
          </div>
          <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 16 }}>
            Cotización válida por {cot.vigencia_dias} día(s) · Atendido por {cot.vendedor_nombre}
          </p>
          {cot.negocio_telefono && (
            <a href={`https://wa.me/${cot.negocio_telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              style={{ display: "block", textAlign: "center", marginTop: 16, padding: "12px", background: "#25D366", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 13 }}>
              📲 Confirmar por WhatsApp
            </a>
          )}
          {(cot.negocio_telefono || cot.negocio_facebook) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 14, paddingTop: 14, borderTop: "1px solid #F1F5F9" }}>
              {cot.negocio_telefono && (
                <span style={{ fontSize: 11, color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>📞 {cot.negocio_telefono}</span>
              )}
              {cot.negocio_facebook && (
                <a href={cot.negocio_facebook} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#1D4ED8", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  👍 Síguenos en Facebook
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detecta si el viewport actual es de tamaño móvil (se actualiza al rotar/resize)
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

// ─── App Principal ────────────────────────────────────────────────────────────
function AppPrivada() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("llantera_user")); } catch { return null; }
  });
  const [seccion, setSeccion] = useState("dashboard");
  const [filtroStockBajo, setFiltroStockBajo] = useState(false);
  const [modal, setModal] = useState(null);
  const isMobile = useIsMobile();
  const [sidebar, setSidebar] = useState(true);       // colapsar/expandir en DESKTOP
  const [menuAbierto, setMenuAbierto] = useState(false); // abrir/cerrar drawer en MOVIL
  const [productos, setProductos] = useState([]);
  const grupoDe = (id) => NAV.find(item => item.children?.some(c => c.id === id));
  const [grupoAbierto, setGrupoAbierto] = useState(() => grupoDe("dashboard")?.id || null);
  const toggleGrupo = (id) => setGrupoAbierto(prev => prev === id ? null : id);

  useEffect(() => {
    if (user) api.productos().then(r => setProductos(r.data || [])).catch(() => {});
  }, [user]);

  const logout = () => {

    localStorage.removeItem("llantera_token");
    localStorage.removeItem("llantera_user");
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  const permisos = user.permisos || {};
  const navVisible = NAV.filter(item => puedeVer(permisos, item.permiso));
  const hojasVisibles = NAV_HOJAS.filter(item => puedeVer(permisos, item.permiso));
  // Si la sección activa ya no es visible para este usuario (ej. cambio de rol), saltar a la primera permitida.
  const seccionActiva = hojasVisibles.find(n => n.id === seccion) ? seccion : (hojasVisibles[0]?.id || "dashboard");
  const titulo = hojasVisibles.find(n => n.id === seccionActiva)?.label || seccionActiva;
  const irASeccion = (id) => { setFiltroStockBajo(false); setSeccion(id); setMenuAbierto(false); };
  const verStockBajo = () => { setFiltroStockBajo(true); setSeccion("inventario"); };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-sans, system-ui)", color: "var(--color-text-primary)", background: "var(--color-background-tertiary)" }}>

      {/* Overlay oscuro detrás del menú, solo visible en móvil cuando el menú está abierto */}
      {isMobile && menuAbierto && (
        <div onClick={() => setMenuAbierto(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />
      )}

      {/* Sidebar: fijo en desktop, drawer deslizante en móvil */}
      <aside style={{
        width: isMobile ? 240 : (sidebar ? 220 : 56),
        background: "#0F172A",
        flexShrink: 0,
        transition: isMobile ? "transform 0.25s" : "width 0.25s",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        ...(isMobile ? {
          position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 50,
          transform: menuAbierto ? "translateX(0)" : "translateX(-100%)",
        } : {}),
      }}>
        <div style={{ padding: (sidebar || isMobile) ? "20px 16px 12px" : "20px 8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🚗</span>
          {(sidebar || isMobile) && <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden" }}>{user.negocio?.nombre || "Llantera POS"}</span>}
          {isMobile
            ? <button onClick={() => setMenuAbierto(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, padding: 2 }}>✕</button>
            : <button onClick={() => setSidebar(!sidebar)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, padding: 2 }}>{sidebar ? "◂" : "▸"}</button>}
        </div>
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navVisible.map(item => {
            // ── Etiqueta de sección (solo cuando el sidebar está expandido) ──
            const sectionHeader = item.sectionLabel && (sidebar || isMobile) ? (
              <div key={`sep-${item.id}`} style={{ padding: "14px 16px 4px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", userSelect: "none" }}>
                {item.sectionLabel}
              </div>
            ) : null;

            if (item.children) {
              const expandido = grupoAbierto === item.id || item.children.some(c => c.id === seccionActiva);
              const tieneActivo = item.children.some(c => c.id === seccionActiva);
              return (
                <div key={item.id}>
                  {sectionHeader}
                  <button onClick={() => toggleGrupo(item.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: (sidebar || isMobile) ? "10px 16px" : "10px 0", justifyContent: (sidebar || isMobile) ? "flex-start" : "center", background: tieneActivo ? "rgba(29,78,216,0.2)" : "none", border: "none", cursor: "pointer", color: expandido ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: expandido ? 600 : 400, transition: "all 0.15s", textAlign: "left" }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    {(sidebar || isMobile) && <span style={{ whiteSpace: "nowrap", flex: 1 }}>{item.label}</span>}
                    {(sidebar || isMobile) && <span style={{ fontSize: 10, opacity: 0.45 }}>{expandido ? "▾" : "▸"}</span>}
                  </button>
                  {expandido && (sidebar || isMobile) && item.children.map(child => (
                    <button key={child.id} onClick={() => irASeccion(child.id)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 38px", background: seccionActiva === child.id ? "rgba(59,130,246,0.18)" : "none", border: "none", borderLeft: seccionActiva === child.id ? "3px solid #60A5FA" : "3px solid transparent", cursor: "pointer", color: seccionActiva === child.id ? "#93C5FD" : "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: seccionActiva === child.id ? 600 : 400, transition: "all 0.15s", textAlign: "left" }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{child.icon}</span>
                      <span style={{ whiteSpace: "nowrap" }}>{child.label}</span>
                    </button>
                  ))}
                </div>
              );
            }
            const activo = seccionActiva === item.id;
            return (
              <div key={item.id}>
                {sectionHeader}
                <button onClick={() => irASeccion(item.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: (sidebar || isMobile) ? "10px 16px" : "10px 0", justifyContent: (sidebar || isMobile) ? "flex-start" : "center", background: activo ? "rgba(59,130,246,0.18)" : "none", borderLeft: activo ? "3px solid #60A5FA" : "3px solid transparent", borderRight: "none", borderTop: "none", borderBottom: "none", cursor: "pointer", color: activo ? "#93C5FD" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: activo ? 600 : 400, transition: "all 0.15s", textAlign: "left" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  {(sidebar || isMobile) && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>
        <div style={{ padding: (sidebar || isMobile) ? "12px 16px" : "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {user.nombre?.[0]?.toUpperCase() || "U"}
            </div>
            {(sidebar || isMobile) && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nombre}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{user.rol}</div>
              </div>
            )}
            {(sidebar || isMobile) && <button onClick={() => setModal("miPassword")} title="Cambiar mi contraseña" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13, marginRight: 2, flexShrink: 0, padding: 4 }}>🔑</button>}
            {(sidebar || isMobile) && <button onClick={logout} title="Cerrar sesión" style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 11, fontWeight: 600, flexShrink: 0, padding: "4px 8px" }}>Salir</button>}
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <main style={{ flex: 1, padding: isMobile ? "16px" : "24px 28px", overflowY: "auto", minWidth: 0, width: "100%" }}>
        {/* Barra superior solo en móvil: botón hamburguesa + título */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setMenuAbierto(true)} style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)", borderRadius: 8, width: 38, height: 38, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>☰</button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</h1>
            </div>
          </div>
        )}
        {!isMobile && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{titulo}</h1>
            <p style={{ margin: "2px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
              {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        )}

        {seccionActiva === "dashboard"   && <Dashboard setSeccion={setSeccion} onNuevaCompra={() => setModal("compra")} onNuevoGasto={() => setModal("gasto")} onVerStockBajo={verStockBajo} />}
        {seccionActiva === "ventas"      && <Ventas />}
        {seccionActiva === "cortes_caja" && <CortesCaja />}
        {seccionActiva === "historial_ventas" && <HistorialVentas />}
        {seccionActiva === "credito"     && <CreditoVentas />}
        {seccionActiva === "catalogo"    && <Catalogo />}
        {seccionActiva === "cotizaciones_lista" && <Cotizaciones />}
        {seccionActiva === "ordenes"     && <Ordenes />}
        {seccionActiva === "inventario"  && <Inventario onNuevoProducto={() => setModal("producto")} filtroStockBajoInicial={filtroStockBajo} />}
        {seccionActiva === "movimientos" && <MovimientosInventario />}
        {seccionActiva === "catalogos"   && <Catalogos />}
        {seccionActiva === "lotes_recepcion"  && <RecepcionLotes />}
        {seccionActiva === "lotes_devolucion" && <DevolucionLotes />}
        {seccionActiva === "compras"     && <Compras onNuevaCompra={() => setModal("compra")} />}
        {seccionActiva === "gastos"      && <Gastos onNuevoGasto={() => setModal("gasto")} />}
        {seccionActiva === "clientes"    && <Clientes />}
        {seccionActiva === "reportes"    && <Reportes />}
        {seccionActiva === "usuarios"    && <Usuarios />}
        {seccionActiva === "configuracion" && <Configuracion />}
      </main>

      {/* Modales */}
      {modal === "producto" && <ModalProducto onClose={() => setModal(null)} onSaved={() => { setModal(null); if (seccion === "inventario") setSeccion("inventario"); api.productos().then(r => setProductos(r.data||[])); }} />}
      {modal === "compra"   && <ModalCompra onClose={() => setModal(null)} onSaved={() => { setModal(null); }} productos={productos} />}
      {modal === "gasto"    && <ModalGasto onClose={() => setModal(null)} onSaved={() => { setModal(null); if (seccion === "gastos") setSeccion("gastos"); }} />}
      {modal === "miPassword" && <ModalMiPassword onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Enrutador raíz ────────────────────────────────────────────────────────────
// Sin librería de routing: detecta /cotizacion/:token en la URL y muestra
// la vista pública (sin login); cualquier otra ruta carga el sistema normal.
export default function App() {
  const path = window.location.pathname;
  const match = path.match(/^\/cotizacion\/([a-zA-Z0-9]+)\/?$/);
  if (match) return <CotizacionPublica token={match[1]} />;
  return <AppPrivada />;
}
