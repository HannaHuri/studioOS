"use client";

// ── הגהת טיוטה ─────────────────────────────────────────────────────────────
// Upload a Word draft, pick which checks to run, get a marked-up Word file back.
// Two independent checks: הגהה לשונית comes back as tracked changes, הגהת תוכן as
// comments. The demo files in /public/proofread are real .docx — the tracked changes
// and comments open in Word and can be accepted or rejected. Regenerate them with
// `node scripts/make-proof-docx.js public/proofread` (the draft text lives there).
import { CircleAlert, Download, FileCheck2, FileText, Folder, MessageSquareQuote, Send, SpellCheck, Terminal, X } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
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
    ...(k.lang ? [{ Icon: SpellCheck, text: "בודק לשון, ניסוח ופיסוק" }] : []),
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

// Same look as the citation badge in the answer — a content note IS a citation,
// it just points at the document the contradiction was found in.
function SourceChip({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 h-5 text-[12px] leading-none align-middle"
      style={{ backgroundColor: isDark ? "#243354" : c.badgeBg, color: isDark ? dk.text : c.text, fontFamily: FONT }}
    >
      <FileText size={11} style={{ flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ── The upload card, above the composer's text field ───────────────────────
export function DraftCard({
  isDark, fileName, fileSize, kinds, onKinds, docCount, onOpenDocs, onRemove, onRun, running,
}: {
  isDark: boolean;
  fileName: string;
  fileSize: number;
  kinds: ProofKinds;
  onKinds: (k: ProofKinds) => void;
  docCount: number;
  onOpenDocs: () => void;
  onRemove: () => void;
  onRun: () => void;
  running: boolean;
}) {
  // הגהת תוכן has nothing to compare against with no documents selected, so the run
  // is blocked rather than quietly returning "לא נמצאו סתירות".
  const noDocs = kinds.content && docCount === 0;
  const canRun = (kinds.lang || kinds.content) && !noDocs && !running;
  const grayCol = isDark ? dk.textMuted : c.iconGray;

  return (
    <div
      className="rounded-lg border flex flex-col gap-2 px-3 py-2.5"
      style={{ borderColor: isDark ? dk.border : c.inputBorder, backgroundColor: isDark ? dk.surface : c.hoverBg, fontFamily: FONT }}
      dir="rtl"
    >
      {/* the uploaded file — its presence is the "הועלה בהצלחה" indication */}
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={15} style={{ color: c.primary, flexShrink: 0 }} />
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px]" style={{ color: isDark ? dk.text : c.text }}>
          {fileName}
        </span>
        <span className="text-[12px] flex-shrink-0" style={{ color: grayCol }}>{formatSize(fileSize)}</span>
        <button onClick={onRemove} className="size-6 flex items-center justify-center rounded flex-shrink-0 transition-opacity opacity-60 hover:opacity-100" style={{ color: grayCol }} title="הסרת המסמך">
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => onKinds({ ...kinds, lang: !kinds.lang })} className="flex items-center gap-1.5 text-[13px]" style={{ color: isDark ? dk.text : c.text }}>
          <Tick checked={kinds.lang} />
          הגהה לשונית
        </button>
        <button onClick={() => onKinds({ ...kinds, content: !kinds.content })} className="flex items-center gap-1.5 text-[13px]" style={{ color: isDark ? dk.text : c.text }}>
          <Tick checked={kinds.content} />
          הגהת תוכן
        </button>

        <div className="flex-1" />

        <button
          onClick={onRun}
          disabled={!canRun}
          className="h-7 px-3 rounded text-[13px] flex-shrink-0 transition-opacity"
          style={{
            backgroundColor: canRun ? c.primary : (isDark ? dk.border : c.border),
            color: "white",
            cursor: canRun ? "pointer" : "default",
            opacity: canRun ? 1 : 0.7,
          }}
        >
          בצע הגהה
        </button>
      </div>

      {/* What the content check is measured against. No new scope control — this only
          reports the selection already made in the documents panel, and opens it. */}
      {kinds.content && (
        <button onClick={onOpenDocs} className="flex items-center gap-1.5 text-[12px] text-right" style={{ color: noDocs ? RED : grayCol }}>
          {noDocs
            ? <><CircleAlert size={12} style={{ flexShrink: 0 }} />לא נבחרו מסמכים בתיק — יש לבחור מסמכים כדי לבדוק את התוכן</>
            : <><Folder size={12} style={{ flexShrink: 0 }} />התוכן ייבדק מול {docCount} המסמכים שנבחרו בתיק</>}
        </button>
      )}
    </div>
  );
}

// ── The answer in the conversation ─────────────────────────────────────────
export function ProofAnswer({ isDark, run }: { isDark: boolean; run: ProofRun }) {
  const grayCol = isDark ? dk.textMuted : c.iconGray;
  const nLang = run.kinds.lang ? PROOF_LANG_FIXES.length : 0;
  const nContent = run.kinds.content ? PROOF_CONTENT_NOTES.length : 0;
  const counts = [nLang && `${nLang} תיקוני לשון`, nContent && `${nContent} הערות תוכן`].filter(Boolean).join(" ו־");

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <p>
        עברתי על <span style={{ fontWeight: 600 }}>{run.fileName}</span> ומצאתי {counts}
        {run.kinds.content ? `, בהשוואה ל-${run.docCount} המסמכים שנבחרו בתיק` : ""}. המסמך המקורי נשמר ללא שינוי.
      </p>

      {run.kinds.lang && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[14px]" style={{ fontWeight: 600 }}>
            <SpellCheck size={15} style={{ color: c.primary }} />
            הגהה לשונית
          </div>
          {PROOF_LANG_FIXES.map((f, i) => (
            <div key={i} className="text-[14px] flex items-baseline gap-1.5 flex-wrap">
              <span style={{ color: grayCol, textDecoration: "line-through" }}>{f.before}</span>
              <span style={{ color: grayCol }}>←</span>
              <span>{f.after}</span>
              <span className="text-[12.5px]" style={{ color: grayCol }}>({f.note})</span>
            </div>
          ))}
        </div>
      )}

      {run.kinds.content && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[14px]" style={{ fontWeight: 600 }}>
            <MessageSquareQuote size={15} style={{ color: c.primary }} />
            הגהת תוכן
          </div>
          {PROOF_CONTENT_NOTES.map((n, i) => (
            <div key={i} className="text-[14px] leading-relaxed">
              {n.text} <SourceChip label={n.source} isDark={isDark} />
            </div>
          ))}
        </div>
      )}

      <p className="text-[13.5px]" style={{ color: grayCol }}>
        {run.kinds.lang && run.kinds.content ? "בקובץ: תיקוני הלשון מסומנים כעקוב אחר שינויים, והערות התוכן כהערות בצד המסמך."
          : run.kinds.lang ? "בקובץ: התיקונים מסומנים כעקוב אחר שינויים, כדי שניתן יהיה לאשר או לדחות כל אחד מהם."
          : "בקובץ: ההערות מופיעות בצד המסמך, ללא שינוי בתוכן עצמו."}
      </p>

      <div>
        <a
          href={proofFileUrl(run.kinds)}
          download={proofDownloadName(run.fileName)}
          className="inline-flex items-center gap-2 h-8 px-3 rounded border text-[13px] transition-colors"
          style={{ borderColor: c.primary, color: c.primary, fontFamily: FONT }}
        >
          <Download size={15} />
          הורדת הקובץ המוגה
        </a>
      </div>
    </div>
  );
}

// Marks a proofreading run in the history list, so it reads differently from a conversation.
export function ProofHistoryIcon({ color }: { color: string }) {
  return <FileCheck2 size={13} style={{ color, flexShrink: 0 }} />;
}
