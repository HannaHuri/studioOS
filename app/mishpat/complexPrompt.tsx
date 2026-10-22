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

import { useImperativeHandle, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, FileText, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import { c, dk, RED, FONT } from "./theme";
import { PromptConfirm } from "./prompts";

// A part draws on the whole case, on document types (`sources`), or — only when the question is
// built from the chat's input, inside a case — on specific documents of that case, each with an
// optional page range (`docs`). `scope` is which of the three was chosen; left out, it follows
// what's filled in.
// `pages` is set on a document uploaded by the user, which the case's list doesn't know.
export type DocPick = { name: string; from?: number; to?: number; pages?: number };
export type SourceScope = "all" | "types" | "docs";
// `howDocs`: documents uploaded as an example for איך — often an earlier judgment — each with the
// pages that answer the how. One uploaded document can serve several parts, each with its own pages.
export type PromptPart = { sources: string[]; task: string; how: string; docs?: DocPick[]; scope?: SourceScope; howDocs?: DocPick[] };
export const scopeOf = (p: PromptPart): SourceScope => p.scope ?? (p.docs?.length ? "docs" : p.sources.length ? "types" : "all");
// A case document the sources field offers, under its document type.
export type CaseDocOption = { type: string; name: string; pages: number };

// Document types as נט המשפט files them — the list the sources field completes from
export const DOC_TYPES = [
  "כתב תביעה", "כתב תביעה מתוקן", "כתב הגנה", "כתב הגנה מתוקן", "כתב תשובה",
  "בקשה", "תגובה לבקשה", "תשובה לתגובה", "החלטה", "פרוטוקול דיון",
  "תצהיר", "תצהיר עדות ראשית", "חוות דעת מומחה", "חוות דעת מומחה מטעם בית המשפט",
  "סיכומים", "סיכומי תשובה", "פסק דין", "הודעה", "מוצגים", "כתב ערעור",
];

export const emptyPart = (): PromptPart => ({ sources: [], task: "", how: "" });

// ── Sources: tags with autocomplete ─────────────────────────────────────────
// With `caseDocs` the field works inside a case: `only="types"` completes from the document types
// this case has, `only="docs"` from the case's own documents — a document picked there goes in the
// list under the field, where its pages can be set.
function SourcesInput({ value, onChange, isDark, caseDocs, docs = [], onDocs, only }: {
  value: string[]; onChange: (v: string[]) => void; isDark: boolean;
  caseDocs?: CaseDocOption[]; docs?: DocPick[]; onDocs?: (v: DocPick[]) => void;
  only?: "types" | "docs";
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const surface = isDark ? dk.surface : "white";

  // one list for the keyboard to walk: the types first, then the case's documents
  type Opt = { kind: "type"; label: string } | { kind: "doc"; label: string; doc: CaseDocOption };
  const options: Opt[] = [
    // inside a case, the types are the ones this case has, so the list stays short
    ...(only === "docs" ? [] : caseDocs ? Array.from(new Set(caseDocs.map((d) => d.type))) : DOC_TYPES)
      .filter((t) => !value.includes(t) && t.includes(q.trim())).map((t) => ({ kind: "type" as const, label: t })),
    ...(only === "types" ? [] : caseDocs ?? []).filter((d) => !docs.some((x) => x.name === d.name) && (d.name.includes(q.trim()) || d.type.includes(q.trim())))
      .map((d) => ({ kind: "doc" as const, label: d.name, doc: d })),
  ];
  // the list closes after each pick so it never sits over the fields below; typing or a click reopens it
  const add = (o: Opt) => {
    if (o.kind === "type") onChange([...value, o.label]); else onDocs?.([...docs, { name: o.label }]);
    setQ(""); setHi(0); setOpen(false); inputRef.current?.focus();
  };
  const firstDoc = options.findIndex((o) => o.kind === "doc");

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
          placeholder={value.length ? "" : only === "docs"
            ? (docs.length ? "אפשר להוסיף מסמכים נוספים" : "התחילו להקליד שם מסמך מהתיק")
            : only === "types" ? "התחילו להקליד סוג מסמך, למשל כתב תביעה"
            : "כל מסמכי התיק. אפשר לבחור סוגי מסמכים מסוימים"}
          className="flex-1 min-w-[120px] h-[24px] bg-transparent outline-none text-[13.5px]"
          style={{ color: textCol }}
        />
      </div>
      {open && options.length > 0 && (
        <div
          className="absolute z-10 right-0 left-0 mt-1 max-h-[300px] overflow-y-auto docs-scroll rounded-[4px] shadow-lg py-1"
          style={{ backgroundColor: surface, border: `1px solid ${line}` }}
        >
          {options.map((o, i) => (
            <div key={o.kind + o.label}>
              {caseDocs && !only && (i === 0 || i === firstDoc) && (
                <div className="px-3 pt-1.5 pb-0.5 text-[12px]" style={{ color: subCol, borderTop: i > 0 ? `1px solid ${line}` : "none", marginTop: i > 0 ? "4px" : 0 }}>
                  {o.kind === "type" ? "סוגי מסמכים" : "מסמכים מהתיק"}
                </div>
              )}
              <button
                onMouseDown={(e) => { e.preventDefault(); add(o); }}
                onMouseEnter={() => setHi(i)}
                className="w-full flex items-center gap-2 text-right px-3 py-1.5 text-[13.5px]"
                style={{ color: textCol, backgroundColor: i === hi ? (isDark ? dk.input : c.hoverBg) : "transparent" }}
              >
                {o.kind === "doc" && <FileText size={14} style={{ color: c.iconGray, flexShrink: 0 }} />}
                <span className="truncate">{o.label}</span>
                {o.kind === "doc" && <span className="text-[12px] flex-shrink-0" style={{ color: subCol }}>{o.doc.type} · {o.doc.pages} עמ׳</span>}
              </button>
            </div>
          ))}
        </div>
      )}
      {open && options.length === 0 && q.trim() && (
        <div className="absolute z-10 right-0 left-0 mt-1 px-3 py-2 rounded-[4px] shadow-lg text-[13px]"
          style={{ backgroundColor: surface, border: `1px solid ${line}`, color: subCol }}>
          {only === "docs" ? "אין מסמך בתיק בשם הזה" : "אין סוג מסמך בשם הזה"}
        </div>
      )}
      {/* The specific documents picked, each with its own page range */}
      <DocRows docs={docs} onDocs={(v) => onDocs?.(v)} isDark={isDark} caseDocs={caseDocs} />
    </div>
  );
}

// ── Documents with page ranges ──────────────────────────────────────────────
// One row per document: its name, from which page to which, and removal. Used for the case's
// documents under מקורות and for the documents uploaded under איך.
function DocRows({ docs, onDocs, isDark, caseDocs, className = "mt-2" }: {
  docs: DocPick[]; onDocs: (v: DocPick[]) => void; isDark: boolean; caseDocs?: CaseDocOption[];
  className?: string; // its spacing: under the field it belongs to, or above it
}) {
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const surface = isDark ? dk.surface : "white";
  const setRange = (name: string, k: "from" | "to", raw: string, max: number) => {
    const n = raw === "" ? undefined : Math.max(1, Math.min(max, parseInt(raw, 10) || 1));
    onDocs(docs.map((v) => (v.name === name ? { ...v, [k]: n } : v)));
  };
  if (!docs.length) return null;
  return (
    <div className={`${className} flex flex-col gap-1.5`}>
      {docs.map((v) => {
        const d = caseDocs?.find((x) => x.name === v.name);
        const pages = d?.pages ?? v.pages;
        const max = pages ?? 9999;
        const num = "w-[56px] h-7 px-1.5 text-center text-[13px] outline-none rounded-[3px]";
        return (
          <div key={v.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px]" style={{ border: `1px solid ${line}`, backgroundColor: surface }}>
            <FileText size={14} style={{ color: c.primary, flexShrink: 0 }} />
            <span className="flex-1 min-w-0 truncate text-[13.5px]" style={{ color: textCol }}>
              {v.name}{d ? <span className="text-[12px]" style={{ color: subCol }}> · {d.type}</span>
                : pages && <span className="text-[12px]" style={{ color: subCol }}> · {pages} עמ׳</span>}
            </span>
            <span className="flex items-center gap-1 text-[12.5px] flex-shrink-0" style={{ color: subCol }}>
              עמודים
              <input type="number" min={1} max={max} value={v.from ?? ""} placeholder="1" onChange={(e) => setRange(v.name, "from", e.target.value, max)}
                className={num} style={{ border: `1px solid ${line}`, color: textCol, backgroundColor: isDark ? dk.input : "white" }} aria-label="מעמוד" />
              עד
              <input type="number" min={1} max={max} value={v.to ?? ""} placeholder={pages ? String(pages) : ""} onChange={(e) => setRange(v.name, "to", e.target.value, max)}
                className={num} style={{ border: `1px solid ${line}`, color: textCol, backgroundColor: isDark ? dk.input : "white" }} aria-label="עד עמוד" />
            </span>
            <button onClick={() => onDocs(docs.filter((x) => x.name !== v.name))} className="size-6 flex items-center justify-center rounded hover:bg-black/5" style={{ color: subCol }} title="הסרה">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Uploading an example for איך ────────────────────────────────────────────
// In the איך label's row. Once a document was uploaded in any part, it opens a short menu: those
// documents first, to use again with other pages, then uploading a new one. Before that it goes
// straight to the file picker.
function HowUpload({ uploaded, onPick, isDark, more }: {
  uploaded: DocPick[]; // uploaded in other parts and not yet in this one
  more: boolean; // this part already has a document, so the link offers another
  onPick: (d: DocPick) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const surface = isDark ? dk.surface : "white";
  const blue = isDark ? dk.blue : c.primary;
  const item = "w-full flex items-center gap-2 text-right px-3 h-8 text-[13.5px] transition-colors";
  const hover = isDark ? dk.input : c.hoverBg;
  return (
    <div className="relative">
      <input
        ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          // a prototype: the page count is guessed from the file's size
          if (f) onPick({ name: f.name.replace(/\.(pdf|docx?)$/i, ""), pages: Math.max(1, Math.round(f.size / 40000)) });
        }}
      />
      <button
        onClick={() => (uploaded.length ? setOpen((v) => !v) : fileRef.current?.click())}
        onBlur={() => setOpen(false)}
        className="h-6 px-1 flex items-center gap-1 rounded text-[12.5px] hover:underline"
        style={{ color: blue }}
        aria-haspopup={uploaded.length ? "menu" : undefined} aria-expanded={uploaded.length ? open : undefined}
      >
        <Paperclip size={14} /> {more ? "העלאת מסמך נוסף" : "העלאת מסמך לדוגמה"}
      </button>
      {open && (
        <div role="menu" className="absolute z-10 left-0 top-full mt-1 w-[264px] rounded-[4px] shadow-lg py-1"
          style={{ backgroundColor: surface, border: `1px solid ${line}` }}>
          <div className="px-3 pt-1 pb-1 text-[12px]" style={{ color: subCol }}>מסמכים שכבר הועלו</div>
          {uploaded.map((d) => (
            <button key={d.name} role="menuitem"
              onMouseDown={(e) => { e.preventDefault(); setOpen(false); onPick({ name: d.name, pages: d.pages }); }}
              className={item} style={{ color: textCol }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
              <FileText size={14} style={{ color: c.iconGray, flexShrink: 0 }} />
              <span className="flex-1 min-w-0 truncate">{d.name}</span>
              {d.pages && <span className="text-[12px] flex-shrink-0" style={{ color: subCol }}>{d.pages} עמ׳</span>}
            </button>
          ))}
          <div className="my-1 h-px" style={{ backgroundColor: line }} />
          <button role="menuitem"
            onMouseDown={(e) => { e.preventDefault(); setOpen(false); fileRef.current?.click(); }}
            className={item} style={{ color: blue }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = hover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Upload size={14} style={{ flexShrink: 0 }} /> העלאת מסמך חדש
          </button>
        </div>
      )}
    </div>
  );
}

// ── Which kind of sources ───────────────────────────────────────────────────
const SCOPES: { key: SourceScope; label: string }[] = [
  { key: "all", label: "כל המסמכים" },
  { key: "types", label: "סוגי מסמכים" },
  { key: "docs", label: "מסמכים ספציפיים" },
];
function ScopeSwitch({ value, onChange, isDark }: { value: SourceScope; onChange: (v: SourceScope) => void; isDark: boolean }) {
  return (
    <div className="flex items-center gap-5 mb-2" role="radiogroup" aria-label="מקורות">
      {SCOPES.map(({ key, label }) => {
        const on = key === value;
        return (
          <button
            key={key} role="radio" aria-checked={on} onClick={() => onChange(key)}
            className="flex items-center gap-1.5 text-[13px]"
            style={{ color: isDark ? dk.text : c.text }}
          >
            <span
              className="size-[16px] flex-none flex items-center justify-center rounded-full"
              style={{ border: `1px solid ${on ? c.primary : isDark ? dk.border : "#b8c0cc"}` }}
            >
              {on && <span className="size-[8px] rounded-full" style={{ backgroundColor: c.primary }} />}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── The parts ───────────────────────────────────────────────────────────────
// The list of parts on its own, so the prompt library's side editor can hold the same form
// as this window: one way of writing a part, wherever a part is written.
export const MAX_PARTS = 10;

export type PartsEditorHandle = { setAll: (fold: boolean) => void };

export function PartsEditor({ ref, parts, onChange, attempted, isDark, caseDocs, collapsible, foldAll }: {
  ref?: React.Ref<PartsEditorHandle>; // lets the input's top bar open or fold every part
  parts: PromptPart[];
  onChange: (parts: PromptPart[]) => void;
  attempted: boolean; // a save was tried — empty מה לעשות fields say so
  isDark: boolean;
  // Given only when the question is built inside a case (from the chat's input): the sources field
  // then also offers this case's documents, with page ranges. The library's prompts are general,
  // so they keep document types alone.
  caseDocs?: CaseDocOption[];
  // Inside the chat's input a part folds to its header line, so a long question can be read
  // whole: a new part opens and the ones above it fold, and any can be reopened.
  collapsible?: boolean;
  foldAll?: boolean; // open/fold-all beside the parts heading, where no top bar carries them
}) {
  // the first part opens at the start, so writing begins right away; the rest fold
  const [closed, setClosed] = useState<boolean[]>(() => parts.map((_, i) => i > 0));
  const isClosed = (i: number) => !!collapsible && !!closed[i] && !(attempted && !parts[i].task.trim());
  const [pendingDelete, setPendingDelete] = useState<number | null>(null); // the part waiting on its delete confirmation
  const listEnd = useRef<HTMLButtonElement>(null); // the "הוספת חלק" button, last in the list

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const quietBorder = isDark ? dk.border : c.border;

  const setPart = (i: number, p: Partial<PromptPart>) => onChange(parts.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...parts]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next);
    const c2 = parts.map((_, j) => !!closed[j]); [c2[i], c2[i + d]] = [c2[i + d], c2[i]]; setClosed(c2);
  };
  const remove = (i: number) => {
    onChange(parts.filter((_, j) => j !== i));
    setClosed(parts.map((_, j) => !!closed[j]).filter((_, j) => j !== i));
  };
  // a copy goes right under its part, open, so picking many document types isn't done twice
  const duplicate = (i: number) => {
    onChange([...parts.slice(0, i + 1), { ...parts[i], sources: [...parts[i].sources], docs: parts[i].docs?.map((d) => ({ ...d })), howDocs: parts[i].howDocs?.map((d) => ({ ...d })) }, ...parts.slice(i + 1)]);
    const c2 = parts.map((_, j) => !!closed[j]);
    setClosed([...c2.slice(0, i + 1), false, ...c2.slice(i + 1)]);
  };
  const setAll = (fold: boolean) => setClosed(parts.map(() => fold));
  useImperativeHandle(ref, () => ({ setAll }));
  const full = parts.length >= MAX_PARTS;
  // every document uploaded for איך in this prompt, once each, so another part can use it again
  const uploadedDocs = parts.flatMap((p) => p.howDocs ?? []).filter((d, j, all) => all.findIndex((x) => x.name === d.name) === j);
  const addPart = () => {
    if (full) return;
    onChange([...parts, emptyPart()]);
    setClosed([...parts.map((p) => !!p.task.trim()), false]);
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  };

  const area = "w-full outline-none text-[14px] leading-relaxed rounded-[4px] px-3 py-2 resize-y";
  const iconBtn = "size-7 flex items-center justify-center rounded transition-colors hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col gap-3">
      {collapsible && (
        <div className="flex items-center gap-3">
          <span className="text-[13px]" style={{ color: textCol }}>חלקים</span>
          {foldAll && parts.length > 1 && (
            <span className="flex items-center gap-2 text-[12.5px]" style={{ color: subCol }}>
              <button onClick={() => setAll(false)} className="hover:underline">פתיחת הכל</button>
              <span className="h-3 w-px" style={{ backgroundColor: line }} />
              <button onClick={() => setAll(true)} className="hover:underline">כיווץ הכל</button>
            </span>
          )}
        </div>
      )}
      {parts.map((p, i) => {
        const taskMissing = attempted && !p.task.trim();
        const folded = isClosed(i);
        const toggle = () => setClosed(parts.map((_, j) => (j === i ? !folded : !!closed[j])));
        return (
          <div key={i} className={`rounded-lg pt-2 ${folded ? "pb-2" : "pb-4"}`} style={{
            paddingInline: "17px",
            // inside the input a grey fill read as disabled, so there a part is outlined instead
            ...(collapsible ? { border: `1px solid ${folded ? quietBorder : (isDark ? dk.blue : c.primary)}` } : { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f4f6f9" }),
          }}>
            <div className={`flex items-center gap-1 ${folded ? "" : "mb-2"}`}>
              <span className="size-6 flex-none rounded-full flex items-center justify-center text-[12.5px] ml-1.5" style={{ backgroundColor: c.primary, color: "white" }}>{i + 1}</span>
              {collapsible ? (
                <button onClick={toggle} className="flex-1 min-w-0 flex items-center gap-1.5 text-right" aria-expanded={!folded} title={folded ? "פתיחת החלק" : "כיווץ החלק"}>
                  <span className="flex-none text-[14.5px]" style={{ color: textCol }}>חלק {i + 1}</span>
                  {folded && (
                    <span className="min-w-0 truncate text-[13.5px]" style={{ color: subCol }}>
                      {p.task.trim() && `· ${p.task.trim()}`}
                    </span>
                  )}
                </button>
              ) : (
                <span className="flex-1 text-[14.5px]" style={{ color: textCol }}>חלק {i + 1}</span>
              )}
              <button className={iconBtn} style={{ color: subCol }} disabled={i === 0} onClick={() => move(i, -1)} title="הזזה למעלה"><ArrowUp size={15} /></button>
              <button className={iconBtn} style={{ color: subCol }} disabled={i === parts.length - 1} onClick={() => move(i, 1)} title="הזזה למטה"><ArrowDown size={15} /></button>
              <button className={iconBtn} style={{ color: subCol }} disabled={parts.length === 1} onClick={() => {
                // an empty part goes straight away; one with anything written in it asks first
                if (p.task.trim() || p.how.trim() || p.sources.length || p.docs?.length || p.howDocs?.length) setPendingDelete(i);
                else remove(i);
              }} title="מחיקת החלק"><Trash2 size={15} /></button>
              <button className={iconBtn} style={{ color: subCol }} disabled={full} onClick={() => duplicate(i)} title={full ? `אפשר להוסיף עד ${MAX_PARTS} חלקים` : "שכפול החלק"}><Copy size={15} /></button>
              {/* at the far end of the row, and larger than the actions beside it */}
              {collapsible && (
                <button onClick={toggle} className="size-8 flex-none flex items-center justify-center rounded transition-colors hover:bg-black/5 mr-1" style={{ color: textCol }} aria-expanded={!folded} title={folded ? "פתיחת החלק" : "כיווץ החלק"}>
                  <ChevronDown size={20} style={{ transform: folded ? "none" : "rotate(180deg)", transition: "transform 0.15s" }} />
                </button>
              )}
            </div>

            {!folded && <>
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
            {caseDocs ? (() => {
              // first which kind of sources, then the field that picks them
              const scope = scopeOf(p);
              const missing = attempted && ((scope === "types" && !p.sources.length) || (scope === "docs" && !p.docs?.length));
              return (
                <>
                  <ScopeSwitch value={scope} onChange={(v) => setPart(i, { scope: v })} isDark={isDark} />
                  {scope === "types" && <SourcesInput only="types" value={p.sources} onChange={(v) => setPart(i, { sources: v })} isDark={isDark} caseDocs={caseDocs} />}
                  {scope === "docs" && <SourcesInput only="docs" value={[]} onChange={() => {}} isDark={isDark} caseDocs={caseDocs} docs={p.docs} onDocs={(v) => setPart(i, { docs: v })} />}
                  {missing && <div className="text-[12.5px] mt-1" style={{ color: RED }}>{scope === "types" ? "יש לבחור לפחות סוג מסמך אחד." : "יש לבחור לפחות מסמך אחד."}</div>}
                </>
              );
            })() : <SourcesInput value={p.sources} onChange={(v) => setPart(i, { sources: v })} isDark={isDark} />}

            <div className="flex items-center justify-between mt-3 mb-1">
              <span className="text-[13px]" style={{ color: textCol }}>איך <span style={{ color: subCol }}>(לא חובה)</span></span>
              <HowUpload
                isDark={isDark}
                more={!!p.howDocs?.length}
                uploaded={uploadedDocs.filter((d) => !p.howDocs?.some((x) => x.name === d.name))}
                onPick={(d) => setPart(i, { howDocs: [...(p.howDocs ?? []).filter((x) => x.name !== d.name), d] })}
              />
            </div>
            {/* the uploaded examples sit right under their upload link, above the pasted text */}
            <DocRows docs={p.howDocs ?? []} onDocs={(v) => setPart(i, { howDocs: v })} isDark={isDark} className="mb-2" />
            <textarea
              value={p.how}
              onChange={(e) => setPart(i, { how: e.target.value })}
              rows={3}
              placeholder="אפשר להדביק כאן דוגמה, למשל קטע מפסק דין קודם, או לתאר את אופן הכתיבה"
              className={area}
              style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : surface, color: textCol }}
            />
            </>}
          </div>
        );
      })}

      {collapsible ? (
        // inside the input: one filled button under the last part, at its end (left in RTL)
        <div className="flex items-center justify-end gap-2">
          {full && <span className="text-[12.5px]" style={{ color: subCol }}>אפשר להוסיף עד {MAX_PARTS} חלקים</span>}
          <button
            ref={listEnd}
            onClick={addPart}
            disabled={full}
            className="ml-[2px] h-7 px-2.5 flex items-center gap-1 rounded-[4px] text-[13px] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-default"
            // in the library the window's filled button is saving, so adding a part steps back
            style={foldAll
              ? { border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, backgroundColor: isDark ? dk.input : "white", color: c.primary }
              : { backgroundColor: c.primary, color: "white" }}
          >
            <Plus size={14} /> הוספת חלק
          </button>
        </div>
      ) : (
        <button
          ref={listEnd}
          onClick={addPart}
          disabled={full}
          className="h-11 flex items-center justify-center gap-1.5 rounded-lg text-[14px] transition-colors hover:bg-black/[0.02] disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent"
          style={{ border: `1px dashed ${quietBorder}`, color: isDark ? dk.blue : c.primary }}
        >
          {full ? `אפשר להוסיף עד ${MAX_PARTS} חלקים` : <><Plus size={16} /> הוספת חלק</>}
        </button>
      )}

      {pendingDelete !== null && (
        <div onClick={(e) => e.stopPropagation()}>
          <PromptConfirm
            isDark={isDark}
            title={`למחוק את חלק ${pendingDelete + 1}?`}
            note="מה שנכתב בחלק הזה יימחק, והחלקים שאחריו יעלו מקום אחד."
            confirmLabel="מחיקה"
            onConfirm={() => { remove(pendingDelete); setPendingDelete(null); }}
            onClose={() => setPendingDelete(null)}
          />
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

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const quietBorder = isDark ? dk.border : c.border;

  const save = () => {
    if (!name.trim() || parts.some((p) => !p.task.trim())) { setAttempted(true); return; }
    onSave(name.trim(), parts.map((p) => ({ ...p, task: p.task.trim(), how: p.how.trim() })));
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        // wide enough that every writing field is as wide as the chat's own input (768px):
        // 768 + the part card's padding (34) + the dialog's own padding (48). It grows with its
        // parts up to 88vh, then the parts scroll — no empty band under "הוספת חלק".
        style={{ width: "min(850px, 92vw)", maxHeight: "88vh", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-4">
          <div className="flex-1 text-[18px]" style={{ color: textCol }}>פרומפט מפורט חדש</div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-3">
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

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 pb-1" dir="ltr">
          <div dir="rtl">
            <PartsEditor parts={parts} onChange={setParts} attempted={attempted} isDark={isDark} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pt-2 pb-5">
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
const pagesText = (d: DocPick) =>
  // in words rather than "3–12": inside Hebrew text a numeric range is shown reversed
  d.from || d.to ? ` (עמודים ${d.from ?? 1} עד ${d.to ?? "הסוף"})` : "";
export const sourcesText = (p: PromptPart) => {
  const scope = scopeOf(p);
  if (scope === "docs" && p.docs?.length) return p.docs.map((d) => d.name + pagesText(d)).join(", ");
  if (scope === "types" && p.sources.length) return p.sources.join(", ");
  return "כל מסמכי התיק";
};
// `guidelines`: general instructions that apply to every part, written once above them
export const partsToText = (parts: PromptPart[], guidelines?: string) =>
  (guidelines?.trim() ? `הנחיות כלליות: ${guidelines.trim()}\n\n` : "") +
  parts.map((p, i) =>
    `חלק ${i + 1} — ${p.task}\nמקורות: ${sourcesText(p)}${p.how ? `\nאיך: ${p.how}` : ""}` +
    (p.howDocs?.length ? `\nדוגמה: ${p.howDocs.map((d) => d.name + pagesText(d)).join(", ")}` : ""),
  ).join("\n\n");
