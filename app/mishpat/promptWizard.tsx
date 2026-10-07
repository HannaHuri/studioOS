"use client";

/* ──────────────────────────────────────────────────────────────────────────
   בניית פרומפט מורכב — a guided way to write a prompt for the library.

   It produces nothing new: the result is an ordinary prompt body, handed to the
   existing PromptEditor for name, classification and sharing, then saved to the
   library like any other. The wizard only helps with the wording — what to do,
   on what material, in what shape, and which parts change from use to use
   (those become [fields], the same fields PromptFill already asks for).
   ────────────────────────────────────────────────────────────────────────── */

import { Fragment, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { c, dk, RED, FONT } from "./theme";
import { EXAMPLE_FIELD, fieldsOf } from "./prompts";

const STEPS = ["המשימה", "החומר", "מבנה התשובה", "הנוסח"];

// Starters, not categories: a chip writes the opening verb into the description, so the
// choice is visible in the text itself and there is no separate "type" to keep in sync.
const STARTERS = [
  { t: "סיכום", s: "סכם את " },
  { t: "השוואה", s: "השווה בין " },
  { t: "איתור", s: "אתר את כל " },
  { t: "ניסוח", s: "נסח " },
  { t: "בדיקה", s: "בדוק אם " },
];

const DOC_TYPES = ["כתבי טענות", "פרוטוקולים", "תצהירים", "חוות דעת", "החלטות", "ראיות"];

type Source = "all" | "types" | "pick";
type Format = "prose" | "bullets" | "table";
type Length = "short" | "normal" | "long";

type State = {
  task: string;
  source: Source; docTypes: string[]; focus: string;
  format: Format; columns: string; length: Length; cite: boolean; notes: string;
};

const INITIAL: State = {
  task: "", source: "all", docTypes: [], focus: "",
  format: "prose", columns: "", length: "normal", cite: true, notes: "",
};

const dot = (s: string) => { const t = s.trim(); return !t ? "" : /[.?!:]$/.test(t) ? t : t + "."; };
const joinHe = (xs: string[]) => xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " ו" + xs[xs.length - 1];

export function composePrompt(s: State): string {
  const parts: string[] = [dot(s.task)];
  if (s.source === "types" && s.docTypes.length) parts.push(`התבסס על ${joinHe(s.docTypes)} שבתיק בלבד.`);
  else if (s.source === "pick") parts.push("התבסס על המסמך [מסמך].");
  else parts.push("התבסס על כל מסמכי התיק.");
  if (s.focus.trim()) parts.push(`התמקד ב${s.focus.trim().replace(/^ב/, "")}.`.replace(/\.\.$/, "."));
  const cols = s.columns.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
  const shape = s.format === "table"
    ? `הצג את התשובה בטבלה${cols.length ? ` עם העמודות: ${cols.join(", ")}` : ""}`
    : s.format === "bullets" ? "הצג את התשובה כרשימת נקודות" : "הצג את התשובה כטקסט רציף";
  parts.push(shape + (s.length === "short" ? ", בקצרה." : s.length === "long" ? ", באופן מפורט." : "."));
  if (s.cite) parts.push("לכל טענה ציין את המסמך ואת העמוד שממנו היא לקוחה.");
  if (s.notes.trim()) parts.push(dot(s.notes));
  return parts.filter(Boolean).join(" ");
}

// The [fields] painted as chips, so the user sees which parts will be asked for on every use
function WithFields({ text, isDark }: { text: string; isDark: boolean }) {
  const bits = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {bits.map((b, i) => /^\[[^\]]+\]$/.test(b)
        ? <span key={i} className="px-1 rounded-[3px]" style={{ backgroundColor: isDark ? "#243354" : "#e5f0ff", color: isDark ? dk.blue : c.primary }}>{b}</span>
        : <Fragment key={i}>{b}</Fragment>)}
    </>
  );
}

export function PromptWizard({ isDark, hidden, onDone, onClose }: {
  isDark: boolean;
  hidden?: boolean;               // kept mounted while the save screen is open, so "ביטול" there comes back here intact
  onDone: (body: string, task: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<State>(INITIAL);
  const [attempted, setAttempted] = useState(false);
  // The last step is the composed text, editable. It is rebuilt from the earlier steps only when
  // those have changed since it was built — so going back to look doesn't throw away edits.
  const [text, setText] = useState("");
  const [builtFrom, setBuiltFrom] = useState("");
  const [customField, setCustomField] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const taskRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const composed = useMemo(() => composePrompt(s), [s]);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const quietBorder = isDark ? dk.border : c.border;

  const taskBare = !s.task.trim() || STARTERS.some((x) => x.s.trim() === s.task.trim());
  const taskMissing = attempted && taskBare;

  const go = (n: number) => {
    if (n > 0 && taskBare) { setStep(0); setAttempted(true); return; }
    if (n === 3 && composed !== builtFrom) { setText(composed); setBuiltFrom(composed); }
    setStep(n);
  };

  const pickStarter = (st: string) => {
    const cur = STARTERS.find((x) => s.task.startsWith(x.s));
    const next = cur ? st + s.task.slice(cur.s.length) : st + s.task;
    set("task", next);
    // straight back to the text, caret after the verb, so the sentence is simply continued
    requestAnimationFrame(() => { const el = taskRef.current; el?.focus(); el?.setSelectionRange(next.length, next.length); });
  };

  // Inserts a field at the caret, or turns the selected words into one
  const insertField = (name: string) => {
    const el = areaRef.current;
    const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length;
    const sel = text.slice(a, b).trim();
    const f = `[${name || sel}]`;
    if (!name && !sel) return;
    const next = text.slice(0, a) + f + text.slice(b);
    setText(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + f.length, a + f.length); });
  };

  const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="h-8 px-3 rounded-[4px] text-[13.5px] transition-colors"
      style={{
        border: `1px solid ${on ? c.primary : quietBorder}`,
        color: on ? c.primary : textCol,
        backgroundColor: on ? (isDark ? "#243354" : "#f0f5ff") : surface,
      }}
    >
      {children}
    </button>
  );
  const Label = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
    <div className={`text-[14px] mb-2 ${first ? "" : "mt-5"}`} style={{ color: textCol }}>{children}</div>
  );
  // spread onto the plain inputs — a component declared in here would remount on every keystroke
  const fieldLook = { className: "w-full px-3 py-2 text-[14px] outline-none rounded-[4px]", style: { border: `1px solid ${line}`, backgroundColor: surface, color: textCol } };
  const Box = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className="flex items-center gap-2 text-[13.5px]" style={{ color: textCol }}>
      <span className="size-[16px] flex-none flex items-center justify-center rounded-[3px]"
        style={{ border: `1px solid ${on ? c.primary : quietBorder}`, backgroundColor: on ? c.primary : "transparent" }}>
        {on && <Check size={12} style={{ color: "white" }} />}
      </span>
      {children}
    </button>
  );

  const fields = fieldsOf(text);
  const SUGGESTED = ["הצד", "שם העד", "תאריך", "נושא", EXAMPLE_FIELD];

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)", display: hidden ? "none" : undefined }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(760px, 92vw)", height: "min(640px, 88vh)", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-1">
          <div className="flex-1">
            <div className="text-[18px]" style={{ color: textCol }}>בניית פרומפט מורכב</div>
            <div className="text-[13px] mt-0.5" style={{ color: subCol }}>הפרומפט יישמר במאגר הפרומפטים, ותוכלו להפעיל אותו שוב בכל תיק.</div>
          </div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {/* Stepper — a step already reached can be clicked back into */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-4">
          {STEPS.map((t, i) => {
            const done = i < step, cur = i === step;
            return (
              <Fragment key={t}>
                {i > 0 && <div className="flex-1 h-px" style={{ backgroundColor: done || cur ? c.primary : line }} />}
                <button onClick={() => i <= step && go(i)} className="flex items-center gap-1.5 flex-none" style={{ cursor: i <= step ? "pointer" : "default" }}>
                  <span className="size-6 rounded-full flex items-center justify-center text-[12.5px]"
                    style={{
                      backgroundColor: done || cur ? c.primary : "transparent",
                      border: `1px solid ${done || cur ? c.primary : quietBorder}`,
                      color: done || cur ? "white" : subCol,
                    }}>
                    {done ? <Check size={13} /> : i + 1}
                  </span>
                  <span className="text-[13.5px]" style={{ color: cur ? textCol : subCol }}>{t}</span>
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 pb-2" dir="ltr">
          <div dir="rtl">
            {step === 0 && (
              <>
                <Label first>מה הפרומפט צריך לעשות?</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {STARTERS.map((x) => <Pill key={x.t} on={s.task.startsWith(x.s)} onClick={() => pickStarter(x.s)}>{x.t}</Pill>)}
                </div>
                <textarea
                  ref={taskRef}
                  value={s.task}
                  onChange={(e) => set("task", e.target.value)}
                  autoFocus
                  placeholder="תארו את המשימה במילים שלכם. למשל: סכם את עדותו של [שם העד] והצבע על סתירות בינה לבין התצהיר שהגיש"
                  className="w-full outline-none text-[14.5px] leading-relaxed rounded-[4px] px-3 py-2.5 resize-none"
                  style={{ border: `1px solid ${taskMissing ? RED : line}`, backgroundColor: isDark ? dk.input : surface, color: textCol, minHeight: "130px" }}
                />
                {taskMissing && <div className="text-[12.5px] mt-1" style={{ color: RED }}>יש לתאר את המשימה כדי להמשיך.</div>}
              </>
            )}

            {step === 1 && (
              <>
                <Label first>על איזה חומר לעבוד?</Label>
                <div className="flex flex-wrap gap-2">
                  <Pill on={s.source === "all"} onClick={() => set("source", "all")}>כל מסמכי התיק</Pill>
                  <Pill on={s.source === "types"} onClick={() => set("source", "types")}>סוגי מסמכים מסוימים</Pill>
                  <Pill on={s.source === "pick"} onClick={() => set("source", "pick")}>מסמך שאבחר בכל הפעלה</Pill>
                </div>
                {s.source === "types" && (
                  <div className="flex flex-wrap gap-x-5 gap-y-2.5 mt-3">
                    {DOC_TYPES.map((t) => (
                      <Box key={t} on={s.docTypes.includes(t)} onClick={() => set("docTypes", s.docTypes.includes(t) ? s.docTypes.filter((x) => x !== t) : [...s.docTypes, t])}>{t}</Box>
                    ))}
                  </div>
                )}
                {s.source === "pick" && (
                  <div className="text-[12.5px] mt-2" style={{ color: subCol }}>בכל הפעלה תתבקשו לציין את המסמך.</div>
                )}
                <Label>נושא להתמקד בו <span style={{ color: subCol }}>(לא חובה)</span></Label>
                <input {...fieldLook} value={s.focus} onChange={(e) => set("focus", e.target.value)} placeholder="למשל: שאלת הקשר הסיבתי" />
              </>
            )}

            {step === 2 && (
              <>
                <Label first>באיזו צורה להציג את התשובה?</Label>
                <div className="flex flex-wrap gap-2">
                  <Pill on={s.format === "prose"} onClick={() => set("format", "prose")}>טקסט רציף</Pill>
                  <Pill on={s.format === "bullets"} onClick={() => set("format", "bullets")}>רשימת נקודות</Pill>
                  <Pill on={s.format === "table"} onClick={() => set("format", "table")}>טבלה</Pill>
                </div>
                {s.format === "table" && (
                  <div className="mt-3">
                    <input {...fieldLook} value={s.columns} onChange={(e) => set("columns", e.target.value)} placeholder="עמודות הטבלה, מופרדות בפסיק. למשל: טענה, מקור, עמוד" />
                  </div>
                )}
                <Label>אורך</Label>
                <div className="flex flex-wrap gap-2">
                  <Pill on={s.length === "short"} onClick={() => set("length", "short")}>קצר</Pill>
                  <Pill on={s.length === "normal"} onClick={() => set("length", "normal")}>רגיל</Pill>
                  <Pill on={s.length === "long"} onClick={() => set("length", "long")}>מפורט</Pill>
                </div>
                <div className="mt-5">
                  <Box on={s.cite} onClick={() => set("cite", !s.cite)}>לכל טענה לציין מסמך ועמוד</Box>
                </div>
                <Label>הנחיות נוספות <span style={{ color: subCol }}>(לא חובה)</span></Label>
                <input {...fieldLook} value={s.notes} onChange={(e) => set("notes", e.target.value)} placeholder="למשל: אל תביע עמדה, רק הצג את הגרסאות" />
              </>
            )}

            {step === 3 && (
              <>
                <Label first>זה הנוסח שנבנה. אפשר לערוך אותו כאן.</Label>
                <textarea
                  ref={areaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full outline-none text-[14.5px] leading-relaxed rounded-[4px] px-3 py-2.5 resize-none"
                  style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : surface, color: textCol, minHeight: "150px" }}
                />
                <div className="text-[14px] mt-4 mb-1" style={{ color: textCol }}>מה משתנה מהפעלה להפעלה?</div>
                <div className="text-[12.5px] mb-2.5 leading-relaxed" style={{ color: subCol }}>
                  פרטים כאלה הופכים לשדות, ובכל הפעלה תתבקשו למלא אותם. לחיצה על שדה מוסיפה אותו במקום הסמן. אפשר גם לסמן מילים בנוסח ולהפוך אותן לשדה.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {SUGGESTED.map((f) => (
                    <button key={f} onClick={() => insertField(f)} className="h-7 px-2.5 rounded-[4px] text-[13px] transition-colors hover:opacity-80"
                      style={{ border: `1px dashed ${c.primary}`, color: isDark ? dk.blue : c.primary }}>
                      + [{f}]
                    </button>
                  ))}
                  <input
                    value={customField}
                    onChange={(e) => setCustomField(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && customField.trim()) { insertField(customField.trim()); setCustomField(""); } }}
                    placeholder="שדה אחר + Enter"
                    className="h-7 w-[130px] px-2 text-[13px] outline-none rounded-[4px]"
                    style={{ border: `1px solid ${line}`, backgroundColor: surface, color: textCol }}
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertField("")}
                    className="h-7 px-2.5 rounded-[4px] text-[13px] hover:bg-black/5 transition-colors"
                    style={{ border: `1px solid ${quietBorder}`, color: textCol }}
                  >
                    הפיכת הסימון לשדה
                  </button>
                </div>
                {fields.includes(EXAMPLE_FIELD) && (
                  <div className="text-[12.5px] mt-2" style={{ color: subCol }}>[{EXAMPLE_FIELD}] נבחרת בכל הפעלה מתוך פאנל הדוגמאות.</div>
                )}
              </>
            )}

            {/* The text so far — so every choice shows what it adds to the prompt */}
            {step < 3 && (
              <div className="mt-6 px-3 py-2.5 rounded-[4px]" style={{ backgroundColor: isDark ? dk.input : c.hoverBg }}>
                <div className="text-[12px] mb-1" style={{ color: subCol }}>הנוסח עד עכשיו</div>
                <div className="text-[13.5px] leading-relaxed" style={{ color: textCol }}>
                  {taskBare ? <span style={{ color: subCol }}>יופיע כאן כשתתארו את המשימה</span> : <WithFields text={composed} isDark={isDark} />}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4">
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ color: subCol }}>
            ביטול
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => go(step - 1)} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${quietBorder}`, color: textCol }}>
                הקודם
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => go(step + 1)} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
                הבא
              </button>
            ) : (
              <button onClick={() => text.trim() && onDone(text.trim(), s.task)} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
                המשך לשמירה
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
