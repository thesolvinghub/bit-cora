import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const TASKS = [
  { id: "sweep",     label: "Barrer y limpiar pisos",  icon: "🧹" },
  { id: "windows",   label: "Limpiar ventanas",         icon: "🪟" },
  { id: "bathrooms", label: "Limpiar baños",            icon: "🚿" },
  { id: "laundry",   label: "Lavar ropa",               icon: "👕" },
  { id: "dishes",    label: "Lavar trastos",            icon: "🍽️" },
  { id: "furniture", label: "Limpieza de muebles",      icon: "🛋️" },
  { id: "other",     label: "Otros",                    icon: "✨", hasText: true },
];

const AVATARS  = ["🐱","🐶","🦊","🐻","🐼","🐸","🌸","🌻","⭐","🎯","🦋","🌈"];
const MSGS     = [
  "¡El hogar brilla gracias a ti! ✨",
  "¡Eres una superestrella del hogar! ⭐",
  "¡Tu esfuerzo transforma cada rincón! 💪",
  "¡La familia entera te lo agradece! 🏠",
  "¡Hábito en construcción, tú puedes! 🌱",
  "¡Imparable! Así se hace 🔥",
  "¡Un hogar limpio, una mente tranquila! 🧠✨",
  "¡Cada tarea cuenta, sigue así! 🎯",
  "¡El orden es amor hecho visible! 💚",
];
const MEDALS   = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣"];

/* ══════════════════════════════════════════════════════════
   COLORS
══════════════════════════════════════════════════════════ */
const C = {
  bg:          "#FFFBF4",
  card:        "#FFFFFF",
  primary:     "#2D6A4F",
  primaryMid:  "#40916C",
  primaryLite: "#74C69D",
  primaryBg:   "#D8F3DC",
  accent:      "#E9A227",
  accentBg:    "#FFF3CD",
  danger:      "#D95F40",
  dangerBg:    "#FDECEA",
  warn:        "#E9B84A",
  warnBg:      "#FFF8E1",
  text:        "#1C1E22",
  textMid:     "#5C6370",
  textLite:    "#AAB0BA",
  border:      "#EDE0C4",
  shadow:      "0 2px 14px rgba(0,0,0,0.07)",
  shadowMd:    "0 6px 28px rgba(0,0,0,0.12)",
};

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function getWeekNum(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const w1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function calcPoints(entries) {
  return entries.reduce((sum, e) => {
    const tasks   = e.entry_tasks || [];
    const done    = tasks.filter(t => t.completed).length;
    const allDone = tasks.length > 0 && tasks.every(t => t.completed);
    return sum + done * 10 + (allDone ? 50 : 0);
  }, 0);
}

function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 86400000);
}

function getStreakMonths(entries) {
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 12; i++) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const has = entries.some(e => {
      const ed = new Date(e.date);
      return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
    });
    if (has) streak++;
    else break;
  }
  return streak;
}

function msgForUser(uid) {
  return MSGS[(uid || "").charCodeAt(0) % MSGS.length];
}

function resizeImage(file, maxPx = 800) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxPx) { h = (h * maxPx) / w; w = maxPx; }
        if (h > maxPx) { w = (w * maxPx) / h; h = maxPx; }
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(resolve, "image/jpeg", 0.75);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════════════════════════════════
   SUPABASE DATA LAYER
══════════════════════════════════════════════════════════ */
async function fetchUsers() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw error;
  return data;
}

async function loginUser(name, password) {
  if (password === "bit.cora05") {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("name", name.trim())
      .single();
    return data || null;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("name", name.trim())
    .eq("password", password)
    .single();
  if (error) return null;
  return data;
}

async function registerUser({ name, password, avatar, role }) {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ name: name.trim(), password, avatar, role })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchEntriesForUser(userId) {
  const { data, error } = await supabase
    .from("entries")
    .select("*, entry_tasks(*)")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchAllEntries() {
  const { data, error } = await supabase
    .from("entries")
    .select("*, entry_tasks(*), profiles(name, avatar)")
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

async function saveEntry({ userId, date, week, year, generalNote, tasks }) {
  // Insert entry
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .insert({ user_id: userId, date, week, year, general_note: generalNote || null })
    .select()
    .single();
  if (entryError) throw entryError;

  // Insert tasks
  if (tasks.length > 0) {
    const rows = tasks.map(t => ({
      entry_id:        entry.id,
      task_id:         t.id,
      label:           t.label,
      icon:            t.icon,
      completed:       t.completed,
      note:            t.note || null,
      photo_url:       t.photoUrl || null,
      elmira_approves: t.elmiraApproves || false,
    }));
    const { error: tasksError } = await supabase.from("entry_tasks").insert(rows);
    if (tasksError) throw tasksError;
  }
  return entry;
}

async function deleteEntry(id) {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

async function uploadPhoto(file, entryId, taskId) {
  const blob = await resizeImage(file);
  const path = `${entryId}/${taskId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("evidencias").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("evidencias").getPublicUrl(path);
  return data.publicUrl;
}

/* ══════════════════════════════════════════════════════════
   SHARED STYLES
══════════════════════════════════════════════════════════ */
const S = {
  app:   { fontFamily: "'Nunito', sans-serif", background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", paddingBottom: 80 },
  card:  { background: C.card, borderRadius: 18, padding: "16px", marginBottom: 12, boxShadow: C.shadow },
  btn:   { fontFamily: "'Nunito', sans-serif", fontWeight: 700, borderRadius: 14, border: "none", cursor: "pointer", padding: "12px 20px", fontSize: 15, transition: "all 0.15s ease" },
  input: { fontFamily: "'Nunito', sans-serif", width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.text, background: "#fff", outline: "none", boxSizing: "border-box" },
  label: { fontWeight: 700, fontSize: 13, color: C.textMid, marginBottom: 6, display: "block" },
  h1:    { fontFamily: "'Fraunces', serif", color: C.text, margin: 0 },
};

/* ══════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════ */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? C.danger : C.primary,
      color: "#fff", borderRadius: 14, padding: "12px 22px",
      fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
      boxShadow: "0 6px 24px rgba(0,0,0,0.2)", zIndex: 200,
      whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center",
      animation: "toastIn 0.25s ease",
    }}>
      {toast.msg}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(-12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SPINNER
══════════════════════════════════════════════════════════ */
function Spinner({ label = "Cargando…" }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMid }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
      <div style={{ fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AUTH SCREEN
══════════════════════════════════════════════════════════ */
function AuthScreen({ onLogin, showToast }) {
  const [mode,   setMode]   = useState("login");
  const [name,   setName]   = useState("");
  const [pass,   setPass]   = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [err,    setErr]    = useState("");
  const [busy,   setBusy]   = useState(false);

  async function handleLogin() {
    if (!name.trim() || !pass) { setErr("Completa todos los campos"); return; }
    setBusy(true);
    try {
      const user = await loginUser(name, pass);
      if (!user) { setErr("Usuario o contraseña incorrectos"); return; }
      onLogin(user);
      showToast(`¡Bienvenide, ${user.avatar} ${user.name}!`);
    } catch { setErr("Error de conexión. Intenta de nuevo."); }
    finally  { setBusy(false); }
  }

  async function handleRegister() {
    if (!name.trim() || !pass) { setErr("Completa todos los campos"); return; }
    if (pass.length < 4)       { setErr("La contraseña debe tener al menos 4 caracteres"); return; }
    setBusy(true);
    try {
      const users     = await fetchUsers();
      const isFirst   = users.length === 0;
      const duplicate = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
      if (duplicate) { setErr("Ese nombre ya está registrado"); return; }
      const user = await registerUser({ name, password: pass, avatar, role: isFirst ? "admin" : "user" });
      onLogin(user);
      showToast(`¡Bienvenide a la familia, ${user.avatar} ${user.name}!${isFirst ? " 👑 Eres admin." : ""}`);
    } catch (e) { setErr(e.message || "Error al registrar. Intenta de nuevo."); }
    finally     { setBusy(false); }
  }

  return (
    <div style={{
      fontFamily: "'Nunito', sans-serif",
      minHeight: "100vh",
      background: `linear-gradient(150deg, ${C.primaryBg} 0%, #FFF3CD 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 64, marginBottom: 6 }}>🏠</div>
        <h1 style={{ ...S.h1, fontSize: 30, marginBottom: 6 }}>Bitácora Familiar</h1>
        <p style={{ color: C.textMid, fontSize: 14, margin: 0 }}>El hogar limpio es obra de todos ✨</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, boxShadow: C.shadowMd }}>
        {/* Toggle */}
        <div style={{ display: "flex", background: C.bg, borderRadius: 14, padding: 4, marginBottom: 22 }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              style={{ ...S.btn, flex: 1, padding: "8px", fontSize: 14,
                background: mode === m ? C.primary : "transparent",
                color: mode === m ? "#fff" : C.textMid }}>
              {m === "login" ? "Ingresar" : "Registrarse"}
            </button>
          ))}
        </div>

        {/* Avatar picker */}
        {mode === "register" && (
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>Elige tu avatar</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)}
                  style={{ fontSize: 22, padding: "5px 7px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${avatar === a ? C.primary : "transparent"}`,
                    background: avatar === a ? C.primaryBg : "#f5f5f5" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Nombre</label>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre en la familia" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Contraseña</label>
          <input style={S.input} type="password" value={pass}
            onChange={e => setPass(e.target.value)} placeholder="••••••"
            onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())} />
        </div>

        {err && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12, textAlign: "center", fontWeight: 600 }}>{err}</p>}

        <button disabled={busy} onClick={mode === "login" ? handleLogin : handleRegister}
          style={{ ...S.btn, background: busy ? C.textLite : C.primary, color: "#fff", width: "100%", fontSize: 16, padding: "14px" }}>
          {busy ? "⏳ Un momento…" : mode === "login" ? "→ Entrar" : "✨ Crear cuenta"}
        </button>

        <p style={{ color: C.textMid, fontSize: 12, marginTop: 10, textAlign: "center" }}>
          👑 El primer registro será administrador
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════════════════ */
function Header({ currentUser, view, logout }) {
  const titles = { home: "Inicio", "new-log": "Nueva Entrada", history: "Historial", admin: "Panel Admin" };
  return (
    <div style={{
      background: C.primary, color: "#fff",
      padding: "14px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>{currentUser.avatar}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{currentUser.name}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>{currentUser.role === "admin" ? "👑 Admin" : "🏠 Familia"}</div>
        </div>
      </div>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700 }}>{titles[view] || ""}</span>
      <button onClick={logout}
        style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
          borderRadius: 10, padding: "6px 12px", cursor: "pointer",
          fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>
        Salir
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   BOTTOM NAV
══════════════════════════════════════════════════════════ */
function BottomNav({ currentUser, view, setView }) {
  const items = [
    { id: "home",    icon: "🏠", label: "Inicio"    },
    { id: "new-log", icon: "➕", label: "Registrar" },
    { id: "history", icon: "📋", label: "Historial" },
    ...(currentUser.role === "admin" ? [{ id: "admin", icon: "📊", label: "Admin" }] : []),
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480,
      background: "#fff", borderTop: `1px solid ${C.border}`,
      display: "flex", zIndex: 50,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
    }}>
      {items.map(item => (
        <button key={item.id} onClick={() => setView(item.id)}
          style={{ flex: 1, padding: "8px 4px 10px", border: "none",
            background: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <span style={{ fontSize: 11, fontWeight: view === item.id ? 800 : 500,
            color: view === item.id ? C.primary : C.textLite }}>
            {item.label}
          </span>
          {view === item.id && <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary }} />}
        </button>
      ))}
    </div>
  );
}

/* ── Mini stat card ───────────────────────────────────── */
function MiniCard({ icon, label, value, color }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: "14px 8px", marginBottom: 0, flex: 1 }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 20, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HOME VIEW
══════════════════════════════════════════════════════════ */
function HomeView({ currentUser, entries, users, setView }) {
  const now         = new Date();
  const thisWeek    = getWeekNum(now);
  const thisYear    = now.getFullYear();
  const myEntries   = entries.filter(e => e.user_id === currentUser.id);
  const pts         = calcPoints(myEntries);
  const streak      = getStreakMonths(myEntries);
  const lastEntry   = [...myEntries].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const inactive    = !lastEntry || daysSince(lastEntry.date) >= 30;
  const weekEntries = myEntries.filter(e => getWeekNum(e.date) === thisWeek && new Date(e.date).getFullYear() === thisYear);
  const weekDone    = weekEntries.reduce((s, e) => s + (e.entry_tasks || []).filter(t => t.completed).length, 0);

  const leaderboard = users
    .map(u => ({ ...u, pts: calcPoints(entries.filter(e => e.user_id === u.id)) }))
    .sort((a, b) => b.pts - a.pts);

  return (
    <div style={{ padding: 16 }}>
      {/* Greeting */}
      <div style={{
        ...S.card,
        background: `linear-gradient(140deg, ${C.primary} 0%, ${C.primaryMid} 100%)`,
        color: "#fff", textAlign: "center", padding: "24px 16px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>🏠</div>
        <div style={{ fontSize: 44, marginBottom: 4 }}>{currentUser.avatar}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 6 }}>
          ¡Hola, {currentUser.name}!
        </div>
        <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 500 }}>{msgForUser(currentUser.id)}</div>
      </div>

      {/* Inactivity alert */}
      {inactive && (
        <div style={{ ...S.card, background: C.warnBg, border: `1.5px solid ${C.warn}` }}>
          <div style={{ fontWeight: 800, color: "#7A5C00", fontSize: 14 }}>⚠️ ¡Llevas más de 30 días sin registrar!</div>
          <div style={{ fontSize: 13, color: "#9A7C00", marginTop: 4 }}>¿Qué tal si retomas el hábito hoy? El hogar te espera 💚</div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <MiniCard icon="⭐" label="Puntos"       value={pts}     color={C.accent}  />
        <MiniCard icon="🔥" label="Racha (meses)" value={streak}  color={C.danger}  />
        <MiniCard icon="✅" label="Sem. actual"   value={weekDone} color={C.primary} />
      </div>

      {/* Streak badges */}
      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🏆 Mis logros</div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {[[3,"🥉","3 meses"],[6,"🥈","6 meses"],[12,"🥇","1 año"]].map(([m, badge, lbl]) => (
            <div key={m} style={{ textAlign: "center", opacity: streak >= m ? 1 : 0.25 }}>
              <div style={{ fontSize: 34 }}>{badge}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{lbl}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: streak >= m ? C.primaryMid : C.textLite }}>
                {streak >= m ? "✓ Logrado" : `${streak}/${m}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button onClick={() => setView("new-log")}
        style={{ ...S.btn, background: C.accent, color: "#fff", width: "100%",
          fontSize: 18, padding: "16px", marginBottom: 12,
          boxShadow: `0 4px 20px rgba(233,162,39,0.4)`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span>🧹</span> Registrar limpieza de hoy
      </button>

      {/* Leaderboard */}
      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>🏅 Clasificación familiar</div>
        {leaderboard.map((u, i) => (
          <div key={u.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px",
            borderBottom: i < leaderboard.length - 1 ? `1px solid ${C.border}` : "none",
            background: u.id === currentUser.id ? C.primaryBg : "transparent",
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 18, minWidth: 26 }}>{MEDALS[i] || i + 1}</span>
            <span style={{ fontSize: 22 }}>{u.avatar}</span>
            <span style={{ flex: 1, fontWeight: u.id === currentUser.id ? 800 : 500, fontSize: 14 }}>
              {u.name}{u.id === currentUser.id ? " (tú)" : ""}
            </span>
            <span style={{ fontWeight: 800, color: C.accent, fontSize: 14 }}>⭐ {u.pts}</span>
          </div>
        ))}
        {leaderboard.length > 0 && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: C.accentBg, borderRadius: 12,
            fontSize: 13, color: "#7A5C00", fontWeight: 700, textAlign: "center" }}>
            🎉 Líder del año: {leaderboard[0].avatar} {leaderboard[0].name} · {leaderboard[0].pts} pts
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NEW LOG VIEW
══════════════════════════════════════════════════════════ */
function NewLogView({ currentUser, refreshData, setView, showToast }) {
  const [date,      setDate]      = useState(todayStr());
  const [selected,  setSelected]  = useState({});
  const [status,    setStatus]    = useState({});
  const [notes,     setNotes]     = useState({});
  const [photos,    setPhotos]    = useState({});    // task id → File
  const [previews,  setPreviews]  = useState({});    // task id → dataURL
  const [elmira,    setElmira]    = useState({});
  const [otherText, setOtherText] = useState("");
  const [genNote,   setGenNote]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const fileRef = useRef({});

  function toggle(id) {
    const nowOn = !selected[id];
    setSelected(p => ({ ...p, [id]: nowOn }));
    if (nowOn) setStatus(p => ({ ...p, [id]: "complete" }));
  }

  function handlePhotoChange(taskId, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotos(p => ({ ...p, [taskId]: file }));
    const reader = new FileReader();
    reader.onload = ev => setPreviews(p => ({ ...p, [taskId]: ev.target.result }));
    reader.readAsDataURL(file);
  }

  async function submit() {
    const selectedTasks = TASKS.filter(t => selected[t.id]);
    if (!selectedTasks.length) { showToast("Selecciona al menos una tarea 🙃", "error"); return; }

    setSaving(true);
    try {
      // 1. Create a temporary entry id placeholder
      const tempId = `tmp_${Date.now()}`;

      // 2. Build tasks payload (without photos first)
      const taskRows = selectedTasks.map(t => ({
        id:            t.id,
        label:         t.id === "other" ? (otherText || "Otros") : t.label,
        icon:          t.icon,
        completed:     status[t.id] === "complete",
        note:          notes[t.id] || "",
        photoUrl:      null,
        elmiraApproves: elmira[t.id] || false,
      }));

      // 3. Save entry (tasks without photos)
      const entry = await saveEntry({
        userId:      currentUser.id,
        date,
        week:        getWeekNum(date),
        year:        new Date(date).getFullYear(),
        generalNote: genNote,
        tasks:       taskRows,
      });

      // 4. Upload photos and update task rows
      for (const t of selectedTasks) {
        if (photos[t.id] && status[t.id] === "complete") {
          try {
            const url = await uploadPhoto(photos[t.id], entry.id, t.id);
            // Find and update the task record
            const { data: taskRec } = await supabase
              .from("entry_tasks")
              .select("id")
              .eq("entry_id", entry.id)
              .eq("task_id", t.id)
              .single();
            if (taskRec) {
              await supabase.from("entry_tasks").update({ photo_url: url, elmira_approves: elmira[t.id] || false })
                .eq("id", taskRec.id);
            }
          } catch (photoErr) {
            console.warn("Error subiendo foto:", photoErr);
          }
        }
      }

      const done    = taskRows.filter(t => t.completed).length;
      const allDone = taskRows.every(t => t.completed) && done > 0;
      const pts     = done * 10 + (allDone ? 50 : 0);
      showToast(`✅ ¡Registrado! +${pts} pts${allDone ? " 🎉 +50 bonus" : ""}`);
      await refreshData();
      setView("home");
    } catch (e) {
      showToast("Error al guardar. Intenta de nuevo.", "error");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const doneCount = TASKS.filter(t => selected[t.id] && status[t.id] === "complete").length;
  const allDone   = TASKS.filter(t => selected[t.id]).length > 0 &&
                    TASKS.filter(t => selected[t.id]).every(t => status[t.id] === "complete");

  return (
    <div style={{ padding: 16 }}>
      {/* Date */}
      <div style={S.card}>
        <label style={S.label}>📅 Fecha de la limpieza</label>
        <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <div style={{ fontSize: 12, color: C.textMid, marginTop: 6 }}>Semana {getWeekNum(date)} del año</div>
      </div>

      {/* Tasks */}
      <div style={S.card}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>🧹 ¿Qué hiciste hoy?</div>
        {TASKS.map(task => (
          <div key={task.id} style={{ marginBottom: selected[task.id] ? 18 : 8 }}>
            <div onClick={() => toggle(task.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 14,
              background: selected[task.id] ? C.primaryBg : "#F8F8F6",
              border: `1.5px solid ${selected[task.id] ? C.primaryLite : C.border}`,
              cursor: "pointer", transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 24 }}>{task.icon}</span>
              <span style={{ flex: 1, fontWeight: selected[task.id] ? 700 : 500, fontSize: 14 }}>
                {task.id === "other" && selected[task.id] && otherText ? otherText : task.label}
              </span>
              <span style={{ fontSize: 22 }}>{selected[task.id] ? "✅" : "⬜"}</span>
            </div>

            {selected[task.id] && (
              <div style={{ marginTop: 8, paddingLeft: 14, borderLeft: `3px solid ${C.primaryLite}` }}>

                {task.hasText && (
                  <input style={{ ...S.input, marginBottom: 8, fontSize: 13 }}
                    value={otherText} onChange={e => setOtherText(e.target.value)}
                    placeholder="Especifica qué hiciste..." />
                )}

                {/* Status */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {[["complete","✅ Completa", C.primary],["incomplete","⚠️ Incompleta", C.danger]].map(([s, lbl, col]) => (
                    <button key={s} onClick={() => setStatus(p => ({ ...p, [task.id]: s }))}
                      style={{ ...S.btn, flex: 1, padding: "9px", fontSize: 13,
                        background: status[task.id] === s ? col : "#EFEFEF",
                        color: status[task.id] === s ? "#fff" : C.textMid }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Note for incomplete */}
                {status[task.id] === "incomplete" && (
                  <input style={{ ...S.input, fontSize: 13, marginBottom: 8 }}
                    value={notes[task.id] || ""}
                    onChange={e => setNotes(p => ({ ...p, [task.id]: e.target.value }))}
                    placeholder='"No hubo tiempo", "Estaba lloviendo"...' />
                )}

                {/* Photo for complete */}
                {status[task.id] === "complete" && (
                  <div>
                    <input type="file" accept="image/*" capture="environment"
                      ref={el => fileRef.current[task.id] = el}
                      style={{ display: "none" }}
                      onChange={e => handlePhotoChange(task.id, e)} />
                    {previews[task.id] ? (
                      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
                        <img src={previews[task.id]} alt="evidencia"
                          style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />
                        {elmira[task.id] && (
                          <div style={{
                            position: "absolute", bottom: 8, right: 8,
                            background: C.accent, color: "#fff", borderRadius: 20, padding: "4px 12px",
                            fontWeight: 800, fontSize: 12, transform: "rotate(-2deg)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                          }}>
                            👵 Doña Elmira Approves!
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, padding: 6, background: "#f9f9f9" }}>
                          <button onClick={() => { setPhotos(p => ({ ...p, [task.id]: null })); setPreviews(p => ({ ...p, [task.id]: null })); }}
                            style={{ ...S.btn, padding: "6px 10px", fontSize: 12, background: "#EFEFEF", color: C.textMid }}>
                            🗑️
                          </button>
                          <button onClick={() => setElmira(p => ({ ...p, [task.id]: !p[task.id] }))}
                            style={{ ...S.btn, flex: 1, padding: "6px", fontSize: 12,
                              background: elmira[task.id] ? C.accent : C.accentBg,
                              color: elmira[task.id] ? "#fff" : "#7A5C00" }}>
                            {elmira[task.id] ? "✅ Doña Elmira Approves!" : "👵 Marcar: Doña Elmira Approves"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => fileRef.current[task.id]?.click()}
                        style={{ ...S.btn, width: "100%", padding: "9px", fontSize: 13, background: "#EFEFEF", color: C.textMid, marginBottom: 6 }}>
                        📷 Subir evidencia (opcional)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* General note */}
      <div style={S.card}>
        <label style={S.label}>🗒️ Nota general (opcional)</label>
        <textarea style={{ ...S.input, resize: "vertical", minHeight: 72 }}
          value={genNote} onChange={e => setGenNote(e.target.value)}
          placeholder="¿Algo más que quieras comentar sobre la limpieza de hoy?" />
      </div>

      {/* Points preview */}
      {Object.values(selected).some(Boolean) && (
        <div style={{ ...S.card, background: C.primaryBg, border: `1.5px solid ${C.primaryLite}` }}>
          <div style={{ fontWeight: 700, color: C.primary, fontSize: 14 }}>
            🧮 Puntos estimados: +{doneCount * 10}{allDone ? " + 50 bonus 🎉" : ""}
          </div>
        </div>
      )}

      <button disabled={saving} onClick={submit}
        style={{ ...S.btn, background: saving ? C.textLite : C.primary, color: "#fff",
          width: "100%", fontSize: 17, padding: "16px", marginBottom: 8 }}>
        {saving ? "⏳ Guardando…" : "💾 Guardar registro"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HISTORY VIEW
══════════════════════════════════════════════════════════ */
function HistoryView({ currentUser, entries, refreshData, users, showToast }) {
  const [filterScope, setFilterScope] = useState("me");
  const [expanded,    setExpanded]    = useState(null);

  const filtered = entries
    .filter(e => filterScope === "me" ? e.user_id === currentUser.id : true)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar esta entrada?")) return;
    try {
      await deleteEntry(id);
      if (expanded === id) setExpanded(null);
      showToast("Entrada eliminada");
      await refreshData();
    } catch { showToast("Error al eliminar", "error"); }
  }

  function statusOf(entry) {
    const tasks = entry.entry_tasks || [];
    if (!tasks.length) return { label: "—", color: C.textLite };
    const done = tasks.filter(t => t.completed).length;
    if (done === tasks.length) return { label: "✅ Completa",   color: C.primary };
    if (done === 0)            return { label: "❌ Incompleta", color: C.danger  };
    return                            { label: "⚠️ Parcial",   color: C.warn    };
  }

  function userName(uid) {
    const u = users.find(u => u.id === uid);
    return u ? `${u.avatar} ${u.name}` : "?";
  }

  return (
    <div style={{ padding: 16 }}>
      {currentUser.role === "admin" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["me","Mis entradas"],["all","Todas"]].map(([f, lbl]) => (
            <button key={f} onClick={() => setFilterScope(f)}
              style={{ ...S.btn, flex: 1, padding: "9px", fontSize: 13,
                background: filterScope === f ? C.primary : "#F0F0F0",
                color: filterScope === f ? "#fff" : C.textMid }}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: C.textMid }}>
          <div style={{ fontSize: 52 }}>📋</div>
          <div style={{ fontSize: 15, marginTop: 10, fontWeight: 600 }}>No hay registros aún</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>¡Comienza registrando tu primera limpieza!</div>
        </div>
      )}

      {filtered.map(entry => {
        const st   = statusOf(entry);
        const open = expanded === entry.id;
        const isOwn = entry.user_id === currentUser.id;
        const pts   = (entry.entry_tasks || []).filter(t => t.completed).length * 10;

        return (
          <div key={entry.id} style={{ ...S.card, cursor: "pointer" }}
            onClick={() => setExpanded(open ? null : entry.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{entry.date}</div>
                <div style={{ fontSize: 12, color: C.textMid }}>
                  Semana {entry.week}
                  {filterScope === "all" ? ` · ${userName(entry.user_id)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: st.color }}>{st.label}</div>
                <div style={{ fontSize: 12, color: C.textLite }}>+{pts} pts</div>
              </div>
              <span style={{ color: C.textLite, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
            </div>

            {open && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}
                onClick={e => e.stopPropagation()}>

                {(entry.entry_tasks || []).map(task => (
                  <div key={task.id} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{task.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{task.label}</div>
                      {task.note && (
                        <div style={{ fontSize: 12, color: C.textMid, fontStyle: "italic", marginTop: 2 }}>
                          💬 "{task.note}"
                        </div>
                      )}
                      {task.photo_url && (
                        <div style={{ marginTop: 6, position: "relative", borderRadius: 10, overflow: "hidden" }}>
                          <img src={task.photo_url} alt="evidencia"
                            style={{ width: "100%", maxHeight: 130, objectFit: "cover", display: "block" }} />
                          {task.elmira_approves && (
                            <div style={{
                              position: "absolute", bottom: 6, right: 6,
                              background: C.accent, color: "#fff", borderRadius: 16, padding: "3px 9px",
                              fontWeight: 800, fontSize: 11, transform: "rotate(-2deg)",
                            }}>
                              👵 Doña Elmira Approves!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 18 }}>{task.completed ? "✅" : "⚠️"}</span>
                  </div>
                ))}

                {entry.general_note && (
                  <div style={{ background: C.bg, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: C.textMid, marginTop: 4 }}>
                    🗒️ {entry.general_note}
                  </div>
                )}

                {isOwn && (
                  <button onClick={() => handleDelete(entry.id)}
                    style={{ ...S.btn, width: "100%", padding: "8px", fontSize: 13,
                      background: C.dangerBg, color: C.danger, marginTop: 10 }}>
                    🗑️ Eliminar entrada
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ADMIN VIEW
══════════════════════════════════════════════════════════ */
function AdminView({ entries, users }) {
  const [tab,        setTab]        = useState("overview");
  const [filterUser, setFilterUser] = useState("all");
  const [filterWeek, setFilterWeek] = useState("all");

  const now      = new Date();
  const thisYear = now.getFullYear();

  /* Inactivity */
  const inactiveUsers = users.filter(u => {
    const last = [...entries.filter(e => e.user_id === u.id)]
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return !last || daysSince(last.date) >= 30;
  });

  /* Task frequency */
  function taskFreq(uid) {
    const ue = entries.filter(e => uid === "all" || e.user_id === uid);
    const f  = {};
    TASKS.forEach(t => (f[t.id] = 0));
    ue.forEach(e => (e.entry_tasks || []).filter(t => t.completed).forEach(t => (f[t.task_id] = (f[t.task_id] || 0) + 1)));
    return f;
  }

  /* Weeks list */
  const weeks = [...new Set(entries.map(e => `${e.year}-W${String(e.week).padStart(2, "0")}`))]
    .sort().reverse().slice(0, 16);

  /* Filtered log */
  const filtered = entries
    .filter(e => filterUser === "all" || e.user_id === filterUser)
    .filter(e => {
      if (filterWeek === "all") return true;
      return `${e.year}-W${String(e.week).padStart(2, "0")}` === filterWeek;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  /* Leaderboard */
  const leaderboard = users.map(u => ({
    ...u,
    pts:          calcPoints(entries.filter(e => e.user_id === u.id)),
    totalTasks:   entries.filter(e => e.user_id === u.id)
                    .reduce((s, e) => s + (e.entry_tasks || []).filter(t => t.completed).length, 0),
    totalEntries: entries.filter(e => e.user_id === u.id).length,
    streak:       getStreakMonths(entries.filter(e => e.user_id === u.id)),
  })).sort((a, b) => b.pts - a.pts);

  const freq = taskFreq(filterUser);
  const maxF = Math.max(...Object.values(freq), 1);

  /* Monthly */
  const monthEntries = entries.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <div style={{ padding: 16 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {[["overview","📊 Resumen"],["trends","📈 Tendencias"],["alerts","🔔 Alertas"],["log","📋 Bitácora"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ ...S.btn, padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap",
              background: tab === id ? C.primary : "#F0F0F0",
              color: tab === id ? "#fff" : C.textMid }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────── */}
      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <MiniCard icon="👥" label="Miembros"     value={users.length}   color={C.primary}   />
            <MiniCard icon="📋" label="Registros"    value={entries.length} color={C.accent}    />
            <MiniCard icon="✅" label="Tareas hechas"
              value={entries.reduce((s, e) => s + (e.entry_tasks || []).filter(t => t.completed).length, 0)}
              color={C.primaryMid} />
            <MiniCard icon="⚠️" label="Alertas" value={inactiveUsers.length} color={C.danger} />
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>🏆 Clasificación {thisYear}</div>
            {leaderboard.map((u, i) => (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", borderBottom: i < leaderboard.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
                <span style={{ fontSize: 18, minWidth: 24 }}>{MEDALS[i] || (i + 1)}</span>
                <span style={{ fontSize: 22 }}>{u.avatar}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: C.textMid }}>
                    {u.totalEntries} reg · {u.totalTasks} tareas · {u.streak}m 🔥
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: C.accent, fontSize: 15 }}>⭐ {u.pts}</div>
              </div>
            ))}
            {leaderboard[0] && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: C.accentBg, borderRadius: 12,
                fontSize: 13, color: "#7A5C00", fontWeight: 700, textAlign: "center" }}>
                🎉 Ganador del año: {leaderboard[0].avatar} {leaderboard[0].name} · {leaderboard[0].pts} pts
              </div>
            )}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>📅 Actividad este mes</div>
            {users.map(u => {
              const ue = monthEntries.filter(e => e.user_id === u.id);
              const t  = ue.reduce((s, e) => s + (e.entry_tasks || []).filter(t => t.completed).length, 0);
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{u.avatar}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{u.name}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: C.primary, fontSize: 13 }}>{t} tareas</div>
                    <div style={{ fontSize: 11, color: C.textMid }}>{ue.length} registros</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TRENDS ─────────────────────────────────────── */}
      {tab === "trends" && (
        <>
          <div style={S.card}>
            <label style={S.label}>Filtrar por usuario</label>
            <select style={S.input} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="all">Todos los miembros</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.avatar} {u.name}</option>)}
            </select>
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Frecuencia de tareas</div>
            {TASKS.map(task => (
              <div key={task.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{task.icon} {task.label}</span>
                  <span style={{ color: C.textMid, fontWeight: 700 }}>{freq[task.id] || 0}x</span>
                </div>
                <div style={{ height: 10, background: "#EFEFEF", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${((freq[task.id] || 0) / maxF) * 100}%`,
                    background: `linear-gradient(90deg, ${C.primary}, ${C.primaryLite})`,
                    borderRadius: 5, transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>⚠️ Tareas incompletas frecuentes</div>
            {(() => {
              const incFreq = {};
              TASKS.forEach(t => (incFreq[t.id] = { count: 0, notes: [] }));
              entries.filter(e => filterUser === "all" || e.user_id === filterUser)
                .forEach(e => (e.entry_tasks || []).filter(t => !t.completed)
                  .forEach(t => { incFreq[t.task_id].count++; if (t.note) incFreq[t.task_id].notes.push(t.note); }));
              const sorted = TASKS
                .map(t => ({ ...t, ...incFreq[t.id] }))
                .filter(t => t.count > 0)
                .sort((a, b) => b.count - a.count);
              if (!sorted.length) return (
                <div style={{ color: C.primary, fontWeight: 600, textAlign: "center", fontSize: 13 }}>
                  🎉 ¡Sin tareas incompletas destacadas!
                </div>
              );
              return sorted.map(task => (
                <div key={task.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{task.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{task.label}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: C.danger }}>{task.count}x</span>
                  </div>
                  {task.notes.slice(0, 2).map((n, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.textMid, fontStyle: "italic" }}>· "{n}"</div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </>
      )}

      {/* ── ALERTS ─────────────────────────────────────── */}
      {tab === "alerts" && (
        <>
          {inactiveUsers.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: 44 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10, color: C.primary }}>¡Toda la familia está activa!</div>
              <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>Nadie lleva más de 30 días sin registrar</div>
            </div>
          ) : (
            <div style={{ ...S.card, border: `1.5px solid ${C.danger}` }}>
              <div style={{ fontWeight: 800, color: C.danger, fontSize: 15, marginBottom: 10 }}>⚠️ Usuarios inactivos (+30 días)</div>
              {inactiveUsers.map(u => {
                const last = [...entries.filter(e => e.user_id === u.id)]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                const days = last ? daysSince(last.date) : null;
                return (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 26 }}>{u.avatar}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: C.danger, fontWeight: 600 }}>
                        {days === null ? "Sin registros aún" : `Último: hace ${days} días`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📅 Asistencia semanal</div>
            {weeks.slice(0, 8).map(week => {
              const we     = entries.filter(e => `${e.year}-W${String(e.week).padStart(2, "0")}` === week);
              const active = new Set(we.map(e => e.user_id));
              const total  = we.reduce((s, e) => s + (e.entry_tasks || []).filter(t => t.completed).length, 0);
              return (
                <div key={week} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{week}</span>
                    <span style={{ fontSize: 12, color: C.textMid }}>{total} tareas · {active.size}/{users.length} activos</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {users.map(u => (
                      <div key={u.id} style={{ position: "relative" }}>
                        <span style={{ fontSize: 26, opacity: active.has(u.id) ? 1 : 0.25 }}>{u.avatar}</span>
                        {!active.has(u.id) && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 11 }}>❌</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── LOG ────────────────────────────────────────── */}
      {tab === "log" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select style={{ ...S.input, flex: 1, fontSize: 13 }}
              value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="all">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.avatar} {u.name}</option>)}
            </select>
            <select style={{ ...S.input, flex: 1, fontSize: 13 }}
              value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
              <option value="all">Todas las semanas</option>
              {weeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: C.textMid, fontSize: 14 }}>No hay registros con este filtro</div>
          )}

          {filtered.map(entry => {
            const u     = users.find(u => u.id === entry.user_id);
            const tasks = entry.entry_tasks || [];
            const done  = tasks.filter(t => t.completed).length;
            const total = tasks.length;
            const sColor = done === total && total > 0 ? C.primary : done === 0 ? C.danger : C.warn;
            const incNotes = tasks.filter(t => !t.completed && t.note);
            return (
              <div key={entry.id} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{u?.avatar} {u?.name}</div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{entry.date} · S{entry.week}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: sColor }}>{done}/{total} ✅</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tasks.map(task => (
                    <span key={task.id} style={{
                      fontSize: 13, padding: "3px 10px", borderRadius: 20,
                      background: task.completed ? C.primaryBg : C.dangerBg,
                      color: task.completed ? C.primary : C.danger, fontWeight: 600,
                    }}>
                      {task.icon} {task.completed ? "✅" : "⚠️"}
                    </span>
                  ))}
                </div>
                {incNotes.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.textMid, fontStyle: "italic" }}>
                    💬 {incNotes.map(t => `${t.icon} "${t.note}"`).join(" · ")}
                  </div>
                )}
                {entry.general_note && (
                  <div style={{ marginTop: 6, fontSize: 12, color: C.textMid }}>🗒️ {entry.general_note}</div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════ */
export default function App() {
  const [loading,     setLoading]  = useState(true);
  const [users,       setUsers]    = useState([]);
  const [entries,     setEntries]  = useState([]);
  const [currentUser, setUser]     = useState(null);
  const [view,        setView]     = useState("home");
  const [toast,       setToast]    = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [u, e] = await Promise.all([
        fetchUsers(),
        currentUser.role === "admin" ? fetchAllEntries() : fetchEntriesForUser(currentUser.id),
      ]);
      setUsers(u);
      setEntries(e);
    } catch (err) {
      console.error("Error recargando datos:", err);
    }
  }, [currentUser]);

  /* Initial load */
  useEffect(() => {
    fetchUsers()
      .then(u => setUsers(u))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* Load entries when user logs in */
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const fn = currentUser.role === "admin" ? fetchAllEntries : () => fetchEntriesForUser(currentUser.id);
    fn()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  function handleLogin(user) {
    setUser(user);
    setView("home");
  }

  function logout() {
    setUser(null);
    setEntries([]);
    setView("home");
  }

  if (loading && !currentUser) return (
    <div style={{
      fontFamily: "'Nunito', sans-serif",
      minHeight: "100vh", background: C.primaryBg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14,
    }}>
      <div style={{ fontSize: 60 }}>🏠</div>
      <div style={{ fontWeight: 700, color: C.primary, fontSize: 16 }}>Cargando tu hogar…</div>
    </div>
  );

  if (!currentUser) {
    return (
      <>
        <Toast toast={toast} />
        <AuthScreen onLogin={handleLogin} showToast={showToast} />
      </>
    );
  }

  return (
    <div style={S.app}>
      <Toast toast={toast} />
      <Header currentUser={currentUser} view={view} logout={logout} />

      {loading
        ? <Spinner label="Cargando datos…" />
        : <>
            {view === "home"    && <HomeView    currentUser={currentUser} entries={entries} users={users} setView={setView} />}
            {view === "new-log" && <NewLogView  currentUser={currentUser} refreshData={refreshData} setView={setView} showToast={showToast} />}
            {view === "history" && <HistoryView currentUser={currentUser} entries={entries} refreshData={refreshData} users={users} showToast={showToast} />}
            {view === "admin"   && currentUser.role === "admin" && <AdminView entries={entries} users={users} />}
          </>
      }

      <BottomNav currentUser={currentUser} view={view} setView={setView} />
    </div>
  );
}
