"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Edit2, X, ChevronDown, Zap, Lock, Globe, Check, CheckCircle2 } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const c = {
  primary:     "#0073ea",
  headerBg:    "#ecedf5",
  darkBlue:    "#00376d",
  text:        "#323338",
  textGray:    "#707070",
  textLight:   "#8596af",
  iconGray:    "#676879",
  border:      "#c5c7d0",
  inputBorder: "#dcdfec",
  hoverBg:     "#f5f6f8",
  error:       "#d83a52",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type BetaStatus = "active" | "closed" | "open";

interface Beta {
  id: string;
  name: string;
  status: BetaStatus;
  users: string[];
  updatedAt: string;
}

// Form no longer includes status — managed via the status menu button
interface BetaFormState {
  name: string;
  users: string; // comma-separated
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_BETAS: Beta[] = [
  {
    id: "1",
    name: "v2-ai-search",
    status: "active",
    users: ["daniD", "sarahK", "ronL", "miriF", "avivG", "noaT", "yaelB", "oferM", "tamarK", "eladP"],
    updatedAt: "27.05.2026",
  },
  { id: "2", name: "v3-dark-mode",   status: "closed", users: [],                          updatedAt: "20.05.2026" },
  { id: "3", name: "v1-new-sidebar", status: "open",   users: [],                          updatedAt: "15.05.2026" },
];

const CURRENT_ADMIN = { initials: "טח", name: "טל חבקין" };

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<BetaStatus, {
  label: string; bg: string; text: string; border: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = {
  active: { label: "פעילה",        bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd", Icon: Zap   },
  closed: { label: "סגורה",        bg: "#fde8eb", text: "#d83a52", border: "#f9a8a8", Icon: Lock  },
  open:   { label: "פתוחה לכולם", bg: "#dcfce7", text: "#15803d", border: "#86efac", Icon: Globe },
};

// ── Confirmation copy per target status ───────────────────────────────────────
const CONFIRM_COPY: Record<BetaStatus, { title: string; body: (name: string) => React.ReactNode }> = {
  active: {
    title: "פתיחת בטא",
    body:  name => <>לפתוח את בטא <BetaName>{name}</BetaName> למשתמשים המורשים?</>,
  },
  closed: {
    title: "סגירת בטא",
    body:  name => <>לסגור את בטא <BetaName>{name}</BetaName>?</>,
  },
  open: {
    title: "פתיחה לכולם",
    body:  name => <>לפתוח את בטא <BetaName>{name}</BetaName> לכלל המשתמשים?</>,
  },
};

const EMPTY_FORM: BetaFormState = { name: "", users: "" };

// ── Sub-components ────────────────────────────────────────────────────────────
function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/studioOS/logo.png" alt="לוגו" className="h-[30px] w-auto" />;
}

function BetaName({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "#323338", fontFamily: "monospace", direction: "ltr", display: "inline", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function FormField({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-[15px] font-medium" style={{ color: c.text }}>{label}</span>
        {hint && <span className="block text-[13px] mt-0.5" style={{ color: c.textLight }}>{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[14px] mt-1" style={{ color: c.error }}>{error}</p>}
    </div>
  );
}

// ── Status menu button ────────────────────────────────────────────────────────
// Dropdown rendered at a fixed position to escape table overflow:hidden
function StatusMenuButton({
  beta, isOpen, onToggle, onSelect,
}: {
  beta: Beta; isOpen: boolean; onToggle: () => void; onSelect: (s: BetaStatus) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);

  function handleToggle() {
    if (!isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({
        top:   r.bottom + 4,
        right: window.innerWidth - r.right,
      });
    }
    onToggle();
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 text-[14px] font-medium"
        style={{
          height: "32px",
          border: `1px solid ${c.border}`,
          color: c.text,
          backgroundColor: isOpen ? c.hoverBg : "transparent",
          borderRadius: "4px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        סטטוס
        <ChevronDown size={12} style={{ transition: "transform 0.15s", transform: isOpen ? "rotate(180deg)" : "none" }} />
      </button>

      {isOpen && dropPos && (
        <div
          style={{
            position: "fixed",
            top: dropPos.top,
            right: dropPos.right,
            zIndex: 200,
            backgroundColor: "white",
            border: `1px solid ${c.border}`,
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            minWidth: "176px",
            padding: "4px 0",
          }}
        >
          {(Object.entries(STATUS_CONFIG) as [BetaStatus, typeof STATUS_CONFIG[BetaStatus]][]).map(([status, s]) => {
            const isCurrent = status === beta.status;
            return (
              <button
                key={status}
                onClick={() => onSelect(status)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[15px]"
                style={{
                  backgroundColor: isCurrent ? "#eff4ff" : "transparent",
                  color: isCurrent ? c.primary : c.text,
                  cursor: isCurrent ? "default" : "pointer",
                  textAlign: "right",
                  direction: "rtl",
                  fontWeight: isCurrent ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = c.hoverBg; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = isCurrent ? "#eff4ff" : "transparent"; }}
              >
                <s.Icon size={14} color={isCurrent ? c.primary : c.iconGray} />
                <span style={{ flex: 1 }}>{s.label}</span>
                {isCurrent && <Check size={13} color={c.primary} />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [betas, setBetas]         = useState<Beta[]>(MOCK_BETAS);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<BetaFormState>(EMPTY_FORM);
  const [errors, setErrors]       = useState<Partial<Record<keyof BetaFormState, string>>>({});
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);
  const usersRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the users textarea whenever content changes (or the form opens)
  useEffect(() => {
    const el = usersRef.current;
    if (!el) return;
    el.style.height = "auto";
    const MAX = 240; // grow up to ~10 lines before scrolling
    const capped = Math.min(el.scrollHeight, MAX);
    el.style.height = capped + "px";
    el.style.overflowY = el.scrollHeight > MAX ? "auto" : "hidden";
  }, [form.users, showForm]);
  const [pendingStatus, setPendingStatus]   = useState<{ beta: Beta; newStatus: BetaStatus } | null>(null);
  const [toast, setToast]                   = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Form helpers ────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(beta: Beta) {
    setForm({ name: beta.name, users: beta.users.join(", ") });
    setEditingId(beta.id);
    setErrors({});
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  }

  function validate(): boolean {
    const e: Partial<Record<keyof BetaFormState, string>> = {};
    // Name only validated on create — cannot be changed after creation
    if (!editingId) {
      if (!form.name.trim()) {
        e.name = "שם הבטא נדרש";
      } else if (!/^[a-zA-Z0-9_-]+$/.test(form.name.trim())) {
        e.name = "שם יכול להכיל אותיות לטיניות, מספרים, מקף ומקף תחתון בלבד";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    const today    = new Date().toLocaleDateString("he-IL");
    const userList = form.users.split(",").map(u => u.trim()).filter(Boolean);

    if (editingId) {
      // Editing: only users list changes — name is immutable
      const betaName = betas.find(b => b.id === editingId)?.name ?? "";
      setBetas(prev =>
        prev.map(b => b.id === editingId ? { ...b, users: userList, updatedAt: today } : b)
      );
      showToast(`רשימת המשתמשים של ${betaName} עודכנה`);
    } else {
      // Creating: new beta defaults to "active"
      const name = form.name.trim();
      setBetas(prev => [{
        id: Date.now().toString(),
        name,
        status: "active",
        users: userList,
        updatedAt: today,
      }, ...prev]);
      showToast(`בטא ${name} נוצרה בהצלחה`);
    }
    closeForm();
  }

  // ── Status change (via menu button) ─────────────────────────────────────────
  function requestStatusChange(beta: Beta, newStatus: BetaStatus) {
    if (newStatus === beta.status) return; // no-op for current status
    setPendingStatus({ beta, newStatus });
  }

  function confirmStatusChange() {
    if (!pendingStatus) return;
    const { beta, newStatus } = pendingStatus;
    const today = new Date().toLocaleDateString("he-IL");
    setBetas(prev =>
      prev.map(b => b.id === beta.id ? { ...b, status: newStatus, updatedAt: today } : b)
    );
    showToast(`סטטוס "${beta.name}" שונה ל${STATUS_CONFIG[newStatus].label}`);
    setPendingStatus(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      dir="rtl"
      style={{ backgroundColor: "#f8f9fb", fontFamily: "'Noto Sans Hebrew', sans-serif" }}
    >
      {/* ── Header ── */}
      <header
        dir="ltr"
        className="h-16 flex items-center justify-between px-8 sticky top-0 z-10"
        style={{ backgroundColor: c.headerBg, borderBottom: `1px solid ${c.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-full flex items-center justify-center text-white text-[14px] flex-shrink-0 select-none"
            style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}
          >
            {CURRENT_ADMIN.initials}
          </div>
          <div className="flex flex-col leading-tight text-right">
            <span className="text-[13px] whitespace-nowrap" style={{ color: c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{CURRENT_ADMIN.name}</span>
          </div>
        </div>

        <a
          href="/studioOS/mishpat"
          dir="rtl"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          style={{ textDecoration: "none" }}
        >
          <Logo />
          <span
            className="font-medium text-[20px] whitespace-nowrap"
            style={{ color: c.darkBlue, fontFamily: "Rubik, sans-serif", lineHeight: 1 }}
          >
            נט המשפט
          </span>
        </a>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Page title + create button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-semibold" style={{ color: c.text }}>ניהול בטאות</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 h-9 rounded-md text-[14px] font-medium"
            style={{ backgroundColor: c.primary, color: "white", cursor: "pointer", fontFamily: "'Noto Sans Hebrew', sans-serif" }}
          >
            <Plus size={16} style={{ flexShrink: 0 }} />
            <span style={{ lineHeight: 1, display: "inline-flex", alignItems: "center" }}>בטא חדשה</span>
          </button>
        </div>

        {/* ── Edit / Create modal ── */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={closeForm}
          >
            <div
              className="rounded-xl p-6 w-[816px] max-w-[calc(100vw-32px)] relative"
              style={{ backgroundColor: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close — top-left corner */}
              <button
                onClick={closeForm}
                className="absolute size-7 flex items-center justify-center rounded-md"
                style={{ color: c.iconGray, top: "12px", left: "12px" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <X size={16} />
              </button>

              <div className="mb-5">
                <div>
                  <h2 className="text-[18px] font-semibold" style={{ color: c.text }}>
                    {editingId ? "עריכת משתמשים" : "יצירת בטא חדשה"}
                  </h2>
                  {editingId && (
                    <span className="text-[14px] font-mono mt-0.5 block" style={{ color: c.textLight }}>
                      {form.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {!editingId && (
                  <FormField label="שם הבטא" hint="אותיות לטיניות, מספרים, מקף" error={errors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="v2-ai-search"
                      className="w-full h-10 rounded-md px-3 text-[16px] outline-none"
                      style={{
                        border: `1px solid ${errors.name ? c.error : c.inputBorder}`,
                        color: c.text,
                        direction: "ltr",
                        textAlign: "left",
                        fontFamily: "monospace",
                      }}
                    />
                  </FormField>
                )}

                <FormField label="משתמשים מורשים" hint="מופרדים בפסיק" error={errors.users}>
                  <textarea
                    ref={usersRef}
                    value={form.users}
                    onChange={e => setForm(f => ({ ...f, users: e.target.value }))}
                    placeholder="daniD, sarahK, ronL"
                    rows={1}
                    className="w-full rounded-md px-3 text-[16px] outline-none"
                    style={{
                      border: `1px solid ${errors.users ? c.error : c.inputBorder}`,
                      color: c.text,
                      direction: "ltr",
                      textAlign: "left",
                      resize: "none",
                      overflowY: "hidden",
                      lineHeight: "1.6",
                      paddingTop: "9px",
                      paddingBottom: "9px",
                      minHeight: "40px",
                      fontFamily: "monospace",
                    }}
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={closeForm}
                  className="px-4 h-9 rounded-md text-[15px]"
                  style={{ border: `1px solid ${c.border}`, color: c.text, backgroundColor: "transparent", cursor: "pointer" }}
                >
                  ביטול
                </button>
                <button
                  onClick={save}
                  className="px-4 h-9 rounded-md text-[15px] font-medium"
                  style={{ backgroundColor: c.primary, color: "white", cursor: "pointer" }}
                >
                  שמירה
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transparent overlay to close any open status menu */}
        {openStatusMenu && (
          <div className="fixed inset-0 z-20" onClick={() => setOpenStatusMenu(null)} />
        )}

        {/* ── Betas table ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${c.border}`, backgroundColor: "white" }}
        >
          <table className="w-full text-[15px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: c.hoverBg, borderBottom: `1px solid ${c.border}` }}>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray, width: "150px" }}>שם</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray, width: "110px" }}>סטטוס</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray }}>משתמשים מורשים</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray, width: "110px" }}>עדכון אחרון</th>
                <th className="px-5 py-3" style={{ width: "210px" }} />
              </tr>
            </thead>
            <tbody>
              {betas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-[15px]" style={{ color: c.textLight }}>
                    אין בטאות עדיין — לחץ על &quot;בטא חדשה&quot; כדי להתחיל
                  </td>
                </tr>
              )}

              {betas.map((beta, idx) => (
                <tr
                  key={beta.id}
                  style={{ borderTop: idx > 0 ? `1px solid ${c.border}` : "none" }}
                >
                  {/* Name */}
                  <td className="px-5 py-3">
                    <span
                      className="font-medium text-[15px]"
                      style={{ color: c.text, fontFamily: "monospace", direction: "ltr", display: "inline-block" }}
                    >
                      {beta.name}
                    </span>
                  </td>

                  {/* Status — static badge */}
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[14px] font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: STATUS_CONFIG[beta.status].bg,
                        color: STATUS_CONFIG[beta.status].text,
                        border: `1px solid ${STATUS_CONFIG[beta.status].border}`,
                      }}
                    >
                      {STATUS_CONFIG[beta.status].label}
                    </span>
                  </td>

                  {/* Authorized users — count + alphabetically sorted chips */}
                  <td className="px-5 py-3">
                    {beta.users.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {[...beta.users].sort((a, b) => a.localeCompare(b)).map(u => (
                          <span
                            key={u}
                            className="px-2 py-0.5 rounded text-[16px]"
                            style={{
                              backgroundColor: c.hoverBg,
                              color: c.textGray,
                              border: `1px solid ${c.inputBorder}`,
                              fontFamily: "monospace",
                            }}
                          >
                            {u}
                          </span>
                        ))}
                        <span
                          className="flex-shrink-0 text-[15px] mr-1"
                          style={{ color: c.text }}
                          title={`${beta.users.length} משתמשים מורשים`}
                        >
                          ({beta.users.length})
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: c.textLight }}>—</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3" style={{ color: c.textGray }}>{beta.updatedAt}</td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(beta)}
                        className="flex items-center gap-1.5 px-3 text-[14px] font-medium"
                        style={{
                          height: "32px",
                          border: `1px solid ${c.border}`,
                          color: c.text,
                          backgroundColor: "transparent",
                          borderRadius: "4px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Edit2 size={12} />
                        עריכת משתמשים
                      </button>

                      <StatusMenuButton
                        beta={beta}
                        isOpen={openStatusMenu === beta.id}
                        onToggle={() => setOpenStatusMenu(openStatusMenu === beta.id ? null : beta.id)}
                        onSelect={newStatus => {
                          setOpenStatusMenu(null);
                          requestStatusChange(beta, newStatus);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>

      {/* ── Status-change confirmation dialog ── */}
      {pendingStatus && (() => {
        const copy = CONFIRM_COPY[pendingStatus.newStatus];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={() => setPendingStatus(null)}
          >
            <div
              className="rounded-xl p-6 w-[400px] max-w-[calc(100vw-32px)]"
              style={{ backgroundColor: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-[18px] font-semibold mb-2" style={{ color: c.text }}>
                {copy.title}
              </h2>
              <p className="text-[15px] mb-6" style={{ color: c.textGray }}>
                {copy.body(pendingStatus.beta.name)}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPendingStatus(null)}
                  className="px-4 h-9 rounded-md text-[15px]"
                  style={{ border: `1px solid ${c.border}`, color: c.text, backgroundColor: "transparent", cursor: "pointer" }}
                >
                  ביטול
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="px-4 h-9 rounded-md text-[15px] font-medium"
                  style={{ backgroundColor: c.primary, color: "white", cursor: "pointer" }}
                >
                  אישור
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Toast (Vibe-style: solid bg, white text, slide-in) ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            backgroundColor: c.primary,
            borderRadius: "4px",           // Vibe --border-radius-small
            boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 8px 8px 16px",
            fontSize: "16px",
            fontWeight: 400,
            color: "white",
            whiteSpace: "nowrap",
            direction: "rtl",
            animation: "toastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          <CheckCircle2 size={20} color="white" strokeWidth={2} />
          <span style={{ flex: 1 }}>{toast}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "white",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              opacity: 0.8,
              marginInlineStart: "8px",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
          >
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}
