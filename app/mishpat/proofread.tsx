"use client";

// ── טיוטה בשיחה ────────────────────────────────────────────────────────────
// A conversation can take one Word draft. Uploading it puts it straight into the conversation —
// shown at its head, part of every question's context from then on, and it can't be removed.
// The actions are picked in the input's task menu (שאלה בסיסית / שאלה מפורטת / the actions);
// ticking one or more shows the upload icon, and sending runs them together:
//   הגהה            — כתיב, ניסוח ופיסוק; comes back as tracked changes
//   בדיקת עקיבות    — contradictions INSIDE the draft; comes back as Word comments
//   התממה           — names and identifiers replaced; comes back as a clean copy (demo for now)
// Each runs only once per conversation.
//
// The demo files in /public/proofread are real .docx — the tracked changes and comments open
// in Word and can be accepted or rejected. Regenerate them with
// `node scripts/make-proof-docx.js public/proofread` (the draft text lives there).
import { ChevronDown, FileCheck2, FileText, Send, SpellCheck, Terminal, TextSearch, UserRoundX } from "lucide-react";
import { useState, type ComponentType, type CSSProperties } from "react";
import { c, dk, FONT } from "./theme";

// One row of the progress tracker. Loose enough to hold the hand-drawn icons the agent run uses.
export type RunStepIcon = ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>;
export type RunStep = { Icon: RunStepIcon; text: string; subText?: string; altIcon?: RunStepIcon; altText?: string };

// Which actions run together. Any mix of the three.
export type ProofKinds = { lang: boolean; coherence: boolean; anon: boolean };
export const NO_KINDS: ProofKinds = { lang: false, coherence: false, anon: false };
export const anyKind = (k: ProofKinds) => k.lang || k.coherence || k.anon;
// What a finished check carries into the message list and the history item.
export type ProofRun = { fileName: string; kinds: ProofKinds };

const KIND_NAMES: [keyof ProofKinds, string][] = [["lang", "הגהה"], ["coherence", "בדיקת עקיבות"], ["anon", "התממה"]];
// "הגהה", "הגהה ובדיקת עקיבות", "הגהה, בדיקת עקיבות והתממה"
export const proofKindLabel = (k: ProofKinds) => {
  const n = KIND_NAMES.filter(([key]) => k[key]).map(([, t]) => t);
  return n.length < 2 ? n.join("") : `${n.slice(0, -1).join(", ")} ו${n[n.length - 1]}`;
};

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

// What התממה replaced — the same pairs the demo file has replaced, so the two agree.
export const ANON_REPLACEMENTS: { before: string; after: string; kind: string }[] = [
  { before: "יעקב אברמוב", after: "י.א.", kind: "שם התובע" },
  { before: 'המרכז הרפואי קדם בע"מ', after: "הנתבעת", kind: "שם הנתבעת" },
  { before: "המרכז הרפואי קדם", after: "המרכז הרפואי", kind: "שם הנתבעת" },
  { before: "12345-67-89", after: "XXXXX-XX-XX", kind: "מספר תיק" },
  { before: "1962", after: "[שנה]", kind: "שנת לידה" },
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
    ...(k.anon ? [{ Icon: UserRoundX, text: "מאתר שמות ופרטים מזהים ומחליף אותם" }] : []),
    { Icon: Terminal, text: "מסמן את התיקונים וההערות במסמך" },
    { Icon: Send, text: k.anon && (k.lang || k.coherence) ? "מכין את הקבצים להורדה" : "מכין את הקובץ להורדה" },
  ];
}

// The demo files differ only in what is marked in them; `original` is what the user uploaded,
// kept untouched so "המסמך המקורי נשמר ללא שינוי" is literally true. התממה comes back as its own
// clean copy, so a run that includes it can hand back two files.
export type ProofFile = { url: string; name: string; note: string; label: string };
const marked = (k: ProofKinds) => ({ ...k, anon: false });
// The original name, a plain hyphen, and the check(s) that ran. Hebrew, so a Hebrew file name
// isn't reordered around an English suffix — agreed with dev, 2026-10-04.
const fileName = (name: string, what: string) => `${name.replace(/\.docx?$/i, "")} - ${what}.docx`;
export function proofFiles(run: ProofRun): ProofFile[] {
  const k = run.kinds, files: ProofFile[] = [];
  if (k.lang || k.coherence) files.push({
    url: `/studioOS/proofread/draft-${k.lang && k.coherence ? "both" : k.lang ? "lang" : "coherence"}.docx`,
    name: fileName(run.fileName, proofKindLabel(marked(k))),
    label: k.lang ? "הורדת קובץ ההגהה" : "הורדת הקובץ עם ההערות",
    note: k.lang && k.coherence ? "התיקונים מסומנים בקובץ כעקוב אחר שינויים, והסתירות כהערות בצד המסמך. המסמך המקורי נשמר ללא שינוי."
      : k.lang ? "התיקונים מסומנים בקובץ כעקוב אחר שינויים, כדי לאשר או לדחות כל אחד מהם. המסמך המקורי נשמר ללא שינוי."
      : "הסתירות מסומנות כהערות בצד המסמך, ללא שינוי בתוכן עצמו. המסמך המקורי נשמר ללא שינוי.",
  });
  if (k.anon) files.push({
    url: "/studioOS/proofread/draft-anon.docx",
    name: fileName(run.fileName, "מותמם"),
    label: "הורדת הקובץ המותמם",
    note: "עותק נקי של המסמך, שבו השמות והפרטים המזהים הוחלפו. המסמך המקורי נשמר ללא שינוי.",
  });
  return files;
}

// ── Shared bits ────────────────────────────────────────────────────────────
export function Tick({ checked, muted }: { checked: boolean; muted?: boolean }) {
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
// ── Length limits ──────────────────────────────────────────────────────────
// Dev's numbers: a draft can be up to 80,000 words, and past ~30 pages בדיקת עקיבות gets less
// reliable, so the user is told before running it. Users think in pages, so pages are what we show —
// at ~265 words to a page of a Hebrew court filing (David 12, 1.5 spacing), 80,000 words ≈ 300 pages.
export const WORD_LIMIT = 80_000;
export const WORDS_PER_PAGE = 265;
export const COHERENCE_PAGE_LIMIT = 30;
// An estimate, so it is rounded like one: "כ-300 עמודים", not "כ-291".
export const pagesOf = (words: number) => {
  const p = words / WORDS_PER_PAGE;
  const step = p >= 100 ? 10 : p >= 20 ? 5 : 1;
  return Math.max(1, Math.round(p / step) * step);
};

// Counts the words of a .docx in the browser: it is a zip, and the text lives in word/document.xml.
// Returns null when it can't tell (an old .doc, or a file it can't read) — then no limit is applied.
export async function countDocxWords(file: File): Promise<number | null> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);
    // the central directory says where each entry starts and how it is stored
    let eocd = buf.length - 22;
    while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
    if (eocd < 0) return null;
    let at = dv.getUint32(eocd + 16, true);
    const n = dv.getUint16(eocd + 10, true);
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(at + 10, true), size = dv.getUint32(at + 20, true);
      const nameLen = dv.getUint16(at + 28, true), extra = dv.getUint16(at + 30, true), note = dv.getUint16(at + 32, true);
      const local = dv.getUint32(at + 42, true);
      const name = new TextDecoder().decode(buf.subarray(at + 46, at + 46 + nameLen));
      if (name === "word/document.xml") {
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        let raw = buf.subarray(start, start + size);
        if (method === 8) raw = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
        const xml = new TextDecoder().decode(raw);
        // the text runs, with a space at each paragraph end so paragraphs don't run together
        const text = Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<\/w:p>/g), (m) => m[1] ?? " ").join("");
        return text.split(/\s+/).filter(Boolean).length;
      }
      at += 46 + nameLen + extra + note;
    }
    return null;
  } catch {
    return null;
  }
}

// ── The actions ────────────────────────────────────────────────────────────
// Listed in the input's task menu, under the question types. Their icons are the ones the
// progress tracker shows for the same work.
export const DRAFT_ACTIONS: { key: keyof ProofKinds; title: string; short: string; desc: string; Icon: RunStepIcon }[] = [
  { key: "lang", Icon: SpellCheck, title: "הגהה", short: "הגהה", desc: "כתיב, ניסוח ופיסוק. חוזרת כעקוב אחר שינויים." },
  { key: "coherence", Icon: TextSearch, title: "בדיקת עקיבות", short: "עקיבות", desc: "סתירות בתוך המסמך. חוזרת כהערות בצד המסמך." },
  { key: "anon", Icon: UserRoundX, title: "התממה", short: "התממה", desc: "החלפת שמות ופרטים מזהים. חוזרת כעותק נקי." },
];

// ── The answer to a check ──────────────────────────────────────────────────
// The download lives in the actions row under the answer, not here — it is one of the
// things you can do with an answer, like copying it.
export function ProofAnswer({ isDark, run }: { isDark: boolean; run: ProofRun }) {
  const [langOpen, setLangOpen] = useState(false);
  const grayCol = isDark ? dk.textMuted : c.iconGray;
  const nLang = run.kinds.lang ? PROOF_LANG_FIXES.length : 0;
  const nCoherence = run.kinds.coherence ? PROOF_COHERENCE_NOTES.length : 0;
  const nAnon = run.kinds.anon ? ANON_REPLACEMENTS.length : 0;
  const counts = [nLang && `${nLang} תיקונים`, nCoherence && `${nCoherence} סתירות`].filter(Boolean).join(" ו־");

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <p>
        עברתי על <span style={{ fontWeight: 600 }}>{run.fileName}</span>
        {counts && <> ומצאתי {counts}</>}
        {nAnon > 0 && <>{counts ? ", ו" : " ו"}החלפתי {nAnon} פרטים מזהים בעותק נקי של המסמך</>}.
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

      {run.kinds.anon && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px]" style={{ fontWeight: 600 }}>התממה</div>
          {ANON_REPLACEMENTS.map((r, i) => (
            <div key={i} className="text-[14px] flex items-baseline gap-1.5 flex-wrap">
              <span style={{ color: grayCol }}>{r.before}</span>
              <span style={{ color: grayCol }}>←</span>
              <span>{r.after}</span>
              <span className="text-[12.5px]" style={{ color: grayCol }}>({r.kind})</span>
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
