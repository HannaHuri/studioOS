"use client";

import { useState } from "react";
import { Plus, Edit2, X, Check, CheckCircle2, Star } from "lucide-react";
import { c } from "../ui";

// ── Types (mirror the DB document shape) ──────────────────────────────────────
interface Model {
  modelID: number;
  modelName: string;        // technical id, e.g. "gemini-3.5-flash" — locked after create
  modelDisplayName: string; // shown to users
  modelDescription: string;
  maxWords: number;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string;
}

interface ModelFormState {
  modelName: string;
  modelDisplayName: string;
  modelDescription: string;
  maxWords: string; // kept as string for the input
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_MODELS: Model[] = [
  { modelID: 5, modelName: "gemini-2.5-pro",   modelDisplayName: "Gemini 2.5 Pro",   modelDescription: "מודל מתקדם לניתוח משפטי מעמיק", maxWords: 800000, isActive: true,  isDefault: true,  updatedAt: "27.05.2026" },
  { modelID: 6, modelName: "gemini-3.5-flash", modelDisplayName: "Gemini 3.5 Flash", modelDescription: "מודל מהיר לשאלות כלליות",        maxWords: 400000, isActive: true,  isDefault: false, updatedAt: "10.08.2026" },
  { modelID: 4, modelName: "gemini-2.0-flash", modelDisplayName: "Gemini 2.0 Flash", modelDescription: "",                             maxWords: 250000, isActive: false, isDefault: false, updatedAt: "01.04.2026" },
];

const EMPTY_FORM: ModelFormState = { modelName: "", modelDisplayName: "", modelDescription: "", maxWords: "" };

// Compact word count: 800000 → "800K", 1500000 → "1.5M"
function formatWords(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────
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

// Toggle switch (active / inactive)
function Toggle({ on, onClick, disabled, title }: {
  on: boolean; onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: "32px",
        height: "18px",
        borderRadius: "999px",
        backgroundColor: on ? c.primary : "#c5c7d0",
        position: "relative",
        transition: "background-color 0.15s",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          insetInlineStart: on ? "16px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: "white",
          transition: "inset-inline-start 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ModulesPage() {
  const [models, setModels]       = useState<Model[]>(MOCK_MODELS);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<ModelFormState>(EMPTY_FORM);
  const [errors, setErrors]       = useState<Partial<Record<keyof ModelFormState, string>>>({});
  const [toast, setToast]         = useState<string | null>(null);

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

  function openEdit(m: Model) {
    setForm({
      modelName: m.modelName,
      modelDisplayName: m.modelDisplayName,
      modelDescription: m.modelDescription,
      maxWords: String(m.maxWords),
    });
    setEditingId(m.modelID);
    setErrors({});
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  }

  function validate(): boolean {
    const e: Partial<Record<keyof ModelFormState, string>> = {};
    // Technical name only validated on create — locked afterwards
    if (!editingId) {
      if (!form.modelName.trim()) {
        e.modelName = "שם טכני נדרש";
      } else if (!/^[a-zA-Z0-9._-]+$/.test(form.modelName.trim())) {
        e.modelName = "אותיות לטיניות, מספרים, נקודה, מקף ומקף תחתון בלבד";
      } else if (models.some(m => m.modelName === form.modelName.trim())) {
        e.modelName = "כבר קיים מודל עם שם טכני זה";
      }
    }
    if (!form.modelDisplayName.trim()) e.modelDisplayName = "שם תצוגה נדרש";
    const words = Number(form.maxWords);
    if (!form.maxWords.trim() || !Number.isInteger(words) || words <= 0) {
      e.maxWords = "מספר חיובי שלם";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    const today = new Date().toLocaleDateString("he-IL");
    const words = Number(form.maxWords);

    if (editingId) {
      setModels(prev => prev.map(m =>
        m.modelID === editingId
          ? { ...m, modelDisplayName: form.modelDisplayName.trim(), modelDescription: form.modelDescription.trim(), maxWords: words, updatedAt: today }
          : m
      ));
      showToast(`המודל ${form.modelDisplayName.trim()} עודכן`);
    } else {
      const nextId = Math.max(0, ...models.map(m => m.modelID)) + 1;
      setModels(prev => [{
        modelID: nextId,
        modelName: form.modelName.trim(),
        modelDisplayName: form.modelDisplayName.trim(),
        modelDescription: form.modelDescription.trim(),
        maxWords: words,
        isActive: true,
        isDefault: false,
        updatedAt: today,
      }, ...prev]);
      showToast(`המודל ${form.modelDisplayName.trim()} נוצר בהצלחה`);
    }
    closeForm();
  }

  // ── Active toggle ─────────────────────────────────────────────────────────────
  function toggleActive(m: Model) {
    if (m.isActive && m.isDefault) {
      showToast("לא ניתן לכבות את מודל ברירת המחדל — בחר מודל ברירת מחדל אחר קודם");
      return;
    }
    const today = new Date().toLocaleDateString("he-IL");
    setModels(prev => prev.map(x =>
      x.modelID === m.modelID ? { ...x, isActive: !x.isActive, updatedAt: today } : x
    ));
    showToast(`המודל ${m.modelDisplayName} ${m.isActive ? "כובה" : "הופעל"}`);
  }

  // ── Default selection (single) ────────────────────────────────────────────────
  function setDefault(m: Model) {
    if (m.isDefault) return;
    if (!m.isActive) {
      showToast("רק מודל פעיל יכול להיות ברירת מחדל");
      return;
    }
    const today = new Date().toLocaleDateString("he-IL");
    setModels(prev => prev.map(x => ({
      ...x,
      isDefault: x.modelID === m.modelID,
      updatedAt: x.modelID === m.modelID || x.isDefault ? today : x.updatedAt,
    })));
    showToast(`${m.modelDisplayName} הוגדר כברירת המחדל`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page title + create button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-semibold" style={{ color: c.text }}>ניהול מודלים</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 h-9 rounded-md text-[14px] font-medium"
            style={{ backgroundColor: c.primary, color: "white", cursor: "pointer", fontFamily: "'Noto Sans Hebrew', sans-serif" }}
          >
            <Plus size={16} style={{ flexShrink: 0 }} />
            <span style={{ lineHeight: 1, display: "inline-flex", alignItems: "center" }}>מודל חדש</span>
          </button>
        </div>

        {/* ── Create / Edit modal ── */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={closeForm}
          >
            <div
              className="rounded-xl p-6 w-[560px] max-w-[calc(100vw-32px)] relative"
              style={{ backgroundColor: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
              onClick={e => e.stopPropagation()}
            >
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
                <h2 className="text-[18px] font-semibold" style={{ color: c.text }}>
                  {editingId ? "עריכת מודל" : "הוספת מודל חדש"}
                </h2>
                {editingId && (
                  <span className="text-[14px] font-mono mt-0.5 block" style={{ color: c.textLight, direction: "ltr", textAlign: "right" }}>
                    {form.modelName}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {!editingId && (
                  <FormField label="שם טכני" hint="מזהה המודל — נעול לאחר יצירה" error={errors.modelName}>
                    <input
                      type="text"
                      value={form.modelName}
                      onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))}
                      placeholder="gemini-3.5-flash"
                      className="w-full h-10 rounded-md px-3 text-[15px] outline-none"
                      style={{ border: `1px solid ${errors.modelName ? c.error : c.inputBorder}`, color: c.text, direction: "ltr", textAlign: "left", fontFamily: "monospace" }}
                    />
                  </FormField>
                )}

                <FormField label="שם תצוגה" hint="השם שהמשתמשים רואים" error={errors.modelDisplayName}>
                  <input
                    type="text"
                    value={form.modelDisplayName}
                    onChange={e => setForm(f => ({ ...f, modelDisplayName: e.target.value }))}
                    placeholder="Gemini 3.5 Flash"
                    className="w-full h-10 rounded-md px-3 text-[15px] outline-none"
                    style={{ border: `1px solid ${errors.modelDisplayName ? c.error : c.inputBorder}`, color: c.text }}
                  />
                </FormField>

                <FormField label="תיאור" hint="אופציונלי">
                  <textarea
                    value={form.modelDescription}
                    onChange={e => setForm(f => ({ ...f, modelDescription: e.target.value }))}
                    placeholder="מודל מהיר לשאלות כלליות"
                    rows={2}
                    className="w-full rounded-md px-3 py-2 text-[15px] outline-none"
                    style={{ border: `1px solid ${c.inputBorder}`, color: c.text, resize: "none", lineHeight: 1.5 }}
                  />
                </FormField>

                <FormField label="מקסימום מילים" error={errors.maxWords}>
                  <input
                    type="number"
                    value={form.maxWords}
                    onChange={e => setForm(f => ({ ...f, maxWords: e.target.value }))}
                    placeholder="400000"
                    className="w-full h-10 rounded-md px-3 text-[15px] outline-none"
                    style={{ border: `1px solid ${errors.maxWords ? c.error : c.inputBorder}`, color: c.text, direction: "ltr", textAlign: "left" }}
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

        {/* ── Models table ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: "white" }}>
          <table className="w-full text-[15px]" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ backgroundColor: c.hoverBg, borderBottom: `1px solid ${c.border}` }}>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "60px" }}>מזהה</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "150px" }}>שם תצוגה</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "172px" }}>שם טכני</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray }}>תיאור</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "104px", whiteSpace: "nowrap" }}>מקס׳ מילים</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "62px" }}>פעיל</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "104px", whiteSpace: "nowrap" }}>ברירת מחדל</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: c.textGray, width: "94px", whiteSpace: "nowrap" }}>עדכון אחרון</th>
                <th className="px-4 py-3" style={{ width: "86px" }} />
              </tr>
            </thead>
            <tbody>
              {models.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-[15px]" style={{ color: c.textLight }}>
                    אין מודלים עדיין — לחץ על &quot;מודל חדש&quot; כדי להתחיל
                  </td>
                </tr>
              )}

              {models.map((m, idx) => (
                <tr key={m.modelID} style={{ borderTop: idx > 0 ? `1px solid ${c.border}` : "none" }}>
                  {/* Model ID */}
                  <td className="px-4 py-3" style={{ color: c.textGray, direction: "ltr", textAlign: "right" }}>{m.modelID}</td>

                  {/* Display name — the one emphasized cell */}
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: c.text }}>{m.modelDisplayName}</span>
                  </td>

                  {/* Technical name */}
                  <td className="px-4 py-3">
                    <span style={{ color: c.textGray, fontFamily: "monospace", direction: "ltr", display: "inline-block" }}>
                      {m.modelName}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3" style={{ color: c.textGray }}>
                    {m.modelDescription || "—"}
                  </td>

                  {/* Max words (compact K format) */}
                  <td className="px-4 py-3" style={{ color: c.textGray, direction: "ltr", textAlign: "right" }}>
                    {formatWords(m.maxWords)}
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <div className="flex justify-start">
                      <Toggle
                        on={m.isActive}
                        onClick={() => toggleActive(m)}
                        title={m.isDefault && m.isActive ? "מודל ברירת המחדל — בחר אחר לפני כיבוי" : m.isActive ? "כבה מודל" : "הפעל מודל"}
                      />
                    </div>
                  </td>

                  {/* Default (single select) — star toggle */}
                  <td className="px-4 py-3">
                    <div className="flex justify-start">
                      <button
                        onClick={() => setDefault(m)}
                        disabled={m.isDefault || !m.isActive}
                        title={m.isDefault ? "ברירת המחדל" : m.isActive ? "הגדר כברירת מחדל" : "רק מודל פעיל יכול להיות ברירת מחדל"}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "4px",
                          display: "inline-flex",
                          cursor: m.isDefault ? "default" : m.isActive ? "pointer" : "not-allowed",
                        }}
                        onMouseEnter={e => { if (!m.isDefault && m.isActive) e.currentTarget.querySelector("svg")?.setAttribute("stroke", "#f5b800"); }}
                        onMouseLeave={e => { if (!m.isDefault) e.currentTarget.querySelector("svg")?.setAttribute("stroke", c.border); }}
                      >
                        <Star
                          size={18}
                          fill={m.isDefault ? "#f5b800" : "none"}
                          color={m.isDefault ? "#f5b800" : c.border}
                        />
                      </button>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3" style={{ color: c.textGray }}>{m.updatedAt}</td>

                  {/* Actions — button pinned to the left edge, gap opens to its right */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openEdit(m)}
                        className="flex items-center justify-center px-2.5 text-[14px] font-medium"
                        title="עריכה"
                        style={{ height: "32px", border: `1px solid ${c.border}`, color: c.text, backgroundColor: "transparent", borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.hoverBg)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)", zIndex: 300,
            backgroundColor: c.primary, borderRadius: "4px", boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 8px 8px 16px",
            fontSize: "16px", fontWeight: 400, color: "white", whiteSpace: "nowrap", direction: "rtl",
            animation: "toastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both", WebkitFontSmoothing: "antialiased",
          }}
        >
          <CheckCircle2 size={20} color="white" strokeWidth={2} />
          <span style={{ flex: 1 }}>{toast}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "white", display: "flex", alignItems: "center", padding: "4px", opacity: 0.8, marginInlineStart: "8px" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
