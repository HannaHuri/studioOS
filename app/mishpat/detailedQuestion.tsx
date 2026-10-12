"use client";

/* ──────────────────────────────────────────────────────────────────────────
   Two windows the chat opens over the page:

   שאלה מפורטת — picked in the input's task menu. The same parts as a detailed prompt in the
   library, but built inside the case, so a part can also draw on specific documents of this case
   with a page range. It is sent once; "שמירה גם בספרייה" keeps a copy as a library prompt,
   which is general, so its specific documents are kept as their document types.

   שימוש בפרומפט — choosing a prompt to use opens it here first: use it as it is, or change it
   for this use only, with "שמירת השינויים בספרייה" to keep the change.
   ────────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { Check, WandSparkles, X } from "lucide-react";
import { c, dk, RED, FONT } from "./theme";
import { PartsEditor, emptyPart, partsToText, type CaseDocOption, type PromptPart } from "./complexPrompt";
import {
  CASE_CONTEXT, CASE_TYPES, COURTS, Dropdown, MATTERS, STAGES, today, uid, type Prompt,
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
    const types = (p.docs ?? []).map((d) => docs.find((x) => x.name === d.name)?.type).filter((t): t is string => !!t);
    return { ...p, sources: Array.from(new Set([...p.sources, ...types])), docs: undefined };
  });
}

// ── שאלה מפורטת ─────────────────────────────────────────────────────────────
export function DetailedQuestionBuilder({ isDark, caseDocs, onSend, onSaveToLibrary, onClose }: {
  isDark: boolean;
  caseDocs: CaseDocOption[];
  onSend: (parts: PromptPart[]) => void;
  onSaveToLibrary: (pr: Prompt) => void;
  onClose: () => void;
}) {
  const [parts, setParts] = useState<PromptPart[]>([emptyPart()]);
  const [attempted, setAttempted] = useState(false);
  const [keep, setKeep] = useState(false); // שמירה גם בספרייה
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
  const hasPicked = parts.some((p) => p.docs?.length);

  const send = () => {
    const bad = parts.some((p) => !p.task.trim());
    if (bad || (keep && !name.trim())) { setAttempted(true); return; }
    const done = clean(parts);
    if (keep) {
      const general = generalize(done, caseDocs);
      onSaveToLibrary({
        id: uid(), name: name.trim(), body: partsToText(general), parts: general,
        source: "mine", author: null, fav: false, court, caseType, matter, stage, tags: [],
        uses: 1, ratingSum: 0, ratingCount: 0, myRating: null, edited: today(),
      });
    }
    onSend(done);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(980px, 94vw)", height: "min(860px, 90vh)", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-1">
          <WandSparkles size={18} style={{ color: c.primary, transform: "scaleX(-1)", marginTop: "4px", marginLeft: "8px" }} />
          <div className="flex-1 text-[18px]" style={{ color: textCol }}>שאלה מפורטת</div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-4 text-[13.5px]" style={{ color: subCol }}>
          כל חלק הוא שלב בשאלה, והחלקים רצים לפי הסדר. השאלה תישלח לשיחה הזו פעם אחת.
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 pb-4" dir="ltr">
          <div dir="rtl" className="flex flex-col gap-4">
            <PartsEditor parts={parts} onChange={setParts} attempted={attempted} isDark={isDark} caseDocs={caseDocs} />

            <div className="rounded-lg px-4 py-3" style={{ border: `1px solid ${quietBorder}` }}>
              <CheckRow on={keep} onToggle={() => setKeep((v) => !v)} label="שמירה גם בספרייה" isDark={isDark} />
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
                    <div className="text-[12.5px] mb-1.5" style={{ color: subCol }}>
                      סיווג — קובע באילו תיקים הפרומפט יוצג לך, ולפי מה אחרים ימצאו אותו אם ישותף
                    </div>
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pt-3 pb-5" style={{ borderTop: `1px solid ${quietBorder}` }}>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${quietBorder}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={send} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            {keep ? "שמירה ושליחה" : "שליחה"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── שימוש בפרומפט ──────────────────────────────────────────────────────────
export function PromptUseWindow({ isDark, prompt, onUse, onSave, onClose }: {
  isDark: boolean;
  prompt: Prompt;
  onUse: (pr: Prompt) => void;   // the prompt as it is to be used — the stored one, or this use's copy
  onSave: (pr: Prompt) => void;  // keep the change: mine is updated, anyone else's becomes mine
  onClose: () => void;
}) {
  const [body, setBody] = useState(prompt.body);
  const [parts, setParts] = useState<PromptPart[] | null>(prompt.parts ?? null);
  const [attempted, setAttempted] = useState(false);
  const [keep, setKeep] = useState(false);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const quietBorder = isDark ? dk.border : c.border;
  const changed = parts ? JSON.stringify(parts) !== JSON.stringify(prompt.parts) : body !== prompt.body;
  const isMine = prompt.source === "mine";

  const use = () => {
    if (parts ? parts.some((p) => !p.task.trim()) : !body.trim()) { setAttempted(true); return; }
    if (!changed) { onUse(prompt); return; }
    const done = parts ? clean(parts) : null;
    const edited: Prompt = { ...prompt, body: done ? partsToText(done) : body.trim(), parts: done ?? undefined };
    if (keep) {
      const stored: Prompt = isMine ? { ...edited, edited: today() } : {
        ...edited, id: uid(), source: "mine", author: null, authorRole: undefined, basedOn: prompt.name,
        fav: false, uses: 0, ratingSum: 0, ratingCount: 0, myRating: null, edited: today(),
      };
      onSave(stored);
      onUse(stored);
      return;
    }
    onUse(edited);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: parts ? "min(850px, 92vw)" : "min(680px, 92vw)", maxHeight: "88vh", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-1">
          <div className="flex-1 min-w-0 text-[18px] truncate" style={{ color: textCol }}>{prompt.name}</div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-3 text-[13.5px]" style={{ color: subCol }}>
          אפשר להשתמש בפרומפט כמו שהוא, או לשנות אותו לשימוש הזה בלבד.
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 pb-2" dir="ltr">
          <div dir="rtl">
            {parts ? (
              <PartsEditor parts={parts} onChange={setParts} attempted={attempted} isDark={isDark} />
            ) : (
              <>
                <textarea
                  value={body} onChange={(e) => setBody(e.target.value)} autoFocus
                  className="w-full outline-none text-[15px] leading-relaxed rounded-[4px] px-3 py-2.5 resize-y"
                  style={{ minHeight: "220px", border: `1px solid ${attempted && !body.trim() ? RED : line}`, backgroundColor: isDark ? dk.input : surface, color: textCol }}
                />
                {attempted && !body.trim() && <div className="text-[12.5px] mt-1" style={{ color: RED }}>הפרומפט ריק.</div>}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 pt-3 pb-5" style={{ borderTop: `1px solid ${quietBorder}` }}>
          {/* only once something was changed — until then there is nothing to keep */}
          <div className="flex-1" style={{ visibility: changed ? "visible" : "hidden" }}>
            <CheckRow on={keep} onToggle={() => setKeep((v) => !v)} label={isMine ? "שמירת השינויים בספרייה" : "שמירה בספרייה כפרומפט שלי"} isDark={isDark} />
          </div>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${quietBorder}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={use} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            {changed ? "שימוש בנוסח הזה" : "שימוש"}
          </button>
        </div>
      </div>
    </div>
  );
}
