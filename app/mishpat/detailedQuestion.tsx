"use client";

/* ──────────────────────────────────────────────────────────────────────────
   שאלה מפורטת — chosen in the input's task menu, and built inside the input itself. The same parts as
   a detailed prompt in the library, but built inside the case, so a part can also draw on specific documents of this case
   with a page range. It is sent once; "שמירה בספרייה שלי" keeps a copy as a library prompt,
   which is general, so its specific documents are kept as their document types. Sharing is a
   second, separate choice under it, since not everything I keep is something I pass on.
   A detailed prompt used from the library opens here too, its parts in place of the draft.
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Check, ChevronDown, WandSparkles, X } from "lucide-react";
import { c, dk, RED, FONT } from "./theme";
import { PartsEditor, emptyPart, type PartsEditorHandle, partsToText, scopeOf, partIncomplete, type CaseDocOption, type PromptPart } from "./complexPrompt";
import {
  CASE_CONTEXT, CASE_TYPES, COURTS, Dropdown, MATTERS, STAGES, fieldsOf, findIdentifiers, scrub, today, uid, type Prompt,
} from "./prompts";

function CheckRow({ on, onToggle, label, isDark }: { on: boolean; onToggle: () => void; label: string; isDark: boolean }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 text-[13.5px]" style={{ color: isDark ? dk.text : c.text }} role="checkbox" aria-checked={on}>
      <span className="size-[16px] flex-none flex items-center justify-center rounded-[3px]"
        style={{ border: `1px solid ${on ? c.primary : isDark ? dk.border : c.border}`, backgroundColor: on ? c.primary : "transparent" }}>
        {on && <Check size={12} style={{ color: "white" }} />}
      </span>
      {label}
    </button>
  );
}

const clean = (parts: PromptPart[]) => parts.map((p) => ({ ...p, task: p.task.trim(), how: p.how.trim() }));

// A library prompt is general — it isn't tied to this case's files — so a part that picked
// specific documents keeps their document types instead.
function generalize(parts: PromptPart[], docs: CaseDocOption[]): PromptPart[] {
  return parts.map((p) => {
    if (scopeOf(p) !== "docs") return { ...p, docs: undefined };
    const types = (p.docs ?? []).map((d) => docs.find((x) => x.name === d.name)?.type).filter((t): t is string => !!t);
    return { ...p, scope: "types", sources: Array.from(new Set(types)), docs: undefined };
  });
}

// ── שאלה מפורטת ─────────────────────────────────────────────────────────────
// Built inside the chat's input, in place of the question line, rather than in a window over the
// page: the conversation stays in view, and the input's own send button sends it. Every section
// folds to one line, so a long question can be read whole before it goes.
export type DetailedHandle = { send: (force?: boolean) => void }; // force sends with fields still unfilled

// The draft of the detailed question being written, kept in this browser
type DetailedDraft = { parts: PromptPart[]; guidelines: string };
const DRAFT_KEY = "mishpat.detailedDraft";
function loadDraft(): DetailedDraft | null {
  try { const v = localStorage.getItem(DRAFT_KEY); return v ? JSON.parse(v) as DetailedDraft : null; } catch { return null; }
}
function saveDraft(d: DetailedDraft | null) {
  try { if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); } catch { /* storage off */ }
}
// Only a draft with something written is kept, so one that's there is worth asking about
export const hasDetailedDraft = () => !!loadDraft();
// A library prompt opened here becomes the draft, so the editor mounts on its parts
export function putDetailedDraft(parts: PromptPart[], guidelines: string) {
  saveDraft({ parts: parts.map((p) => ({ ...p, sources: [...p.sources], docs: p.docs?.map((d) => ({ ...d })) })), guidelines });
}

function Fold({ title, note, preview, open, onToggle, isDark, children }: {
  title: string; note?: string; preview?: string; open: boolean; onToggle: () => void; isDark: boolean; children: React.ReactNode;
}) {
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  return (
    <div>
      {/* the toggle matches a part's: large, at the far end, in line with the parts' toggles below */}
      <button onClick={onToggle} className="w-full flex items-center gap-1.5 text-right" style={{ paddingInlineEnd: "18px" }} aria-expanded={open}>
        <span className="flex-none text-[13px]" style={{ color: textCol }}>
          {title}{note && <span style={{ color: subCol }}> {note}</span>}
        </span>
        {!open && preview && <span className="min-w-0 truncate text-[13px]" style={{ color: subCol }}>· {preview}</span>}
        <span className="flex-1" />
        <span className="size-8 flex-none flex items-center justify-center rounded transition-colors hover:bg-black/5" style={{ color: textCol }}>
          <ChevronDown size={20} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </span>
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

export function DetailedInline({ ref, isDark, caseDocs, maxHeight, onSend, onFieldsLeft, onSaveToLibrary, onClose }: {
  ref?: React.Ref<DetailedHandle>;
  isDark: boolean;
  caseDocs: CaseDocOption[];
  maxHeight: string; // past it the sections scroll, so the input never pushes the page away
  onSend: (parts: PromptPart[], guidelines: string) => void;
  onFieldsLeft: (fields: string[]) => void; // a send held back because [fields] are still in the text
  onSaveToLibrary: (pr: Prompt, share?: { anon: boolean }) => void;
  onClose: () => void;
}) {
  // What's written is kept as a draft while working: closing, switching to a basic question or
  // reloading the page brings it back the next time a detailed question is opened.
  const [draft0] = useState(loadDraft);
  const [parts, setParts] = useState<PromptPart[]>(draft0?.parts ?? [emptyPart()]);
  const [guidelines, setGuidelines] = useState(draft0?.guidelines ?? ""); // general instructions for all the parts
  const [editorKey, setEditorKey] = useState(0); // a cleared draft starts the parts afresh, folded
  const hasContent = !!guidelines.trim() || parts.some((p) => p.task.trim() || p.how.trim() || p.sources.length || p.docs?.length || p.howDocs?.length);
  useEffect(() => { saveDraft(hasContent ? { parts, guidelines } : null); }, [parts, guidelines, hasContent]);
  const clearDraft = () => { setParts([emptyPart()]); setGuidelines(""); setAttempted(false); setEditorKey((k) => k + 1); };
  const [guideOpen, setGuideOpen] = useState(true);
  const partsRef = useRef<PartsEditorHandle>(null);
  const [attempted, setAttempted] = useState(false);
  const [keep, setKeep] = useState(false); // שמירה בספרייה שלי
  const [share, setShare] = useState(false); // שיתוף עם כל המשתמשים, only on top of keeping
  const [anon, setAnon] = useState(false);
  const [name, setName] = useState("");
  const [court, setCourt] = useState(CASE_CONTEXT.court);
  const [caseType, setCaseType] = useState(CASE_CONTEXT.caseType);
  const [matter, setMatter] = useState(CASE_CONTEXT.matter);
  const [stage, setStage] = useState(CASE_CONTEXT.stage);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const quietBorder = isDark ? dk.border : c.border;
  const hasPicked = parts.some((p) => scopeOf(p) === "docs");

  const send = (force?: boolean) => {
    const bad = parts.some(partIncomplete);
    if (bad || (keep && !name.trim())) { setAttempted(true); return; }
    const done = clean(parts);
    const left = fieldsOf(partsToText(done, guidelines.trim()));
    if (left.length && !force) { onFieldsLeft(left); return; }
    if (keep) {
      // The shared copy goes out with identifying details swapped for fields, as the library
      // editor does; my own copy and the question sent here keep them.
      const scrubText = (t: string) => (share ? scrub(t, findIdentifiers(t), new Set()) : t);
      const general = generalize(done, caseDocs).map((p) => ({ ...p, task: scrubText(p.task), how: scrubText(p.how) }));
      const g = scrubText(guidelines.trim());
      onSaveToLibrary({
        id: uid(), name: scrubText(name.trim()), body: partsToText(general, g), parts: general,
        guidelines: g || undefined,
        source: "mine", author: null, fav: false, court, caseType, matter, stage, tags: [],
        uses: 1, ratingSum: 0, ratingCount: 0, myRating: null, edited: today(),
      }, share ? { anon } : undefined);
    }
    saveDraft(null);
    onSend(done, guidelines.trim());
  };
  useImperativeHandle(ref, () => ({ send }));

  return (
    <div dir="rtl" className="flex flex-col" style={{ fontFamily: FONT }}>
      <div className="flex items-center gap-2 pb-2">
        <WandSparkles size={16} style={{ color: c.primary, transform: "scaleX(-1)", flexShrink: 0 }} />
        <span className="flex-none text-[15px]" style={{ color: textCol }}>שאלה מפורטת</span>
        {/* in the top bar, so they never scroll out of view; with a single part there is nothing to do all at once */}
        {parts.length > 1 && (
          <span className="flex items-center gap-2 text-[12.5px] mr-3" style={{ color: subCol }}>
            <button onClick={() => partsRef.current?.setAll(false)} className="hover:underline">פתיחת הכל</button>
            <span className="h-3 w-px" style={{ backgroundColor: line }} />
            <button onClick={() => partsRef.current?.setAll(true)} className="hover:underline">כיווץ הכל</button>
          </span>
        )}
        <span className="flex-1" />
        {hasContent && (
          <span className="flex items-center gap-2 text-[12.5px]" style={{ color: subCol }}>
            נשמר כטיוטה
            <button onClick={clearDraft} className="hover:underline" style={{ color: isDark ? dk.blue : c.primary }}>ניקוי</button>
          </span>
        )}
        <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="חזרה לשאלה בסיסית">
          <X size={16} />
        </button>
      </div>

      <div className="overflow-y-auto docs-scroll -ml-1 pl-1 -mr-[10px] pr-[10px]" style={{ maxHeight }} dir="ltr">
        <div dir="rtl" className="flex flex-col gap-3 pb-1">
          <Fold title="הנחיות כלליות" note="(לא חובה)" preview={guidelines.trim()} open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} isDark={isDark}>
            <textarea
              value={guidelines} onChange={(e) => setGuidelines(e.target.value)} rows={2}
              placeholder="הנחיות שחלות על כל החלקים, למשל: לכתוב בלשון רשמית ולהתבסס רק על מסמכי התיק"
              className="w-full outline-none text-[14px] leading-relaxed rounded-[4px] px-3 py-2 resize-y"
              style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : surface, color: textCol }}
            />
          </Fold>

          <PartsEditor ref={partsRef} key={editorKey} parts={parts} onChange={setParts} attempted={attempted} isDark={isDark} caseDocs={caseDocs} collapsible />

          <div>
            <CheckRow on={keep} onToggle={() => { setKeep((v) => !v); setShare(false); }} label="שמירה בספרייה שלי" isDark={isDark} />
            {keep && (
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <input
                    value={name} onChange={(e) => setName(e.target.value)} autoFocus
                    placeholder="שם הפרומפט, למשל: היסטוריה דיונית"
                    className="w-full px-3 py-2 text-[15px] outline-none rounded-[4px]"
                    style={{ border: `1px solid ${attempted && !name.trim() ? RED : line}`, backgroundColor: surface, color: textCol }}
                  />
                  {attempted && !name.trim() && <div className="text-[12.5px] mt-1" style={{ color: RED }}>יש להזין שם כדי לשמור בספרייה.</div>}
                </div>
                <div>
                  <div className="text-[12.5px] mb-1.5" style={{ color: subCol }}>סיווג</div>
                  <div className="flex items-start gap-2 flex-wrap">
                    {([
                      { t: "ערכאה", v: court, o: COURTS, set: setCourt, w: 130 },
                      { t: "סוג תיק", v: caseType, o: CASE_TYPES, set: setCaseType, w: 140 },
                      { t: "סוג עניין", v: matter, o: MATTERS, set: setMatter, w: 150 },
                      { t: "שלב", v: stage, o: STAGES, set: setStage, w: 140 },
                    ] as const).map(({ t, v, o, set, w }) => (
                      <div key={t}>
                        <div className="text-[12px] mb-1" style={{ color: subCol }}>{t}</div>
                        <Dropdown label={t} value={v} options={[...o]} onChange={set} isDark={isDark} width={w} noAny />
                      </div>
                    ))}
                  </div>
                </div>
                {hasPicked && (
                  <div className="text-[12.5px] leading-relaxed" style={{ color: subCol }}>
                    בספרייה הפרומפט כללי ואינו קשור לתיק הזה, ולכן מסמכים ספציפיים יישמרו כסוגי המסמכים שלהם.
                  </div>
                )}
                <CheckRow on={share} onToggle={() => setShare((v) => !v)} label="שיתוף עם כל המשתמשים" isDark={isDark} />
                {share && (
                  <div className="px-3 py-2.5 rounded-[4px]" style={{ backgroundColor: isDark ? "#243354" : "#f0f5ff" }}>
                    <div className="text-[12.5px] leading-relaxed" style={{ color: isDark ? dk.text : c.darkBlue }}>
                      בעותק המשותף, פרטים שעשויים לזהות את התיק יוחלפו בשדות למילוי. העותק שלך נשאר כפי שהוא.
                    </div>
                    <div className="text-[12.5px] mt-2 mb-1.5" style={{ color: isDark ? dk.text : c.darkBlue }}>מי מופיע כמחבר</div>
                    <div className="flex items-center gap-2">
                      {[{ k: false, t: "בשמי" }, { k: true, t: "אנונימי" }].map(({ k, t }) => (
                        <button
                          key={t} onClick={() => setAnon(k)}
                          className="h-7 px-3 rounded-[4px] text-[12.5px] transition-colors"
                          style={{
                            border: `1px solid ${anon === k ? c.primary : quietBorder}`,
                            color: anon === k ? c.primary : textCol,
                            backgroundColor: surface,
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
