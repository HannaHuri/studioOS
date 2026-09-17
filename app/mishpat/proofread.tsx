"use client";

// ── טיוטה בשיחה ────────────────────────────────────────────────────────────
// A conversation can take one Word draft. Picking it opens a dialog with three actions:
//   הגהה            — כתיב, ניסוח ופיסוק; comes back as tracked changes
//   בדיקת עקיבות    — contradictions INSIDE the draft; comes back as Word comments
//   שיחה עם המסמך   — the draft joins the conversation's context
// The two checks combine with each other but never with the chat (a, b, a+b, or c). They
// run as soon as they are confirmed, and only once per conversation; the chat hands back
// to the composer so the user can ask. Either way the draft stays in the conversation —
// it can't be removed — and a checkbox beside the upload button says whether it is part of
// what the next question is about.
//
// The demo files in /public/proofread are real .docx — the tracked changes and comments open
// in Word and can be accepted or rejected. Regenerate them with
// `node scripts/make-proof-docx.js public/proofread` (the draft text lives there).
import { ChevronDown, FileCheck2, FileText, Send, SpellCheck, Terminal, TextSearch, X } from "lucide-react";
import { useState, type ComponentType, type CSSProperties } from "react";
import { c, dk, FONT } from "./theme";

// One row of the progress tracker. Loose enough to hold the hand-drawn icons the agent run uses.
export type RunStepIcon = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>;
export type RunStep = { Icon: RunStepIcon; text: string; subText?: string; altIcon?: RunStepIcon; altText?: string };

// What the dialog is set to. `chat` never sits alongside the other two — the toggles enforce it.
export type DraftChoice = { lang: boolean; coherence: boolean; chat: boolean };
export type ProofKinds = { lang: boolean; coherence: boolean };
// What a finished check carries into the message list and the history item.
export type ProofRun = { fileName: string; kinds: ProofKinds };

export const proofKindLabel = (k: ProofKinds) =>
  k.lang && k.coherence ? "הגהה ובדיקת עקיבות" : k.lang ? "הגהה" : "בדיקת עקיבות";

// ── The demo findings ──────────────────────────────────────────────────────
// Fixed for the prototype; each one exists in the .docx as a real tracked change or a real
// comment, so the summary here and the downloaded file agree.
export const PROOF_LANG_FIXES: { before: string; after: string; note: string }[] = [
  { before: "בדיקה שיטחית", after: "בדיקה שטחית", note: "שגיאת כתיב" },
  { before: "ארעה התרשלות", after: "אירעה התרשלות", note: "כתיב מלא" },
  { before: "ועד היום התובע סובל", after: "ועד היום סובל התובע", note: "סדר מילים" },
  { before: "לקבל את את התביעה", after: "לקבל את התביעה", note: "כפל מילה" },
];

// Internal contradictions only. They point at sections of the draft in plain text — the
// numbered citation badge belongs to sources from the case file, which this is not.
export const PROOF_COHERENCE_NOTES: string[] = [
  "מועד הניתוח — בסעיף 1 הניתוח בוצע למחרת הפנייה, כלומר ביום 13.6.2023, ובסעיף 3 נכתב שבוצע ביום 20.6.2023.",
  "גיל התובע — בסעיף 1 הוא יליד 1962, ובסעיף 4 נכתב שהיה בן 48 במועד האירוע.",
  'סכום התביעה — בסעיף 4 הנזק הועמד על 1,250,000 ש"ח, ובסעיף 5 מתבקש סכום של 1,400,000 ש"ח.',
];

// The canned answer to a question asked with the draft in context.
export const DRAFT_ANSWER =
  'לפי הטיוטה, התובע פנה למרכז הרפואי ביום 12.6.2023, נותח בעקבות בדיקה ראשונית, והתביעה נשענת על טענה להתרשלות במהלך הניתוח. הנזק הכספי מועמד בסעיף 4 על 1,250,000 ש"ח, אך בסעיף הסעדים מתבקש סכום של 1,400,000 ש"ח — כדאי ליישב בין השניים לפני ההגשה.';

// ── The run's progress steps ───────────────────────────────────────────────
// The list changes with the chosen checks, so the tracker never claims to be doing
// something the user didn't ask for. Same shape the agent tracker already renders.
export function proofSteps(k: ProofKinds): RunStep[] {
  return [
    { Icon: FileText, text: "קורא את הטיוטה" },
    ...(k.lang ? [{ Icon: SpellCheck, text: "בודק כתיב, ניסוח ופיסוק" }] : []),
    ...(k.coherence ? [{ Icon: TextSearch, text: "מאתר סתירות בתוך הטיוטה" }] : []),
    { Icon: Terminal, text: "מסמן את התיקונים וההערות במסמך" },
    { Icon: Send, text: "מכין את הקובץ להורדה" },
  ];
}

// The four demo files differ only in what is marked in them; `original` is what the
// user uploaded, kept untouched so "המסמך המקורי נשמר ללא שינוי" is literally true.
export const proofFileUrl = (k: ProofKinds) =>
  `/studioOS/proofread/draft-${k.lang && k.coherence ? "both" : k.lang ? "lang" : "coherence"}.docx`;

export const proofDownloadName = (fileName: string) =>
  `${fileName.replace(/\.docx?$/i, "")} — לאחר הגהה.docx`;

// What the downloaded file contains — the tooltip on the download link, so the answer
// doesn't spend a line on it.
export const proofFileNote = (k: ProofKinds) =>
  k.lang && k.coherence ? "התיקונים מסומנים בקובץ כעקוב אחר שינויים, והסתירות כהערות בצד המסמך. המסמך המקורי נשמר ללא שינוי."
    : k.lang ? "התיקונים מסומנים בקובץ כעקוב אחר שינויים, כדי לאשר או לדחות כל אחד מהם. המסמך המקורי נשמר ללא שינוי."
    : "הסתירות מסומנות כהערות בצד המסמך, ללא שינוי בתוכן עצמו. המסמך המקורי נשמר ללא שינוי.";

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

// ── Shared bits ────────────────────────────────────────────────────────────
function Tick({ checked, muted }: { checked: boolean; muted?: boolean }) {
  return (
    <span
      className="size-4 rounded-[2px] flex-shrink-0 flex items-center justify-center"
      style={{
        backgroundColor: checked ? (muted ? c.border : c.primary) : "transparent",
        border: checked ? "none" : `1px solid ${c.border}`,
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

// The embedded draft, as it sits inside the message that first used it. No remove button:
// once a draft is in a conversation it stays there.
export function DraftFileCard({ name, isDark }: { name: string; isDark: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-2 max-w-full rounded px-2.5 py-1.5 mb-1.5"
      style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "white", border: `1px solid ${isDark ? dk.border : c.inputBorder}` }}
      dir="rtl"
    >
      <FileText size={15} style={{ color: c.primary, flexShrink: 0 }} />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px]" style={{ color: isDark ? dk.text : c.text, fontFamily: FONT }}>
        {name}
      </span>
    </div>
  );
}

// ── The dialog ─────────────────────────────────────────────────────────────
// Opens when a draft is picked, and again from the same button once the draft is in the
// conversation. A dialog rather than a strip under the composer, because in this product
// setting up a task is something you do in a window.
export function DraftModal({
  isDark, fileName, fileSize, choice, onChoice, checksUsed, onClose, onConfirm,
}: {
  isDark: boolean;
  fileName: string;
  fileSize: number;
  choice: DraftChoice;
  onChoice: (c: DraftChoice) => void;
  // הגהה and בדיקת עקיבות run once per conversation; after that they stay visible but locked.
  checksUsed: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const canConfirm = choice.chat || ((choice.lang || choice.coherence) && !checksUsed);
  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const line = isDark ? dk.border : c.inputBorder;

  // Picking a check clears the chat and vice versa — the dialog never holds a combination
  // the service can't run.
  const toggleCheck = (key: "lang" | "coherence") =>
    onChoice({ ...choice, [key]: !choice[key], chat: false });
  const toggleChat = () => onChoice({ lang: false, coherence: false, chat: !choice.chat });

  const option = (on: boolean, title: string, desc: string, toggle: () => void, locked = false) => (
    <button
      onClick={locked ? undefined : toggle}
      className="w-full flex items-start gap-2.5 text-right rounded px-2 py-2 transition-colors"
      style={{ backgroundColor: "transparent", cursor: locked ? "default" : "pointer", opacity: locked ? 0.5 : 1 }}
      onMouseEnter={e => { if (!locked) e.currentTarget.style.backgroundColor = isDark ? "rgba(200,214,229,0.06)" : c.hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <span className="mt-0.5"><Tick checked={on} muted={locked} /></span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[14px]" style={{ color: textCol }}>{title}</span>
        <span className="text-[13px] leading-snug" style={{ color: subCol }}>{desc}</span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg shadow-2xl"
        style={{ width: "min(520px, 92vw)", backgroundColor: surface, fontFamily: FONT }}
      >
        {/* header */}
        <div className="flex items-start px-6 pt-5 pb-3">
          <div className="flex-1 text-[18px]" style={{ color: textCol, fontWeight: 400 }}>טיוטה</div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {/* the uploaded file — its presence here is the "הועלה בהצלחה" indication */}
        <div className="mx-6 mb-4 flex items-center gap-2 min-w-0 rounded px-3 py-2.5" style={{ border: `1px solid ${line}` }}>
          <FileText size={16} style={{ color: c.primary, flexShrink: 0 }} />
          <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]" style={{ color: textCol }}>{fileName}</span>
          <span className="text-[12.5px] flex-shrink-0" style={{ color: subCol }}>{formatSize(fileSize)}</span>
        </div>

        <div className="px-6 text-[13px]" style={{ color: subCol }}>בחרו פעולה</div>
        <div className="px-4 pt-1 flex flex-col">
          {option(choice.lang, "הגהה", "כתיב, ניסוח ופיסוק. חוזרת כעקוב אחר שינויים, כדי לאשר או לדחות כל תיקון.",
            () => toggleCheck("lang"), checksUsed)}
          {option(choice.coherence, "בדיקת עקיבות", "סתירות בתוך המסמך. חוזרת כהערות בצד המסמך, ללא שינוי בתוכן.",
            () => toggleCheck("coherence"), checksUsed)}
          {checksUsed && (
            <div className="text-[12.5px] pb-1" style={{ color: subCol, paddingInlineStart: "34px" }}>
              ההגהה כבר בוצעה בשיחה זו. לביצוע הגהה נוספת יש להתחיל שיחה חדשה.
            </div>
          )}
        </div>

        {/* The line marks a different kind of action, not just another option: the checks above
            run on אישור, the chat below hands back to the composer for a question. */}
        <div className="mx-6 my-2" style={{ borderTop: `1px solid ${line}` }} />

        <div className="px-4 pb-2 flex flex-col">
          {option(choice.chat, "שיחה עם המסמך", "שאלות על תוכן הטיוטה, לבד או יחד עם מסמכי התיק.", toggleChat)}
        </div>

        <div className="flex gap-3 justify-end px-6 py-5">
          <button onClick={onClose} className="rounded-md px-7 py-2 text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-md px-8 py-2 text-[14px] text-white transition-opacity"
            style={{ backgroundColor: canConfirm ? c.primary : (isDark ? dk.border : c.border), cursor: canConfirm ? "pointer" : "default", opacity: canConfirm ? 1 : 0.7 }}
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The answer to a check ──────────────────────────────────────────────────
// The download lives in the actions row under the answer, not here — it is one of the
// things you can do with an answer, like copying it.
export function ProofAnswer({ isDark, run }: { isDark: boolean; run: ProofRun }) {
  const [langOpen, setLangOpen] = useState(false);
  const grayCol = isDark ? dk.textMuted : c.iconGray;
  const nLang = run.kinds.lang ? PROOF_LANG_FIXES.length : 0;
  const nCoherence = run.kinds.coherence ? PROOF_COHERENCE_NOTES.length : 0;
  const counts = [nLang && `${nLang} תיקונים`, nCoherence && `${nCoherence} סתירות`].filter(Boolean).join(" ו־");

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <p>
        עברתי על <span style={{ fontWeight: 600 }}>{run.fileName}</span> ומצאתי {counts}.
      </p>

      {/* The fixes are folded away: they are mechanical, and the place to actually act on them is
          the tracked changes in the file. The contradictions, which need judgement, stay open. */}
      {run.kinds.lang && (
        <div className="flex flex-col gap-1.5">
          <button onClick={() => setLangOpen((v) => !v)} className="flex items-center gap-1 text-[14px] text-right" style={{ fontWeight: 600 }}>
            הגהה
            <span style={{ fontWeight: 400, color: grayCol }}>· {PROOF_LANG_FIXES.length} תיקונים</span>
            <ChevronDown size={14} style={{ color: grayCol, transition: "transform 0.15s", transform: langOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {/* The old wording sits in grey with an arrow to the new one — no strike-through line. */}
          {langOpen && PROOF_LANG_FIXES.map((f, i) => (
            <div key={i} className="text-[14px] flex items-baseline gap-1.5 flex-wrap">
              <span style={{ color: grayCol }}>{f.before}</span>
              <span style={{ color: grayCol }}>←</span>
              <span>{f.after}</span>
              <span className="text-[12.5px]" style={{ color: grayCol }}>({f.note})</span>
            </div>
          ))}
        </div>
      )}

      {run.kinds.coherence && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px]" style={{ fontWeight: 600 }}>בדיקת עקיבות</div>
          {PROOF_COHERENCE_NOTES.map((n, i) => (
            <div key={i} className="text-[14px] leading-relaxed">{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Marks a check in the history list, so it reads differently from a conversation.
export function ProofHistoryIcon({ color }: { color: string }) {
  return <FileCheck2 size={13} style={{ color, flexShrink: 0 }} />;
}
