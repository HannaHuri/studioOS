"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, Edit2, X, Check, Shield, ChevronDown, ArrowRight,
} from "lucide-react";

// ── Design tokens (same as main page) ────────────────────────────────────────
const c = {
  primary:      "#0073ea",
  primaryLight: "#cce5ff",
  headerBg:     "#ecedf5",
  darkBlue:     "#00376d",
  text:         "#323338",
  textGray:     "#707070",
  textLight:    "#8596af",
  iconGray:     "#676879",
  border:       "#c5c7d0",
  inputBorder:  "#dcdfec",
  hoverBg:      "#f5f6f8",
  error:        "#d83a52",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type BetaStatus = "active" | "closed" | "open";

interface Beta {
  id: string;
  name: string;
  status: BetaStatus;
  users: string[];       // authorized usernames
  updatedAt: string;
}

interface BetaFormState {
  name: string;
  status: BetaStatus;
  users: string;         // comma-separated string (as typed)
}

// ── Mock data (dev team: replace with API calls) ──────────────────────────────
const MOCK_BETAS: Beta[] = [
  {
    id: "1",
    name: "v2-ai-search",
    status: "active",
    users: ["daniD", "sarahK", "ronL"],
    updatedAt: "27.05.2026",
  },
  {
    id: "2",
    name: "v3-dark-mode",
    status: "closed",
    users: [],
    updatedAt: "20.05.2026",
  },
  {
    id: "3",
    name: "v1-new-sidebar",
    status: "open",
    users: [],
    updatedAt: "15.05.2026",
  },
];

// ── Mock current admin user (dev team: replace with real auth) ────────────────
const CURRENT_ADMIN = { initials: "דד", name: "דניאל דמביץ" };

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<BetaStatus, { label: string; bg: string; text: string; border: string }> = {
  active: { label: "פעילה",        bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  closed: { label: "סגורה",        bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" },
  open:   { label: "פתוחה לכולם", bg: "#dcfce7", text: "#15803d", border: "#86efac" },
};

const EMPTY_FORM: BetaFormState = { name: "", status: "active", users: "" };

// ── Sub-components ────────────────────────────────────────────────────────────
function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/studioOS/logo.png" alt="לוגו" className="h-[30px] w-auto" />;
}

function StatusBadge({ status }: { status: BetaStatus }) {
  const s = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function FormField({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-[13px] font-medium" style={{ color: c.text }}>{label}</span>
        {hint && <span className="block text-[11px] mt-0.5" style={{ color: c.textLight }}>{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[12px] mt-1" style={{ color: c.error }}>{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [betas, setBetas]       = useState<Beta[]>(MOCK_BETAS);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState<BetaFormState>(EMPTY_FORM);
  const [errors, setErrors]     = useState<Partial<Record<keyof BetaFormState, string>>>({});

  // ── Form helpers ────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(beta: Beta) {
    setForm({ name: beta.name, status: beta.status, users: beta.users.join(", ") });
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
    if (!form.name.trim()) {
      e.name = "שם הבטא נדרש";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(form.name.trim())) {
      e.name = "שם יכול להכיל אותיות לטיניות, מספרים, מקף ומקף תחתון בלבד";
    }
    if (form.status === "active" && !form.users.trim()) {
      e.users = "בטא פעילה דורשת לפחות משתמש מורשה אחד";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;

    const today = new Date().toLocaleDateString("he-IL");
    const userList = form.status === "active"
      ? form.users.split(",").map(u => u.trim()).filter(Boolean)
      : [];

    if (editingId) {
      setBetas(prev =>
        prev.map(b =>
          b.id === editingId
            ? { ...b, name: form.name.trim(), status: form.status, users: userList, updatedAt: today }
            : b
        )
      );
    } else {
      const newBeta: Beta = {
        id: Date.now().toString(),
        name: form.name.trim(),
        status: form.status,
        users: userList,
        updatedAt: today,
      };
      setBetas(prev => [newBeta, ...prev]);
    }
    closeForm();
  }

  function toggleStatus(beta: Beta) {
    // Closing → just flip to closed
    if (beta.status !== "closed") {
      const today = new Date().toLocaleDateString("he-IL");
      setBetas(prev => prev.map(b => b.id === beta.id ? { ...b, status: "closed", updatedAt: today } : b));
      return;
    }
    // Opening a closed beta with no users → must go through form to set users
    if (beta.users.length === 0) {
      openEdit(beta);
      return;
    }
    // Opening a closed beta that already has users
    const today = new Date().toLocaleDateString("he-IL");
    setBetas(prev => prev.map(b => b.id === beta.id ? { ...b, status: "active", updatedAt: today } : b));
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
        {/* Left: avatar + name + role */}
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-full flex items-center justify-center text-white text-[14px] flex-shrink-0 select-none"
            style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}
          >
            {CURRENT_ADMIN.initials}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px]" style={{ color: c.darkBlue }}>{CURRENT_ADMIN.name}</span>
            <span className="text-[11px] flex items-center gap-1" style={{ color: c.primary }}>
              <Shield size={10} />
              אדמין
            </span>
          </div>

          {/* Back to app */}
          <a
            href="/studioOS/mishpat"
            className="flex items-center gap-1.5 text-[12px] rounded-md px-3 h-7 mr-2 transition-colors hover:opacity-80"
            style={{ backgroundColor: c.border, color: c.text }}
          >
            <ArrowRight size={13} />
            חזרה לאפליקציה
          </a>
        </div>

        {/* Right: logo + name */}
        <div className="flex items-center gap-2">
          <Logo />
          <span
            className="font-medium text-[20px] whitespace-nowrap"
            style={{ color: c.darkBlue, fontFamily: "Rubik, sans-serif", lineHeight: 1 }}
          >
            נט המשפט
          </span>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Page title + create button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-semibold" style={{ color: c.text }}>ניהול בטאות</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 h-9 rounded-md text-[14px] font-medium"
            style={{ backgroundColor: c.primary, color: "white", cursor: "pointer" }}
          >
            <Plus size={16} />
            בטא חדשה
          </button>
        </div>

        {/* ── Modal: Create / Edit form ── */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={closeForm}
          >
            <div
              className="rounded-xl p-6 w-[520px] max-w-[calc(100vw-32px)]"
              style={{
                backgroundColor: "white",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-semibold" style={{ color: c.text }}>
                  {editingId ? "עריכת בטא" : "יצירת בטא חדשה"}
                </h2>
                <button
                  onClick={closeForm}
                  className="size-7 flex items-center justify-center rounded-md transition-colors"
                  style={{ color: c.iconGray }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Name */}
                <FormField label="שם הבטא" hint="אותיות לטיניות, מספרים, מקף" error={errors.name}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="v2-ai-search"
                    className="w-full h-9 rounded-md px-3 text-[13px] outline-none"
                    style={{
                      border: `1px solid ${errors.name ? c.error : c.inputBorder}`,
                      color: c.text,
                      direction: "ltr",
                      textAlign: "left",
                      fontFamily: "monospace",
                    }}
                  />
                </FormField>

                {/* Status */}
                <FormField label="סטטוס">
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as BetaStatus }))}
                      className="w-full h-9 rounded-md px-3 text-[13px] outline-none appearance-none"
                      style={{
                        border: `1px solid ${c.inputBorder}`,
                        color: c.text,
                        backgroundColor: "white",
                        paddingLeft: "32px",
                      }}
                    >
                      <option value="active">פעילה</option>
                      <option value="closed">סגורה</option>
                      <option value="open">פתוחה לכולם</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: "10px", color: c.iconGray }}
                    />
                  </div>
                </FormField>

                {/* Authorized users — only when status = active */}
                {form.status === "active" && (
                  <div className="md:col-span-2">
                    <FormField
                      label="משתמשים מורשים"
                      hint="מופרדים בפסיק"
                      error={errors.users}
                    >
                      <input
                        type="text"
                        value={form.users}
                        onChange={e => setForm(f => ({ ...f, users: e.target.value }))}
                        placeholder="daniD, sarahK, ronL"
                        className="w-full h-9 rounded-md px-3 text-[13px] outline-none"
                        style={{
                          border: `1px solid ${errors.users ? c.error : c.inputBorder}`,
                          color: c.text,
                          direction: "ltr",
                          textAlign: "left",
                        }}
                      />
                    </FormField>
                  </div>
                )}
              </div>

              {/* Actions — justified to the left, שמור leftmost */}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={closeForm}
                  className="px-4 h-9 rounded-md text-[13px]"
                  style={{ border: `1px solid ${c.border}`, color: c.text, backgroundColor: "transparent" }}
                >
                  ביטול
                </button>
                <button
                  onClick={save}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-md text-[13px] font-medium"
                  style={{ backgroundColor: c.primary, color: "white" }}
                >
                  <Check size={14} />
                  שמור
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Betas table ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${c.border}`, backgroundColor: "white" }}
        >
          <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: c.hoverBg, borderBottom: `1px solid ${c.border}` }}>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray, width: "200px" }}>שם</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray, width: "140px" }}>סטטוס</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray }}>משתמשים מורשים</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: c.textGray, width: "130px" }}>עדכון אחרון</th>
                <th className="px-5 py-3" style={{ width: "130px" }} />
              </tr>
            </thead>
            <tbody>
              {betas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-[13px]" style={{ color: c.textLight }}>
                    אין בטאות עדיין — לחץ על &quot;בטא חדשה&quot; כדי להתחיל
                  </td>
                </tr>
              )}

              {betas.map((beta, idx) => {
                return (
                  <tr
                    key={beta.id}
                    style={{ borderTop: idx > 0 ? `1px solid ${c.border}` : "none" }}
                  >
                    {/* Name */}
                    <td className="px-5 py-3">
                      <span
                        className="font-medium text-[13px]"
                        style={{ color: c.text, fontFamily: "monospace", direction: "ltr", display: "inline-block" }}
                      >
                        {beta.name}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <StatusBadge status={beta.status} />
                    </td>

                    {/* Authorized users */}
                    <td className="px-5 py-3">
                      {beta.users.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {beta.users.map(u => (
                            <span
                              key={u}
                              className="px-2 py-0.5 rounded text-[11px]"
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
                        </div>
                      ) : (
                        <span style={{ color: c.textLight }}>—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3" style={{ color: c.textGray }}>{beta.updatedAt}</td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => openEdit(beta)}
                          className="flex items-center gap-1 px-2.5 h-7 rounded text-[12px]"
                          style={{
                            border: `1px solid ${c.border}`,
                            color: c.text,
                            backgroundColor: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <Edit2 size={11} />
                          עריכה
                        </button>

                        {beta.status !== "closed" ? (
                          <button
                            onClick={() => toggleStatus(beta)}
                            className="flex items-center gap-1 px-2.5 h-7 rounded text-[12px]"
                            style={{
                              backgroundColor: "#fff0f1",
                              border: "1px solid #f9a8a8",
                              color: c.error,
                              cursor: "pointer",
                            }}
                          >
                            סגור
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleStatus(beta)}
                            className="flex items-center gap-1 px-2.5 h-7 rounded text-[12px]"
                            style={{
                              backgroundColor: c.primaryLight,
                              border: "1px solid #93c5fd",
                              color: c.primary,
                              cursor: "pointer",
                            }}
                          >
                            פתח
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <p className="text-[12px] mt-3" style={{ color: c.textLight }}>
          * תכולת הבטא נקבעת בצד הלקוח — שם הבטא הוא המפתח המקשר בין הדף לבטא
        </p>
      </main>
    </div>
  );
}
