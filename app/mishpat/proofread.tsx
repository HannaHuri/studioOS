"use client";

// ── הגהת טיוטה ─────────────────────────────────────────────────────────────
// Upload a Word draft, pick which checks to run, get a marked-up Word file back.
// Two independent checks: הגהה לשונית comes back as tracked changes, הגהת תוכן as
// comments. The demo files in /public/proofread are real .docx — the tracked changes
// and comments open in Word and can be accepted or rejected. Regenerate them with
// `node scripts/make-proof-docx.js public/proofread` (the draft text lives there).
import { ChevronDown, CircleAlert, FileCheck2, FileText, Folder, Send, SpellCheck, Terminal, X } from "lucide-react";
import { useState, type ComponentType, type CSSProperties } from "react";
import { Badge } from "./icons";
import { c, dk, RED, FONT } from "./theme";

// One row of the progress tracker. Loose enough to hold the hand-drawn icons the agent run uses.
export type RunStepIcon = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>;
export type RunStep = { Icon: RunStepIcon; text: string; subText?: string; altIcon?: RunStepIcon; altText?: string };

export type ProofKinds = { lang: boolean; content: boolean };
// What a finished run carries into the message list and the history item.
export type ProofRun = { fileName: string; kinds: ProofKinds; docCount: number };

export const proofKindLabel = (k: ProofKinds) =>
  k.lang && k.content ? "הגהה לשונית והגהת תוכן" : k.lang ? "הגהה לשונית" : "הגהת תוכן";

// ── The demo findings ──────────────────────────────────────────────────────
// Fixed for the prototype; each one exists in the .docx as a real tracked change
// or a real comment, so the summary here and the downloaded file agree.
export const PROOF_LANG_FIXES: { before: string; after: string; note: string }[] = [
  { before: "בדיקה שיטחית", after: "בדיקה שטחית", note: "שגיאת כתיב" },
  { before: "ארעה התרשלות", after: "אירעה התרשלות", note: "כתיב מלא" },
  { before: "ועד היום התובע סובל", after: "ועד היום סובל התובע", note: "סדר מילים" },
  { before: "לקבל את את התביעה", after: "לקבל את התביעה", note: "כפל מילה" },
];

export const PROOF_CONTENT_NOTES: { text: string; source: string }[] = [
  { text: "סעיף 1 — מועד הפנייה למיון מצוין כ־12.6.2023, ואילו בתצהיר עדות ראשית של התובע מצוין 5.7.2023.", source: "תצהיר עדות ראשית — התובע" },
  { text: "סעיף 2 — ההתרשלות מנוסחת כעובדה מוכחת, בעוד שזו טענה השנויה במחלוקת בין הצדדים.", source: "כתב הגנה מתוקן" },
  { text: "סעיף 3 — נטען שחוות הדעת מטעם התובע לא נסתרה, אך בתיק מצויה חוות דעת מטעם בית המשפט הקובעת קשר סיבתי חלקי בלבד.", source: "חוות דעת מומחה מטעם בית המשפט" },
  { text: 'סעיף 4 — הנזק מסתכם ב־1,250,000 ש"ח, ואילו בכתב התביעה המתוקן הסכום הנתבע הוא 1,450,000 ש"ח.', source: "כתב תביעה מתוקן" },
];

// ── The run's progress steps ───────────────────────────────────────────────
// The list changes with the chosen checks, so the tracker never claims to be doing
// something the user didn't ask for. Same shape the agent tracker already renders.
export function proofSteps(k: ProofKinds): RunStep[] {
  return [
    { Icon: FileText, text: "קורא את הטיוטה" },
    ...(k.lang ? [{ Icon: SpellCheck, text: "בודק כתיב, ניסוח ופיסוק" }] : []),
    ...(k.content ? [{ Icon: Folder, text: "משווה את הטענות מול מסמכי התיק" }] : []),
    { Icon: Terminal, text: "מסמן את התיקונים וההערות במסמך" },
    { Icon: Send, text: "מכין את הקובץ להורדה" },
  ];
}

// The four demo files differ only in what is marked in them; `original` is what the
// user uploaded, kept untouched so "המסמך המקורי נשמר ללא שינוי" is literally true.
export const proofFileUrl = (k: ProofKinds) =>
  `/studioOS/proofread/draft-${k.lang && k.content ? "both" : k.lang ? "lang" : "content"}.docx`;

export const proofDownloadName = (fileName: string) =>
  `${fileName.replace(/\.docx?$/i, "")} — לאחר הגהה.docx`;

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

// ── Shared bits ────────────────────────────────────────────────────────────
function Tick({ checked }: { checked: boolean }) {
  return (
    <span
      className="size-4 rounded-[2px] flex-shrink-0 flex items-center justify-center"
      style={{ backgroundColor: checked ? c.primary : "transparent", border: checked ? "none" : `1px solid ${c.border}` }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

// ── The dialog that opens once a draft has been picked ─────────────────────
// A dialog rather than a strip under the composer, because in this product configuring
// a task is something you do in a window: it is a task being set up, not an attachment
// riding along with the next message.
export function ProofModal({
  isDark, fileName, fileSize, kinds, onKinds, docCount, onOpenDocs, onClose, onConfirm,
}: {
  isDark: boolean;
  fileName: string;
  fileSize: number;
  kinds: ProofKinds;
  onKinds: (k: ProofKinds) => void;
  docCount: number;
  // Closes the dialog and opens the documents panel, keeping the draft — changing the
  // selection is a real step here, and it happens in the panel that already owns it.
  onOpenDocs: () => void;
  onClose: () => void;
  // Confirming does not start the run — it hands the request back to the composer, so the
  // user can add a sentence to it before sending.
  onConfirm: () => void;
}) {
  // הגהת תוכן has nothing to compare against with no documents selected, so the run
  // is blocked rather than quietly returning "לא נמצאו סתירות".
  const noDocs = kinds.content && docCount === 0;
  const canConfirm = (kinds.lang || kinds.content) && !noDocs;
  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const line = isDark ? dk.border : c.inputBorder;

  const check = (on: boolean, title: string, desc: string, toggle: () => void) => (
    <button onClick={toggle} className="w-full flex items-start gap-2.5 text-right rounded px-2 py-2 transition-colors" style={{ backgroundColor: "transparent" }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? "rgba(200,214,229,0.06)" : c.hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <span className="mt-0.5"><Tick checked={on} /></span>
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
          <div className="flex-1 text-[18px]" style={{ color: textCol, fontWeight: 400 }}>הגהת טיוטה</div>
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

        <div className="px-6 text-[13px]" style={{ color: subCol }}>בחרו את סוג ההגהה</div>
        <div className="px-4 pt-1 pb-2 flex flex-col">
          {check(kinds.lang, "הגהה לשונית", "כתיב, ניסוח ופיסוק. חוזרת כעקוב אחר שינויים, כדי לאשר או לדחות כל תיקון.",
            () => onKinds({ ...kinds, lang: !kinds.lang }))}
          {check(kinds.content, "הגהת תוכן", "השוואת הטענות שבטיוטה למסמכי התיק. חוזרת כהערות בצד המסמך, ללא שינוי בתוכן.",
            () => onKinds({ ...kinds, content: !kinds.content }))}
        </div>

        {/* What the content check is measured against. No new scope control — this reports
            the selection already made in the documents panel, and sends you there to change it. */}
        {kinds.content && (
          <div className="mx-6 mb-1 flex items-center gap-1.5 text-[12.5px] text-right" style={{ color: noDocs ? RED : subCol }}>
            {noDocs
              ? <><CircleAlert size={13} style={{ flexShrink: 0 }} />לא נבחרו מסמכים בתיק</>
              : <><Folder size={13} style={{ flexShrink: 0 }} />התוכן ייבדק מול {docCount} המסמכים שנבחרו בתיק</>}
            <button onClick={onOpenDocs} className="hover:underline" style={{ color: c.primary }}>
              {noDocs ? "לבחירת מסמכים" : "לשינוי הבחירה"}
            </button>
          </div>
        )}

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

// What the downloaded file contains — the tooltip on the download link, so the answer
// doesn't spend a line on it.
export const proofFileNote = (k: ProofKinds) =>
  k.lang && k.content ? "תיקוני הלשון מסומנים בקובץ כעקוב אחר שינויים, והערות התוכן כהערות בצד המסמך. המסמך המקורי נשמר ללא שינוי."
    : k.lang ? "התיקונים מסומנים בקובץ כעקוב אחר שינויים, כדי לאשר או לדחות כל אחד מהם. המסמך המקורי נשמר ללא שינוי."
    : "ההערות מופיעות בצד המסמך, ללא שינוי בתוכן עצמו. המסמך המקורי נשמר ללא שינוי.";

// ── The answer in the conversation ─────────────────────────────────────────
// The download lives in the actions row under the answer, not here — it is one of the
// things you can do with an answer, like copying it.
export function ProofAnswer({ isDark, run, showBadges }: { isDark: boolean; run: ProofRun; showBadges: boolean }) {
  const [langOpen, setLangOpen] = useState(false);
  const grayCol = isDark ? dk.textMuted : c.iconGray;
  const nLang = run.kinds.lang ? PROOF_LANG_FIXES.length : 0;
  const nContent = run.kinds.content ? PROOF_CONTENT_NOTES.length : 0;
  const counts = [nLang && `${nLang} תיקוני לשון`, nContent && `${nContent} הערות תוכן`].filter(Boolean).join(" ו־");

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <p>
        עברתי על <span style={{ fontWeight: 600 }}>{run.fileName}</span> ומצאתי {counts}
        {run.kinds.content ? `, בהשוואה ל־${run.docCount} המסמכים שנבחרו בתיק` : ""}.
      </p>

      {/* The language fixes are folded away: they are mechanical, and the place to actually act
          on them is the tracked changes in the file. The content notes, which need judgement,
          stay open. */}
      {run.kinds.lang && (
        <div className="flex flex-col gap-1.5">
          <button onClick={() => setLangOpen((v) => !v)} className="flex items-center gap-1 text-[14px] text-right" style={{ fontWeight: 600 }}>
            הגהה לשונית
            <span style={{ fontWeight: 400, color: grayCol }}>· {PROOF_LANG_FIXES.length} תיקונים</span>
            <ChevronDown size={14} style={{ color: grayCol, transition: "transform 0.15s", transform: langOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {/* The old wording sits in grey with an arrow to the new one. It used to be struck
              through, which put a line across a quarter of the answer. */}
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

      {run.kinds.content && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px]" style={{ fontWeight: 600 }}>הגהת תוכן</div>
          {/* A content note IS a citation — same numbered badge every other answer uses, with
              the document it came from named on hover. */}
          {PROOF_CONTENT_NOTES.map((n, i) => (
            <div key={i} className="text-[14px] leading-relaxed">
              {n.text} {showBadges && <Badge num={i + 1} title={n.source} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Marks a proofreading run in the history list, so it reads differently from a conversation.
export function ProofHistoryIcon({ color }: { color: string }) {
  return <FileCheck2 size={13} style={{ color, flexShrink: 0 }} />;
}
