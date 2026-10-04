"use client";

// ── טיוטה בשיחה ────────────────────────────────────────────────────────────
// A conversation can take one Word draft. Uploading it puts it straight into the conversation —
// shown at its head, part of every question's context from then on, and it can't be removed.
// The upload icon and the response-mode selector go grey, and a "פעולות" menu appears beside them:
//   הגהה            — כתיב, ניסוח ופיסוק; comes back as tracked changes
//   בדיקת עקיבות    — contradictions INSIDE the draft; comes back as Word comments
// One or more can be ticked and run together, and each runs only once per conversation; once all
// have run, the menu goes grey too. More actions will join the menu later.
//
// The demo files in /public/proofread are real .docx — the tracked changes and comments open
// in Word and can be accepted or rejected. Regenerate them with
// `node scripts/make-proof-docx.js public/proofread` (the draft text lives there).
import { ChevronDown, FileCheck2, FileText, Send, SpellCheck, Terminal, TextSearch } from "lucide-react";
import { useState, type ComponentType, type CSSProperties } from "react";
import { c, dk, FONT } from "./theme";

// One row of the progress tracker. Loose enough to hold the hand-drawn icons the agent run uses.
export type RunStepIcon = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>;
export type RunStep = { Icon: RunStepIcon; text: string; subText?: string; altIcon?: RunStepIcon; altText?: string };

// What the dialog is set to. `chat` never sits alongside the other two — the toggles enforce it.
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

// ── The draft at the top of the conversation ───────────────────────────────
// Once a draft is in, it is part of the conversation itself — so it is shown at the head of
// the conversation, not in the composer (which is for writing the next question) and not inside
// whichever message happened to use it first. The file card it always was — a small bordered
// card — pinned at the head of the thread by the page.
export function DraftStrip({ name, isDark }: { name: string; isDark: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-2 max-w-full rounded px-2.5 py-1.5"
      style={{
        backgroundColor: isDark ? dk.surface : "white",
        border: `1px solid ${isDark ? dk.border : c.inputBorder}`,
      }}
      dir="rtl"
      title={name}
    >
      <FileText size={15} style={{ color: c.primary, flexShrink: 0 }} />
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px]" style={{ color: isDark ? dk.text : c.text, fontFamily: FONT }}>
        {name}
      </span>
    </div>
  );
}

// ── The dialog ─────────────────────────────────────────────────────────────
// ── The actions menu ───────────────────────────────────────────────────────
// Opens from the "פעולות" button beside the upload icon once a draft is in. Built like the
// response-mode dropdown, but the rows tick rather than pick: one or more actions are marked and
// run together on ביצוע. Each runs once per conversation — after it has, its row stays, locked.
export const DRAFT_ACTIONS: { key: keyof ProofKinds; title: string; desc: string }[] = [
  { key: "lang", title: "הגהה", desc: "כתיב, ניסוח ופיסוק. חוזרת כעקוב אחר שינויים, כדי לאשר או לדחות כל תיקון." },
  { key: "coherence", title: "בדיקת עקיבות", desc: "סתירות בתוך המסמך. חוזרת כהערות בצד המסמך, ללא שינוי בתוכן." },
];

export function DraftActionsMenu({ pos, usedChecks, onClose, onRun }: {
  pos: { top?: number; bottom?: number; right: number };
  usedChecks: ProofKinds;
  onClose: () => void;
  onRun: (kinds: ProofKinds) => void;
}) {
  const [picked, setPicked] = useState<ProofKinds>({ lang: false, coherence: false });
  const canRun = DRAFT_ACTIONS.some((a) => picked[a.key] && !usedChecks[a.key]);
  return (
    <>
      <div className="fixed inset-0 z-[190]" onClick={onClose} />
      <div
        style={{
          position: "fixed",
          ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
          right: pos.right,
          zIndex: 200,
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
          width: "300px",
          overflow: "hidden",
          fontFamily: FONT,
        }}
        dir="rtl"
      >
        <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: `1px solid ${c.border}`, lineHeight: 1.3 }}>
          <span className="text-[14px]" style={{ color: c.textGray }}>ניתן לבחור פעולה אחת או יותר</span>
        </div>
        <div className="py-1">
          {DRAFT_ACTIONS.map(({ key, title, desc }) => {
            const done = usedChecks[key];
            return (
              <button
                key={key}
                onClick={done ? undefined : () => setPicked((p) => ({ ...p, [key]: !p[key] }))}
                className="w-full flex items-start gap-2.5 px-4 py-2.5 text-right"
                style={{ backgroundColor: "transparent", cursor: done ? "default" : "pointer", opacity: done ? 0.5 : 1 }}
                onMouseEnter={e => { if (!done) e.currentTarget.style.backgroundColor = c.hoverBg; }}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span className="mt-0.5"><Tick checked={done || picked[key]} muted={done} /></span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[14px]" style={{ color: c.text }}>{title}</span>
                  <span className="text-[13px] leading-snug" style={{ color: c.textGray }}>
                    {done ? "כבר בוצעה בשיחה זו" : desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end px-4 pb-3 pt-1">
          <button
            onClick={() => canRun && onRun({ lang: picked.lang && !usedChecks.lang, coherence: picked.coherence && !usedChecks.coherence })}
            disabled={!canRun}
            className="rounded-md px-6 py-1.5 text-[14px] text-white transition-opacity"
            style={{ backgroundColor: canRun ? c.primary : c.border, cursor: canRun ? "pointer" : "default", opacity: canRun ? 1 : 0.7 }}
          >
            ביצוע
          </button>
        </div>
      </div>
    </>
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
