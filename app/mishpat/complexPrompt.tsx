"use client";

/* ──────────────────────────────────────────────────────────────────────────
   פרומפט מורכב — a named prompt made of parts that run in order as one unit.

   Each part says three things, in this order: what to do (מה לעשות), which
   document types it draws on (מקורות), and how (איך — usually a pasted example,
   e.g. a passage from an earlier judgment). The parts are one prompt: a later part sees
   what the earlier ones produced, which is why their order can be changed.

   Deliberately left out (they were in the dev team's builder): date filters,
   ordering, max documents, keyword filters, few-shot lists, JSON. A selection rule
   such as "the amended statement of claim if there is one" is written in מה לעשות.
   How this looks inside the library is still open — for now it is saved there as
   an ordinary prompt carrying its parts.
   ────────────────────────────────────────────────────────────────────────── */

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { c, dk, RED, FONT } from "./theme";

export type PromptPart = { sources: string[]; task: string; how: string };

// Document types as נט המשפט files them — the list the sources field completes from
export const DOC_TYPES = [
  "כתב תביעה", "כתב תביעה מתוקן", "כתב הגנה", "כתב הגנה מתוקן", "כתב תשובה",
  "בקשה", "תגובה לבקשה", "תשובה לתגובה", "החלטה", "פרוטוקול דיון",
  "תצהיר", "תצהיר עדות ראשית", "חוות דעת מומחה", "חוות דעת מומחה מטעם בית המשפט",
  "סיכומים", "סיכומי תשובה", "פסק דין", "הודעה", "מוצגים", "כתב ערעור",
];

const emptyPart = (): PromptPart => ({ sources: [], task: "", how: "" });

// ── Sources: tags with autocomplete ─────────────────────────────────────────
function SourcesInput({ value, onChange, isDark }: { value: string[]; onChange: (v: string[]) => void; isDark: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const surface = isDark ? dk.surface : "white";

  const options = DOC_TYPES.filter((t) => !value.includes(t) && t.includes(q.trim()));
  // the list closes after each pick so it never sits over the fields below; typing or a click reopens it
  const add = (t: string) => { onChange([...value, t]); setQ(""); setHi(0); setOpen(false); inputRef.current?.focus(); };

  return (
    <div className="relative">
      <div
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        className="min-h-[38px] flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-[4px] cursor-text"
        style={{ border: `1px solid ${open ? c.primary : line}`, backgroundColor: surface }}
      >
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 h-[24px] px-2 rounded-[3px] text-[13px]"
            style={{ backgroundColor: isDark ? "#243354" : c.badgeBg, color: isDark ? dk.text : c.darkBlue }}>
            {t}
            <button onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== t)); }} className="opacity-60 hover:opacity-100" title="הסרה">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, options.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter" && options[hi]) { e.preventDefault(); add(options[hi]); }
            else if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={value.length ? "" : "כל מסמכי התיק. אפשר לבחור סוגי מסמכים מסוימים"}
          className="flex-1 min-w-[120px] h-[24px] bg-transparent outline-none text-[13.5px]"
          style={{ color: textCol }}
        />
      </div>
      {open && options.length > 0 && (
        <div
          className="absolute z-10 right-0 left-0 mt-1 max-h-[220px] overflow-y-auto docs-scroll rounded-[4px] shadow-lg py-1"
          style={{ backgroundColor: surface, border: `1px solid ${line}` }}
        >
          {options.map((t, i) => (
            <button
              key={t}
              onMouseDown={(e) => { e.preventDefault(); add(t); }}
              onMouseEnter={() => setHi(i)}
              className="w-full text-right px-3 py-1.5 text-[13.5px]"
              style={{ color: textCol, backgroundColor: i === hi ? (isDark ? dk.input : c.hoverBg) : "transparent" }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {open && options.length === 0 && q.trim() && (
        <div className="absolute z-10 right-0 left-0 mt-1 px-3 py-2 rounded-[4px] shadow-lg text-[13px]"
          style={{ backgroundColor: surface, border: `1px solid ${line}`, color: subCol }}>
          אין סוג מסמך בשם הזה
        </div>
      )}
    </div>
  );
}

// ── The editor ──────────────────────────────────────────────────────────────
export function ComplexPromptEditor({ isDark, onSave, onClose }: {
  isDark: boolean;
  onSave: (name: string, parts: PromptPart[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [parts, setParts] = useState<PromptPart[]>([emptyPart()]);
  const [attempted, setAttempted] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const quietBorder = isDark ? dk.border : c.border;

  const setPart = (i: number, p: Partial<PromptPart>) => setParts((prev) => prev.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setParts((prev) => {
    const next = [...prev]; [next[i], next[i + d]] = [next[i + d], next[i]]; return next;
  });
  const addPart = () => {
    setParts((prev) => [...prev, emptyPart()]);
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  };

  const save = () => {
    if (!name.trim() || parts.some((p) => !p.task.trim())) { setAttempted(true); return; }
    onSave(name.trim(), parts.map((p) => ({ ...p, task: p.task.trim(), how: p.how.trim() })));
  };

  const area = "w-full outline-none text-[14px] leading-relaxed rounded-[4px] px-3 py-2 resize-y";
  const iconBtn = "size-7 flex items-center justify-center rounded transition-colors hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        // wide enough that every writing field is as wide as the chat's own input (768px):
        // 768 + the part card's padding and border (34) + the dialog's own padding (48)
        style={{ width: "min(850px, 92vw)", height: "88vh", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-4">
          <div className="flex-1 text-[18px]" style={{ color: textCol }}>פרומפט מורכב חדש</div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {/* inset like the fields inside the part cards, so the name lines up with them */}
        <div className="pb-3" style={{ paddingInline: "41px" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הפרומפט, למשל: כתיבת פסק דין"
            className="w-full px-3 py-2.5 text-[16px] outline-none rounded-[4px]"
            style={{ border: `1px solid ${attempted && !name.trim() ? RED : line}`, backgroundColor: surface, color: textCol }}
            autoFocus
          />
          {attempted && !name.trim() && <div className="text-[12.5px] mt-1" style={{ color: RED }}>יש להזין שם.</div>}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 pb-4" dir="ltr">
          <div dir="rtl" className="flex flex-col gap-3">
            {parts.map((p, i) => {
              const taskMissing = attempted && !p.task.trim();
              return (
                <div key={i} className="rounded-lg px-4 pt-2 pb-4" style={{ border: `1px solid ${line}` }}>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="size-6 rounded-full flex items-center justify-center text-[12.5px] ml-1.5" style={{ backgroundColor: c.primary, color: "white" }}>{i + 1}</span>
                    <span className="flex-1 text-[14.5px]" style={{ color: textCol }}>חלק {i + 1}</span>
                    <button className={iconBtn} style={{ color: subCol }} disabled={i === 0} onClick={() => move(i, -1)} title="הזזה למעלה"><ArrowUp size={15} /></button>
                    <button className={iconBtn} style={{ color: subCol }} disabled={i === parts.length - 1} onClick={() => move(i, 1)} title="הזזה למטה"><ArrowDown size={15} /></button>
                    <button className={iconBtn} style={{ color: subCol }} disabled={parts.length === 1} onClick={() => setParts((prev) => prev.filter((_, j) => j !== i))} title="מחיקת החלק"><Trash2 size={15} /></button>
                  </div>

                  <div className="text-[13px] mb-1" style={{ color: textCol }}>מה לעשות</div>
                  <textarea
                    value={p.task}
                    onChange={(e) => setPart(i, { task: e.target.value })}
                    rows={3}
                    placeholder="למשל: תאר את ההיסטוריה הדיונית של התיק לפי סדר כרונולוגי"
                    className={area}
                    style={{ border: `1px solid ${taskMissing ? RED : line}`, backgroundColor: isDark ? dk.input : surface, color: textCol }}
                  />
                  {taskMissing && <div className="text-[12.5px] mt-1" style={{ color: RED }}>יש לכתוב מה החלק הזה צריך לעשות.</div>}

                  <div className="text-[13px] mt-3 mb-1" style={{ color: textCol }}>מקורות</div>
                  <SourcesInput value={p.sources} onChange={(v) => setPart(i, { sources: v })} isDark={isDark} />

                  <div className="text-[13px] mt-3 mb-1" style={{ color: textCol }}>איך <span style={{ color: subCol }}>(לא חובה)</span></div>
                  <textarea
                    value={p.how}
                    onChange={(e) => setPart(i, { how: e.target.value })}
                    rows={3}
                    placeholder="אפשר להדביק כאן דוגמה, למשל קטע מפסק דין קודם, או לתאר את אופן הכתיבה"
                    className={area}
                    style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : surface, color: textCol }}
                  />
                </div>
              );
            })}

            <button
              onClick={addPart}
              className="h-11 flex items-center justify-center gap-1.5 rounded-lg text-[14px] transition-colors hover:bg-black/[0.02]"
              style={{ border: `1px dashed ${quietBorder}`, color: isDark ? dk.blue : c.primary }}
            >
              <Plus size={16} /> הוספת חלק
            </button>
            <div ref={listEnd} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${line}` }}>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${quietBorder}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={save} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            שמירה
          </button>
        </div>
      </div>
    </div>
  );
}

// The parts as plain text — what the library card shows until its own form for these exists
export const partsToText = (parts: PromptPart[]) =>
  parts.map((p, i) =>
    `חלק ${i + 1} — ${p.task}\nמקורות: ${p.sources.length ? p.sources.join(", ") : "כל מסמכי התיק"}${p.how ? `\nאיך: ${p.how}` : ""}`,
  ).join("\n\n");
