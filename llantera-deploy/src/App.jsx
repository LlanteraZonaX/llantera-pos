import { useState, useEffect, useCallback } from "react";
import api from "./api";

// ─── Utilidades ───────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
      <div style={{ background: "#1E293B", borderRadius: 16, padding: "40px 36px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
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
function KpiCard({ icono, label, valor, sub, color = "#1D4ED8", alerta }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 14, padding: "18px 20px", border: "1px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
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
function ModalProducto({ onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: "", medida: "", marca: "", categoria_id: 1, precio_compra: "", precio_venta: "", stock_actual: "", stock_minimo: "", es_servicio: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre || !form.precio_venta) return setError("Nombre y precio de venta son requeridos");
    setLoading(true); setError("");
    try {
      await api.crearProducto({ ...form, precio_compra: parseFloat(form.precio_compra)||0, precio_venta: parseFloat(form.precio_venta)||0, stock_actual: parseFloat(form.stock_actual)||0, stock_minimo: parseFloat(form.stock_minimo)||0 });
      onSaved();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalBase, maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>📦 Nuevo producto / llanta</h2>
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
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {loading ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nueva Compra ───────────────────────────────────────────────────────
function ModalCompra({ onClose, onSaved, productos }) {
  const [form, setForm] = useState({ proveedor: "", fecha_recepcion: new Date().toISOString().split("T")[0], num_factura: "", notas: "" });
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
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar compra"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nuevo Gasto ────────────────────────────────────────────────────────
function ModalGasto({ onClose, onSaved }) {
  const CATS = ["Renta","Electricidad","Agua","Sueldos","Combustible","Mantenimiento equipo","Papelería","Publicidad","Otros"];
  const [form, setForm] = useState({ categoria_id: 9, descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0], metodo_pago: "efectivo", notas: "" });
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
          <button onClick={onClose} style={{ padding: "9px 20px", border: "1px solid var(--color-border-secondary)", borderRadius: 8, background: "none", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={guardar} disabled={loading} style={{ padding: "9px 24px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{loading ? "Guardando..." : "Guardar gasto"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ setSeccion, onNuevaCompra, onNuevoGasto }) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 4 }}>
        <button onClick={onNuevaCompra} style={{ padding: "8px 16px", background: "var(--color-background-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: 9, cursor: "pointer", fontSize: 13 }}>🚚 Nueva compra</button>
        <button onClick={onNuevoGasto} style={{ padding: "8px 16px", background: "#0F766E", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Gasto</button>
        <button onClick={cargar} style={{ padding: "8px 12px", background: "var(--color-background-tertiary)", border: "1px solid var(--color-border-secondary)", borderRadius: 9, cursor: "pointer", fontSize: 13 }}>↻ Actualizar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        <KpiCard icono="💰" label="Ingresos hoy" valor={fmt(k.ingresos_hoy)} sub={`${k.num_ventas||0} ventas`} color="#1D4ED8" />
        <KpiCard icono="💵" label="Efectivo" valor={fmt(k.efectivo)} sub="del día" color="#065F46" />
        <KpiCard icono="💳" label="Tarjeta" valor={fmt(k.tarjeta)} sub="del día" color="#7C3AED" />
        <KpiCard icono="🔧" label="Órdenes activas" valor={(k.en_espera||0)+(k.en_proceso||0)+(k.listo||0)} sub={`${k.listo||0} lista(s) p/ entregar`} color="#B45309" />
        <KpiCard icono="📦" label="Stock bajo" valor={k.stock_bajo||0} sub="productos" color="#DC2626" alerta={(k.stock_bajo||0) > 0} />
        <KpiCard icono="💳" label="Cuentas × cobrar" valor={fmt(k.total_cxc)} sub={`${k.num_pendientes||0} clientes`} color="#92400E" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 16 }}>
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
    </div>
  );
}

// ─── Módulo Inventario ────────────────────────────────────────────────────────
function Inventario({ onNuevoProducto }) {
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.productos(buscar ? `buscar=${encodeURIComponent(buscar)}` : "");
      setProductos(r.data || []);
    } catch {}
    setLoading(false);
  }, [buscar]);

  useEffect(() => { const t = setTimeout(cargar, 400); return () => clearTimeout(t); }, [cargar]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Buscar por nombre, medida o SKU..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        <button onClick={onNuevoProducto} style={{ padding: "8px 18px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Nuevo producto</button>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)" }}>Cargando...</div> : (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 12, border: "1px solid var(--color-border-tertiary)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-tertiary)" }}>
                {["Nombre", "Medida", "Marca", "Precio venta", "Stock", "Estado"].map(h =>
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {productos.length === 0
                ? <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>No hay productos. ¡Agrega tu primer producto!</td></tr>
                : productos.map(p => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--color-border-tertiary)" }}>
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
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
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
        <button onClick={cargar} style={{ marginLeft: "auto", padding: "6px 14px", border: "1px solid var(--color-border-secondary)", borderRadius: 20, background: "var(--color-background-secondary)", fontSize: 12, cursor: "pointer" }}>↻</button>
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
  useEffect(() => {
    const t = setTimeout(() => {
      api.clientes(buscar ? `buscar=${encodeURIComponent(buscar)}` : "")
        .then(r => { setClientes(r.data || []); setLoading(false); }).catch(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [buscar]);
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Buscar por nombre, teléfono o RFC..." value={buscar} onChange={e => setBuscar(e.target.value)} />
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
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "🏠", label: "Dashboard" },
  { id: "ordenes", icon: "🔧", label: "Órdenes de servicio" },
  { id: "inventario", icon: "📦", label: "Inventario" },
  { id: "compras", icon: "🚚", label: "Compras" },
  { id: "gastos", icon: "💸", label: "Gastos" },
  { id: "clientes", icon: "👥", label: "Clientes / CRM" },
];

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("llantera_user")); } catch { return null; }
  });
  const [seccion, setSeccion] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [sidebar, setSidebar] = useState(true);
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    if (user) api.productos().then(r => setProductos(r.data || [])).catch(() => {});
  }, [user]);

  const logout = () => {
    localStorage.removeItem("llantera_token");
    localStorage.removeItem("llantera_user");
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} />;

  const titulo = NAV.find(n => n.id === seccion)?.label || seccion;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-sans, system-ui)", color: "var(--color-text-primary)", background: "var(--color-background-tertiary)" }}>
      {/* Sidebar */}
      <aside style={{ width: sidebar ? 220 : 56, background: "#0F172A", flexShrink: 0, transition: "width 0.25s", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ padding: sidebar ? "20px 16px 12px" : "20px 8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🚗</span>
          {sidebar && <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden" }}>Llantera POS</span>}
          <button onClick={() => setSidebar(!sidebar)} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, padding: 2 }}>{sidebar ? "◂" : "▸"}</button>
        </div>
        <nav style={{ flex: 1, padding: "10px 0" }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setSeccion(item.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: sidebar ? "10px 16px" : "10px 0", justifyContent: sidebar ? "flex-start" : "center", background: seccion === item.id ? "rgba(29,78,216,0.35)" : "none", borderLeft: seccion === item.id ? "3px solid #60A5FA" : "3px solid transparent", border: "none", cursor: "pointer", color: seccion === item.id ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: seccion === item.id ? 600 : 400, transition: "all 0.15s", textAlign: "left" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {sidebar && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: sidebar ? "12px 16px" : "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {user.nombre?.[0]?.toUpperCase() || "U"}
            </div>
            {sidebar && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nombre}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{user.rol}</div>
              </div>
            )}
            {sidebar && <button onClick={logout} title="Cerrar sesión" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}>⏻</button>}
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{titulo}</h1>
          <p style={{ margin: "2px 0 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
            {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {seccion === "dashboard"   && <Dashboard setSeccion={setSeccion} onNuevaCompra={() => setModal("compra")} onNuevoGasto={() => setModal("gasto")} />}
        {seccion === "ordenes"     && <Ordenes />}
        {seccion === "inventario"  && <Inventario onNuevoProducto={() => setModal("producto")} />}
        {seccion === "compras"     && <Compras onNuevaCompra={() => setModal("compra")} />}
        {seccion === "gastos"      && <Gastos onNuevoGasto={() => setModal("gasto")} />}
        {seccion === "clientes"    && <Clientes />}
      </main>

      {/* Modales */}
      {modal === "producto" && <ModalProducto onClose={() => setModal(null)} onSaved={() => { setModal(null); if (seccion === "inventario") setSeccion("inventario"); api.productos().then(r => setProductos(r.data||[])); }} />}
      {modal === "compra"   && <ModalCompra onClose={() => setModal(null)} onSaved={() => { setModal(null); }} productos={productos} />}
      {modal === "gasto"    && <ModalGasto onClose={() => setModal(null)} onSaved={() => { setModal(null); if (seccion === "gastos") setSeccion("gastos"); }} />}
    </div>
  );
}
