"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, CornerDownRight,
  Clock, Copy, Eye, EyeClosed, FileText, Files, FolderOpen, Route,
  HelpCircle, Info, Link, Sparkles, Minimize2,
  Moon, MoreHorizontal, MoreVertical, Plus, Quote, RotateCw, Search, Shield, StickyNote,
  Split, Sun, ThumbsDown, ThumbsUp,
  Calendar, ExternalLink, Check, Key, Maximize2, Pencil, X, Rows3, LayoutGrid, Paperclip, SlidersHorizontal, ClipboardCopy, ClipboardList, CircleMinus, CirclePlus,
  ZoomIn, ZoomOut, GripHorizontal, GripVertical,
  type LucideIcon,
} from "lucide-react";

// react-pdf/pdfjs-dist touches browser-only APIs (DOMMatrix) at module-evaluation time, so it must never be evaluated during SSR
const PdfViewer = dynamic(() => import("./pdf-viewer"), { ssr: false });

// ── Design tokens ──────────────────────────────────────────────────────────
const c = {
  primary: "#0073ea",
  takhelet: "#0ea5e9", // strong, bright sky-blue accent (distinct from the corporate primary blue)
  primaryLight: "#cce5ff",
  badgeBg: "#d4e7ff",
  headerBg: "#ecedf5",
  darkBlue: "#00376d",
  text: "#323338",
  textGray: "#707070",
  textLight: "#8596af",
  iconGray: "#676879",
  border: "#c5c7d0",
  inputBorder: "#dcdfec",
  panelBg: "#ecedf5",
  hoverBg: "#f5f6f8",
} as const;

const dk = {
  bg: "#13172b", surface: "#1c2235", input: "#1e2538",
  text: "#c8d6e5", textMuted: "#6b7da3", header: "#181c30",
  border: "#2a3150", blue: "#90b8e0",
} as const;

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/studioOS/logo.png" alt="לוגו" className="h-[23px] w-auto" />;
}

// ── Checkbox ───────────────────────────────────────────────────────────────
// While the chat is narrowed to "רק המסמך הזה", the table's selection is still there but does NOT feed the chat.
// Rather than drill a flag through every row component, the doc-selection checkboxes read it from context and dim.
// (The column-visibility popover opts out with its own false provider — those checkboxes aren't doc selection.)
const SelectionDimmed = createContext(false);

// `mixed` = the standard indeterminate state: used on folder headers (case / type / process) when only SOME of the
// documents inside are selected — a dash instead of a check, so a partial selection can't be mistaken for "none".
// Clicking a mixed box selects everything in the folder (checked stays false while mixed, so the caller's !allOn works).
function CheckboxBlue({ checked, mixed, onToggle }: { checked: boolean; mixed?: boolean; onToggle: () => void }) {
  const dimmed = useContext(SelectionDimmed);
  const filled = checked || !!mixed;
  return (
    <div
      onClick={onToggle}
      className="size-4 rounded-[2px] flex-shrink-0 flex items-center justify-center cursor-pointer select-none transition-opacity"
      style={{ backgroundColor: filled ? c.primary : "transparent", border: filled ? "none" : `1px solid ${c.border}`, opacity: dimmed ? 0.3 : 1 }}
    >
      {checked ? (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : mixed ? (
        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
          <path d="M1 1H9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  );
}

// ── Citation badge ─────────────────────────────────────────────────────────
function Badge({ num }: { num: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full size-5 text-[12px] leading-none flex-shrink-0 mx-0.5 cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: c.badgeBg, color: c.text, fontFamily: "Figtree, sans-serif" }}
    >
      {num}
    </span>
  );
}

// ── Vibe-style icon button ─────────────────────────────────────────────────
function VibeBtn({ onClick, title, active, children }: {
  onClick?: () => void; title?: string; active?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="size-8 flex items-center justify-center rounded-md transition-colors"
      style={{ color: active ? c.primary : c.iconGray, backgroundColor: active ? c.primaryLight : hov ? c.hoverBg : "transparent" }}
    >
      {children}
    </button>
  );
}


// ── Documents data (chronological model) ────────────────────────────────────
type DocBucket = "today" | "week" | "month" | "older";
const BUCKET_LABELS: Record<DocBucket, string> = {
  today: "היום", week: "השבוע", month: "החודש", older: "ישן יותר",
};
const BUCKET_ORDER: DocBucket[] = ["today", "week", "month", "older"];

interface CaseDoc {
  id: string;
  name: string;
  type: string;          // doc type — chip + filter
  submitter: string;     // צד מגיש
  submitterName?: string; // specific party name (shown on hover; useful when a side has several)
  date: string;          // display date
  time?: string;         // display time (matters when several docs are filed the same day)
  iso: string;           // ISO date (for range filtering)
  bucket: DocBucket;
  words: string;         // word count
  summary: string;       // תקציר
  related: string[];     // related document names
  attachments?: string[]; // files attached to this document (exhibits, certificates, etc.)
  checked: boolean;      // selected for chat
  used?: boolean;        // referenced by the chat's answer
  missing?: boolean;     // document has no text / not processed (0 words)
  key?: boolean;         // central/pivotal document
  keyReason?: string;    // why it's central — shown in tooltip (transparency)
  isNew?: boolean;       // new since the judge's last visit
  note?: string;         // the user's own note about this document (never written by the system)
  noteShared?: boolean;  // false/undefined = לעיני בלבד · true = visible to the user's team, with their name
  noteInChat?: boolean;  // opt-in: hand the note to the chat as context whenever this document is in scope
  nameOriginal?: string;    // the system's own name, kept the first time the user renames the display name
  summaryOriginal?: string; // the system's own summary, kept the first time the user rewrites it
  caseId?: string;       // which case this document belongs to
  file?: string;         // path to a real PDF under /public — shown instead of the mock pages when present
  processId?: number;    // groups documents that belong to the same thread/topic (motion → response → decision)
  processIds?: number[]; // a document that belongs to several processes (appears in each thread/folder); overrides processId
}

// Process (thread) labels, per case and id — the single source of truth for folder-header names. Numbered per case
// (each case's threads start at 1 and are unrelated to another case's), so the map is keyed by caseId then process id.
const PROCESS_LABELS: Record<string, Record<number, string>> = {
  c1: {
    1: "בקשת הנתבע לדחיית מועד הדיון",
    2: "הודעת התובע על הגשת ראיות נוספות",
    3: "בקשת התובע לגילוי מסמכים",
    // The two open threads — one waiting on the other side, one waiting on the judge. Both matter for the
    // "תהליכים פתוחים" lens: it exists precisely because those two states look identical from a decision's point of view.
    4: "בקשת הנתבע לזימון עד נוסף",
    5: "בקשת התובע לחיוב בהוצאות",
  },
  c2: {
    1: "בקשת התובע לסעד זמני",
  },
};
// A document's processes — the multi-process array when present, otherwise the single processId (or none).
const docProcessIds = (d: CaseDoc): number[] => d.processIds ?? (d.processId != null ? [d.processId] : []);
const processLabel = (caseId: string | undefined, id: number): string => PROCESS_LABELS[caseId ?? ""]?.[id] ?? `תהליך ${id}`;
const processTitle = (d: CaseDoc): string =>
  docProcessIds(d).map((id) => processLabel(d.caseId, id)).join(" · ") || "תהליך";
// A decision / judgment closes the thread it belongs to. Everything else leaves it open — including a thread that is
// currently waiting on the other side's response rather than on the judge.
const isResolutionDoc = (d: CaseDoc) => d.type === "החלטות בתיק" || d.type === "פסקי דין";

// מגיש is a two-value distinction, and "תובע"/"נתבע" differ by a single glyph in the middle of a four-letter word —
// at column size they read as the same shape and the eye stops separating them. One letter each IS the distinction;
// the full word (with the party's name) stays in the cell's tooltip. Court documents render blank: their type already
// says who filed them, which is why "בימ״ש" was dropped from this column.
const submitterLetter = (s: string) => (s === "תובע" ? "ת" : s === "נתבע" ? "נ" : "");
// Process keys are per-case (each case numbers its threads from 1), so any cross-case set must be keyed by both.
const procKey = (caseId: string | undefined, pid: number) => `${caseId ?? ""}::${pid}`;

// Type filter chips with aggregate word counts (real case data)
const DOC_TYPE_TOTALS: { type: string; words: string }[] = [
  { type: "הכל",            words: "237K" },
  { type: "כתבי טענות",     words: "108K" },
  { type: "בקשות והוראות",  words: "4.2K" },
  { type: "תצהירים",        words: "26.6K" },
  { type: "חוות דעת",       words: "13.5K" },
  { type: "החלטות בתיק",    words: "2.4K" },
  { type: "פסקי דין",       words: "10.9K" },
  { type: "פרוטוקולים",     words: "21.6K" },
  { type: "מוצגים",         words: "8.3K" },
];

// Mock documents (dev team: replace with real API data)
const CASE_DOCS: CaseDoc[] = [
  {
    id: "d1", name: "בקשה לדחיית מועד דיון", type: "בקשות והוראות", submitter: "נתבע", submitterName: "המרכז הרפואי קדם בע״מ",
    date: "27.05.26", time: "09:14", iso: "2026-05-27", bucket: "week", words: "1.1K",
    summary: "הנתבע מבקש לדחות את מועד הדיון הקבוע ל-21.6 בשל היעדרות מומחה מרכזי מהארץ, ומציע מועד חלופי בחודש יולי. התובע מתנגד לבקשה.",
    related: ["פרוטוקול דיון מקדמי"], checked: false,
    isNew: true, file: "/studioOS/docs/motion-1.pdf", processId: 1,
  },
  {
    id: "d2", name: "תצהיר עדות ראשית — ד״ר לוי", type: "תצהירים", submitter: "תובע", submitterName: "יעקב אברמוב",
    date: "31.05.26", time: "16:40", iso: "2026-05-31", bucket: "week", words: "8.4K",
    summary: "תצהיר מומחה רפואי מטעם התובע הקובע קשר סיבתי בין הרשלנות הנטענת לנזק, ומפרט נכות צמיתה בשיעור 25%.",
    related: ["חוות דעת אקטוארית", "כתב תביעה", "פרוטוקול דיון מקדמי", "החלטה על מינוי מומחה", "כתב הגנה מתוקן", "הודעה על הגשת ראיות נוספות"], checked: true, used: true, isNew: true,
    attachments: ["נספח א — תעודת התמחות ד״ר לוי", "נספח ב — צילומי MRI"],
    key: true, keyReason: "מסמך מרכזי — תצהיר מומחה שעליו נשענת התביעה; מסמכים נוספים מפנים אליו", file: "/studioOS/docs/affidavit-1.pdf",
  },
  {
    id: "d3", name: "תגובה לבקשת ארכה", type: "בקשות והוראות", submitter: "תובע",
    date: "29.05.26", time: "11:05", iso: "2026-05-29", bucket: "week", words: "640",
    summary: "התובע מתנגד לבקשת הארכה וטוען כי מדובר בניסיון לסחבת; לחלופין מבקש כי הדחייה תותנה בהוצאות.",
    related: [], checked: false, file: "/studioOS/docs/motion-2.pdf", processId: 1,
  },
  {
    id: "d4", name: "פרוטוקול דיון מקדמי", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "18.05.26", time: "14:22", iso: "2026-05-18", bucket: "month", words: "4.2K",
    summary: "סיכום הדיון המקדמי: נקבעו פלוגתאות, הוסכם על מינוי מומחה מטעם בית המשפט ונקבע לוח זמנים להגשת ראיות.",
    related: ["החלטה על מינוי מומחה", "בקשה לדחיית מועד דיון", "תצהיר עדות ראשית — ד״ר לוי", "פרוטוקול ישיבת קדם משפט"], checked: false, used: true,
    key: true, keyReason: "מסמך מרכזי — פרוטוקול הקובע את הפלוגתאות ולוח הזמנים בתיק", file: "/studioOS/docs/protocol-1.pdf",
  },
  {
    id: "d5", name: "כתב הגנה מתוקן", type: "כתבי טענות", submitter: "נתבע",
    date: "10.05.26", time: "11:30", iso: "2026-05-10", bucket: "month", words: "12.1K",
    summary: "הנתבע דוחה את כל טענות הרשלנות, טוען להעדר קשר סיבתי ולאשם תורם של התובע, ומעלה טענת התיישנות חלקית.",
    related: ["כתב תביעה", "תצהיר עדות ראשית — ד״ר לוי", "תצהיר עדות — גב' רוזן", "כתב תביעה שכנגד"], checked: false, file: "/studioOS/docs/defense-1.pdf",
  },
  {
    id: "d6", name: "החלטה על מינוי מומחה", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "05.05.26", time: "09:45", iso: "2026-05-05", bucket: "month", words: "820",
    summary: "בית המשפט ממנה את פרופ׳ זילברשטיין כמומחה מטעמו לבחינת שאלת הנכות, וקובע את חלוקת שכר הטרחה בין הצדדים.",
    related: ["פרוטוקול דיון מקדמי", "תצהיר עדות ראשית — ד״ר לוי", "חוות דעת מומחה מטעם בית המשפט בשאלת הנכות הרפואית והקשר הסיבתי לאירוע"], checked: false, file: "/studioOS/docs/decision-1.pdf",
  },
  {
    id: "d7", name: "כתב תביעה", type: "כתבי טענות", submitter: "תובע",
    date: "12.02.26", time: "14:10", iso: "2026-02-12", bucket: "older", words: "15.7K",
    summary: "התובע, מר יעקב אברמוב, הגיש כתב תביעה כנגד הנתבע בגין רשלנות רפואית לכאורה בטיפול שניתן לו, בעקבותיו נגרמו נזקי גוף.",
    related: ["כתב הגנה מתוקן", "תצהיר עדות ראשית — ד״ר לוי", "בקשה לגילוי מסמכים", "כתב תביעה שכנגד"], checked: false, file: "/studioOS/docs/claim-1.pdf",
  },
  {
    id: "d8", name: "חוות דעת אקטוארית", type: "חוות דעת", submitter: "תובע",
    date: "20.01.26", time: "10:20", iso: "2026-01-20", bucket: "older", words: "3.6K",
    summary: "חישוב הפסדי השתכרות לעבר ולעתיד על בסיס הנכות הנטענת, בצירוף הפסדי פנסיה וזכויות סוציאליות.",
    related: ["תצהיר עדות ראשית — ד״ר לוי"], checked: false, file: "/studioOS/docs/expert-opinion-1.pdf",
  },
  {
    id: "d9", name: "הודעה על הגשת ראיות נוספות", type: "בקשות והוראות", submitter: "תובע",
    date: "01.06.26", time: "13:20", iso: "2026-06-01", bucket: "week", words: "420",
    summary: "התובע מודיע על כוונתו להגיש תיעוד רפואי עדכני שהצטבר לאחר הגשת התצהירים. הנתבע טרם הגיב.",
    related: ["תצהיר עדות ראשית — ד״ר לוי"], checked: false, file: "/studioOS/docs/motion-3.pdf", processId: 2,
  },
  {
    id: "d10", name: "בקשה לזימון עד", type: "בקשות והוראות", submitter: "נתבע",
    date: "30.05.26", time: "15:05", iso: "2026-05-30", bucket: "week", words: "0",
    summary: "המסמך טרם עובד — אין תקציר זמין.",
    related: [], checked: false, missing: true,
  },
  {
    id: "d11", name: "תצהיר עדות — גב' רוזן", type: "תצהירים", submitter: "נתבע",
    date: "28.05.26", time: "12:40", iso: "2026-05-28", bucket: "week", words: "6.2K",
    summary: "תצהיר עדה מטעם הנתבע בנוגע לנסיבות מתן הטיפול ולנהלים שהיו נהוגים במחלקה.",
    related: ["כתב הגנה מתוקן"], checked: false, file: "/studioOS/docs/affidavit-2.pdf",
  },
  {
    id: "d12", name: "החלטה בבקשת ארכה", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "02.06.26", time: "10:15", iso: "2026-06-02", bucket: "today", words: "390",
    summary: "בית המשפט נעתר חלקית לבקשת הארכה ומאריך את המועד להגשת סיכומים ב-14 יום.",
    related: ["בקשה לחיוב בהוצאות בגין דחיית הדיון"], checked: false, file: "/studioOS/docs/decision-2.pdf",
    processId: 1, // the decision that closes thread 1 — it was linked only through `related`, so the thread looked open
  },
  {
    id: "d13", name: "פרוטוקול ישיבת קדם משפט", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "15.05.26", time: "09:30", iso: "2026-05-15", bucket: "month", words: "5.8K",
    summary: "תיעוד ישיבת קדם המשפט, לרבות עמדות הצדדים והחלטות ביניים בנוגע לגילוי מסמכים.",
    related: ["פרוטוקול דיון מקדמי", "פרוטוקול דיון הוכחות ראשון"], checked: false, file: "/studioOS/docs/protocol-2.pdf",
  },
  {
    id: "d14", name: "בקשה לגילוי מסמכים", type: "בקשות והוראות", submitter: "תובע",
    date: "12.05.26", time: "13:15", iso: "2026-05-12", bucket: "month", words: "1.4K",
    summary: "התובע מבקש לחייב את הנתבע בגילוי רשומות רפואיות מלאות ויומני ניתוח רלוונטיים. הנתבע מתנגד חלקית לבקשה.",
    related: ["כתב תביעה"], checked: false, file: "/studioOS/docs/motion-4.pdf", processId: 3,
  },
  {
    id: "d15", name: "תגובה לבקשת גילוי מסמכים", type: "בקשות והוראות", submitter: "נתבע",
    date: "14.05.26", time: "10:50", iso: "2026-05-14", bucket: "month", words: "980",
    summary: "הנתבע מתנגד חלקית לגילוי וטוען לחיסיון רפואי ולחוסר רלוונטיות של חלק מהמסמכים.",
    related: [], checked: false, file: "/studioOS/docs/motion-1.pdf", processId: 3,
  },
  {
    id: "d16", name: "חוות דעת מומחה מטעם בית המשפט בשאלת הנכות הרפואית והקשר הסיבתי לאירוע", type: "חוות דעת", submitter: "בית המשפט",
    date: "08.05.26", time: "16:20", iso: "2026-05-08", bucket: "month", words: "9.7K",
    summary: "חוות דעת המומחה שמונה מטעם בית המשפט, הקובעת נכות בשיעור 18% וקשר סיבתי חלקי.",
    related: ["החלטה על מינוי מומחה"], checked: false, file: "/studioOS/docs/expert-opinion-2.pdf",
  },
  {
    id: "d17", name: "כתב תביעה שכנגד", type: "כתבי טענות", submitter: "נתבע",
    date: "03.03.26", time: "11:15", iso: "2026-03-03", bucket: "older", words: "8.9K",
    summary: "הנתבע מגיש תביעה שכנגד בטענה להוצאות שנגרמו לו עקב הגשת התביעה בחוסר תום לב.",
    related: ["כתב תביעה", "כתב הגנה מתוקן", "כתב הגנה לתביעה שכנגד", "החלטה על איחוד דיון"], checked: false, file: "/studioOS/docs/claim-2.pdf",
  },
  {
    id: "d18", name: "כתב הגנה לתביעה שכנגד", type: "כתבי טענות", submitter: "תובע",
    date: "20.03.26", time: "14:35", iso: "2026-03-20", bucket: "older", words: "4.1K",
    summary: "התובע דוחה את הטענות בתביעה שכנגד וטוען כי התביעה הוגשה בתום לב ועל בסיס ראיות.",
    related: ["כתב תביעה שכנגד"], checked: false, file: "/studioOS/docs/defense-2.pdf",
  },
  {
    id: "d19", name: "החלטה על איחוד דיון", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "25.03.26", time: "09:05", iso: "2026-03-25", bucket: "older", words: "640",
    summary: "בית המשפט מורה על איחוד הדיון בתביעה ובתביעה שכנגד לשם יעילות דיונית.",
    related: ["כתב תביעה שכנגד"], checked: false, file: "/studioOS/docs/decision-3.pdf",
  },
  {
    id: "d20", name: "פרוטוקול דיון הוכחות ראשון", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "10.04.26", time: "13:50", iso: "2026-04-10", bucket: "older", words: "11.2K",
    summary: "תיעוד דיון ההוכחות הראשון, לרבות חקירת התובע ועד מטעמו וטענות הצדדים.",
    related: ["פרוטוקול ישיבת קדם משפט", "בקשה לזימון עד נוסף"], checked: false, file: "/studioOS/docs/protocol-1.pdf",
  },
  {
    id: "d21", name: "סיכומי התובע", type: "כתבי טענות", submitter: "תובע",
    date: "18.04.26", time: "10:10", iso: "2026-04-18", bucket: "older", words: "7.3K",
    summary: "סיכומי התובע המסכמים את הראיות וטוענים לאחריות מלאה של הנתבע לנזקים שנגרמו.",
    related: [], checked: false, file: "/studioOS/docs/claim-1.pdf",
  },
  {
    id: "d23", name: "החלטה בבקשות גילוי והגשת ראיות", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "03.06.26", time: "10:05", iso: "2026-06-03", bucket: "today", words: "410",
    summary: "בית המשפט מכריע במאוחד בבקשת גילוי המסמכים ובבקשה להגשת ראיות נוספות: מורה על גילוי הרשומות הרפואיות ומתיר הגשת תיעוד עדכני בכפוף לזכות תגובה.",
    related: [], checked: false, file: "/studioOS/docs/decision-4.pdf",
    processIds: [2, 3],
  },
  // Thread 4 — filed, not yet answered: the ball is with the other side, and the judge has nothing to do with it today.
  {
    id: "d24", name: "בקשה לזימון עד נוסף", type: "בקשות והוראות", submitter: "נתבע", submitterName: "המרכז הרפואי קדם בע״מ",
    date: "03.06.26", time: "13:40", iso: "2026-06-03", bucket: "today", words: "820",
    summary: "הנתבע מבקש לזמן לעדות את האחות התורנית שטיפלה בתובע בליל האירוע, וטוען כי עדותה חיונית לבירור השתלשלות הטיפול. התובע טרם הגיב.",
    related: ["פרוטוקול דיון הוכחות ראשון"], checked: false, isNew: true, file: "/studioOS/docs/motion-3.pdf", processId: 4,
  },
  // Thread 5 — answered, undecided: this one IS waiting on the judge.
  {
    id: "d25", name: "בקשה לחיוב בהוצאות בגין דחיית הדיון", type: "בקשות והוראות", submitter: "תובע",
    date: "02.06.26", time: "15:30", iso: "2026-06-02", bucket: "today", words: "710",
    summary: "התובע מבקש לחייב את הנתבע בהוצאות בגין דחיית מועד הדיון, וטוען כי הבקשה הוגשה בהתראה קצרה ולאחר שהיערכותו לדיון כבר הושלמה.",
    related: ["החלטה בבקשת ארכה"], checked: false, isNew: true, file: "/studioOS/docs/motion-4.pdf", processId: 5,
  },
  {
    id: "d26", name: "תגובה לבקשה לחיוב בהוצאות", type: "בקשות והוראות", submitter: "נתבע",
    date: "03.06.26", time: "09:10", iso: "2026-06-03", bucket: "today", words: "560",
    summary: "הנתבע מתנגד לחיוב בהוצאות וטוען כי הודיע על הצורך בדחייה מיד עם היוודע היעדרות המומחה, וכי לא נגרמו לתובע הוצאות ממשיות.",
    related: [], checked: false, isNew: true, file: "/studioOS/docs/motion-1.pdf", processId: 5,
  },
];

// Second case (mock) — documents for a different file
const CASE_DOCS_2: CaseDoc[] = [
  { id: "e1", name: "כתב תביעה", type: "כתבי טענות", submitter: "תובע", date: "29.05.26", time: "09:20", iso: "2026-05-29", bucket: "week", words: "9.8K",
    summary: "תביעה כספית בגין הפרת חוזה בנייה ואיחור במסירת דירות לרוכשים.", related: ["כתב הגנה"], checked: false, file: "/studioOS/docs/claim-1.pdf" },
  { id: "e2", name: "בקשה לסעד זמני", type: "בקשות והוראות", submitter: "תובע", date: "31.05.26", time: "14:45", iso: "2026-05-31", bucket: "week", words: "1.2K",
    summary: "בקשה לצו מניעה זמני שימנע העברת זכויות בפרויקט עד להכרעה בתיק. הנתבע מתנגד לבקשה.", related: [], checked: false, file: "/studioOS/docs/motion-2.pdf", processId: 1 },
  { id: "e3", name: "כתב הגנה", type: "כתבי טענות", submitter: "נתבע", date: "15.04.26", time: "11:00", iso: "2026-04-15", bucket: "older", words: "7.1K",
    summary: "הנתבע טוען לעיכובים מצד התובע ולכוח עליון שמנע עמידה בלוחות הזמנים.", related: ["כתב תביעה"], checked: false, file: "/studioOS/docs/defense-1.pdf" },
  { id: "e4", name: "החלטה בבקשת סעד זמני", type: "החלטות בתיק", submitter: "בית המשפט", date: "01.06.26", time: "10:30", iso: "2026-06-01", bucket: "week", words: "540",
    summary: "בית המשפט נעתר חלקית ומורה על רישום הערת אזהרה עד לדיון.", related: [], checked: false, used: true, file: "/studioOS/docs/decision-5.pdf", processId: 1 },
];

// Case metadata (number + parties)
const CASES_META = [
  { id: "c1", number: "12345-67-89", parties: "יעקב אברמוב נ׳ המרכז הרפואי קדם בע״מ", type: 'ת"א' },
  { id: "c2", number: "59198-67-89", parties: "אורן פרידמן נ׳ שיכון הצפון חברה לבנייה בע״מ", type: 'ת"א' },
];

// ── Filter options ──────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  "הכל",
  ...DOC_TYPE_TOTALS.filter((t) => t.type !== "הכל").map((t) => t.type).sort((a, b) => a.localeCompare(b, "he")),
];
// Aggregate word count per type (for the "by type" category tags)
const CAT_WORDS: Record<string, string> = Object.fromEntries(DOC_TYPE_TOTALS.map((t) => [t.type, t.words]));

// Word-count parsing/formatting (chat budget is capped at 60K words per question)
function parseWords(s: string): number {
  const t = s.trim();
  if (t.toUpperCase().endsWith("K")) return Math.round(parseFloat(t) * 1000);
  return parseInt(t, 10) || 0;
}
function formatWords(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? k.toString() : k.toFixed(1)) + "K";
  }
  return String(n);
}
const SUBMITTER_OPTIONS = ["הכל", "תובע", "נתבע", "בית המשפט"];

// ── Compact filter dropdown (optionally type-ahead searchable) ───────────────
function FilterDropdown({
  label, value, options, onChange, searchable = false, subLabels, isDark, emptyOptions, emptyTitle,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; searchable?: boolean; subLabels?: Record<string, string>; isDark?: boolean;
  // Options with nothing behind them in the current view: shown, but grayed and not selectable, so "no פסקי דין" reads
  // as a fact about the case rather than as a filter the user got wrong. The selected value is never grayed — the user
  // must always be able to see and undo what is narrowing the list.
  emptyOptions?: Set<string>; emptyTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = searchable && q.trim() ? options.filter((o) => o.includes(q.trim())) : options;
  const isFiltered = value !== "הכל";

  return (
    <div className="relative" dir="rtl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 h-8 px-2.5 rounded-md text-[13px] transition-colors"
        style={{
          border: `1px solid ${isFiltered ? c.primary : (isDark ? dk.border : c.border)}`,
          color: isFiltered ? c.primary : (isDark ? dk.textMuted : c.textGray),
          backgroundColor: isFiltered ? (isDark ? "#22304a" : "#eff4ff") : (isDark ? dk.input : "white"),
          fontFamily: "Noto Sans Hebrew, sans-serif",
        }}
      >
        <span>{isFiltered ? value : label}</span>
        <ChevronDown size={13} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setQ(""); }} />
          <div
            className="absolute z-40 mt-1 rounded-[8px] py-1 overflow-hidden"
            style={{ top: "100%", right: 0, minWidth: "180px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.13)" }}
          >
            {searchable && (
              <div className="pr-2 pl-3 pt-1 pb-2" style={{ borderBottom: `1px solid ${isDark ? dk.border : "#eef1f4"}` }}>
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="הקלידו סוג…"
                  className="w-full h-7 text-[13px] outline-none"
                  style={{ border: "none", background: "transparent", color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                />
              </div>
            )}
            <div className="max-h-[240px] overflow-y-auto docs-scroll" dir="ltr">
              {shown.map((opt) => {
                const sel = opt === value;
                const empty = !sel && !!emptyOptions?.has(opt);
                return (
                  <button
                    key={opt}
                    dir="rtl"
                    disabled={empty}
                    title={empty ? emptyTitle : undefined}
                    onClick={() => { if (empty) return; onChange(opt); setOpen(false); setQ(""); }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-right ${empty ? "cursor-default" : ""}`}
                    style={{ backgroundColor: sel ? (isDark ? "#22304a" : "#eff4ff") : "transparent", color: empty ? (isDark ? "#4d5878" : c.textLight) : (sel ? c.primary : (isDark ? dk.text : c.text)), fontWeight: sel ? 600 : 400, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                    onMouseEnter={(e) => { if (!sel && !empty) e.currentTarget.style.backgroundColor = isDark ? dk.border : c.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = sel ? (isDark ? "#22304a" : "#eff4ff") : "transparent"; }}
                  >
                    <span className="flex flex-col items-start min-w-0">
                      <span>{opt}</span>
                      {subLabels?.[opt] && <span className="text-[13px] mt-0.5 truncate max-w-full" style={{ color: isDark ? dk.textMuted : c.textGray, fontWeight: 400 }}>{subLabels[opt]}</span>}
                    </span>
                    {sel && <Check size={13} style={{ color: c.primary, flexShrink: 0 }} />}
                  </button>
                );
              })}
              {shown.length === 0 && (
                <div className="px-3 py-2 text-[12px]" style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif" }}>אין תוצאות</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Date range filter (from / to) ────────────────────────────────────────────
function DateRangeFilter({
  from, to, onChange, isDark,
}: {
  from: string; to: string; onChange: (from: string, to: string) => void; isDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = !!(from || to);
  const fmt = (iso: string) => (iso ? iso.split("-").reverse().join(".").slice(0, 8) : "…");
  const label = active ? `${fmt(from)} – ${fmt(to)}` : "תאריך";
  return (
    <div className="relative" dir="rtl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 h-8 px-2.5 rounded-md text-[13px] transition-colors"
        style={{ border: `1px solid ${active ? c.primary : (isDark ? dk.border : c.border)}`, color: active ? c.primary : (isDark ? dk.textMuted : c.textGray), backgroundColor: active ? (isDark ? "#22304a" : "#eff4ff") : (isDark ? dk.input : "white"), fontFamily: "Noto Sans Hebrew, sans-serif" }}
      >
        <Calendar size={13} />
        <span>{label}</span>
        <ChevronDown size={13} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute z-40 mt-1 rounded-[8px] p-3 flex flex-col gap-2.5"
            style={{ top: "100%", right: 0, width: "164px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.13)" }}
          >
            <label className="flex flex-col gap-1 text-[14px]" style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              מתאריך
              <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="w-full box-border h-9 rounded px-2 text-[14px] outline-none" style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}`, backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text }} />
            </label>
            <label className="flex flex-col gap-1 text-[14px]" style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              עד תאריך
              <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="w-full box-border h-9 rounded px-2 text-[14px] outline-none" style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}`, backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text }} />
            </label>
            {active && (
              <button onClick={() => onChange("", "")} className="text-[12px] self-start" style={{ color: c.primary, fontFamily: "Noto Sans Hebrew, sans-serif" }}>נקה טווח</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Document row — lean by default, expands on hover (or click to pin) ───────
const SUBMITTER_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  "תובע": { bg: "#e6f0fb", color: "#1a6dc4", dot: "#69a8e0" },     // blue
  "נתבע": { bg: "#f1eafc", color: "#7a4ec2", dot: "#a98fd6" },     // purple
  "בית המשפט": { bg: "#eaf3ec", color: "#2f7d4f", dot: "#74b58f" }, // green
};

// Per-document-type tag colors (light bg + readable text) — the type tag carries the color cue
const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  "כתבי טענות":    { bg: "#e6f0fb", color: "#1a6dc4" }, // blue
  "בקשות והוראות": { bg: "#f1eafc", color: "#7a4ec2" }, // purple
  "תצהירים":       { bg: "#e7f4ea", color: "#2f7d4f" }, // green
  "חוות דעת":      { bg: "#fdecd9", color: "#b9670c" }, // orange
  "החלטות בתיק":   { bg: "#e8eafc", color: "#3949ab" }, // indigo
  "פסקי דין":      { bg: "#fbe5e3", color: "#b23a2c" }, // red
  "פרוטוקולים":    { bg: "#e0f0ef", color: "#287d75" }, // teal
  "מוצגים":        { bg: "#fbf3d3", color: "#8a6d12" }, // yellow
};

// Specific party name per case + side (shown on hover; useful when a side has several)
const PARTY_NAMES: Record<string, Record<string, string>> = {
  c1: { "תובע": "יעקב אברמוב", "נתבע": "המרכז הרפואי קדם בע״מ" },
  c2: { "תובע": "אורן פרידמן", "נתבע": "שיכון הצפון חברה לבנייה בע״מ" },
};

function DocRow({ doc, isDark, markNew, active, onOpenDoc, onToggleCheck, rowRef }: { doc: CaseDoc; isDark: boolean; markNew?: boolean; active?: boolean; onOpenDoc?: () => void; onToggleCheck: () => void; rowRef?: (el: HTMLDivElement | null) => void }) {
  const sub = SUBMITTER_COLORS[doc.submitter] ?? { bg: "#eef1f8", color: c.iconGray, dot: c.iconGray };
  const [relMore, setRelMore] = useState(false);
  const RELATED_LIMIT = 2;
  const shownRelated = relMore ? doc.related : doc.related.slice(0, RELATED_LIMIT);
  const iconCol = isDark ? dk.textMuted : c.iconGray;
  const subText = isDark ? dk.textMuted : c.textGray;
  const textCol = isDark ? dk.text : c.text;
  const partyName = doc.submitterName ?? (doc.caseId ? PARTY_NAMES[doc.caseId]?.[doc.submitter] : undefined);
  const baseBg = isDark ? dk.input : "white";
  const activeBg = isDark ? "#212c42" : "#f4f8fd"; // gentle takhelet tint for the currently-open document
  return (
    <div
      ref={rowRef}
      className="rounded-[8px] border h-full overflow-hidden flex flex-col cursor-pointer transition-colors"
      style={{ borderColor: active ? c.primary : (isDark ? dk.border : "#dce8f6"), backgroundColor: active ? activeBg : baseBg, boxShadow: markNew ? "inset -2px 0 0 0 rgba(0,115,234,0.45)" : undefined }}
      dir="rtl"
      onClick={onOpenDoc}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? "#232c44" : (active ? "#e1ecfb" : "#f6f9ff"); }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? activeBg : baseBg; }}
    >
      {/* Row 1: checkbox · document name (single line, ellipsis if long) */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span onClick={(e) => e.stopPropagation()}><CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} /></span>
        <button className="flex-1 min-w-0 text-right" title={doc.name}>
          <span className="doc-link text-[14px] font-medium block truncate" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>
            {doc.name}
          </span>
        </button>
      </div>

      {/* Row 2: all metadata + icons on one line (date · submitter · key · used · open · count) */}
      <div className="flex items-center gap-2 px-3 pt-1.5 pb-2.5 overflow-hidden">
        <span className="text-[12px] flex-shrink-0" style={{ color: subText, fontFamily: "Figtree, sans-serif" }}>{doc.date}{doc.time ? ` · ${doc.time}` : ""}</span>
        <span
          title={partyName ? `${doc.submitter} — ${partyName}` : doc.submitter}
          className="rounded px-2 py-0.5 text-[12px] flex-shrink-0"
          style={{ backgroundColor: sub.bg, color: sub.color, fontFamily: "Noto Sans Hebrew, sans-serif" }}
        >{doc.submitter}</span>
        {doc.used && <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="שימש בתשובת הצ׳אט האחרונה" />}
        <div className="flex-1" />
        <span
          className="rounded-full px-2 py-px text-[12px] flex-shrink-0"
          style={doc.missing
            ? { color: "#d83a52", backgroundColor: "#fde8eb", fontFamily: "Figtree, sans-serif" }
            : { color: isDark ? dk.textMuted : c.textLight, backgroundColor: "transparent", fontFamily: "Figtree, sans-serif" }}
          title={doc.missing ? "המסמך ללא תוכן" : "מספר מילים"}
        >{doc.words}</span>
      </div>

      {/* Summary + related docs (collapses to one line with a "more" toggle) */}
      <div className="px-3 pb-2.5 pt-0.5 flex flex-col gap-1.5 flex-1">
        <p className="text-[14px] leading-snug" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</p>
        {doc.related.length > 0 && (
          <div className={`flex items-center gap-x-3 gap-y-1 mt-auto ${relMore ? "flex-wrap" : "flex-nowrap overflow-hidden"}`}>
            {shownRelated.map((r) => (
              <button key={r} onClick={(e) => e.stopPropagation()} className="doc-link flex items-center gap-1 text-right min-w-0" title={r}>
                <FileText size={12} style={{ flexShrink: 0 }} />
                <span className="text-[13px] truncate" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>{r}</span>
              </button>
            ))}
            {doc.related.length > RELATED_LIMIT && (
              <button
                onClick={(e) => { e.stopPropagation(); setRelMore((v) => !v); }}
                className="flex items-center gap-0.5 text-[13px] flex-shrink-0"
                style={{ color: c.primary, fontFamily: "Noto Sans Hebrew, sans-serif" }}
              >
                {relMore ? "פחות" : "עוד"}
                <ChevronDown size={12} style={{ transition: "transform 0.15s", transform: relMore ? "rotate(180deg)" : "none" }} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// A compact icon/number trigger inside a table row (process number · 🔗 related · 📎 attachments).
// `picked` turns the icon blue once any of this group's nested items are selected for the chat (otherwise it
// stays the default gray). No partial vs. full distinction — just picked / not picked.
// The chip's FILL carries what the click does, and the rule holds across the whole row:
//   solid chip   = opens in place, UNDER this row — the thing belongs to this document (תהליך · 📎 נספחים)
//   outline chip = opens a floating list that points AWAY from this row (🔗 מסמכים קשורים)
// Both stay boxed: validation showed an unboxed control isn't read as clickable at all, so the box is the
// affordance and only the fill is free to carry the distinction.
function RowIconTrigger({ children, active, onClick, title, isDark, picked = false, boxed = false, outline = false }: { children: React.ReactNode; active: boolean; onClick: (e: ReactMouseEvent) => void; title: string; isDark: boolean; picked?: boolean; boxed?: boolean; outline?: boolean }) {
  // `boxed` gives the icon a subtle button chip so it reads as an interactive control, not as column content.
  const lit = active || picked;
  const chipBg = lit ? (isDark ? "#22304a" : c.primaryLight) : outline ? "transparent" : (isDark ? "#232c40" : "#eef1f6");
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center flex-shrink-0 rounded transition-colors ${boxed ? "" : "hover:opacity-75"}`}
      style={boxed
        ? { color: lit ? c.primary : (isDark ? dk.textMuted : c.iconGray), backgroundColor: chipBg, border: `1px solid ${lit ? c.primary : (isDark ? dk.border : "#dde3ec")}`, padding: "2px 2px", lineHeight: 0 }
        : { color: lit ? c.primary : (isDark ? dk.textMuted : c.textGray) }}
      title={title}
    >
      {children}
    </button>
  );
}

// The text-wrap glyph. This is Google's own `format_text_wrap` (Material Symbols, Apache-2.0) — the icon Sheets
// puts on this exact control, and the one the PM recognised on sight. Three rounds of stroke-based glyphs failed
// here for a reason worth keeping: a stroke icon spends its budget on THREE horizontal text lines stacked inside
// ~10px, so nothing has room. This one spends it on two long VERTICAL bars — the cell's edges — which stay crisp
// at any size and carry the whole silhouette, leaving one big filled arrow between them. Filled beats stroked at
// this size (more ink per pixel), so it holds together where our own drawings smudged. Weight axis wght300, not
// the default 400 — the 400 read heavy beside 12px header labels; 200 exists but its bars go sub-pixel and turn grey.
// NOT mirrored for RTL, deliberately (her call): the arrow points left exactly as it does in Sheets, because what
// this icon is doing here is being recognised, and it is recognised by the shape people already know.
function WrapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="M180-180v-600h60v600h-60Zm540 0v-600h60v600h-60Zm-290.61-92.23L301.62-400l127.77-126.77L471.15-485l-55 55h98.46q37.62 0 63.81-26.19 26.2-26.19 26.2-63.81 0-37.62-26.2-63.81Q552.23-610 514.61-610H295.39v-60h219.22q62.16 0 106.08 43.92 43.92 43.93 43.92 106.08t-43.92 106.08Q576.77-370 514.61-370h-98.46l55 55-41.76 42.77Z" />
    </svg>
  );
}

// Process id(s) as small numeric chips for the process column — the numbers stay visible (they matter) but read as
// structured tags rather than noisy "2, 3" plain text. Chip text inherits its color (so a clickable trigger can tint it).
function ProcessChips({ ids, isDark }: { ids: number[]; isDark: boolean }) {
  return (
    <span className="flex items-center justify-center gap-px min-w-0">
      {ids.map((pid) => (
        <span key={pid} className="rounded text-[11px] font-semibold leading-none flex-shrink-0" style={{ backgroundColor: isDark ? "#2a3550" : "#e9eef7", fontFamily: "Figtree, sans-serif", padding: "2px 3px" }}>{pid}</span>
      ))}
    </span>
  );
}

// The label inside a CLICKABLE process trigger: ONE process number, as plain text. The boxed chip around it — the very
// same chip 🔗 מסמכים קשורים and 📎 נספחים wear — is what says "this opens something"; a number on its own pill
// background read as column content, which is why users never tried clicking it.
function ProcessTriggerLabel({ id }: { id: number }) {
  return (
    <span className="flex items-center justify-center text-[11.5px] font-semibold leading-none" style={{ fontFamily: "Figtree, sans-serif", minWidth: "13px", minHeight: "13px" /* match the 13px icon in the 🔗/📎 chips so the three buttons are the same size */ }}>
      {id}
    </span>
  );
}

// The extra processes beyond the first, as a blue "+N" that sits OUTSIDE the chip — bare text, no button styling.
// Keeping it out of the chip is what makes it unmistakable: inside, "2 +1" reads as one crowded label and a
// comma-joined "2,3" reads as the single number twenty-three. Outside, the chip is still one process and the +N is
// plainly something else. It stays clickable (same panel — the panel lists every process by name and count), so the
// blue is honest rather than decorative.
function ProcessOverflowLink({ onClick, title, isDark }: { onClick: (e: ReactMouseEvent) => void; title: string; isDark: boolean }) {
  // A bare "+", not "+2": beside a chip that already shows a process NUMBER, a second digit reads as another process
  // number rather than as a count. Dropping it loses "how many", which now lives in the tooltip and in the folder rows
  // the panel opens — and buys back 5px of a column that was struggling to centre.
  // (Kept dir="ltr" as a guard: the moment anyone puts a digit back here, RTL reorders "+2" into "2+".)
  return (
    <button dir="ltr" onClick={onClick} title={title} className="text-[14px] font-semibold leading-none flex-shrink-0 hover:underline" style={{ color: isDark ? dk.blue : c.primary, fontFamily: "Figtree, sans-serif" }}>
      +
    </button>
  );
}

// Inline detail panel that expands directly under a table row, in place of the old floating popovers.
// One nested document rendered inside an expanded detail, using the SAME dynamic columns as the parent table so
// every field lines up (and the pinned block stays put on horizontal scroll). The checkbox column is live: related
// and process-thread docs are real case documents, so ticking one here toggles that document's own `checked` state.
function NestedDocRow({ doc, gridCols, colGap, colMeta, showType, isDark, isOpen, isSelf, variant = "related", onOpenDoc, onToggleCheck }: { doc: CaseDoc; gridCols: string; colGap: string; colMeta: ColMeta; showType: boolean; isDark: boolean; isOpen?: boolean; isSelf?: boolean; variant?: "related" | "process"; onOpenDoc?: (doc: CaseDoc) => void; onToggleCheck?: () => void }) {
  const metaCol = isDark ? dk.textMuted : c.textLight;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const partyName = doc.submitterName ?? (doc.caseId ? PARTY_NAMES[doc.caseId]?.[doc.submitter] : undefined);
  const typeC = TYPE_COLORS[doc.type] ?? { bg: isDark ? dk.input : "#eef1f4", color: isDark ? dk.textMuted : c.textGray };
  const num = colMeta.docNumbers[doc.id];
  // Opaque backgrounds (so pinned sticky cells occlude scrolling content): base = detail-panel bg, plus open/hover tints.
  const baseBg = isDark ? dk.input : "white"; // matches the table: the panel is no longer a tinted block
  const restBg = isOpen ? (isDark ? "#22293f" : "#e8f0fc") : baseBg;
  const hoverBg = isOpen ? restBg : (isDark ? "#232c44" : "#f6f9ff");
  const cellContent = (key: string) => {
    switch (key) {
      case "checkbox": return onToggleCheck ? <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} /></span> : <span className="flex-shrink-0" />;
      case "num":      return <span dir="ltr" className="text-center w-full text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="מספר מסמך">{num != null ? `#${num}` : ""}</span>;
      case "date":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.time ? `${doc.date} ${doc.time}` : doc.date}>{doc.date}</span>;
      case "time":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="שעת הגשה">{doc.time ?? "—"}</span>;
      case "process":  return <span className="min-w-0 flex justify-center w-full" style={{ color: metaCol }}>{docProcessIds(doc).length > 0 && <ProcessChips ids={docProcessIds(doc)} isDark={isDark} />}</span>;
      case "name":     return (
        <span className="flex items-center gap-1 min-w-0" style={{ paddingInlineStart: "6px" }}>
          {variant === "process"
            ? <CornerDownRight size={11} className="flex-shrink-0" style={{ color: metaCol, opacity: 0.85, transform: "scaleX(-1)" }} />
            : <Link size={11} className="flex-shrink-0" style={{ color: metaCol, opacity: 0.85 }} />}
          <span className="doc-link truncate text-[12.5px] leading-tight" title={doc.name} style={{ fontFamily: "Noto Sans Hebrew, sans-serif", fontStyle: isSelf ? "italic" : undefined, color: isOpen ? c.primary : undefined, textDecoration: isOpen ? "underline" : undefined, textDecorationColor: isOpen ? c.primary : undefined, textUnderlineOffset: "2px", paddingBottom: "2px" }}>{doc.name}</span>
          {doc.used && <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="שימש בתשובת הצ׳אט האחרונה" />}
        </span>
      );
      case "summary":  return <span className={colMeta.summaryWrap ? "text-[12.5px] min-w-0 whitespace-normal leading-snug" : "truncate text-[12.5px] min-w-0"} onMouseEnter={(e) => colMeta.onCellTip?.(doc.summary, e)} onMouseLeave={() => colMeta.onCellTip?.(null)} style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</span>;
      case "type":     return <span className="min-w-0 flex"><span className="text-[11.5px] truncate rounded px-1.5 py-px" style={{ backgroundColor: typeC.bg, color: typeC.color, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={doc.type}>{doc.type}</span></span>;
      case "submitter":return <span className="text-[12.5px] truncate min-w-0" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={partyName ? `${doc.submitter} · ${partyName}` : doc.submitter}>{submitterLetter(doc.submitter)}</span>;
      case "related":  return <span />;
      case "attachments": return <span />;
      case "note":     return <span />;
      case "words":    return <span className="text-[11.5px] text-right w-full" style={{ color: doc.missing ? "#d83a52" : metaCol, fontFamily: "Figtree, sans-serif", paddingInlineStart: "4px" }} title={doc.missing ? "המסמך ללא תוכן" : "מספר מילים"}>{doc.words}</span>;
      default:         return null;
    }
  };
  return (
    <div
      className="grid items-center px-2 py-1 rounded transition-colors cursor-pointer"
      style={{ gridTemplateColumns: gridCols, columnGap: colGap, minWidth: `${showType ? colMeta.minWidthType : colMeta.minWidthNoType}px`, ["--row-bg" as string]: restBg, backgroundColor: "var(--row-bg)" } as React.CSSProperties}
      onClick={() => onOpenDoc?.(doc)}
      onMouseEnter={(e) => { e.currentTarget.style.setProperty("--row-bg", hoverBg); }}
      onMouseLeave={(e) => { e.currentTarget.style.setProperty("--row-bg", restBg); }}
    >
      {colMeta.order.filter((key) => colShown(key, colMeta, showType)).map((key) => (
        <div key={key} className="min-w-0 flex items-center h-full" style={pinCellStyle(key, colMeta)}>
          {cellContent(key)}
        </div>
      ))}
    </div>
  );
}

// Attachments aren't case documents, so their selection is tracked in a Set keyed by parent-doc + name.
const attKey = (docId: string, name: string) => `${docId}::${name}`;

// ── Table columns (customizable) ────────────────────────────────────────────
// Toggleable columns the user can show/hide. The checkbox, document name, and the related/attachment icons are
// structural and always shown, so they're not in this list. "num" (מספר מסמך) and "time" (שעת הגשה) are OFF by default.
type DocColKey = "num" | "date" | "time" | "process" | "summary" | "type" | "submitter" | "related" | "attachments" | "note" | "words";
const DOC_COL_ORDER: DocColKey[] = ["num", "date", "time", "process", "summary", "type", "submitter", "related", "attachments", "note", "words"]; // data keys (labels + visibility defaults)
// The LAYOUT order includes the "name" anchor. Columns before it are frozen (stay put on horizontal scroll); columns
// after it scroll. Default puts process · date right of the name, like before — but every column is freely movable
// (drag it across the name line to change whether it scrolls).
type LayoutKey = DocColKey | "name";
// נספחים sits immediately after שם מסמך, not out with the metadata: a נספח is part of THIS document (validation,
// 2026-08-23 — "חלק מאוד מהותי מהמסמך"), whereas מסמכים קשורים is a relation to OTHER documents and stays in the
// metadata block. Adjacency is what makes that distinction readable without explaining it.
// שעת הגשה follows תאריך — the layout drives the columns popover too, so the two time fields read as a pair in the
// menu, and the column lands beside the date when it is switched on.
const DEFAULT_LAYOUT: LayoutKey[] = ["date", "time", "process", "num", "name", "attachments", "summary", "type", "submitter", "related", "words", "note"]; // הערה sits at the far end: its own column, and the one spot where its label cannot crowd a neighbour
const reconcileLayout = (stored: string[]): LayoutKey[] => {
  const all: LayoutKey[] = ["name", ...DOC_COL_ORDER];
  const valid = stored.filter((k): k is LayoutKey => all.includes(k as LayoutKey));
  const withName: LayoutKey[] = valid.includes("name") ? valid : [...valid, "name"];
  const missing = all.filter((k) => !withName.includes(k));
  return [...withName, ...missing];
};
const DOC_COL_LABELS: Record<DocColKey, string> = { num: "מספר מסמך", date: "תאריך", time: "שעת הגשה", process: "תהליך", summary: "תקציר", type: "סוג", submitter: "מגיש", related: "מסמכים קשורים", attachments: "נספחים", note: "הערה", words: "מספר מילים" };
const DOC_COL_DEFAULTS: Record<DocColKey, boolean> = { num: false, date: true, time: false, process: true, summary: true, type: true, submitter: true, related: true, attachments: true, note: true, words: true };
const DOC_COLS_LS_KEY = "mishpat-lab-docCols-v3"; // key bumped → old saved column state is discarded, everyone gets fresh defaults
const loadDocCols = (): Record<DocColKey, boolean> => {
  if (typeof window === "undefined") return { ...DOC_COL_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(DOC_COLS_LS_KEY);
    if (raw) return { ...DOC_COL_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DOC_COL_DEFAULTS };
};
// Persisted column LAYOUT (order + freeze line via the "name" anchor). Bumped key ("v2") so the old order format is ignored.
const DOC_COLORDER_LS_KEY = "mishpat-lab-docLayout-v7"; // bump on EVERY default-order change (v5 נספחים beside the name, v6 שעת הגשה after תאריך) — without it, anyone who has opened the page keeps the old order and never sees the change
const loadLayout = (): LayoutKey[] => {
  if (typeof window === "undefined") return [...DEFAULT_LAYOUT];
  try {
    const raw = window.localStorage.getItem(DOC_COLORDER_LS_KEY);
    if (raw) return reconcileLayout(JSON.parse(raw));
  } catch { /* ignore */ }
  return [...DEFAULT_LAYOUT];
};

// ── Editing a document's name / summary ────────────────────────────────────
// The name and summary are the SYSTEM's output, not the court record, so a user may correct them. Two rules hold this
// together: (1) the original is never destroyed — it is kept on the document and one hover away, and restorable;
// (2) the edit is PERSONAL (2026-08-19 decision) — a judge may well use the summary as a private reminder of what the
// document is, so it must not rewrite what colleagues see. Personal scope is also why it persists to localStorage
// rather than to the document. If this ever becomes shared-per-case, this overlay is the thing that moves server-side.
type EditField = "name" | "summary" | "note";
type NoteOpts = { shared: boolean; inChat: boolean };
// note has no "original" — the system never writes one, so there is nothing to restore to; an emptied note is
// simply gone. noteShared rides along with it because it is a property of that note, not of the document.
type DocEdit = Partial<Record<EditField, string>> & { noteShared?: boolean; noteInChat?: boolean };
const DOC_EDITS_LS_KEY = "mishpat-lab-docEdits-v1";
const loadDocEdits = (): Record<string, DocEdit> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DOC_EDITS_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
};
const saveDocEdits = (m: Record<string, DocEdit>) => {
  try { window.localStorage.setItem(DOC_EDITS_LS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
};
// Re-apply saved edits on top of the freshly-loaded documents (the system text becomes the "original").
const applyDocEdits = (list: CaseDoc[]): CaseDoc[] => {
  const edits = loadDocEdits();
  if (!Object.keys(edits).length) return list;
  return list.map((d) => {
    const e = edits[d.id];
    if (!e) return d;
    const next = { ...d };
    if (e.name != null && e.name !== d.name) { next.nameOriginal = d.name; next.name = e.name; }
    if (e.summary != null && e.summary !== d.summary) { next.summaryOriginal = d.summary; next.summary = e.summary; }
    if (e.note != null) { next.note = e.note; next.noteShared = !!e.noteShared; next.noteInChat = !!e.noteInChat; }
    return next;
  });
};
// Which cell is open for editing, and how to start/cancel/commit — carried by context so it doesn't have to be drilled
// through every table row. `commit(null)` restores the system's text.
const DocEditCtx = createContext<{
  editing: { id: string; field: EditField } | null;
  start: (id: string, field: EditField) => void;
  cancel: () => void;
  commit: (id: string, values: Partial<Record<EditField, string | null>>, noteOpts?: NoteOpts) => void;
  setDirty: (dirty: boolean) => void;
} | null>(null);

// The editor opens as a panel UNDER the row (same pattern as the related/process/attachment details) rather than inside
// the cell: the summary column is routinely ~100px wide, which is unusable for rewriting a paragraph. Both fields are
// edited together — the pencil that was clicked only decides which one gets the focus.
function DocEditPanel({ doc, focusField, isDark, onCommit, onCancel, onDirtyChange }: {
  doc: CaseDoc; focusField: EditField; isDark: boolean;
  onCommit: (values: Partial<Record<EditField, string | null>>, noteShared?: boolean) => void; onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(doc.name);
  const [summary, setSummary] = useState(doc.summary);
  // Reported up so a second click on the pencil can close an untouched panel without ever discarding typed text.
  const editName = (v: string) => { setName(v); onDirtyChange(v !== doc.name || summary !== doc.summary); };
  const editSummary = (v: string) => { setSummary(v); onDirtyChange(name !== doc.name || v !== doc.summary); };
  const nameRef = useRef<HTMLInputElement | null>(null);
  const sumRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = focusField === "name" ? nameRef.current : sumRef.current;
    if (el) { el.focus(); el.select(); }
  }, [focusField]);
  const labelCol = isDark ? dk.textMuted : c.textLight;
  // undefined = untouched, null = back to the system's text (also when emptied), string = the user's wording
  const norm = (draft: string, current: string, original?: string): string | null | undefined => {
    const v = draft.trim();
    if (v === current) return undefined;
    if (v === "" || (original != null && v === original)) return null;
    return v;
  };
  const save = () => {
    const out: Partial<Record<EditField, string | null>> = {};
    const n = norm(name, doc.name, doc.nameOriginal); if (n !== undefined) out.name = n;
    const s = norm(summary, doc.summary, doc.summaryOriginal); if (s !== undefined) out.summary = s;
    onCommit(out);
  };
  const fieldStyle: React.CSSProperties = {
    fontFamily: "Noto Sans Hebrew, sans-serif", border: `1px solid ${isDark ? dk.border : "#cfe1f7"}`, resize: "none",
    backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text,
  };
  const restoreBtn = (original: string | undefined, onRestore: () => void) => original == null ? null : (
    <button onClick={onRestore} className="text-[11.5px] hover:opacity-70 whitespace-nowrap flex-shrink-0"
      style={{ color: c.primary, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={`נוסח המערכת: ${original}`}>שחזור לנוסח המערכת</button>
  );
  const label = (text: string) => <span className="text-[12px]" style={{ color: labelCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{text}</span>;
  return (
    <div
      className="px-3 py-2.5 flex flex-col gap-2.5" dir="rtl"
      style={{ backgroundColor: isDark ? "#181f33" : "#f4f8fd", borderTop: `1px solid ${isDark ? dk.border : "#e3ebf5"}` }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      }}
    >
      <span className="flex items-center gap-1.5 text-[12px]" style={{ color: labelCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
        <Pencil size={12} className="flex-shrink-0" />
        השם והתקציר נכתבו על ידי המערכת — הנוסח שתשמרו כאן נשמר עבורכם בלבד
      </span>

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">{label("שם המסמך")}<span className="flex-1" />{restoreBtn(doc.nameOriginal, () => editName(doc.nameOriginal!))}</span>
        {/* Enter saves from the NAME field (single-line input — that is what Enter means there). In the summary it has
            to stay a line break, or a paragraph couldn't be broken and an ordinary Enter mid-writing would close the
            panel; Ctrl+Enter saves from there. */}
        <input ref={nameRef} value={name} onChange={(e) => editName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }}
          className="w-full rounded px-2 py-1.5 text-[13px] leading-tight outline-none" style={fieldStyle} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">{label("תקציר")}<span className="flex-1" />{restoreBtn(doc.summaryOriginal, () => editSummary(doc.summaryOriginal!))}</span>
        <textarea ref={sumRef} value={summary} onChange={(e) => editSummary(e.target.value)} rows={4}
          className="w-full rounded px-2 py-1.5 text-[13px] leading-snug outline-none" style={fieldStyle} />
      </div>


      {/* Buttons pinned to the far (left, in RTL) end of the panel, שמירה outermost with ביטול to its right. The
          Esc / Ctrl+Enter shortcuts still work but are deliberately NOT advertised — the hint read as one more
          thing to learn. */}
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="rounded-md px-3 h-7 text-[13px] hover:bg-black/5 transition-colors"
          style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>ביטול</button>
        <button onClick={save} className="rounded-md px-3 h-7 text-[13px] hover:opacity-90 transition-opacity"
          style={{ backgroundColor: c.primary, color: "white", fontFamily: "Noto Sans Hebrew, sans-serif" }}>שמירה</button>
      </div>
    </div>
  );
}

function DocNotePanel({ doc, isDark, onCommit, onCancel, onDirtyChange }: {
  doc: CaseDoc; isDark: boolean;
  onCommit: (values: Partial<Record<EditField, string | null>>, noteOpts?: NoteOpts) => void; onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [note, setNote] = useState(doc.note ?? "");
  const [shared, setShared] = useState(!!doc.noteShared);
  const [inChat, setInChat] = useState(!!doc.noteInChat);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); el.select(); } }, []);
  const dirty = (nt: string, sh: boolean, ic: boolean) => nt !== (doc.note ?? "") || (nt !== "" && (sh !== !!doc.noteShared || ic !== !!doc.noteInChat));
  const editNote = (v: string) => { setNote(v); onDirtyChange(dirty(v, shared, inChat)); };
  const editShared = (v: boolean) => { setShared(v); onDirtyChange(dirty(note, v, inChat)); };
  const editInChat = (v: boolean) => { setInChat(v); onDirtyChange(dirty(note, shared, v)); };
  const labelCol = isDark ? dk.textMuted : c.textLight;
  const save = () => {
    // The note has no system text behind it: emptied means deleted, not restored to anything.
    const nt = note.trim();
    const out: Partial<Record<EditField, string | null>> = {};
    if (nt !== (doc.note ?? "")) out.note = nt === "" ? null : nt;
    else if (nt !== "" && (shared !== !!doc.noteShared || inChat !== !!doc.noteInChat)) out.note = nt; // only a flag changed
    onCommit(out, { shared, inChat });
  };
  return (
    <div
      className="px-3 py-2.5 flex flex-col gap-2" dir="rtl"
      style={{ backgroundColor: isDark ? "#181f33" : "#f4f8fd", borderTop: `1px solid ${isDark ? dk.border : "#e3ebf5"}` }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      }}
    >
      <span className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: labelCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
          <StickyNote size={12} className="flex-shrink-0" />
          הערה משלכם על המסמך
        </span>
        <span className="flex-1" />
        {/* Who may read it is part of the note, so it is asked right where the note is written rather than buried
            in a setting — people write differently when they know who is reading. */}
        <span className="flex items-center h-6 rounded-md overflow-hidden flex-shrink-0" style={{ border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}` }}>
          {([[false, "לעיני בלבד"], [true, "לי ולצוותי"]] as [boolean, string][]).map(([val, lbl], i) => (
            <button
              key={lbl}
              onClick={() => editShared(val)}
              className="h-full px-2 flex items-center text-[11.5px] whitespace-nowrap transition-colors"
              style={{ backgroundColor: shared === val ? (isDark ? "#22304a" : "#eaf2fd") : "transparent", color: shared === val ? c.primary : (isDark ? dk.textMuted : c.textGray), fontFamily: "Noto Sans Hebrew, sans-serif", borderInlineStart: i === 1 ? `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}` : undefined }}
              title={val ? "כל מי שעובד על התיק יראה את ההערה, בציון שמך" : "ההערה נשמרת עבורך בלבד"}
            >
              {lbl}
            </button>
          ))}
        </span>
      </span>
      <textarea
        ref={ref} value={note} onChange={(e) => editNote(e.target.value)} rows={3} placeholder="מה חשוב לזכור על המסמך הזה"
        className="w-full rounded px-2 py-1.5 text-[13px] leading-snug outline-none"
        style={{ fontFamily: "Noto Sans Hebrew, sans-serif", border: `1px solid ${isDark ? dk.border : "#cfe1f7"}`, resize: "none", backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text }}
      />
      <div className="flex items-center gap-2">
        {/* Opt-in, never a default: the note is the user's own framing of the document — the one piece of context
            the model cannot infer — but a note written "לעיני בלבד" must not leak into a prompt unasked. Worded as
            a standing rule rather than "send now", because a note only matters while its document is in scope;
            ticking it for an unselected document would otherwise appear to do nothing. */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none" title="ההערה תימסר לצ׳אט כהקשר נוסף, בכל שיחה שהמסמך הזה נכלל בה">
          <SelectionDimmed.Provider value={false}><CheckboxBlue checked={inChat} onToggle={() => editInChat(!inChat)} /></SelectionDimmed.Provider>
          <span className="text-[12px]" style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>לצרף את ההערה לשיחה כשהמסמך נכלל בה</span>
        </label>
        <span className="flex-1" />
        <button onClick={onCancel} className="rounded-md px-3 h-7 text-[13px] hover:bg-black/5 transition-colors"
          style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>ביטול</button>
        <button onClick={save} className="rounded-md px-3 h-7 text-[13px] hover:opacity-90 transition-opacity"
          style={{ backgroundColor: c.primary, color: "white", fontFamily: "Noto Sans Hebrew, sans-serif" }}>שמירה</button>
      </div>
    </div>
  );
}

// One pencil serves both jobs: the (hover-only) invitation to edit, and — once the text has been edited — a permanent
// blue mark that this is the user's wording, whose tooltip carries the system's original.
function EditPencil({ edited, title, isDark, onStart }: { edited: boolean; title: string; isDark: boolean; onStart: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onStart(); }}
      className={`flex-shrink-0 flex items-center transition-opacity hover:!opacity-100 ${edited ? "opacity-70" : "absolute inset-y-0 opacity-0 group-hover:opacity-60"}`}
      style={edited
        ? { color: c.primary }
        : { color: isDark ? dk.textMuted : c.iconGray, insetInlineEnd: 0, paddingInlineStart: "9px", background: "linear-gradient(to left, transparent, var(--row-bg) 9px)" }}
      title={title}
    >
      <Pencil size={11} />
    </button>
  );
}

// Per-case chronological document number (oldest filed = 1). Attachments get the parent number + a Hebrew letter (1א׳).
const HEB_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת".split("");
const hebLetter = (i: number) => HEB_LETTERS[i] ?? `#${i + 1}`;
const buildDocNumbers = (docs: CaseDoc[]): Record<string, number> => {
  const byCase: Record<string, CaseDoc[]> = {};
  docs.forEach((d) => { (byCase[d.caseId ?? ""] ??= []).push(d); });
  const nums: Record<string, number> = {};
  Object.values(byCase).forEach((list) => {
    [...list]
      .sort((a, b) => `${a.iso} ${a.time ?? "00:00"}`.localeCompare(`${b.iso} ${b.time ?? "00:00"}`)) // oldest first
      .forEach((d, i) => { nums[d.id] = i + 1; });
  });
  return nums;
};

// Horizontal scroller for the docs table (RTL): the pinned block starts visible on the right; the rest scrolls left.
// A soft fade on the left edge signals there's more to see that way (paired with the partially-cut column beneath it).
function HScroll({ children, bg, isDark }: { children: React.ReactNode; bg: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeEnd, setFadeEnd] = useState(false);
  const update = () => {
    const el = ref.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // Chromium RTL: scrollLeft is 0 at the start (right) and goes negative toward the end (left).
    setFadeEnd(max > 1 && el.scrollLeft > -max + 1);
  };
  useEffect(() => {
    update();
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="relative">
      <div ref={ref} dir="rtl" className="overflow-x-auto docs-scroll" onScroll={update}>{children}</div>
      {fadeEnd && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-30" style={{ width: "22px", background: `linear-gradient(to left, ${isDark ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)"}, ${bg})` }} />
      )}
    </div>
  );
}

// Expands UNDER a table row, and only ever for things that belong to that row's document: its process thread
// (status + the documents in it) or its נספחים. מסמכים קשורים deliberately do NOT come through here — they are
// other rows of this same table, and nesting them under a parent row made them read as documents that were filed
// together with it (validation, 2026-08-29); they open in RelatedPopover instead. Process-thread docs are real
// documents, so they render as full column-aligned rows (NestedDocRow) with live checkboxes that toggle the
// underlying document's `checked`. Attachments are exhibits, not case documents, so they have no column data
// and stay a simple labeled list with their own checkbox state (attachmentSel). Each group offers "בחר הכל".
function RowDetail({ kind, doc, processDocs, gridCols, colGap, colMeta, showType, showSelfInThread, openDocId, isDark, onOpenDoc, onClose, onToggleDocById, onSetChecked, attachmentSel, onToggleAttachment, onSetAttachments }: { kind: "attachments" | "process"; doc: CaseDoc; processDocs?: CaseDoc[]; gridCols: string; colGap: string; colMeta: ColMeta; showType: boolean; showSelfInThread?: boolean; openDocId?: string; isDark: boolean; onOpenDoc?: (doc: CaseDoc) => void; onClose: () => void; onToggleDocById?: (id: string) => void; onSetChecked?: (ids: string[], next: boolean) => void; attachmentSel?: Set<string>; onToggleAttachment?: (key: string) => void; onSetAttachments?: (keys: string[], next: boolean) => void }) {
  // White, not a tint. The blue block used to shade the whole detail area, which made the panel itself look
  // selected and left the row that owns it indistinguishable from its neighbours. The תכלת now marks only the SOURCE
  // row (DocRowCompact activeBg) — the tint identifies whose panel this is, and the panel is just table.
  const panelBg = isDark ? dk.input : "#ffffff";
  const titleCol = isDark ? dk.textMuted : c.textLight;
  const textCol = isDark ? dk.text : c.text;
  const metaCol = isDark ? dk.textMuted : c.textLight;

  // Which process folder is expanded. One process → it opens with the panel, because clicking the trigger already
  // chose it and there is nothing left to pick. Several → all start collapsed, exactly like folders in תיקיות: the
  // rows themselves already answer "which threads is this document in?", and the user opens the one they want.
  const procIds = docProcessIds(doc);
  const [openPid, setOpenPid] = useState<number | null>(procIds.length === 1 ? procIds[0] : null);

  let title = "";
  let TitleIcon: LucideIcon = FileText;
  let body: React.ReactNode = null;
  // Whether every selectable item in this group is currently picked, and the toggle that selects/clears all of them.
  // Attachments only — a process now carries its own tri-state checkbox on its folder row.
  let allSelected = false;
  let onSelectAll: (() => void) | null = null;

  if (kind === "process") {
    // ONE FOLDER ROW PER PROCESS — the same row the תיקיות view already draws inside "בקשות והוראות".
    // Validation kept showing users ticking a document and expecting its thread to follow, and that instinct is
    // not imported from the web: it is the convention THIS table already teaches one tab away, where a process is
    // a folder with a tri-state checkbox. So the panel stops speaking its own dialect — the header is that folder
    // row, the checkbox leads (landing in the table's own checkbox column, not 500px away at the far end), and the
    // "בחר הכל" link is gone because a parent checkbox says it better. A document on several processes gets several
    // folder rows, again mirroring תיקיות, where it appears in each process folder: that also fixes something the
    // merged list could not express at all — taking only ONE of the threads into the conversation.
    const union = processDocs ?? [];
    const groups = docProcessIds(doc).map((pid) => ({
      pid,
      label: processLabel(doc.caseId, pid),
      // `processDocs` is the union across the document's threads, so filtering it by pid recovers each thread whole.
      docs: union
        .filter((d) => docProcessIds(d).includes(pid))
        // In the by-type view (showSelfInThread === false) the folder already lists every doc of the process, so the
        // source doc is dropped from its own thread. In chronological it stays (italic) — it locates the doc in a long thread.
        .filter((d) => showSelfInThread !== false || d.id !== doc.id)
        .sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0)),
    }));
    body = (
      <div className="flex flex-col">
        {groups.map((g, i) => {
          const closed = g.docs.some(isResolutionDoc); // status reflects the whole thread
          const allOn = g.docs.length > 0 && g.docs.every((d) => d.checked);
          const someOn = !allOn && g.docs.some((d) => d.checked);
          const open = openPid === g.pid;
          return (
            <div key={g.pid} className="flex flex-col" style={i > 0 ? { borderTop: `1px solid ${isDark ? dk.border : "#e3ebf5"}` } : undefined}>
              <div className="flex items-center gap-2 py-1" style={{ paddingInlineStart: "8px", paddingInlineEnd: "8px" }}>
                <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                  <CheckboxBlue checked={allOn} mixed={someOn} onToggle={() => onSetChecked?.(g.docs.map((d) => d.id), !allOn)} />
                </span>
                <button onClick={() => setOpenPid((p) => (p === g.pid ? null : g.pid))} className="flex items-center gap-1.5 flex-1 min-w-0 text-right" title={open ? "כיווץ" : "פתיחה"}>
                  <span className="text-[13px] font-medium truncate min-w-0" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
                    <span dir="ltr" style={{ fontFamily: "Figtree, sans-serif" }}>{g.pid}</span> — {g.label} <span style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }}>({g.docs.length})</span>
                  </span>
                  {/* The status belongs to THIS thread, so it travels with its name rather than floating at the row's
                      far end, where with several folder rows it read as a column of its own. */}
                  <span className="text-[11px] rounded-full px-1.5 py-px whitespace-nowrap flex-shrink-0" style={{ fontWeight: 400, fontFamily: "Noto Sans Hebrew, sans-serif", backgroundColor: closed ? (isDark ? "#1c3a2c" : "#e5f4ec") : (isDark ? "#3a2e1c" : "#fbf0df"), color: closed ? "#0f8a5f" : "#b9670c" }}>
                    {closed ? "הושלם" : "פתוח"}
                  </span>
                  <span className="flex-1" />
                  <ChevronDown size={15} style={{ color: isDark ? dk.textMuted : c.iconGray, flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
                </button>
                {/* The panel's one × rides on the first folder row; the rest reserve its width so every chevron shares an x. */}
                {i === 0
                  ? <button onClick={onClose} className="flex items-center justify-center rounded hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: metaCol, width: "20px", height: "20px" }} title="סגירה"><X size={13} /></button>
                  : <span className="flex-shrink-0" style={{ width: "20px" }} />}
              </div>
              {open && g.docs.map((d) => (
                <NestedDocRow key={d.id} doc={d} gridCols={gridCols} colGap={colGap} colMeta={colMeta} showType={showType} isDark={isDark} isOpen={d.id === openDocId} isSelf={d.id === doc.id} variant="process" onOpenDoc={onOpenDoc} onToggleCheck={onToggleDocById ? () => onToggleDocById(d.id) : undefined} />
              ))}
            </div>
          );
        })}
      </div>
    );
  } else {
    title = "נספחים";
    TitleIcon = Paperclip;
    // Attachments are exhibits (not case documents) — no column data, so a simple labeled list with their own checkbox state.
    const names = doc.attachments ?? [];
    const keys = names.map((name) => attKey(doc.id, name));
    if (keys.length > 0 && onSetAttachments) {
      allSelected = keys.every((k) => attachmentSel?.has(k));
      onSelectAll = () => onSetAttachments(keys, !allSelected);
    }
    // When the מספר-מסמך column is on, attachments are numbered off their parent doc: 1א׳, 1ב׳ … (parent number + Hebrew letter).
    const parentNum = colMeta.docNumbers[doc.id];
    body = (
      <div className="flex flex-col" style={{ paddingInlineStart: "16px", paddingInlineEnd: "8px" }}>
        {names.map((name, i) => {
          const key = attKey(doc.id, name);
          return (
            <div key={name} className="flex items-center gap-2 py-1 text-right">
              <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={!!attachmentSel?.has(key)} onToggle={() => onToggleAttachment?.(key)} /></span>
              {colMeta.visible.num && parentNum != null && (
                <span dir="ltr" className="text-[11.5px] flex-shrink-0 tabular-nums" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="מספר נספח">{`#${parentNum}${hebLetter(i)}׳`}</span>
              )}
              <FileText size={13} style={{ flexShrink: 0, color: isDark ? dk.textMuted : c.iconGray }} />
              <span className="text-[12.5px] truncate flex-1 min-w-0" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="pt-1.5 pb-2"
      // Both edges now, not just the top: a tinted block ended itself, a white one needs a line to say where it stops.
      style={{ backgroundColor: panelBg, borderTop: `1px solid ${isDark ? dk.border : "#e3ebf5"}`, borderBottom: `1px solid ${isDark ? dk.border : "#e3ebf5"}` }}
      dir="rtl"
    >
      {/* נספחים keep the labelled header; a process does not, because its folder row IS its header. */}
      {kind !== "process" && (
      <div className="flex items-center justify-between mb-1 px-2" style={{ paddingInlineStart: "34px" }}>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: titleCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
          <TitleIcon size={12} />
          {title}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onSelectAll && (
            <button onClick={onSelectAll} className="text-[11.5px] rounded px-1.5 py-0.5 hover:bg-black/5 transition-colors" style={{ color: c.primary, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={allSelected ? "ביטול בחירת כל הפריטים" : "בחירת כל הפריטים לצ׳אט"}>
              {allSelected ? "נקה הכל" : "בחר הכל"}
            </button>
          )}
          <button onClick={onClose} className="flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: metaCol, width: "20px", height: "20px" }} title="סגירה"><X size={13} /></button>
        </div>
      </div>
      )}
      {body}
    </div>
  );
}

// 🔗 מסמכים קשורים open HERE — a floating list hanging off the icon that was clicked — and deliberately NOT as a
// card under the row, the way תהליך and 📎 נספחים do. A נספח is CONTAINED in its document: it was filed with it and
// exists nowhere else in the table, so nesting it under the row is simply true. A מסמך קשור is ANOTHER ROW of this
// same table, with its own date and its own submitter; nesting it showed the same document twice and read as
// "these were filed together with this one" — which is exactly what a judge told us in validation (2026-08-29).
// So the relation points OUTWARD: clicking a name scrolls to that document's real row and rings it, and each
// checkbox is that document's OWN, so its real row ticks at the same moment. Every part of the list keeps saying
// "this document lives over there", never "this document is part of me".
function RelatedPopover({ doc, siblingDocs, anchor, trigger, activeId, isDark, onClose, onJump, onOpenDoc, onToggleDocById, onSetChecked }: { doc: CaseDoc; siblingDocs: CaseDoc[]; anchor: DOMRect; trigger?: HTMLElement | null; activeId?: string | null; isDark: boolean; onClose: () => void; onJump: (d: CaseDoc) => void; onOpenDoc?: (d: CaseDoc) => void; onToggleDocById?: (id: string) => void; onSetChecked?: (ids: string[], next: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !trigger?.contains(t)) onClose(); }; // the trigger is exempt so its own click can toggle instead of reopening
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Deliberately NOT closed by scrolling. Jumping to a related document scrolls the table under the list, and the
    // list has to survive that: its whole point is browsing several related documents one after another. It stays
    // where it was opened until the user closes it (×, Esc, the 🔗 trigger again, or a click outside).
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  });

  const W = 320;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(anchor.right - W, vw - W - 8));
  const below = vh - anchor.bottom > 240; // flip above the icon for rows near the bottom of the table
  const pos: React.CSSProperties = below
    ? { top: anchor.bottom + 6, maxHeight: vh - anchor.bottom - 20 }
    : { bottom: vh - anchor.top + 6, maxHeight: anchor.top - 20 };

  const resolved = doc.related.map((name) => ({ name, d: siblingDocs.find((x) => x.name === name) }));
  const inCase = resolved.map((r) => r.d).filter((d): d is CaseDoc => !!d);
  const allSelected = inCase.length > 0 && inCase.every((d) => d.checked);
  const textCol = isDark ? dk.text : c.text;
  const metaCol = isDark ? dk.textMuted : c.textLight;

  return (
    <div
      ref={ref}
      dir="rtl"
      className="fixed z-[280] rounded-[8px] flex flex-col overflow-hidden"
      style={{ left, width: W, ...pos, backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : "#dde3ec"}`, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", fontFamily: "Noto Sans Hebrew, sans-serif" }}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2" style={{ borderBottom: `1px solid ${isDark ? dk.border : "#eef1f6"}` }}>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: textCol }}>
            <Link size={13} style={{ color: isDark ? dk.textMuted : c.iconGray }} />
            מסמכים קשורים
            <span style={{ color: metaCol, fontWeight: 400, fontFamily: "Figtree, sans-serif" }}>({doc.related.length})</span>
          </span>
          {/* One line only (user's call). What the click does stays in each name's tooltip. */}
          <span className="text-[11.5px] leading-snug" style={{ color: metaCol }}>
            מסמכים אחרים בתיק שזוהו כקשורים
          </span>
        </div>
        <button onClick={onClose} title="סגירה" className="flex items-center justify-center rounded hover:bg-black/5 flex-shrink-0" style={{ color: metaCol, width: "20px", height: "20px" }}><X size={13} /></button>
      </div>
      {inCase.length > 0 && onSetChecked && (
        <div className="flex items-center justify-end px-3 py-1" style={{ borderBottom: `1px solid ${isDark ? dk.border : "#f2f5f9"}` }}>
          <button onClick={() => onSetChecked(inCase.map((d) => d.id), !allSelected)} className="text-[11.5px] rounded px-1.5 py-0.5 hover:bg-black/5 transition-colors" style={{ color: c.primary }} title={allSelected ? "ביטול בחירת כל המסמכים הקשורים" : "בחירת כל המסמכים הקשורים לצ׳אט"}>
            {allSelected ? "נקה הכל" : "בחר הכל"}
          </button>
        </div>
      )}
      <div className="flex flex-col overflow-y-auto py-1">
        {resolved.map(({ name, d }) => d ? (
          <div key={name} className="group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-black/[0.03]" style={d.id === activeId ? { backgroundColor: isDark ? "#22293f" : "#eaf2fd" } : undefined}>
            <span className="flex-shrink-0" onClick={(e) => e.stopPropagation()}><CheckboxBlue checked={d.checked} onToggle={() => onToggleDocById?.(d.id)} /></span>
            <button onClick={() => onJump(d)} className="flex flex-col items-start min-w-0 flex-1 text-right" title="מעבר לשורה של המסמך בטבלה">
              <span className="doc-link text-[12.5px] truncate max-w-full" style={{ color: textCol }}>{name}</span>
              <span className="text-[11px] flex items-center gap-1.5 truncate max-w-full" style={{ color: metaCol }}>
                <span style={{ fontFamily: "Figtree, sans-serif" }}>{d.date}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span className="truncate">{d.type}</span>
              </span>
            </button>
            <button onClick={() => onOpenDoc?.(d)} title="פתיחת המסמך" className="flex items-center justify-center rounded flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-opacity" style={{ color: c.primary, width: "22px", height: "22px" }}><FileText size={14} /></button>
          </div>
        ) : (
          // Named as related but not actually in this case — nothing to jump to, so it stays plain text.
          <div key={name} className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex-shrink-0" style={{ width: "14px" }} />
            <span className="text-[12.5px] truncate min-w-0 flex-1" style={{ color: metaCol }}>{name}</span>
            <span className="text-[11px] flex-shrink-0" style={{ color: metaCol }}>אינו בתיק</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Right-click on a row. It came out of validation — a user simply tried it — and the users come from נט המשפט,
// a Windows-era application where right-click is a reflex rather than a discovery.
// The rule it lives by: **nothing lives ONLY here.** A context menu is invisible by definition, so anything that
// existed only inside it would be lost to everyone who never right-clicks. What it adds instead is the one thing
// this table has repeatedly failed at — saying its row actions in WORDS. Every item below mirrors a control that
// is already on the row, except the two copy actions, which have no home at all today.
// It deliberately acts on the row that was clicked and NEVER on "the selection": the checkbox here means
// "in the conversation", not "picked for an operation", and letting a menu act on it would collide with that.
// NOTE: every floating layer on this page is pinned to an explicit 8px. Tailwind's scale is overridden here
// (--radius: 0.625rem), so `rounded-lg` renders 10px and `rounded-md` 8px — the class names lie about the number.
type CtxItem = { label: string; icon: LucideIcon; onSelect: () => void; active?: boolean } | "sep";
function RowContextMenu({ x, y, items, isDark, onClose }: { x: number; y: number; items: CtxItem[]; isDark: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onClose, true); };
  });
  const W = 236;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const rows = items.filter((i) => i !== "sep").length, seps = items.length - rows;
  const h = rows * 30 + seps * 9 + 8;
  return (
    <div
      ref={ref}
      dir="rtl"
      className="fixed z-[290] overflow-hidden py-1"
      style={{ left: Math.max(8, Math.min(x - W, vw - W - 8)), top: Math.max(8, Math.min(y, vh - h - 8)), width: W, borderRadius: "8px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", fontFamily: "Noto Sans Hebrew, sans-serif" }}
    >
      {items.map((it, i) => it === "sep" ? (
        <div key={`sep${i}`} className="my-1" style={{ height: "1px", backgroundColor: isDark ? dk.border : "#eef1f4" }} />
      ) : (
        <button
          key={it.label}
          onClick={() => { it.onSelect(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-right transition-colors hover:bg-black/[0.04]"
          style={{ color: it.active ? c.primary : (isDark ? dk.text : c.text) }}
          title={it.active ? "פתוח כעת — לחיצה תסגור" : undefined}
        >
          <it.icon size={14} style={{ flexShrink: 0, color: it.active ? c.primary : (isDark ? dk.textMuted : c.iconGray) }} />
          <span className="text-[13px] truncate">{it.label}</span>
          {it.active && <><span className="flex-1" /><Check size={13} style={{ flexShrink: 0 }} /></>}
        </button>
      ))}
    </div>
  );
}

// The full column order + which cells are shown, shared by DocRowCompact / NestedDocRow / the header so they stay aligned.
// `order` is the live render order (checkbox · name · sp · …user-ordered data columns) — user-reorderable via the popover.
type ColMeta = { visible: Record<DocColKey, boolean>; order: string[]; pin: Record<string, number | undefined>; gapPx: number; docNumbers: Record<string, number>; minWidthType: number; minWidthNoType: number; summaryWrap?: boolean; onCellTip?: (text: string | null, e?: ReactMouseEvent) => void };
const colShown = (key: string, cm: ColMeta, showType: boolean): boolean =>
  key === "checkbox" || key === "name" || key === "sp" ? true
  : key === "type" ? (cm.visible.type && showType)
  : !!cm.visible[key as DocColKey];
const pinCellStyle = (key: string, cm: ColMeta): React.CSSProperties | undefined =>
  cm.pin[key] !== undefined ? { position: "sticky", right: cm.pin[key], zIndex: 2, background: "var(--row-bg)" } : undefined;

// Dense table row — one line per document; columns come from `colMeta` (user-customizable, some pinned while scrolling).
function DocRowCompact({ doc, isDark, markNew, active, gridCols, colGap = "4px", colMeta, showType = true, showSelfInThread, lockProcess, processDocs, siblingDocs, openDocId, expandedKinds, onToggleExpand, relatedOpen, onOpenRelated, flash, onContextMenu, onOpenDoc, onOpenAnyDoc, onToggleCheck, onToggleDocById, onSetChecked, attachmentSel, onToggleAttachment, onSetAttachments, rowRef }: { doc: CaseDoc; isDark: boolean; markNew?: boolean; active?: boolean; gridCols: string; colGap?: string; colMeta: ColMeta; showType?: boolean; showSelfInThread?: boolean; lockProcess?: boolean; processDocs?: CaseDoc[]; siblingDocs?: CaseDoc[]; openDocId?: string; expandedKinds?: ("attachments" | "process")[]; onToggleExpand?: (kind: "attachments" | "process") => void; relatedOpen?: boolean; onOpenRelated?: (rect: DOMRect, el: HTMLElement) => void; flash?: boolean; onContextMenu?: (x: number, y: number) => void; onOpenDoc?: () => void; onOpenAnyDoc?: (doc: CaseDoc) => void; onToggleCheck: () => void; onToggleDocById?: (id: string) => void; onSetChecked?: (ids: string[], next: boolean) => void; attachmentSel?: Set<string>; onToggleAttachment?: (key: string) => void; onSetAttachments?: (keys: string[], next: boolean) => void; rowRef?: (el: HTMLDivElement | null) => void }) {
  const baseBg = isDark ? dk.input : "white";
  const activeBg = isDark ? "#212c42" : "#f4f8fd"; // the תכלת that used to fill the whole panel now marks just this row
  // Which detail panels are open for this row (parallel — related / process / attachments can all be open at once).
  const openKinds = new Set(expandedKinds ?? []);
  const anyOpen = openKinds.size > 0;
  const hoverBg = isDark ? "#232c44" : (active || anyOpen || relatedOpen || flash ? "#e7f0fb" : "#f6f9ff");
  const metaCol = isDark ? dk.textMuted : c.textLight;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const partyName = doc.submitterName ?? (doc.caseId ? PARTY_NAMES[doc.caseId]?.[doc.submitter] : undefined);
  const typeC = TYPE_COLORS[doc.type] ?? { bg: isDark ? dk.input : "#eef1f4", color: isDark ? dk.textMuted : c.textGray };
  const attNames = doc.attachments ?? [];
  const attPicked = attNames.some((name) => !!attachmentSel?.has(attKey(doc.id, name)));
  const lit = active || anyOpen || !!relatedOpen || !!flash;
  const restBg = lit ? activeBg : baseBg;
  // Fixed stacking order for the open panels (process → related → attachments) when several are open at once.
  const PANEL_ORDER: ("process" | "attachments")[] = ["process", "attachments"];
  const openPanels = PANEL_ORDER.filter((k) => openKinds.has(k));
  const toggle = (kind: "attachments" | "process") => (e: ReactMouseEvent) => { e.stopPropagation(); onToggleExpand?.(kind); };
  const num = colMeta.docNumbers[doc.id];
  const procIds = docProcessIds(doc);
  // Name/summary editing — null when this row has no cell open for editing (the usual case). Once either field has been
  // rewritten the pencil stays visible and blue, and its tooltip names the system's wording for whichever field it was.
  const edit = useContext(DocEditCtx);
  const editingField = edit?.editing?.id === doc.id ? edit.editing.field : null;
  const editedAny = doc.nameOriginal != null || doc.summaryOriginal != null;
  const editTitle = editedAny
    ? ["נערך", doc.nameOriginal != null ? `שם המערכת: ${doc.nameOriginal}` : null, doc.summaryOriginal != null ? `תקציר המערכת: ${doc.summaryOriginal}` : null].filter(Boolean).join("\n")
    : "עריכת שם המסמך והתקציר";

  const cellContent = (key: string) => {
    switch (key) {
      case "checkbox": return <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} /></span>;
      case "num":      return <span dir="ltr" className="text-center w-full text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="מספר מסמך">{num != null ? `#${num}` : ""}</span>;
      case "date":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.time ? `${doc.date} ${doc.time}` : doc.date}>{doc.date}</span>;
      case "time":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="שעת הגשה">{doc.time ?? "—"}</span>;
      // Process — the id(s). Clickable in the flat views, and there it wears the SAME boxed chip as 🔗 קשורים / 📎 נספחים
      // right next to it: validation (2026-08-23) found users simply never tried clicking a bare number, because a number
      // on a soft background is the universal look of "cell content". Inside a type-view process folder (lockProcess) the
      // numbers stay but are static — they still matter there to reveal that a doc is linked to OTHER processes beyond the
      // folder's own — so they keep the plain pill and NOT the button chip. Pill = data, box = button.
      case "process":  return (
        <span className="min-w-0 flex items-center justify-center w-full" onClick={(e) => e.stopPropagation()}>
          {procIds.length > 0 && (lockProcess
            ? <ProcessChips ids={procIds} isDark={isDark} />
            : (
              // The "+" hangs OFF the chip instead of sitting in a reserved slot beside it. A fixed slot kept every
              // chip on the same x, but it did that by pushing all of them off the column's centre — and it charged
              // its width to every row, including the overwhelming majority with a single process. Positioned
              // absolutely it costs no layout width at all, so the chip is simply centred, always, and rows with an
              // extra process differ only by a mark hanging beside it. (inset-inline-end:100% puts it just outside
              // the chip's leading edge — the right, in RTL.)
              <span className="relative flex items-center justify-center flex-shrink-0">
                <RowIconTrigger active={openKinds.has("process")} onClick={toggle("process")} title={`תהליך: ${processLabel(doc.caseId, procIds[0])}`} isDark={isDark} boxed>
                  <ProcessTriggerLabel id={procIds[0]} />
                </RowIconTrigger>
                {procIds.length > 1 && (
                  <span className="absolute flex items-center" style={{ insetInlineEnd: "100%", marginInlineEnd: "2px", top: 0, bottom: 0 }}>
                    <ProcessOverflowLink
                      onClick={toggle("process")}
                      title={`תהליכים נוספים: ${procIds.slice(1).map((pid) => processLabel(doc.caseId, pid)).join(" · ")}`}
                      isDark={isDark}
                    />
                  </span>
                )}
              </span>
            ))}
        </span>
      );
      // ONE edit affordance per row, pinned to the END of the name column (the spacer) rather than trailing the text:
      // the panel edits both fields anyway, and an icon that lands at the same x on every row fades in like a column
      // instead of chasing the cursor. Two pencils at two text-dependent positions was the noise.
      case "name":     return (
        <span className="relative flex items-center gap-1.5 min-w-0 w-full">
          <span className="doc-link truncate text-[12.5px] font-medium leading-tight" title={doc.name} onClick={(e) => { e.stopPropagation(); onOpenDoc?.(); }} style={{ fontFamily: "Noto Sans Hebrew, sans-serif", color: active ? c.primary : undefined, textDecoration: active ? "underline" : undefined, textDecorationColor: active ? c.primary : undefined, textUnderlineOffset: "2px", paddingBottom: "2px" }}>{doc.name}</span>
          {doc.used && <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="שימש בתשובת הצ׳אט האחרונה" />}
          {edit && <EditPencil edited={editedAny} title={editTitle} isDark={isDark} onStart={() => edit.start(doc.id, "name")} />}
        </span>
      );
      case "summary":  return (
        <span className="flex items-center gap-1 min-w-0 w-full">
          <span className={colMeta.summaryWrap ? "text-[12.5px] min-w-0 whitespace-normal leading-snug" : "truncate text-[12.5px] min-w-0"} onMouseEnter={(e) => colMeta.onCellTip?.(doc.summary, e)} onMouseLeave={() => colMeta.onCellTip?.(null)} style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</span>
        </span>
      );
      case "type":     return <span className="min-w-0 flex"><span className="text-[11.5px] truncate rounded px-1.5 py-px" style={{ backgroundColor: typeC.bg, color: typeC.color, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={doc.type}>{doc.type}</span></span>;
      case "submitter":return <span className="text-[12.5px] truncate min-w-0" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={partyName ? `${doc.submitter} · ${partyName}` : doc.submitter}>{submitterLetter(doc.submitter)}</span>;
      case "related":  return (
        <span className="flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
          {doc.related.length > 0 && (
            <RowIconTrigger active={!!relatedOpen} onClick={(e) => { e.stopPropagation(); const el = e.currentTarget as HTMLElement; onOpenRelated?.(el.getBoundingClientRect(), el); }} title={`מסמכים קשורים (${doc.related.length})`} isDark={isDark} boxed outline>
              <Link size={13} />
            </RowIconTrigger>
          )}
        </span>
      );
      case "note":     return (
        <span className="flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); edit?.start(doc.id, "note"); }}
            onMouseEnter={(e) => { if (doc.note) colMeta.onCellTip?.(doc.note, e); }}
            onMouseLeave={() => colMeta.onCellTip?.(null)}
            className={`flex items-center justify-center flex-shrink-0 rounded transition-opacity ${doc.note ? "" : "opacity-0 group-hover:opacity-50 hover:!opacity-100"}`}
            style={{ color: doc.note ? c.primary : (isDark ? dk.textMuted : c.iconGray), width: "18px", height: "18px" }}
            title={doc.note ? [doc.noteShared ? "הערה — גלויה לך ולצוותך" : "הערה — לעיניך בלבד", doc.noteInChat ? "מצורפת לשיחה עם הצ׳אט" : null].filter(Boolean).join("\n") : "הוספת הערה"}
          >
            <StickyNote size={13} />
          </button>
        </span>
      );
      case "attachments": return (
        <span className="flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
          {(doc.attachments?.length ?? 0) > 0 && (
            <RowIconTrigger active={openKinds.has("attachments")} onClick={toggle("attachments")} title={`נספחים (${doc.attachments?.length})`} isDark={isDark} picked={attPicked} boxed>
              <Paperclip size={13} />
            </RowIconTrigger>
          )}
        </span>
      );
      case "words":    return <span className="text-[11.5px] text-right w-full" style={{ color: doc.missing ? "#d83a52" : metaCol, fontFamily: "Figtree, sans-serif", paddingInlineStart: "4px" }} title={doc.missing ? "המסמך ללא תוכן" : "מספר מילים"}>{doc.words}</span>;
      default:         return null;
    }
  };
  return (
    <div
      ref={rowRef}
      className="relative transition-colors"
      style={{ borderBottom: `1px solid ${isDark ? dk.border : "#eef1f4"}`, backgroundColor: restBg, minWidth: `${showType ? colMeta.minWidthType : colMeta.minWidthNoType}px` }}
      dir="rtl"
    >
      {lit && <span className="absolute inset-y-0 z-10" style={{ insetInlineStart: 0, width: "3px", backgroundColor: c.primary }} />}
      <div
        className="group grid items-center px-2 py-1.5 cursor-pointer"
        style={{ gridTemplateColumns: gridCols, columnGap: colGap, ["--row-bg" as string]: restBg, backgroundColor: "var(--row-bg)", boxShadow: flash ? `inset 0 0 0 1px ${c.primary}` : undefined } as React.CSSProperties}
        onClick={() => { if (!editingField) onOpenDoc?.(); }}
        onContextMenu={(e) => { if (!onContextMenu) return; e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
        onMouseEnter={(e) => { e.currentTarget.style.setProperty("--row-bg", hoverBg); }}
        onMouseLeave={(e) => { e.currentTarget.style.setProperty("--row-bg", restBg); }}
      >
        {colMeta.order.filter((key) => colShown(key, colMeta, showType)).map((key) => (
          <div key={key} className="min-w-0 flex items-center h-full" style={pinCellStyle(key, colMeta)}>
            {cellContent(key)}
          </div>
        ))}
      </div>
      {editingField && edit && (editingField === "note"
        ? <DocNotePanel doc={doc} isDark={isDark}
            onCommit={(values, noteOpts) => edit.commit(doc.id, values, noteOpts)} onCancel={() => edit.cancel()} onDirtyChange={edit.setDirty} />
        : <DocEditPanel doc={doc} focusField={editingField} isDark={isDark}
            onCommit={(values) => edit.commit(doc.id, values)} onCancel={() => edit.cancel()} onDirtyChange={edit.setDirty} />
      )}
      {/* Open detail panels stack as separate labeled cards (related / process / attachments can be open in parallel). */}
      {openPanels.map((kind) => (
        <RowDetail key={kind} kind={kind} doc={doc} processDocs={processDocs} gridCols={gridCols} colGap={colGap} colMeta={colMeta} showType={showType} showSelfInThread={showSelfInThread} openDocId={openDocId} isDark={isDark} onOpenDoc={onOpenAnyDoc} onClose={() => onToggleExpand?.(kind)} onToggleDocById={onToggleDocById} onSetChecked={onSetChecked} attachmentSel={attachmentSel} onToggleAttachment={onToggleAttachment} onSetAttachments={onSetAttachments} />
      ))}
    </div>
  );
}

// ── Mock document viewer (opens as a third pane next to the chat) ────────────
const MOCK_DOC_PARAS = [
  "1. בהתאם להחלטת בית המשפט מיום 12.4.2026, ולאחר שהוגשו כתבי הטענות מטעם הצדדים, מתכבד הח״מ להגיש מסמך זה לעיון בית המשפט הנכבד.",
  "2. אין חולק כי בין הצדדים נכרת הסכם בכתב, וכי במועד הרלוונטי לתביעה עמדו הצדדים ביחסים חוזיים מחייבים. המחלוקת נסבה על שאלת קיומם של התנאים המתלים שנקבעו בסעיף 7 להסכם.",
  "3. מן הראיות שהובאו בפני בית המשפט עולה כי הצד שכנגד לא עמד בלוח הזמנים שנקבע, ולא מסר הודעה כנדרש בסעיף 9. נטל ההוכחה בעניין זה מוטל על הטוען לקיום ההתחייבות, ולא הורם.",
  "4. לאור האמור, ובשים לב לפסיקה הרלוונטית, מתבקש בית המשפט הנכבד לקבוע כי הופרה התחייבות יסודית, על כל המשתמע מכך לעניין הסעדים המבוקשים בכתב התביעה.",
  "5. שמורה לח״מ הזכות להוסיף ולטעון, להגיש ראיות משלימות ולהשלים טיעון בעל-פה במועד הדיון, ככל שבית המשפט הנכבד יורה על כך.",
];

function DocViewer({ doc, isDark, width, onWidthChange, onClose, fill, showHandle, canExpand, expanded, onToggleExpand }: { doc: CaseDoc; isDark: boolean; width: number; onWidthChange: (w: number) => void; onClose: () => void; fill?: boolean; showHandle?: boolean; canExpand?: boolean; expanded?: boolean; onToggleExpand?: () => void }) {
  const iconCol = isDark ? dk.textMuted : c.iconGray;
  const rootRef = useRef<HTMLDivElement>(null);
  // Scroll container of the stacked PDF pages — driven by the jump-to-start/end double-arrows (a real scroll, unlike the reference-only page/zoom/rotate controls below)
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollDoc = (toEnd: boolean) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: toEnd ? el.scrollHeight : 0, behavior: "smooth" });
  };
  // Real page count of the loaded PDF (null while parsing / no file) — feeds the reference-only panel's page-total display
  const [numPages, setNumPages] = useState<number | null>(null);
  useEffect(() => { setNumPages(null); }, [doc.file]);
  // Measure the pane's own width so the page fills it (no wasted grey margins on wide screens, in any layout mode)
  const [paneW, setPaneW] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => { for (const e of entries) setPaneW(e.contentRect.width); });
    ro.observe(el);
    setPaneW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  // Page fills the pane minus a small symmetric margin; capped so a very wide pane still reads like a document.
  // Use the known fixed width when the pane isn't flex-filling (reliable); measure only in fill mode.
  const effectivePaneW = (!fill && width > 0) ? width : paneW;
  const fitPageWidth = effectivePaneW > 0 ? Math.max(360, Math.min(960, Math.round(effectivePaneW - 56))) : (expanded ? 820 : 640);
  // Floating action panel — draggable from its grip; offset is relative to its default position (vertically centered on the left edge)
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const startPanelDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY, base = panelOffset;
    const onMove = (ev: MouseEvent) => setPanelOffset({ x: base.x + (ev.clientX - startX), y: base.y + (ev.clientY - startY) });
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  };
  return (
    <div ref={rootRef} className={`relative flex flex-col ${fill ? "flex-1 min-w-0" : "flex-shrink-0"}`} style={{ ...(fill ? {} : { width: `${width}px` }), borderInlineStart: `1px solid ${isDark ? dk.border : "#e6ebf3"}`, borderInlineEnd: `1px solid ${isDark ? dk.border : "#e6ebf3"}`, backgroundColor: isDark ? dk.bg : "#eef1f6" }} dir="rtl">
      {/* Drag handle — left edge: drag to resize the viewer width (kept while floating-by-drag so the user can drag back; hidden only when the doc is force-expanded) */}
      {showHandle && (
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          const rightEdge = rootRef.current?.getBoundingClientRect().right ?? window.innerWidth;
          const onMove = (ev: MouseEvent) => onWidthChange(Math.max(380, Math.min(rightEdge - 375, rightEdge - ev.clientX)));
          const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = ""; };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
          document.body.style.userSelect = "none";
        }}
        className="absolute top-0 bottom-0 left-0 z-20 group"
        style={{ width: "8px", cursor: "ew-resize" }}
        title="גרירה לשינוי רוחב המסמך"
      >
        <div className="absolute top-0 bottom-0 left-0 transition-colors group-hover:bg-[#cdd3df]" style={{ width: "2px" }} />
        {/* Grip-dots chip straddling the edge — reads clearly as a drag handle; turns blue on hover */}
        <div
          className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center rounded-md border transition-colors group-hover:!bg-[#0073ea] group-hover:!border-[#0073ea] group-hover:!text-white"
          style={{ width: "15px", height: "30px", backgroundColor: isDark ? "#2a3350" : "#eef2f8", borderColor: isDark ? dk.border : "#cfd8e6", color: isDark ? dk.textMuted : "#8a97ad" }}
        >
          <GripVertical size={13} strokeWidth={2} />
        </div>
      </div>
      )}
      {/* Real window controls — small, fixed, horizontal cluster pinned to the document's own top-left corner. Light-blue chrome; always in the same spot even if the reference panel below gets dragged away */}
      <div
        className="absolute z-30 flex items-center gap-0.5"
        style={{ top: "12px", left: "12px", borderRadius: "8px", backgroundColor: isDark ? "#22304a" : "#eaf2fd" }}
      >
        {canExpand && (
          <button onClick={onToggleExpand} title={expanded ? "החזרת תצוגת עמודות" : "הרחבת המסמך (הצ׳אט יהפוך למרחף)"} className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/10" style={{ color: c.primary }}>
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
        {doc.file
          ? <a href={doc.file} target="_blank" rel="noopener noreferrer" title="פתיחה בלשונית חדשה" className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/10" style={{ color: c.primary }}><ExternalLink size={16} /></a>
          : <button title="פתיחה בלשונית חדשה" className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/10" style={{ color: c.primary }}><ExternalLink size={16} /></button>}
        <button onClick={onClose} title="סגירת המסמך" className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/10" style={{ color: c.primary }}><X size={18} /></button>
      </div>
      {/* Reference-only panel — page/zoom/rotate controls, spec for the dev team to wire to the real PDF engine. Vertically centered on the left edge, draggable from its grip at the bottom */}
      <div
        className="absolute z-20 flex flex-col items-center gap-0.5 p-1"
        style={{
          top: "50%", left: "12px",
          transform: `translateY(calc(-50% - 24px)) translate(${panelOffset.x}px, ${panelOffset.y}px)`,
          borderRadius: "8px", backgroundColor: isDark ? "rgba(30,38,58,0.92)" : "rgba(255,255,255,0.92)",
          border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.18)", backdropFilter: "blur(4px)",
        }}
        title="פקדי דפדוף/זום/סיבוב — תצוגה בלבד, לצוות הפיתוח"
      >
        {/* Reference only — rotate / page nav / zoom, styled for the dev team to implement against the real PDF engine (not wired up here) */}
        <div className="flex flex-col items-center">
          <button className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="סיבוב (תצוגה בלבד — לצוות הפיתוח)"><RotateCw size={17} /></button>
          <button onClick={() => scrollDoc(false)} className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="מעבר לתחילת המסמך"><ChevronsUp size={17} /></button>
          <button className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="עמוד קודם (תצוגה בלבד)"><ChevronUp size={17} /></button>
          <span className="flex items-center justify-center rounded text-[15px] font-medium" style={{ width: "28px", height: "24px", marginTop: "4px", lineHeight: "1", paddingTop: "2px", boxSizing: "border-box", border: `1px solid ${isDark ? dk.border : c.border}`, color: isDark ? dk.text : c.text, fontFamily: "Figtree, sans-serif" }} title="עמוד נוכחי — ניתן להקליד מספר עמוד (תצוגה בלבד)">1</span>
          <span className="flex items-center justify-center text-[15px]" style={{ marginTop: "8px", lineHeight: "1", color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="סך העמודים">{doc.file ? (numPages ?? "…") : 2}</span>
          <button className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="עמוד הבא (תצוגה בלבד)"><ChevronDown size={17} /></button>
          <button onClick={() => scrollDoc(true)} className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="מעבר לסוף המסמך"><ChevronsDown size={17} /></button>
        </div>
        <div className="w-5 border-t my-0.5" style={{ borderColor: isDark ? dk.border : c.border }} />
        <button className="size-9 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="הגדלה (תצוגה בלבד)"><ZoomIn size={18} /></button>
        <span className="flex items-center justify-center text-[12px]" style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Figtree, sans-serif" }} title="אחוז תקריב (תצוגה בלבד)">100%</span>
        <button className="size-9 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="הקטנה (תצוגה בלבד)"><ZoomOut size={18} /></button>
        {/* Grip — drag the whole panel anywhere, at the bottom */}
        <div onMouseDown={startPanelDrag} className="w-full flex items-center justify-center pt-1" style={{ cursor: "grab" }} title="גרירת הפאנל">
          <GripHorizontal size={14} style={{ color: isDark ? dk.textMuted : c.textLight }} />
        </div>
      </div>
      {/* Body — a real PDF (canvas-rendered via react-pdf) when the mock doc has a file, otherwise the generated mock pages. Rendering to canvas ourselves (rather than the browser's native PDF plugin in an iframe) is what lets the surrounding background actually be styled. */}
      {doc.file ? (
        // dir="ltr" so the scrollbar sits on the right edge (the PDF pages are centered, so direction doesn't affect them)
        <div ref={scrollRef} className="flex-1 overflow-y-auto docs-scroll" dir="ltr" style={{ backgroundColor: isDark ? dk.bg : "#f1f3f4" }}>
          <div className="flex flex-col items-center gap-4 pt-2.5 pb-5 px-4">
            <PdfViewer file={doc.file} numPages={numPages} pageWidth={fitPageWidth} onLoadSuccess={setNumPages} />
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
          <div className="flex flex-col items-center gap-4 pt-2.5 pb-5 px-4" dir="rtl">
            {[1, 2].map((p) => (
              <div key={p} className="w-full shadow-lg" style={{ maxWidth: `${fitPageWidth}px`, backgroundColor: "white", padding: "48px 56px", minHeight: "820px", fontFamily: "Noto Sans Hebrew, sans-serif" }} dir="rtl">
                {p === 1 && (
                  <div className="text-center mb-7">
                    <div className="text-[12px]" style={{ color: "#5a6478" }}>בית המשפט המחוזי</div>
                    <div className="text-[17px] font-bold mt-2" style={{ color: "#1a2a4a" }}>{doc.name}</div>
                    <div className="text-[12px] mt-1.5" style={{ color: "#5a6478" }}>ת״א 12345-67-89 · {PARTY_NAMES.c1?.["תובע"]} נ׳ {PARTY_NAMES.c1?.["נתבע"]}</div>
                    <div className="mt-4" style={{ borderTop: "1px solid #dfe4ec" }} />
                  </div>
                )}
                <p className="text-[14px] leading-[1.95]" style={{ color: "#2b3340" }}>{doc.summary}</p>
                {MOCK_DOC_PARAS.map((t, i) => (
                  <p key={i} className="text-[14px] leading-[1.95] mt-3.5" style={{ color: "#2b3340" }}>{t}</p>
                ))}
                <div className="text-center text-[11px] mt-9" style={{ color: "#aab2c0" }}>— {p} —</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Document panel (open) — table browser ────────────────────────────────────
function DocumentPanelOpen({ isDark, panelWidth, isFocus, onToggleFocus, onSetWidth, onOpenDoc, onClosePanel, openDocId, docs, setDocs }: { isDark: boolean; panelWidth: number; isFocus?: boolean; onToggleFocus?: () => void; onSetWidth?: (w: number) => void; onOpenDoc?: (doc: CaseDoc) => void; onClosePanel?: () => void; openDocId?: string; docs: CaseDoc[]; setDocs: React.Dispatch<React.SetStateAction<CaseDoc[]>> }) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Which detail panels are open — a Set of `${docId}::${kind}` so related / process / attachments can be open in
  // parallel (per user), across any rows. Each opens/closes independently from its own trigger or the card's × button.
  type PanelKind = "attachments" | "process"; // מסמכים קשורים are NOT an in-place panel — they open in RelatedPopover
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());
  const panelK = (id: string, kind: PanelKind) => `${id}::${kind}`;
  const togglePanel = (id: string, kind: PanelKind) => setOpenPanels((s) => { const n = new Set(s); const k = panelK(id, kind); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const openKindsFor = (id: string): PanelKind[] => (["process", "attachments"] as PanelKind[]).filter((k) => openPanels.has(panelK(id, k)));
  // 🔗 מסמכים קשורים: one floating list at a time, anchored to the icon's rect, plus the row it jumped to.
  const [relPop, setRelPop] = useState<{ doc: CaseDoc; rect: DOMRect; el: HTMLElement } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [relActiveId, setRelActiveId] = useState<string | null>(null); // which related document the open list last took you to
  const [ctxMenu, setCtxMenu] = useState<{ doc: CaseDoc; x: number; y: number } | null>(null);
  // Clipboard: the async API needs a secure context, which localhost and the deployed site both are — the
  // textarea fallback is there for anything else (an IP address in a demo, an old browser in a courtroom).
  const copy = (text: string) => {
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).catch(() => {}); return; }
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  };
  // "העתקת השורה" copies the row AS SHOWN — the visible data columns, in the user's own column order. The
  // icon-only columns have no text to give, and the note is deliberately left out: it is the user's private
  // writing and should not ride along in a copy they did not ask it into.
  const rowText = (d: CaseDoc) => {
    const num = docNumbers[d.id];
    const cell: Partial<Record<string, string | undefined>> = {
      num: num != null ? `#${num}` : undefined,
      date: d.date, time: d.time, process: docProcessIds(d).length ? processTitle(d) : undefined,
      name: d.name, summary: d.summary, type: d.type, submitter: d.submitter, words: d.words,
    };
    return ["checkbox", ...layout]
      .map((k) => (k === "name" || visibleCols[k as DocColKey] ? cell[k] : undefined))
      .filter((v): v is string => !!v)
      .join(" · ");
  };
  const ctxItems = (d: CaseDoc): CtxItem[] => {
    const rel = d.related.length, att = d.attachments?.length ?? 0, procs = docProcessIds(d);
    const items: CtxItem[] = [
      { label: "פתיחת המסמך", icon: FileText, onSelect: () => onOpenDoc?.(d) },
      { label: d.checked ? "הסרה מהשיחה" : "הוספה לשיחה", icon: d.checked ? CircleMinus : CirclePlus, onSelect: () => toggleDoc(d.id) },
    ];
    if (att || rel || procs.length) {
      items.push("sep");
      if (att) items.push({ label: `נספחים (${att})`, icon: Paperclip, active: openPanels.has(panelK(d.id, "attachments")), onSelect: () => togglePanel(d.id, "attachments") });
      if (rel) items.push({ label: `מסמכים קשורים (${rel})`, icon: Link, active: relPop?.doc.id === d.id, onSelect: () => {
        // Hang the list off the row's own 🔗 button when it is on screen, so it opens exactly where a click would
        // have put it (and so that button stays the toggle that closes it again).
        if (relPop?.doc.id === d.id) { closeRelPop(); return; }
        const el = rowRefs.current[d.id]?.querySelector('button[title^="מסמכים קשורים"]') as HTMLElement | null;
        if (el) setRelPop({ doc: d, rect: el.getBoundingClientRect(), el });
      } });
      if (procs.length) items.push({ label: `התהליך: ${processTitle(d)}`, icon: CornerDownRight, active: openPanels.has(panelK(d.id, "process")), onSelect: () => togglePanel(d.id, "process") });
    }
    items.push("sep");
    items.push({ label: d.note ? "עריכת ההערה" : "הוספת הערה", icon: StickyNote, onSelect: () => editCtx.start(d.id, "note") });
    items.push({ label: "עריכת שם ותקציר", icon: Pencil, onSelect: () => editCtx.start(d.id, "name") });
    items.push("sep");
    items.push({ label: "העתקת שם המסמך", icon: ClipboardCopy, onSelect: () => copy(d.name) });
    items.push({ label: "העתקת השורה", icon: ClipboardList, onSelect: () => copy(rowText(d)) });
    return items;
  };
  const flashTimer = useRef<number | null>(null);
  const closeRelPop = () => { setRelPop(null); setRelActiveId(null); };
  // Go to the related document's OWN row and ring it. When the row isn't on screen at all — filtered out, or in a
  // group that isn't rendered — there is nothing to point at, so fall back to opening the document itself.
  const jumpToDoc = (d: CaseDoc) => {
    setRelActiveId(d.id); // the list stays open, so it marks which of its documents you are looking at
    const el = rowRefs.current[d.id];
    if (!el) { onOpenDoc?.(d); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(d.id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 2200);
  };
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);
  const cols = Math.min(4, Math.max(1, Math.floor(panelWidth / 290))); // more columns when there's room (min ~290px/card)
  const multiCol = cols > 1;
  const [search, setSearch]       = useState("");
  const [searchOpen, setSearchOpen]   = useState(false); // minimal (no case open): search collapses to an icon until opened
  const [filtersOpen, setFiltersOpen] = useState(false); // minimal (no case open): refine filters (type/submitter/date) collapse behind a filter icon
  const [activeType, setActiveType] = useState("הכל");
  const [activeSubmitter, setActiveSubmitter] = useState("הכל");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [grouping, setGrouping]   = useState<"chrono" | "type">("chrono"); // chrono (flat) or grouped by type
  const [sortKey, setSortKey]     = useState<"date" | "name" | "words" | "submitter" | "type" | "process" | "related" | "attachments" | null>(null); // table column sort
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");
  // Case documents start selected by default. Their related/process triggers are NOT colored by this (they'd all be
  // blue and too loud in the row) — only the attachments icon reflects selection, since attachments are opt-in and not shown elsewhere.
  // `docs` (with each doc's `checked` flag) is lifted to MishpatPage so the chat's scope bar can read the selection.
  const [attachmentSel, setAttachmentSel] = useState<Set<string>>(new Set()); // chat-selected attachments (exhibits), keyed by `${docId}::${name}`
  // Customizable columns (persisted to localStorage) + the "columns" popover, and the per-case document numbers.
  const [visibleCols, setVisibleCols] = useState<Record<DocColKey, boolean>>(DOC_COL_DEFAULTS);
  const [layout, setLayout] = useState<LayoutKey[]>(DEFAULT_LAYOUT);
  const [colsMenuOpen, setColsMenuOpen] = useState(false);
  useEffect(() => { setVisibleCols(loadDocCols()); setLayout(loadLayout()); }, []); // hydrate from localStorage after mount (avoids SSR mismatch)
  const toggleCol = (k: DocColKey) => setVisibleCols((p) => { const next = { ...p, [k]: !p[k] }; try { window.localStorage.setItem(DOC_COLS_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  // Column reorder in the popover — pointer-based (robust + testable), operating on the DATA columns only (the שם מסמך
  // column isn't listed there). `to` is the insertion slot among the data columns; name is kept at its place. Persisted.
  const colRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragColKey = useRef<string | null>(null);
  const dropColIdx = useRef<number | null>(null);
  const clickSuppressed = useRef(false); // true right after a drag, so the trailing click doesn't also toggle
  const [, setColDragTick] = useState(0); // forces a re-render so the drag/drop indicator updates
  const reorderCol = (fromKey: string, toDataIdx: number) => setLayout((prev) => {
    // Work by KEY (not index) so the always-present "name" column — which isn't in the popover — never moves.
    const dataItems = prev.filter((k) => k !== "name");                 // the reorderable columns, in order
    const targetKey = toDataIdx < dataItems.length ? dataItems[toDataIdx] : null; // insert BEFORE this key, or at end
    if (targetKey === fromKey) return prev;                             // dropped on itself → no-op
    const without = prev.filter((k) => k !== fromKey);                  // remove only the dragged column; name stays put
    const insertAt = targetKey === null ? without.length : without.indexOf(targetKey);
    const next = [...without];
    next.splice(insertAt, 0, fromKey as LayoutKey);
    try { window.localStorage.setItem(DOC_COLORDER_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  // Reset order + widths + visibility back to the defaults (and forget the saved state).
  const resetCols = () => {
    setLayout([...DEFAULT_LAYOUT]); setColWidths({}); setDragFreeze(null); setSummaryWrap(false); setVisibleCols({ ...DOC_COL_DEFAULTS });
    try { window.localStorage.removeItem(DOC_COLORDER_LS_KEY); window.localStorage.removeItem(DOC_COLW_LS_KEY); window.localStorage.removeItem(DOC_COLS_LS_KEY); } catch { /* ignore */ }
    setColsMenuOpen(false); // close the popover after resetting
  };
  const startColDrag = (key: string, e: ReactMouseEvent) => {
    const startY = e.clientY;
    let dragging = false;
    const dataKeys = () => layout.filter((k) => k !== "name");
    const onMove = (ev: MouseEvent) => {
      if (!dragging) {
        if (Math.abs(ev.clientY - startY) < 4) return; // small move threshold → a plain click still toggles
        dragging = true; dragColKey.current = key; document.body.style.userSelect = "none";
      }
      const list = dataKeys(); let idx = list.length;
      for (let j = 0; j < list.length; j++) { const el = colRowRefs.current[list[j]]; if (!el) continue; const r = el.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { idx = j; break; } }
      dropColIdx.current = idx; setColDragTick((t) => t + 1);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = "";
      if (dragging) {
        clickSuppressed.current = true; // eat only the click that immediately follows this drag
        setTimeout(() => { clickSuppressed.current = false; }, 0);
        const k = dragColKey.current, to = dropColIdx.current;
        dragColKey.current = null; dropColIdx.current = null; setColDragTick((t) => t + 1);
        if (k != null && to != null) reorderCol(k, to);
      }
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };
  // Per-column widths (px), set by dragging a column header's edge; persisted. Overrides the column's default track.
  // Key bumped to v3: a pre-2026-08-13 build persisted EVERY column as a fixed px width the moment a resize drag
  // started, so anyone who ever grabbed a handle back then carries a fully-frozen table that can never spread on
  // expand. Bumping the key throws that saved state away and gives those users the flexible defaults back.
  const DOC_COLW_LS_KEY = "mishpat-lab-docColW-v5"; // v5: מגיש lost "בימ״ש" and narrowed — a stored v4 width would keep the old, now-oversized track
  const [colWidths, setColWidths] = useState<Record<string, number>>({}); // ONLY columns the user explicitly resized (persisted)
  const [dragFreeze, setDragFreeze] = useState<Record<string, number> | null>(null); // temp: pins ALL columns to px DURING a resize drag, released on mouseup so untouched columns flex again
  const [summaryWrap, setSummaryWrap] = useState(false); // תקציר column: wrap to multiple lines vs. single-line ellipsis
  // Custom (larger, styled) tooltip for the summary cell — the native `title` tooltip's size is OS-controlled and reads small.
  const [colsMenuRect, setColsMenuRect] = useState<DOMRect | null>(null); // anchor of the (fixed) column menu, taken from the header button
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const handleCellTip = (text: string | null, e?: ReactMouseEvent) => { if (text && e) setTip({ text, x: e.clientX, y: e.clientY }); else setTip(null); };
  useEffect(() => { try { const raw = window.localStorage.getItem(DOC_COLW_LS_KEY); if (raw) setColWidths(JSON.parse(raw)); } catch { /* ignore */ } }, []);
  const setColWidth = (k: string, px: number) => setColWidths((prev) => {
    const next = { ...prev, [k]: Math.max(30, Math.round(px)) };
    try { window.localStorage.setItem(DOC_COLW_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const docNumbers = useMemo(() => buildDocNumbers(docs), [docs]);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null); // accordion — collapsed by default
  const [openType, setOpenType]     = useState<string | null>(null); // folder accordion (type view)
  const [openProcess, setOpenProcess] = useState<number | null>(null); // process sub-folder accordion, inside the "בקשות והוראות" type folder
  const [lens, setLens]             = useState<"all" | "new" | "open">("all"); // status lens

  // On (re)open of the panel while a document is already open, reveal it: expand its case and scroll its row into
  // view (once). This only fires on mount — not while browsing — so it doesn't reintroduce the mid-navigation jump.
  const didReveal = useRef(false);
  useEffect(() => {
    if (didReveal.current || !openDocId) return;
    const d = docs.find((x) => x.id === openDocId);
    if (!d?.caseId) { didReveal.current = true; return; }
    if (openCaseId !== d.caseId) { setOpenCaseId(d.caseId); return; } // open its case first, then the next run scrolls
    const el = rowRefs.current[openDocId];
    if (el) { el.scrollIntoView({ block: "center" }); didReveal.current = true; }
  });

  // Panels now open in parallel and are managed manually (each closes from its own trigger or × button), so opening a
  // document no longer auto-collapses them — the blue open-marker still shows which thread doc is being viewed.

  const bg = isDark ? dk.surface : "white";

  function toggleSort(key: "date" | "name" | "words" | "submitter" | "type" | "process" | "related" | "attachments") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "date" || key === "words" || key === "related" || key === "attachments" ? "desc" : "asc"); } // names/submitter/type a→ב; dates/words/counts high→low
  }
  const sortDocs = (arr: CaseDoc[]) => {
    if (!sortKey) return arr;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...arr].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "he") * dir;
      if (sortKey === "submitter") return a.submitter.localeCompare(b.submitter, "he") * dir;
      if (sortKey === "type") return a.type.localeCompare(b.type, "he") * dir;
      if (sortKey === "words") return (parseWords(a.words) - parseWords(b.words)) * dir;
      if (sortKey === "related") return (a.related.length - b.related.length) * dir;
      if (sortKey === "attachments") return ((a.attachments?.length ?? 0) - (b.attachments?.length ?? 0)) * dir;
      if (sortKey === "process") {
        // Documents with no process always sort last, regardless of direction — only tagged docs reverse order between clicks.
        // Multi-process docs order by their lowest process id.
        const ap = docProcessIds(a)[0], bp = docProcessIds(b)[0];
        if (ap == null && bp == null) return 0;
        if (ap == null) return 1;
        if (bp == null) return -1;
        return (ap - bp) * dir;
      }
      // date — same-day docs also order by time (falls back to "00:00" when no time is set)
      const at = `${a.iso} ${a.time ?? "00:00"}`, bt = `${b.iso} ${b.time ?? "00:00"}`;
      return (at < bt ? -1 : at > bt ? 1 : 0) * dir;
    });
  };
  // Dense table with user-customizable columns. Full column order (RTL → first track rightmost):
  // Flat table (nothing pinned): checkbox leads, then the user-ordered columns. `track` = the column's width;
  // `fixed` is its min used in the no-scroll width sum. Widths obey `visibleCols`; the document name is always shown.
  const roomy = isFocus || panelWidth >= 720;
  const gapPx = isFocus ? 8 : 4;
  const typeTrack = roomy ? "minmax(60px,92px)" : "minmax(30px,44px)";
  // The values are now single letters (ת / נ, blank for the court), so what sizes this column is its own HEADER:
  // "מגיש" measures 26.1px at the header's 12.5px medium, against 8.6px for the widest value. Narrowing past ~27px
  // would truncate the label, not the data — so the letters buy legibility here, not width.
  const submitterTrack = roomy ? "minmax(28px,34px)" : "minmax(27px,29px)";
  type ColDef = { track: string; show: (st: boolean) => boolean; fixed?: number };
  const colDefs: Record<string, ColDef> = {
    checkbox:    { track: "18px", show: () => true, fixed: 18 },
    name:        { track: roomy ? "minmax(140px,240px)" : "minmax(74px,1.4fr)", show: () => true, fixed: roomy ? 140 : 74 },
    num:         { track: "36px", show: () => visibleCols.num, fixed: 36 },
    process:     { track: roomy ? "44px" : "32px", show: () => visibleCols.process, fixed: roomy ? 44 : 32 }, // roomy fits the boxed trigger with "2,3" or "2 +3"
    date:        { track: "52px", show: () => visibleCols.date, fixed: 52 },
    time:        { track: "44px", show: () => visibleCols.time, fixed: 44 },
    summary:     { track: roomy ? "minmax(120px,1fr)" : "minmax(74px,1.1fr)", show: () => visibleCols.summary, fixed: 74 },
    type:        { track: typeTrack, show: (st) => visibleCols.type && st, fixed: 64 },
    submitter:   { track: submitterTrack, show: () => visibleCols.submitter, fixed: 27 },
    related:     { track: roomy ? "38px" : "36px", show: () => visibleCols.related, fixed: roomy ? 38 : 36 },       // narrower than its own "קשורים" header, which spills into the gap on both sides
    note:        { track: roomy ? "28px" : "26px", show: () => visibleCols.note, fixed: roomy ? 28 : 26 },        // marker only — the note itself is written in the pencil panel
    attachments: { track: roomy ? "30px" : "28px", show: () => visibleCols.attachments, fixed: roomy ? 30 : 28 },   // ditto "נספחים" (the תקציר header carries a 6px inset so the two labels clear each other)
    words:       { track: roomy ? "minmax(58px,66px)" : "minmax(54px,62px)", show: () => visibleCols.words, fixed: 54 }, // fits the "מס׳ מילים" header
  };
  // Flat table: the checkbox leads, then the user-ordered columns (name is just one of them). Nothing is pinned —
  // what matters to the user is which columns show, in what order, at what width.
  const fullOrder = ["checkbox", ...layout];
  const visCols = (showType: boolean) => {
    const cols = fullOrder.filter((k) => colDefs[k]?.show(showType)).map((k) => {
      const d = colDefs[k];
      // During a resize drag ALL columns are pinned (dragFreeze); otherwise only explicitly-resized columns are fixed and
      // the rest keep their flexible default track → the table always fills the width (spreads on expand).
      const w = (dragFreeze && dragFreeze[k] != null) ? dragFreeze[k] : colWidths[k];
      return { key: k, track: w != null ? `${w}px` : d.track, pinned: false, fixed: w ?? d.fixed };
    });
    // The table must ALWAYS fill its container. In the roomy/expanded layout תקציר is the only column with an `fr`
    // track, so hiding it — or resizing it to a fixed px width — used to leave every track fixed and the columns
    // bunched at the right edge with dead space on the left. When no flexible track is left, promote one column to
    // `1fr` so it absorbs the leftover. Skipped mid-drag, where pinning every column is the point.
    if (!dragFreeze && !cols.some((cc) => cc.track.includes("fr"))) {
      // Prefer a column the user has NOT explicitly resized (a width they set by hand is a promise we keep), תקציר first.
      const candidates = ["summary", "name"].filter((k) => cols.some((cc) => cc.key === k));
      const pick = candidates.find((k) => colWidths[k] == null) ?? candidates[0];
      const col = cols.find((cc) => cc.key === pick);
      if (col) {
        const m = col.track.match(/minmax\((\d+)px/);
        const min = m ? parseInt(m[1], 10) : (parseInt(col.track, 10) || 0);
        col.track = `minmax(${min}px,1fr)`; // grows into the free space, never shrinks below what it has now
      }
    }
    return cols;
  };
  const tableTemplate = (showType: boolean) => visCols(showType).map((col) => col.track).join(" ");
  // Sticky-right offset for each pinned column (RTL): cumulative fixed width + gap of the pinned columns to its right.
  // The type column is never pinned, so this is independent of showType.
  const pinMap: Record<string, number> = (() => {
    const map: Record<string, number> = {}; let acc = 8; // start past the row's px-2 right padding so pinned cells hold their column
    for (const col of visCols(true)) {
      if (!col.pinned) break; // the pinned block is a contiguous prefix
      map[col.key] = acc;
      acc += (col.fixed ?? 0) + gapPx;
    }
    return map;
  })();
  // Min width the visible columns need — when it exceeds the panel, the table scrolls horizontally.
  const tableMinWidth = (showType: boolean) => visCols(showType).reduce((sum, col) => {
    const m = col.track.match(/minmax\((\d+)px/);
    const min = m ? parseInt(m[1], 10) : (col.fixed ?? (parseInt(col.track, 10) || 0));
    return sum + min + gapPx;
  }, 8 /* px-2 padding */);
  const colMeta: ColMeta = { visible: visibleCols, order: fullOrder, pin: pinMap, gapPx, docNumbers, minWidthType: tableMinWidth(true), minWidthNoType: tableMinWidth(false), summaryWrap, onCellTip: handleCellTip };

  // Column customization — the ⋮, moved off the filter row (where validation showed users never found it) into the
  // table's own corner: the otherwise-empty checkbox header cell, beside תאריך. Its menu is position:fixed off the
  // button's rect, because the header sits inside the horizontal-scroll container and an absolutely-positioned menu
  // would be clipped by it.
  const columnsBtn = (
    <button
      onClick={(e) => { setColsMenuRect(e.currentTarget.getBoundingClientRect()); setColsMenuOpen((v) => !v); }}
      title="התאמת עמודות"
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: "18px", height: "18px", color: colsMenuOpen ? c.primary : (isDark ? dk.textMuted : c.textGray), /* same weight as the header labels beside it — a fainter icon is what made the old one invisible */ backgroundColor: colsMenuOpen ? (isDark ? "#22304a" : "#eff4ff") : "transparent" }}
      onMouseEnter={(e) => { if (!colsMenuOpen) e.currentTarget.style.backgroundColor = isDark ? dk.border : c.hoverBg; }}
      onMouseLeave={(e) => { if (!colsMenuOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <MoreVertical size={15} />
    </button>
  );

  const sortHead = (key: "date" | "name" | "words" | "submitter" | "type" | "process" | "related" | "attachments", label: string, opts?: { center?: boolean; hideIcon?: boolean; alignLeft?: boolean; titleText?: string }) => (
    <button onClick={() => toggleSort(key)} className={`flex items-center gap-0.5 h-full whitespace-nowrap hover:opacity-80 ${opts?.center ? "justify-center w-full" : ""} ${opts?.alignLeft ? "justify-end w-full" : ""}`} style={{ color: sortKey === key ? c.primary : (isDark ? dk.textMuted : c.textGray), fontFamily: "Noto Sans Hebrew, sans-serif" }} title={opts?.titleText ?? `מיון לפי ${label}`}>
      <span>{label}</span>
      {!opts?.hideIcon && sortKey === key && (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </button>
  );
  const headerCellContent = (key: string) => {
    switch (key) {
      case "checkbox": return columnsBtn; // the table's own corner — where users look for column controls
      case "num":      return <span className="text-center w-full" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }} title="מספר מסמך">מס׳</span>; // the cells' # carries the meaning; the column is too narrow for "מס׳ מסמך"
      case "date":     return sortHead("date", "תאריך");
      case "time":     return <span style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>שעה</span>;
      case "process":  return sortHead("process", "תהליך", { center: true, hideIcon: true });
      case "name":     return sortHead("name", "שם מסמך");
      case "summary":  return (
        <span className="flex items-center gap-0.5" style={{ fontFamily: "Noto Sans Hebrew, sans-serif", paddingInlineStart: "8px" }}>
          <span>תקציר</span>
          <button onClick={() => setSummaryWrap((v) => !v)} title={summaryWrap ? "צמצום התקציר לשורה אחת" : "פריסת התקציר לכמה שורות"} className="flex items-center hover:opacity-70" style={{ color: summaryWrap ? c.primary : (isDark ? dk.textMuted : c.iconGray) }}>
            <WrapIcon />
          </button>
        </span>
      );
      case "type":     return sortHead("type", "סוג");
      case "submitter":return sortHead("submitter", "מגיש");
      case "related":  return sortHead("related", "קשורים", { center: true, hideIcon: true, titleText: "מיון לפי מסמכים קשורים" });
      case "attachments": return sortHead("attachments", "נספחים", { center: true, hideIcon: true, titleText: "מיון לפי נספחים" });
      case "note":     return <span className="w-full text-center" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }} title="הערות אישיות על המסמך">הערה</span>;
      case "words":    return (
        <span className="flex w-full" style={{ paddingInlineStart: "4px" }}>
          {sortHead("words", "מס׳ מילים", { titleText: "מיון לפי מספר מילים" })}
        </span>
      );
      default:         return <span />;
    }
  };
  const makeTableHeader = (showType: boolean) => {
    const cols = visCols(showType);
    return (
    <div className="grid items-center px-2 h-8 pb-1 sticky top-0 z-20 text-[12.5px] font-medium" style={{ gridTemplateColumns: tableTemplate(showType), columnGap: `${gapPx}px`, minWidth: `${tableMinWidth(showType)}px`, backgroundColor: bg, borderBottom: `1px solid ${isDark ? dk.border : "#e3ebf5"}`, color: isDark ? dk.textMuted : c.textGray }} dir="rtl">
      {cols.map((col) => (
        <div key={col.key} className="min-w-0 flex items-center h-full relative" style={pinMap[col.key] !== undefined ? { position: "sticky", right: pinMap[col.key], zIndex: 21, backgroundColor: bg } : undefined}>
          {headerCellContent(col.key)}
          {col.key !== "checkbox" && (
            <div
              onMouseDown={(e) => {
                e.preventDefault(); e.stopPropagation();
                const cell = e.currentTarget.parentElement as HTMLElement;
                const gridEl = cell.parentElement as HTMLElement;
                // Freeze EVERY visible column to its current px width first, so resizing this one changes only it
                // (the flexible fr columns no longer redistribute → other columns stop changing width).
                const frozen: Record<string, number> = {};
                cols.forEach((cc, idx) => { const el = gridEl.children[idx] as HTMLElement; if (el) frozen[cc.key] = Math.round(el.getBoundingClientRect().width); });
                setDragFreeze(frozen); // pin all columns for the DURATION of the drag → only the grabbed one visibly changes
                const startW = frozen[col.key]; const startX = e.clientX; let lastW = startW;
                // RTL: a column grows from its LEFT edge (the handle sits there). Drag the handle LEFT ⇒ wider (the
                // grabbed edge follows the cursor); drag it RIGHT (into the column) ⇒ narrower.
                const onMove = (ev: MouseEvent) => { lastW = Math.max(30, Math.round(startW + (startX - ev.clientX))); setDragFreeze((prev) => ({ ...(prev || frozen), [col.key]: lastW })); };
                const onUp = () => {
                  document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = "";
                  setColWidths((prev) => { const next = { ...prev, [col.key]: lastW }; try { window.localStorage.setItem(DOC_COLW_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; }); // persist ONLY the grabbed column
                  setDragFreeze(null); // release the others → flexible columns fill the width again (spreads on expand)
                };
                document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); document.body.style.userSelect = "none";
              }}
              className="absolute top-0 bottom-0 z-10 group/rz"
              style={{ insetInlineEnd: "-3px", width: "7px", cursor: "col-resize" }}
              title="גרירה לשינוי רוחב העמודה"
            >
              <div className="absolute inset-y-1 transition-colors group-hover/rz:bg-[#9db6d6]" style={{ insetInlineEnd: "3px", width: "2px", borderRadius: "1px" }} />
            </div>
          )}
        </div>
      ))}
    </div>
    );
  };
  const tableHeader = makeTableHeader(true);
  const tableHeaderNoType = makeTableHeader(false);

  function toggleDoc(id: string) {
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d)));
  }
  // Batch-select a set of documents (used by "בחר הכל" on a nested related/process group).
  function setDocsChecked(ids: string[], next: boolean) {
    const idSet = new Set(ids);
    setDocs((p) => p.map((d) => (idSet.has(d.id) ? { ...d, checked: next } : d)));
  }
  // A נספח was filed WITH its document, so it goes into the chat scope with it: selecting a document selects its
  // נספחים, and dropping the document drops them again. This runs off the checked TRANSITION rather than off every
  // render, which is what lets someone untick one נספח by hand and keep that choice while the document stays
  // selected — and it catches every path that changes selection (a row's checkbox, "בחר הכל" in a nested group, a
  // whole type folder) without each of them having to remember.
  const prevCheckedIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = new Set(docs.filter((d) => d.checked).map((d) => d.id));
    const prev = prevCheckedIds.current;
    prevCheckedIds.current = now;
    const keysOf = (id: string) => { const d = docs.find((x) => x.id === id); return (d?.attachments ?? []).map((n) => attKey(id, n)); };
    if (prev === null) { // first run — seed from the documents that start selected
      const seed = docs.flatMap((d) => (d.checked ? (d.attachments ?? []).map((n) => attKey(d.id, n)) : []));
      if (seed.length) setAttachmentSel((sel) => { const n = new Set(sel); seed.forEach((k) => n.add(k)); return n; });
      return;
    }
    const add: string[] = [], drop: string[] = [];
    now.forEach((id) => { if (!prev.has(id)) add.push(...keysOf(id)); });
    prev.forEach((id) => { if (!now.has(id)) drop.push(...keysOf(id)); });
    if (add.length || drop.length) setAttachmentSel((sel) => { const n = new Set(sel); add.forEach((k) => n.add(k)); drop.forEach((k) => n.delete(k)); return n; });
  }, [docs]);

  // Attachments aren't case documents, so their chat-selection lives in a separate Set (keyed by parent-doc + name).
  const toggleAttachment = (key: string) => setAttachmentSel((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const setAttachmentsSelected = (keys: string[], next: boolean) => setAttachmentSel((s) => { const n = new Set(s); keys.forEach((k) => (next ? n.add(k) : n.delete(k))); return n; });
  function toggleTypeAll(type: string, next: boolean) {
    setDocs((p) => p.map((d) => (d.type === type ? { ...d, checked: next } : d)));
  }
  function toggleBucketAll(bucket: DocBucket, next: boolean) {
    setDocs((p) => p.map((d) => (d.bucket === bucket ? { ...d, checked: next } : d)));
  }
  function toggleCaseAll(caseId: string, next: boolean) {
    setDocs((p) => p.map((d) => (d.caseId === caseId ? { ...d, checked: next } : d)));
  }

  // ── Name / summary editing ───────────────────────────────────────────────
  // The document keeps the system's text in `nameOriginal` / `summaryOriginal` from the first edit onward, so restoring
  // is always possible; the same edit is mirrored into localStorage so it survives a reload (it belongs to the user,
  // not to the document). `value === null` = restore the system's text.
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const editDirty = useRef(false); // has anything been typed in the open panel? (a second pencil click closes it only if not)
  const commitEdit = (id: string, values: Partial<Record<EditField, string | null>>, noteOpts?: NoteOpts) => {
    setEditing(null);
    editDirty.current = false;
    if (!Object.keys(values).length) return; // nothing was changed
    setDocs((p) => p.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d };
      if (values.name !== undefined) {
        if (values.name === null) { next.name = d.nameOriginal ?? d.name; next.nameOriginal = undefined; }
        else { next.nameOriginal = d.nameOriginal ?? d.name; next.name = values.name; }
      }
      if (values.summary !== undefined) {
        if (values.summary === null) { next.summary = d.summaryOriginal ?? d.summary; next.summaryOriginal = undefined; }
        else { next.summaryOriginal = d.summaryOriginal ?? d.summary; next.summary = values.summary; }
      }
      if (values.note !== undefined) {
        if (values.note === null) { next.note = undefined; next.noteShared = undefined; next.noteInChat = undefined; }
        else { next.note = values.note; next.noteShared = !!noteOpts?.shared; next.noteInChat = !!noteOpts?.inChat; }
      }
      return next;
    }));
    const edits = loadDocEdits();
    const e: DocEdit = { ...edits[id] };
    (Object.keys(values) as EditField[]).forEach((f) => { const v = values[f]; if (v === null) delete e[f]; else if (v !== undefined) e[f] = v; });
    if (values.note === null) { delete e.noteShared; delete e.noteInChat; }
    else if (values.note !== undefined) { e.noteShared = !!noteOpts?.shared; e.noteInChat = !!noteOpts?.inChat; }
    if (e.name == null && e.summary == null && e.note == null) delete edits[id]; else edits[id] = e;
    saveDocEdits(edits);
  };
  const editCtx = {
    editing,
    // Clicking the pencil of a cell that's already open closes the panel again — but never when something was typed,
    // so the toggle can't silently throw away an edit.
    start: (id: string, field: EditField) => setEditing((cur) => {
      const sameCell = cur?.id === id && cur.field === field;
      if (sameCell && editDirty.current) return cur;
      editDirty.current = false;
      return sameCell ? null : { id, field };
    }),
    cancel: () => { editDirty.current = false; setEditing(null); },
    commit: commitEdit,
    setDirty: (d: boolean) => { editDirty.current = d; },
  };

  // A document matches the active top filters (type / submitter / date / search) — case-agnostic
  // `ignoreType` drops the type filter itself — used to work out which types still have documents behind them, which
  // must be measured against every OTHER filter but not against the type choice (otherwise picking one type would
  // gray out all the rest).
  const matchesFilters = (d: CaseDoc, opts?: { ignoreType?: boolean }) =>
    (opts?.ignoreType || activeType === "הכל" || d.type === activeType) &&
    (activeSubmitter === "הכל" || d.submitter === activeSubmitter) &&
    (!dateFrom || d.iso >= dateFrom) &&
    (!dateTo || d.iso <= dateTo) &&
    // Search covers the system's original wording too — otherwise renaming a document makes it unfindable by the name
    // it actually carries in נט המשפט.
    (search.trim() === "" || [d.name, d.summary, d.nameOriginal, d.summaryOriginal].some((t) => t?.includes(search.trim())));
  // "תהליכים פתוחים" lens. A thread stays open until a decision/judgment is filed in it — a motion that is currently
  // out for the other side's response is still open even though the judge has nothing to do with it right now; the lens
  // shows the whole thread so he can see where it stands. Built across ALL cases, since the case list counts matches
  // per case while only one case's documents are loaded into the table.
  const closedProcesses = new Set<string>();
  docs.forEach((d) => { if (isResolutionDoc(d)) docProcessIds(d).forEach((pid) => closedProcesses.add(procKey(d.caseId, pid))); });
  const inOpenProcess = (d: CaseDoc) => docProcessIds(d).some((pid) => !closedProcesses.has(procKey(d.caseId, pid)));
  // Full active predicate (filters + the open-processes lens) — used for the per-case match count
  const matchesActive = (d: CaseDoc, opts?: { ignoreType?: boolean }) => matchesFilters(d, opts) && (lens !== "open" || inOpenProcess(d));
  // Types with no documents behind them right now → grayed (not hidden) in the סוג filter. Hiding them would leave the
  // user unable to tell "this case has no judgments" from "that option doesn't exist here"; the grouped "לפי סוג" view
  // already lists only the types present, so graying also brings the filter in line with it.
  const typesAvailable = new Set(docs.filter((d) => (!openCaseId || d.caseId === openCaseId) && matchesActive(d, { ignoreType: true })).map((d) => d.type));
  const emptyTypes = new Set(TYPE_OPTIONS.filter((t) => t !== "הכל" && !typesAvailable.has(t)));
  // Is any filter currently narrowing the view? (drives the per-case "N matches" indicator)
  const filterActive =
    activeType !== "הכל" || activeSubmitter !== "הכל" || !!dateFrom || !!dateTo || search.trim() !== "" || lens === "open";
  // The three "refine" filters only (type / submitter / date) — these are what collapse behind the filter icon on the case list
  const refineCount = (activeType !== "הכל" ? 1 : 0) + (activeSubmitter !== "הכל" ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0);
  const refineActive = refineCount > 0;
  // Minimal on the case list; everything unfolds once a case is open (or when the user opens/uses a control). An active
  // filter always keeps its control visible, so the list is never narrowed by something the user can't see.
  const searchExpanded  = !!openCaseId || searchOpen || search.trim() !== "";
  const filtersExpanded = !!openCaseId || filtersOpen || refineActive;

  // Filtering — scoped to the currently open case
  const filtered = docs.filter((d) => d.caseId === openCaseId && matchesFilters(d));

  const filteredSorted = [...filtered].sort((a, b) => `${b.iso} ${b.time ?? "00:00"}`.localeCompare(`${a.iso} ${a.time ?? "00:00"}`)); // newest first, same-day ties broken by time
  // "New" = filed after the last visit → always the most-recent contiguous block (demo baseline)
  const LAST_VISIT = "2026-06-01";
  const isNewDoc = (d: CaseDoc) => d.iso > LAST_VISIT;
  const lensed = filteredSorted.filter((d) => lens === "all" || (lens === "open" && inOpenProcess(d)));
  const typesInData = Array.from(new Set(lensed.map((d) => d.type)));
  // Process badge popovers show the whole thread regardless of active filters — grouped from all of this case's documents
  const processDocsById: Record<number, CaseDoc[]> = {};
  docs.filter((d) => d.caseId === openCaseId).forEach((d) => {
    docProcessIds(d).forEach((pid) => { (processDocsById[pid] ??= []).push(d); });
  });
  // The thread(s) a row's process trigger opens — the union across all of the document's processes (dedup).
  const docThread = (d: CaseDoc): CaseDoc[] | undefined => {
    const ids = docProcessIds(d);
    return ids.length ? Array.from(new Set(ids.flatMap((pid) => processDocsById[pid] ?? []))) : undefined;
  };

  // Size control — binary only (default <-> full-screen). "Table" already has its own direct, independent toggle right next to this one,
  // so it is not a rung here; a single swapping icon (like a video player's fullscreen button) is unambiguous with just two states.
  const lightBlueBtnStyle = { border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, backgroundColor: isDark ? "#22304a" : "#eaf2fd", color: c.primary };
  const expandBtn = onToggleFocus ? (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={onToggleFocus}
        className="size-8 flex items-center justify-center rounded-md flex-shrink-0 transition-opacity hover:opacity-85"
        style={lightBlueBtnStyle}
        title={isFocus ? "חזרה לתצוגה הרגילה" : "הרחבה למסך מלא"}
      >
        {isFocus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
      {onClosePanel && (
        <button
          onClick={onClosePanel}
          className="size-8 flex items-center justify-center rounded-md flex-shrink-0 transition-opacity hover:opacity-85"
          style={lightBlueBtnStyle}
          title="סגירת המסמכים"
        >
          <X size={15} />
        </button>
      )}
    </div>
  ) : null;

  // תהליכים פתוחים — task-oriented lens (was "ממתין להחלטה"; validation showed a decision can be outstanding simply
  // because the motion is out for the other side's response, so "waiting for a decision" mislabels those threads).
  // Lives inline on the top row while on the case list; moves into the filter row once a case is open.
  const openProcBtn = (
    <button
      onClick={() => setLens((l) => (l === "open" ? "all" : "open"))}
      className="flex items-center gap-1 h-8 px-2.5 rounded-md text-[13px] transition-colors whitespace-nowrap flex-shrink-0"
      style={{
        border: `1px solid ${lens === "open" ? c.primary : (isDark ? dk.border : c.border)}`,
        color: lens === "open" ? c.primary : (isDark ? dk.textMuted : c.textGray),
        backgroundColor: lens === "open" ? (isDark ? "#22304a" : "#eff4ff") : (isDark ? dk.input : "white"),
        fontFamily: "Noto Sans Hebrew, sans-serif",
      }}
      title="הצג רק תהליכים שטרם ניתנה בהם החלטה — כולל אלה הממתינים לתגובת הצד השני"
    >
      {/* Route, not the mirrored process arrow (a bare corner arrow reads as Enter/reply, and the summary-wrap
          control two buttons away now owns the return-arrow shape). A path with a start and an end also says "תהליך" in a real-world metaphor,
          and says nothing about "waiting" — the distinction this lens exists to make. */}
      <Route size={13} />
      תהליכים פתוחים
    </button>
  );

  // View toggle — chrono / group-by-type. Shown both on the case list and inside an open case, so the control set stays
  // consistent; on the list it just sets the preference that takes effect once a case is opened.
  const viewToggle = (
    <div className="flex items-center h-8 rounded-md overflow-hidden flex-shrink-0" style={{ border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}` }}>
      <button
        onClick={() => setGrouping("chrono")}
        className="h-full px-2.5 flex items-center text-[13px] whitespace-nowrap transition-colors"
        style={{ backgroundColor: grouping === "chrono" ? (isDark ? "#22304a" : "#eaf2fd") : "transparent", color: grouping === "chrono" ? c.primary : (isDark ? dk.textMuted : c.textGray), fontFamily: "Noto Sans Hebrew, sans-serif" }}
        title="כל מסמכי התיק ברצף, לפי סדר ההגשה"
      >
        כרונולוגי
      </button>
      <button
        onClick={() => { setGrouping("type"); setOpenType(null); }}
        className="h-full px-2.5 flex items-center text-[13px] whitespace-nowrap transition-colors"
        style={{ backgroundColor: grouping === "type" ? (isDark ? "#22304a" : "#eaf2fd") : "transparent", color: grouping === "type" ? c.primary : (isDark ? dk.textMuted : c.textGray), borderInlineStart: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, fontFamily: "Noto Sans Hebrew, sans-serif" }}
        title="קיבוץ המסמכים לתיקיות לפי סוג"
      >
        תיקיות
      </button>
    </div>
  );

  // The column menu (its trigger lives up in the table header — see columnsBtn), rendered at the panel root so the
  // table's scroll container can't clip it. It hangs off the button's rect with its (right, in RTL) edge aligned to it.
  const columnsMenu = colsMenuOpen && colsMenuRect && (
    <>
      <div className="fixed inset-0 z-[190]" onClick={() => setColsMenuOpen(false)} />
      <div className="fixed z-[200] rounded-[8px] overflow-hidden" style={{ top: colsMenuRect.bottom + 6, left: Math.max(8, Math.min(colsMenuRect.right - 212, (typeof window !== "undefined" ? window.innerWidth : 1280) - 220)), width: "212px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }} dir="rtl">
        <div className="px-3 py-2 text-[12px] font-semibold" style={{ color: isDark ? dk.textMuted : c.textGray, borderBottom: `1px solid ${isDark ? dk.border : "#eef1f4"}`, fontFamily: "Noto Sans Hebrew, sans-serif" }}>עמודות בטבלה <span className="font-normal" style={{ color: isDark ? dk.textMuted : c.textLight }}>· גררו לשינוי סדר</span></div>
        <div className="py-1">
          {layout.filter((k) => k !== "name").map((k, i, list) => (
            <div
              key={k}
              ref={(el) => { colRowRefs.current[k] = el; }}
              onMouseDown={(e) => startColDrag(k, e)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 relative"
              style={{ opacity: dragColKey.current === k ? 0.4 : 1, cursor: "grab" }}
            >
                  {dragColKey.current != null && dropColIdx.current === i && <div className="absolute left-2 right-2 top-0" style={{ height: "2px", backgroundColor: c.primary }} />}
                  {dragColKey.current != null && dropColIdx.current === list.length && i === list.length - 1 && <div className="absolute left-2 right-2 bottom-0" style={{ height: "2px", backgroundColor: c.primary }} />}
                  <span className="flex-shrink-0" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="גרירה לשינוי סדר"><GripVertical size={13} /></span>
                  <span className="flex items-center gap-2 flex-1 min-w-0" onClick={() => { if (clickSuppressed.current) return; toggleCol(k as DocColKey); }}>
                    <SelectionDimmed.Provider value={false}><CheckboxBlue checked={visibleCols[k as DocColKey]} onToggle={() => {}} /></SelectionDimmed.Provider>
                    <span className="text-[13px]" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{DOC_COL_LABELS[k as DocColKey]}</span>
                  </span>
                </div>
          ))}
        </div>
        <div className="px-3 py-1.5" style={{ borderTop: `1px solid ${isDark ? dk.border : "#eef1f4"}` }}>
          <button onClick={resetCols} className="text-[12.5px] hover:underline" style={{ color: c.primary, fontFamily: "Noto Sans Hebrew, sans-serif" }} title="החזרת סדר, רוחב והצגת העמודות למצב ההתחלתי">איפוס לברירת מחדל</button>
        </div>
      </div>
    </>
  );

  return (
    <DocEditCtx.Provider value={editCtx}>
    <div className="h-full flex flex-col" style={{ backgroundColor: bg, "--doc-link-color": isDark ? dk.text : "#323338", "--doc-link-hover": isDark ? "#5aa2ef" : "#0073ea" } as any}>
      {columnsMenu}
      {ctxMenu && (
        <RowContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems(ctxMenu.doc)} isDark={isDark} onClose={() => setCtxMenu(null)} />
      )}
      {/* 🔗 מסמכים קשורים — floats over the table instead of expanding inside it (see RelatedPopover) */}
      {relPop && (
        <RelatedPopover
          doc={relPop.doc}
          siblingDocs={docs.filter((d) => d.caseId === relPop.doc.caseId)}
          anchor={relPop.rect}
          trigger={relPop.el}
          activeId={relActiveId}
          isDark={isDark}
          onClose={closeRelPop}
          onJump={jumpToDoc}
          onOpenDoc={onOpenDoc}
          onToggleDocById={toggleDoc}
          onSetChecked={setDocsChecked}
        />
      )}
      {/* Larger custom tooltip (summary) — fixed-position so it isn't clipped by the table's scroll container */}
      {tip && (
        <div
          className="fixed z-[300] pointer-events-none"
          style={{ left: Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1280) - 336), top: tip.y + 18, maxWidth: "320px", padding: "9px 12px", borderRadius: "8px", backgroundColor: isDark ? "#0d1424" : "#1e2732", color: "#fff", fontSize: "14.5px", lineHeight: 1.5, fontFamily: "Noto Sans Hebrew, sans-serif", boxShadow: "0 8px 26px rgba(0,0,0,0.28)", direction: "rtl" }}
        >
          {tip.text}
        </div>
      )}
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2.5" dir="rtl">
        {/* Search + filters — minimal (icons) on the case list; unfolds once a case is open */}
        <div className="flex flex-col gap-2.5">
          {/* Row A (always one line): search (icon → field) · on the case list also the filter + ממתין controls · window controls pinned to the far end */}
          <div className="flex items-center gap-1.5 min-w-0">
            {searchExpanded ? (
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ right: "10px", color: c.iconGray }} />
                <input
                  value={search}
                  autoFocus={searchOpen && !openCaseId}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => { if (!openCaseId && search.trim() === "") setSearchOpen(false); }}
                  placeholder="חיפוש שם מסמך או תקציר"
                  className="w-full h-8 rounded-md text-[13px] outline-none"
                  style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}`, backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text, paddingRight: "32px", paddingLeft: !openCaseId ? "30px" : "10px", fontFamily: "Noto Sans Hebrew, sans-serif" }}
                />
                {!openCaseId && (
                  <button onClick={() => { setSearch(""); setSearchOpen(false); }} title="סגירת החיפוש" className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center hover:opacity-70" style={{ left: "8px", color: c.iconGray }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} title="חיפוש" className="size-8 flex items-center justify-center rounded-md flex-shrink-0 transition-colors hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray, border: `1px solid ${isDark ? dk.border : c.border}`, backgroundColor: isDark ? dk.input : "white" }}>
                <Search size={16} />
              </button>
            )}
            {/* Case list: the filter toggle + ממתין sit up here on the top row, beside the search (not on a second row) */}
            {!openCaseId && (
              <>
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  title="סינון"
                  className="relative size-8 flex items-center justify-center rounded-md flex-shrink-0 transition-colors hover:bg-black/5"
                  style={{
                    color: filtersExpanded ? c.primary : (isDark ? dk.textMuted : c.iconGray),
                    border: `1px solid ${filtersExpanded ? c.primary : (isDark ? dk.border : c.border)}`,
                    backgroundColor: filtersExpanded ? (isDark ? "#22304a" : "#eff4ff") : (isDark ? dk.input : "white"),
                  }}
                >
                  <SlidersHorizontal size={16} />
                  {refineActive && (
                    <span className="absolute flex items-center justify-center rounded-full text-[10px] font-semibold leading-none" style={{ top: "-5px", left: "-5px", minWidth: "15px", height: "15px", padding: "0 3px", backgroundColor: c.primary, color: "white", fontFamily: "Figtree, sans-serif" }}>{refineCount}</span>
                  )}
                </button>
                {viewToggle}
                {openProcBtn}
              </>
            )}
            {/* Window controls pinned to the far (left) end — the growing search field already pushes them there, so the spacer is only needed when search is a small icon */}
            {!searchExpanded && <div className="flex-1" />}
            {expandBtn}
          </div>

          {/* Row B — only when there are refine dropdowns to show (case list: user opened the filter / a filter is active) or a case is open */}
          {(filtersExpanded || openCaseId) && (
            <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
              {filtersExpanded && (
                <>
                  <FilterDropdown label="סוג" value={activeType} options={TYPE_OPTIONS} onChange={setActiveType} searchable isDark={isDark} emptyOptions={emptyTypes} emptyTitle={openCaseId ? "אין מסמכים מסוג זה בתיק" : "אין מסמכים מסוג זה"} />
                  <FilterDropdown label="מגיש" value={activeSubmitter} options={SUBMITTER_OPTIONS} onChange={setActiveSubmitter} subLabels={openCaseId ? PARTY_NAMES[openCaseId] : undefined} isDark={isDark} />
                  <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} isDark={isDark} />
                </>
              )}

              {/* Inside an open case ממתין joins the filter row (on the case list it lives up on Row A instead), with the
                  chrono / by-type toggle right beside it */}
              {openCaseId && openProcBtn}
              {openCaseId && viewToggle}

              {filterActive && (
                <button
                  onClick={() => { setActiveType("הכל"); setActiveSubmitter("הכל"); setDateFrom(""); setDateTo(""); setSearch(""); setLens("all"); setSearchOpen(false); setFiltersOpen(false); }}
                  className="flex items-center gap-1 h-8 px-2 rounded-md text-[13px] transition-colors whitespace-nowrap flex-shrink-0 hover:bg-black/5"
                  style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                  title="ניקוי כל הסינונים"
                >
                  <X size={14} />
                  נקה סינון
                </button>
              )}

            </div>
          )}
        </div>
      </div>

      {/* List — the docs table scrolls horizontally (RTL) inside HScroll when columns overflow; this outer box scrolls vertically */}
      <div className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
       <div className="px-3 pt-1 pb-3 flex flex-col gap-4" dir="rtl">
        {CASES_META.map((cf) => {
          const caseDocs = docs.filter((d) => d.caseId === cf.id);
          const caseOpen = openCaseId === cf.id;
          const caseAllOn = caseDocs.length > 0 && caseDocs.every((d) => d.checked);
          const caseSomeOn = !caseAllOn && caseDocs.some((d) => d.checked); // partial selection → indeterminate dash
          const caseUsed = caseDocs.some((d) => d.used);
          // # of docs matching the active filter (null when no filter) — but under the open-processes lens the unit of
          // the answer is the THREAD, not the document: a motion and the response to it are two documents and one thing
          // the judge has to deal with, so there the badge counts distinct open processes instead. (Both are zero
          // together — a document only matches the lens by being in an open process.)
          const caseMatchDocs = filterActive ? caseDocs.filter((d) => matchesActive(d)) : null;
          const caseMatch = caseMatchDocs && (lens === "open"
            ? new Set(caseMatchDocs.flatMap((d) => docProcessIds(d).filter((pid) => !closedProcesses.has(procKey(d.caseId, pid))))).size
            : caseMatchDocs.length);
          const caseWords = caseDocs.reduce((sum, d) => sum + parseWords(d.words), 0); // total words across the case's documents
          return (
            <div key={cf.id} className="flex flex-col">
              {/* Case header — typography for emphasis + a neutral structural underline that ties the title to the edge-aligned chevron at any width */}
              <div className="flex items-start gap-2 px-2 py-3 transition-opacity" style={{ borderBottom: `1px solid ${isDark ? dk.border : "#dde3ee"}`, opacity: caseMatch === 0 ? 0.5 : 1 }}>
                <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                  <CheckboxBlue checked={caseAllOn} mixed={caseSomeOn} onToggle={() => toggleCaseAll(cf.id, !caseAllOn)} />
                </span>
                <button className="flex flex-col flex-1 text-right min-w-0 gap-0.5" onClick={() => { const closing = caseOpen; setOpenCaseId(closing ? null : cf.id); if (closing) { setSearchOpen(false); setFiltersOpen(false); } }}>
                  {/* Row A: title (right) + word count · chevron (left edge) */}
                  <span className="flex items-center justify-between gap-2 w-full min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FolderOpen size={15} style={{ color: c.iconGray, flexShrink: 0 }} />
                      <span className="flex items-center gap-1.5 text-[17px] font-bold leading-snug min-w-0" style={{ color: isDark ? dk.text : c.text }}>
                        <span className="whitespace-nowrap" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>{cf.type}</span>
                        <span className="whitespace-nowrap" style={{ fontFamily: "Figtree, sans-serif" }}>{cf.number}</span>
                        {caseUsed && <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="כולל מסמך ששימש בתשובה" />}
                        {filterActive && (
                          <span
                            className="text-[12px] font-normal rounded-full px-1.5 py-px flex-shrink-0 whitespace-nowrap"
                            style={caseMatch === 0
                              ? { backgroundColor: "transparent", color: isDark ? dk.textMuted : c.textLight }
                              : { backgroundColor: isDark ? "#22304a" : "#e8f0fb", color: isDark ? dk.text : c.primary }}
                            title={lens === "open" ? "תהליכים פתוחים בתיק זה" : "מסמכים בתיק זה התואמים לסינון הפעיל"}
                          >
                            {lens === "open"
                              ? (caseMatch === 0 ? "אין תהליכים פתוחים" : `${caseMatch} ${caseMatch === 1 ? "תהליך פתוח" : "תהליכים פתוחים"}`)
                              : (caseMatch === 0 ? "אין תואמים" : `${caseMatch} ${caseMatch === 1 ? "תואם" : "תואמים"}`)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {visibleCols.words && <span className="text-[12px] whitespace-nowrap" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="סך המילים בכל מסמכי התיק">{formatWords(caseWords)}</span>}
                      <ChevronDown size={22} style={{ color: c.iconGray, transition: "transform 0.15s", transform: caseOpen ? "rotate(180deg)" : "none" }} />
                    </span>
                  </span>
                  {/* Row B: party names — full width, aligned under the title text */}
                  <span className="text-[14px] leading-snug truncate" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif", paddingInlineStart: "21px" }} title={cf.parties}>{cf.parties}</span>
                </button>
              </div>

              {caseOpen && (
                <div className="flex flex-col gap-1.5 pt-1.5">
        {lensed.length === 0 && (
          <div className="text-center py-10 text-[13px]" style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
            לא נמצאו מסמכים תואמים
          </div>
        )}

        {/* Chronological — flat column table; sort via column headers */}
        {grouping === "chrono" && (
          <HScroll bg={bg} isDark={isDark}>
          <div className="flex flex-col" style={{ minWidth: `${tableMinWidth(true)}px` }}>
            {tableHeader}
            {sortDocs(lensed).map((doc) => (
              <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(true)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} processDocs={docThread(doc)} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id)} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} relatedOpen={relPop?.doc.id === doc.id} onOpenRelated={(rect, el) => setRelPop((p) => (p?.doc.id === doc.id ? null : { doc, rect, el }))} flash={flashId === doc.id} onContextMenu={(x, y) => setCtxMenu({ doc, x, y })} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
            ))}
          </div>
          </HScroll>
        )}

        {/* By type — column-table rows under type sub-headers. A single sticky column header sits directly under the
            case name (mirroring the chronological view) and acts as the global sort control; the per-folder headers
            were dropped so the layout stays consistent with chrono. Type column is omitted (the folders already group by type). */}
        {grouping === "type" && (
          <HScroll bg={bg} isDark={isDark}>
          <div className="flex flex-col" style={{ minWidth: `${tableMinWidth(false)}px` }}>
            {lensed.length > 0 && tableHeaderNoType}
            {typesInData.map((type, ti) => {
              const typeDocs = lensed.filter((d) => d.type === type);
              const open = openType === type;
              const allOn = typeDocs.length > 0 && typeDocs.every((d) => d.checked);
              const someOn = !allOn && typeDocs.some((d) => d.checked);
              const typeWords = formatWords(typeDocs.reduce((sum, d) => sum + parseWords(d.words), 0));
              const typeUsed = typeDocs.some((d) => d.used);
              return (
                <div key={type} className="flex flex-col" style={ti > 0 ? { borderTop: `1px solid ${isDark ? dk.border : "#eef1f4"}` } : undefined}>
                  <div className="flex items-center gap-2 px-2 pt-2.5 pb-1.5">
                    <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={allOn} mixed={someOn} onToggle={() => toggleTypeAll(type, !allOn)} /></span>
                    <button onClick={() => setOpenType((o) => (o === type ? null : type))} className="flex items-center gap-1.5 flex-1 min-w-0 text-right" title={open ? "כיווץ" : "פתיחה"}>
                      <span className="text-[14px] font-semibold truncate" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{type} <span style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }}>({typeDocs.length})</span></span>
                      {typeUsed && <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="כולל מסמך ששימש בתשובה" />}
                      <span className="flex-1" />
                      {visibleCols.words && <span className="text-[13px] flex-shrink-0" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="סה״כ מילים בקטגוריה">{typeWords}</span>}
                      <ChevronDown size={16} style={{ color: c.iconGray, flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
                    </button>
                  </div>
                  {/* "בקשות והוראות" — sub-grouped by process (each thread gets its own folder); docs with no process stay flat */}
                  {open && type === "בקשות והוראות" ? (() => {
                    const byProcess: Record<number, CaseDoc[]> = {};
                    const noProcess: CaseDoc[] = [];
                    sortDocs(typeDocs).forEach((d) => {
                      const ids = docProcessIds(d);
                      if (ids.length) ids.forEach((pid) => (byProcess[pid] ??= []).push(d));
                      else noProcess.push(d);
                    });
                    const processIds = Object.keys(byProcess).map(Number).sort((a, b) => a - b);
                    return (
                      <>
                        {processIds.map((pid) => {
                          // Show the FULL thread inside the folder (all types — incl. the decision) so no extra click is needed
                          const pDocs = [...(processDocsById[pid] ?? byProcess[pid])].sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
                          const pOpen = openProcess === pid;
                          const pAllOn = pDocs.every((d) => d.checked);
                          const pSomeOn = !pAllOn && pDocs.some((d) => d.checked);
                          return (
                            <div key={pid} className="flex flex-col" style={{ borderTop: `1px solid ${isDark ? dk.border : "#eef1f4"}` }}>
                              <div className="flex items-center gap-2 py-1.5" style={{ paddingInlineStart: "28px", paddingInlineEnd: "8px" }}>
                                <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={pAllOn} mixed={pSomeOn} onToggle={() => setDocs((p) => p.map((d) => (docProcessIds(d).includes(pid) ? { ...d, checked: !pAllOn } : d)))} /></span>
                                <button onClick={() => setOpenProcess((o) => (o === pid ? null : pid))} className="flex items-center gap-1.5 flex-1 min-w-0 text-right" title={pOpen ? "כיווץ" : "פתיחה"}>
                                  <span className="text-[13px] font-medium truncate" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
                                    <span style={{ fontFamily: "Figtree, sans-serif" }}>{pid}</span> — {processLabel(openCaseId, pid)} <span style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }}>({pDocs.length})</span>
                                  </span>
                                  <span className="flex-1" />
                                  <ChevronDown size={15} style={{ color: c.iconGray, flexShrink: 0, transition: "transform 0.15s", transform: pOpen ? "rotate(180deg)" : "none" }} />
                                </button>
                              </div>
                              {pOpen && pDocs.map((doc) => (
                                <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(false)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} showType={false} showSelfInThread={false} lockProcess processDocs={processDocsById[pid]} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id).filter((k) => k !== "process")} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} relatedOpen={relPop?.doc.id === doc.id} onOpenRelated={(rect, el) => setRelPop((p) => (p?.doc.id === doc.id ? null : { doc, rect, el }))} flash={flashId === doc.id} onContextMenu={(x, y) => setCtxMenu({ doc, x, y })} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
                              ))}
                            </div>
                          );
                        })}
                        {noProcess.map((doc) => (
                          <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(false)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} showType={false} showSelfInThread={false} processDocs={undefined} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id)} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} relatedOpen={relPop?.doc.id === doc.id} onOpenRelated={(rect, el) => setRelPop((p) => (p?.doc.id === doc.id ? null : { doc, rect, el }))} flash={flashId === doc.id} onContextMenu={(x, y) => setCtxMenu({ doc, x, y })} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
                        ))}
                      </>
                    );
                  })() : open && sortDocs(typeDocs).map((doc) => (
                    <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(false)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} showType={false} showSelfInThread={false} processDocs={docThread(doc)} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id)} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} relatedOpen={relPop?.doc.id === doc.id} onOpenRelated={(rect, el) => setRelPop((p) => (p?.doc.id === doc.id ? null : { doc, rect, el }))} flash={flashId === doc.id} onContextMenu={(x, y) => setCtxMenu({ doc, x, y })} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
                  ))}
                </div>
              );
            })}
          </div>
          </HScroll>
        )}

                </div>
              )}
            </div>
          );
        })}
       </div>
      </div>
    </div>
    </DocEditCtx.Provider>
  );
}

// ── Dislike feedback modal ─────────────────────────────────────────────────
const REASONS = [
  "תשובה כוללת המצאות",
  "בלבול בין עיקר לטפל",
  "בלבול בין טענות לעובדות",
  "תשובה לא תואמת דוגמא",
  "תשובה חסרה",
  "לא מה ששאלתי",
  "אחר",
];

const MAX_CHARS = 250;

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const isOverLimit = text.length > MAX_CHARS;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl flex flex-col gap-5 shadow-2xl relative"
        style={{ backgroundColor: "white", padding: "24px", width: "560px", maxWidth: "calc(100vw - 32px)", direction: "rtl" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X — absolute top-left corner */}
        <button
          onClick={onClose}
          className="absolute size-8 flex items-center justify-center rounded-md hover:bg-[#f5f6f8] transition-colors"
          style={{ color: c.iconGray, top: "12px", left: "12px" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        {/* Header */}
        <div>
          <span style={{ fontSize: "16px", fontWeight: 600, color: c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
            מה לא היה מדויק בתשובה?
          </span>
        </div>

        {/* Reason tags */}
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setSelected(selected === r ? null : r)}
              className="h-8 px-3.5 rounded-full text-[13px] transition-all"
              style={{
                fontFamily: "Noto Sans Hebrew, sans-serif",
                border: `1.5px solid ${selected === r ? c.primary : c.border}`,
                backgroundColor: selected === r ? c.primaryLight : "transparent",
                color: selected === r ? c.primary : c.text,
                fontWeight: selected === r ? 500 : 400,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-1">
          <textarea
            rows={3}
            placeholder="הסבר נוסף (לא חובה)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg resize-none outline-none text-[14px] p-3"
            style={{
              border: `1.5px solid ${isOverLimit ? "#d83a52" : c.inputBorder}`,
              direction: "rtl",
              fontFamily: "Noto Sans Hebrew, sans-serif",
              color: c.text,
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => { if (!isOverLimit) e.target.style.borderColor = c.primary; }}
            onBlur={(e) => { if (!isOverLimit) e.target.style.borderColor = c.inputBorder; }}
          />
          <div className="flex items-center justify-between" dir="rtl">
            {isOverLimit ? (
              <span style={{ fontSize: "12px", color: "#d83a52", fontFamily: "Noto Sans Hebrew, sans-serif" }}>
                ניתן להזין עד {MAX_CHARS} תווים
              </span>
            ) : (
              <span />
            )}
            <span style={{
              fontSize: "12px",
              fontFamily: "Noto Sans Hebrew, sans-serif",
              color: isOverLimit ? "#d83a52" : c.iconGray,
            }}>
              {text.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2" dir="ltr">
          <button
            onClick={onClose}
            disabled={isOverLimit}
            className="h-9 rounded-md text-[14px] transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
            style={{
              fontFamily: "Noto Sans Hebrew, sans-serif", width: "88px",
              backgroundColor: isOverLimit ? c.border : c.primary,
              color: "white",
              opacity: isOverLimit ? 1 : undefined,
            }}
          >
            שליחה
          </button>
          <button
            onClick={onClose}
            className="h-9 rounded-md text-[14px] hover:bg-[#f5f6f8] transition-colors"
            style={{ fontFamily: "Noto Sans Hebrew, sans-serif", width: "88px", border: `1.5px solid ${c.border}`, color: c.text }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message action bar ─────────────────────────────────────────────────────
function MessageActions({ isDark, showBadges, onToggleBadges }: {
  isDark: boolean; showBadges: boolean; onToggleBadges: () => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const handleUp = () => setFeedback((f) => (f === "up" ? null : "up"));
  const handleDown = () =>
    setFeedback((f) => {
      if (f === "down") return null;
      setShowFeedback(true);
      return "down";
    });

  return (
    <>
      <div className="flex items-center mt-3" style={{ gap: "2px" }} dir="ltr">
        <VibeBtn title={copied ? "הועתק" : "העתק"} onClick={handleCopy}>
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </VibeBtn>
        <VibeBtn title="תשובה טובה" onClick={handleUp}>
          <ThumbsUp size={18} fill={feedback === "up" ? c.iconGray : "none"} />
        </VibeBtn>
        <VibeBtn title="תשובה לא טובה" onClick={handleDown}>
          <ThumbsDown size={18} fill={feedback === "down" ? c.iconGray : "none"} />
        </VibeBtn>
        <VibeBtn title="המשך בשיחה חדשה">
          <Split size={18} style={{ transform: "rotate(90deg)" }} />
        </VibeBtn>
        <VibeBtn title="נסה שוב"><RotateCw size={18} /></VibeBtn>
        <VibeBtn title={showBadges ? "הסתר ציטוטים" : "הצג ציטוטים"} onClick={onToggleBadges}>
          {showBadges ? <Eye size={18} /> : <EyeClosed size={18} />}
        </VibeBtn>
        <SourcesBtn isDark={isDark} />
      </div>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
}

function SourcesBtn({ isDark }: { isDark: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title="לבדיקת מקורות התשובה"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="flex items-center gap-1.5 h-8 px-2.5 rounded-md transition-colors"
      style={{
        color: c.iconGray,
        backgroundColor: hov ? c.hoverBg : "transparent",
        fontFamily: "Noto Sans Hebrew, sans-serif",
        fontSize: "13px",
      }}
    >
      <Link size={18} />
      <span>מקורות</span>
    </button>
  );
}

// ── Chat area ──────────────────────────────────────────────────────────────
type Message = { q: string; isFirst: boolean };

type ScopeMode = "selection" | "doc";

function ChatArea({ isDark, conversationKey, barMode, overDoc, openDocName, scopeCount = 0, caseCount = 1, scopeMode = "selection", onScopeModeChange, onEmptyChange, onEnlarge, onDock, onDragStart }: { isDark: boolean; conversationKey: number; barMode?: boolean; overDoc?: boolean; openDocName?: string; scopeCount?: number; caseCount?: number; scopeMode?: ScopeMode; onScopeModeChange?: (m: ScopeMode) => void; onEmptyChange?: (isEmpty: boolean) => void; onEnlarge?: () => void; onDock?: () => void; onDragStart?: (e: ReactMouseEvent) => void }) {
  const [showCitations, setShowCitations] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [citCollapsed, setCitCollapsed] = useState(true);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { q: "מהי מוכנות התיק לדיון הקרוב?", isFirst: true },
  ]);
  const [sendPressed, setSendPressed] = useState(false);

  useEffect(() => {
    setShowCitations(true);
    setShowBadges(true);
    setCitCollapsed(true);
    setInputText("");
    setMessages([]);          // start fresh — empty state
  }, [conversationKey]);

  const isEmpty = messages.length === 0;
  const bg = isDark ? dk.bg : "white";
  const textCol = isDark ? dk.text : c.text;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep the latest message in view (esp. in the compact floating window, which otherwise stays scrolled to the top).
  // Re-run on the bar→window transition too (the scroll container mounts only then), and after a tick so the answer
  // has laid out (setTimeout rather than rAF, which is paused when the tab isn't compositing).
  useEffect(() => {
    const toBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
    toBottom();
    const id = setTimeout(toBottom, 60);
    return () => clearTimeout(id);
  }, [messages, barMode, overDoc]);

  // Tell the parent whether the conversation is empty — drives the minimal-bar vs. full-window reading-mode chat (#2).
  // Gate on the actual value: onEmptyChange is a fresh closure each parent render, so an ungated effect would re-fire
  // on every render and keep forcing the window open (breaking manual minimize).
  const lastEmptyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastEmptyRef.current !== isEmpty) {
      lastEmptyRef.current = isEmpty;
      onEmptyChange?.(isEmpty);
    }
  }, [isEmpty, onEmptyChange]);
  // Reset the auto-grown input height once it's cleared (e.g. after sending)
  useEffect(() => { if (inputRef.current && inputText === "") inputRef.current.style.height = "auto"; }, [inputText]);

  function handleSend() {
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      { q: inputText.trim(), isFirst: prev.length === 0 },
    ]);
    setInputText("");
  }

  // ── Scope control — a 2-segment control above the input, shown ONLY in the floating chat over a document.
  // The question it answers is deliberately closed ("narrow to the document I'm reading?"), not open ("what is the
  // scope?"): the table's checkboxes remain the one place that governs selection, and "רק המסמך הזה" is a temporary
  // OVERRIDE that never rewrites them — switching back restores exactly what was there.
  // The two sides are NOT equal weight, so they don't get an equal-weight control (a segmented control reads as
  // "two peers — pick one"): the top line STATES the scope in force, and the checkbox below OFFERS the narrowing.
  // Checkbox rather than a lone radio, because a single radio can't be unticked — there'd be no way back. It's also
  // the same gesture, and the same component, users already use to pick documents in the table.
  function renderScopeBar() {
    const narrowed = scopeMode === "doc";
    return (
      <div className="flex flex-col gap-1" dir="rtl" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>
        {renderScopeLine()}
        <label className="flex items-center gap-1.5 text-[12.5px] cursor-pointer w-fit" title={openDocName ? `שיחה רק עם ${openDocName}` : "שיחה רק עם המסמך הפתוח"}>
          <CheckboxBlue checked={narrowed} onToggle={() => onScopeModeChange?.(narrowed ? "selection" : "doc")} />
          <span style={{ color: narrowed ? c.primary : (isDark ? dk.textMuted : c.textLight) }}>רק המסמך הזה</span>
        </label>
      </div>
    );
  }

  // "שיחה עם …" — always states the scope actually in force, so the line and the checkbox can never contradict
  // each other. Shared by the floating window (above the checkbox) and the enlarged chat (on its own, read-only).
  function renderScopeLine(withRevert = false) {
    const muted = isDark ? dk.textMuted : c.textLight;
    const narrowed = scopeMode === "doc";
    const empty = !narrowed && scopeCount === 0;
    // Multi-case is a signal worth keeping: "26 · 2 תיקים" says the answer spans two cases.
    const label = narrowed
      ? (openDocName ?? "המסמך הפתוח")
      : `המסמכים שבחרתי (${caseCount > 1 ? `${scopeCount} · ${caseCount} תיקים` : scopeCount})`;
    return (
      <div className="flex items-center gap-x-1.5 gap-y-1 flex-wrap text-[12.5px] min-w-0" dir="rtl" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>
        <span className="flex items-center gap-1 flex-shrink-0" style={{ color: muted }}>
          <FolderOpen size={13} /> שיחה עם
        </span>
        <span className="font-medium truncate min-w-0" style={{ color: empty ? "#b9670c" : c.primary }}>{label}</span>
        {withRevert && (
          <button onClick={() => onScopeModeChange?.("selection")} title="חזרה לשיחה עם המסמכים שבחרתי" className="flex-shrink-0 hover:opacity-70" style={{ color: c.primary }}>
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  // In the enlarged / docked chat there is no control (by design — the choice belongs to the moment you're reading a
  // document). But a narrowed scope must never be invisible, or a one-document answer reads like a whole-case answer:
  // when it IS narrowed, a quiet read-only chip states it and offers the one-click way back.
  function renderScopeChip() {
    if (overDoc || scopeMode !== "doc" || !openDocName) return null;
    return <div className="px-0.5">{renderScopeLine(true)}</div>;
  }

  // ── Input box (shared between empty and normal state) ──────────────────
  function renderInput() {
    // Over the document (condensed floating chat): the scope bar sits above a single-row input.
    if (overDoc) {
      return (
        <div className="flex flex-col gap-3">
        <div className="px-0.5">{renderScopeBar()}</div>
        <div
          className="rounded-lg border flex items-end gap-1.5 px-2 py-1.5"
          style={{ borderColor: isDark ? dk.border : c.inputBorder, boxShadow: "0px 2px 15px 0px rgba(0,0,0,0.05)", backgroundColor: isDark ? dk.input : "white" }}
          dir="ltr"
        >
          <button
            onClick={handleSend}
            title="שלח"
            className="size-8 flex items-center justify-center rounded-md border flex-shrink-0 transition-colors"
            style={{ color: c.primary, borderColor: c.primary, backgroundColor: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? dk.border : "#e0ecfd")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <ArrowUp size={17} />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            dir="rtl"
            className={`flex-1 bg-transparent outline-none text-right text-[15px] resize-none leading-6 overflow-y-auto py-1 ${isDark ? "dark-ph" : ""}`}
            style={{ color: isDark ? dk.text : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif", minHeight: "24px", maxHeight: "140px" }}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isEmpty ? "הקלידו שאלה…" : ""}
          />
        </div>
        </div>
      );
    }
    return (
      <div
        className="rounded-lg border flex flex-col gap-2 px-3 pt-3 pb-2 overflow-hidden"
        style={{
          borderColor: isDark ? dk.border : c.inputBorder,
          boxShadow: "0px 2px 15px 0px rgba(0,0,0,0.05)",
          backgroundColor: isDark ? dk.input : "white",
        }}
        dir="rtl"
      >
        <textarea
          ref={inputRef}
          rows={1}
          className={`w-full bg-transparent outline-none text-right text-[16px] resize-none leading-6 overflow-y-auto ${isDark ? "dark-ph" : ""}`}
          style={{ color: isDark ? dk.text : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif", minHeight: "24px", maxHeight: "168px" }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(168, t.scrollHeight) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          dir="rtl"
          placeholder={isEmpty || barMode ? "אפשר לשאול כאן כל שאלה בנוגע לתיק" : ""}
          autoFocus={isEmpty || barMode}
        />
        <div className="flex items-center gap-1.5 min-w-0" dir="ltr">
          {/* Send button — default / hover / press states */}
          <button
            onClick={handleSend}
            className="size-8 flex items-center justify-center rounded border flex-shrink-0 transition-colors"
            style={{
              borderColor: sendPressed ? c.primary : (isDark ? dk.border : c.border),
              backgroundColor: "transparent",
              color: c.iconGray,
            }}
            title="שלח"
            onMouseEnter={e => { if (!sendPressed) e.currentTarget.style.backgroundColor = c.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; setSendPressed(false); }}
            onMouseDown={() => { setSendPressed(true); }}
            onMouseUp={() => setSendPressed(false)}
          >
            <ArrowUp size={17} />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Citations toggle — left of case info */}
          <button
            onClick={() => setShowCitations((v) => !v)}
            className="size-7 flex items-center justify-center rounded flex-shrink-0 transition-colors"
            style={{
              backgroundColor: showCitations ? (isDark ? "#22304a" : c.primaryLight) : "transparent",
              border: `1px solid ${showCitations ? c.primary : (isDark ? dk.border : c.border)}`,
              color: isDark ? dk.textMuted : c.iconGray,
            }}
            title={showCitations ? "ציטוטים מופעלים" : "ציטוטים מכובים"}
            onMouseEnter={e => { if (!showCitations) e.currentTarget.style.backgroundColor = isDark ? dk.border : c.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = showCitations ? (isDark ? "#22304a" : c.primaryLight) : "transparent"; }}
          >
            <Quote size={16} strokeWidth={2} />
          </button>

          {/* Case info — aligned to the right, hoverable */}
          <button
            className="flex items-center gap-1.5 flex-shrink-0 min-w-0 overflow-hidden max-w-[55%] h-8 px-2 rounded transition-colors"
            dir="rtl"
            style={{ backgroundColor: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <FolderOpen size={15} style={{ color: c.iconGray, flexShrink: 0 }} />
            <span className="truncate text-[14px]" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>
              {CASES_META[0].type} • {CASES_META[0].number}
              <span className="inline-block align-middle" style={{ width: "14px", height: "1px", margin: "0 2px", backgroundColor: isDark ? dk.text : c.text }} />
              {CASES_META[0].parties}
            </span>
            <span className="flex-shrink-0 text-[14px]" style={{ color: "#0068f5" }}>+1</span>
          </button>
        </div>
      </div>
    );
  }

  // Two disclaimer variants: the FULL two-paragraph text (empty state, pinned at the bottom of the page) and the
  // SHORT single line (after a question is asked, under the input). Line spacing is kept tight on the full version.
  function renderDisclaimer(full = false) {
    // The compact floating window over the document skips the disclaimer — no room, and it's shown in the main chat anyway.
    if (overDoc) return null;
    const pStyle: React.CSSProperties = { color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl", textAlign: "center", lineHeight: 1.3 };
    if (full) {
      return (
        <div className="flex flex-col">
          <p className="text-[14px]" style={pStyle}>
            תוכנה זו מבוססת AI, ועלולה שלא לדייק ואף להטעות; היא אינה תחליף לשיקול דעת שיפוטי ומחייבת בחינה עצמאית.
          </p>
          <p className="text-[14px]" style={pStyle}>
            הכלי משמש כאמצעי עזר בלבד לביצוע משימות טכניות. על המשתמש חובה להפעיל שיקול דעת בעת עיון או שימוש בתוכן המופק. הכלי אינו מתחייב לכסות את מלוא הפרטים, העובדות והטענות.
          </p>
        </div>
      );
    }
    return (
      <p className="text-[14px] mt-1.5" style={pStyle}>
        תוכנה זו מבוססת AI, ועלולה שלא לדייק ואף להטעות; היא אינה תחליף לשיקול דעת שיפוטי ומחייבת בחינה עצמאית.
      </p>
    );
  }

  function renderFirstAnswer() {
    const showNum = showCitations && showBadges;
    return (
      <>
        <p className="mb-3">
          התיק מוכן לישיבת הוכחות אחרונה במועד 19/5/24. התובע הגיש את כל ראיותיו, כולל תצהירים של עדים ומומחים רפואיים מטעמו.{" "}
          {showNum && (
            <>
              <Badge num={1} />
              <Badge num={2} />
              {citCollapsed ? (
                <button onClick={() => setCitCollapsed(false)} className="inline-flex items-center justify-center rounded-full size-5 mx-0.5 hover:opacity-80 flex-shrink-0" style={{ backgroundColor: c.badgeBg, color: c.iconGray, verticalAlign: "middle" }} title="הרחב">
                  <MoreHorizontal size={11} />
                </button>
              ) : (
                <>
                  <button onClick={() => setCitCollapsed(true)} className="inline-flex items-center justify-center rounded-full size-5 mx-0.5 hover:opacity-80 flex-shrink-0" style={{ backgroundColor: c.badgeBg, color: c.iconGray }} title="כווץ">
                    <Minimize2 size={11} style={{ transform: "rotate(45deg)" }} />
                  </button>
                  <Badge num={3} /><Badge num={4} /><Badge num={5} />
                </>
              )}
            </>
          )}
        </p>
        <p className="mb-3">
          הנתבע הגיש אף הוא את ראיותיו, לרבות חוות דעת מומחה וחוות דעת אקטואריות.{" "}
          {showNum && <Badge num={6} />}
        </p>
        <p>
          התובע הגיש בקשות להיתר להגשת תיעוד רפואי חדש שיצטבר עד למועד הדיון, וכן להארכת המועד להגשת סיכומים עקב שגיאות בחוות הדעת האקטואריות של הנתבע.{" "}
          {showNum && <><Badge num={7} /><Badge num={8} /></>}
        </p>
      </>
    );
  }

  // ── Bar mode (reading) — a single compact line in our blue: send (boxed, left) · question · enlarge + dock + drag-grip (right) ──
  if (barMode) {
    const barBtn = (onClick: (() => void) | undefined, title: string, node: React.ReactNode) => (
      <button
        onClick={onClick}
        title={title}
        className="size-7 flex items-center justify-center rounded-md flex-shrink-0 transition-colors"
        style={{ color: isDark ? dk.textMuted : c.iconGray, backgroundColor: "transparent" }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? dk.border : "#e3edfb")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        {node}
      </button>
    );
    return (
      <>
        <div
          className="w-full flex items-end gap-1 rounded-xl border px-2 py-1.5"
          style={{ borderColor: c.primary, backgroundColor: isDark ? dk.input : "#eef4ff", boxShadow: "0 4px 16px rgba(0,115,234,0.18)" }}
          dir="ltr"
        >
          {/* Send — boxed so its up-arrow doesn't read like the enlarge chevron */}
          <button
            onClick={handleSend}
            title="שליחת שאלה"
            className="size-8 flex items-center justify-center rounded-md border flex-shrink-0 transition-colors"
            style={{ color: c.primary, borderColor: c.primary, backgroundColor: "transparent" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? dk.border : "#e0ecfd")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <ArrowUp size={17} />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            dir="rtl"
            className={`flex-1 bg-transparent outline-none text-right text-[15px] resize-none leading-6 overflow-y-auto py-1 ${isDark ? "dark-ph" : ""}`}
            style={{ color: isDark ? dk.text : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif", minHeight: "24px", maxHeight: "140px" }}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="איך אפשר לעזור?"
            autoFocus
          />
          {barBtn(onEnlarge, "הגדלת חלון הצ׳אט", <ChevronUp size={17} />)}
          {barBtn(onDock, "עיגון הצ׳אט כטור", <Maximize2 size={15} />)}
          {/* Drag grip — move the bar; rightmost */}
          <div onMouseDown={onDragStart} title="גרירת השורה" className="size-7 flex items-center justify-center flex-shrink-0 cursor-move" style={{ color: isDark ? dk.textMuted : c.textLight }}>
            <GripVertical size={16} />
          </div>
        </div>
      </>
    );
  }

  // ── Empty state (input centered; full disclaimer pinned at page bottom) ──
  if (isEmpty) {
    return (
      <>
        <div className="flex-1 flex flex-col px-6 pb-5 min-w-0" style={{ backgroundColor: bg }}>
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
          <div className="w-full max-w-[768px] flex flex-col gap-4">
            {overDoc ? null : (
              <p
                className="text-right text-[22px] font-medium mb-2"
                style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
              >
                שלום, כבוד השופט/ת. במה אוכל לעזור?
              </p>
            )}
            <div className="flex flex-col gap-3">{renderScopeChip()}{renderInput()}</div>
          </div>
          </div>
          {/* Full disclaimer pinned to the bottom of the page in the empty state (short version replaces it once a question is asked). */}
          {!overDoc && (
            <div className="flex justify-center w-full">
              <div className="w-full max-w-[768px]">{renderDisclaimer(true)}</div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Normal state ───────────────────────────────────────────────────────
  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0" style={{ backgroundColor: bg }}>
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-4 flex flex-col items-center gap-4">
            {messages.map((msg, i) => (
              <div key={i} className="w-full max-w-[768px] min-w-0 flex flex-col gap-3">
                <div className="rounded px-4 py-3 min-w-0 overflow-hidden" style={{ backgroundColor: isDark ? "rgba(0,115,234,0.12)" : "rgba(204,229,255,0.5)" }} dir="rtl">
                  <p className="text-[15px] text-right break-words" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", overflowWrap: "anywhere" }}>{msg.q}</p>
                </div>
                <div className="min-w-0">
                  <div className="text-right text-[15px] leading-relaxed break-words" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl", overflowWrap: "anywhere" }}>
                    {msg.isFirst ? renderFirstAnswer() : <p>מעבד את שאלתך...</p>}
                  </div>
                  <MessageActions isDark={isDark} showBadges={showBadges} onToggleBadges={() => setShowBadges((v) => !v)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-5 pt-2 flex flex-col items-center">
          <div className="w-full max-w-[768px] min-w-0 flex flex-col gap-3">
            {renderScopeChip()}
            <div>
              {renderInput()}
              {renderDisclaimer()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
// Mock: set isAdmin = true to simulate an admin user (dev team: wire to real auth)
const IS_ADMIN = true;

function AppHeader({ isDark, onToggleDark, onReset }: { isDark: boolean; onToggleDark: () => void; onReset: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-8 z-30" style={{ backgroundColor: isDark ? dk.header : c.headerBg }}>
      <div className="flex items-center gap-3">

        {/* User avatar + name — clickable for admin */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors"
            style={{ backgroundColor: menuOpen ? (isDark ? "#2a3150" : c.hoverBg) : "transparent" }}
          >
            <div className="size-7 rounded-full flex items-center justify-center text-white text-[13px] flex-shrink-0 select-none" style={{ backgroundColor: "#6b7ea8", fontFamily: "Noto Sans Hebrew, sans-serif" }}>כש</div>
            <div className="flex flex-col leading-tight text-right">
              <span className="text-[13px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}>כבוד השופט/ת</span>
            </div>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              className="absolute top-full mt-1 left-0 rounded-[8px] py-1 z-50"
              style={{
                minWidth: "180px",
                backgroundColor: isDark ? dk.surface : "white",
                border: `1px solid ${isDark ? dk.border : c.border}`,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              }}
            >
              {/* Personal settings — primary need for most users, shown first */}
              <button
                disabled
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] text-right"
                style={{ color: isDark ? dk.textMuted : c.textLight, cursor: "not-allowed", direction: "rtl" }}
              >
                הגדרות אישיות
                <span className="text-[10px] mr-auto px-1.5 py-0.5 rounded" style={{ backgroundColor: c.hoverBg, color: c.textLight }}>בקרוב</span>
              </button>
              {IS_ADMIN && (
                <>
                  <div style={{ borderTop: `1px solid ${isDark ? dk.border : c.border}`, margin: "4px 0" }} />
                  <a
                    href="/studioOS/mishpat/admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-[14px] transition-colors"
                    style={{ color: isDark ? dk.text : c.text, direction: "rtl" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? dk.border : c.hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Shield size={14} style={{ color: c.primary }} />
                    ניהול מערכת
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button onClick={onToggleDark} className="flex items-center gap-1.5 rounded-full h-6 px-1.5 cursor-pointer" style={{ backgroundColor: isDark ? "#334155" : c.border }} title={isDark ? "מצב בהיר" : "מצב כהה"}>
          {isDark ? <Sun size={12} style={{ color: "#FCD34D" }} /> : <Moon size={12} style={{ color: "#4A5568" }} />}
          <div className="size-[15px] rounded-full" style={{ backgroundColor: isDark ? "#94A3B8" : "white" }} />
        </button>
      </div>

      <button onClick={onReset} className="flex items-center gap-2 cursor-pointer" dir="rtl" title="חזרה למסך הפתיחה">
        <Logo />
        <span className="font-medium text-[18px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Rubik, sans-serif", lineHeight: "1" }}>נט המשפט</span>
      </button>
    </header>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function MishpatPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [convKey, setConvKey] = useState(0);
  const [panelWidth, setPanelWidth] = useState(620); // dense table is the only view — wide enough for the separate summary + process columns
  const [resizing, setResizing] = useState(false);
  const [focusDocs, setFocusDocs] = useState(false);
  const [openDocRaw, setOpenDoc] = useState<CaseDoc | null>(null);
  // Case documents with their `checked` selection — lifted here so the chat scope bar reflects the checkboxes.
  const [docs, setDocs] = useState<CaseDoc[]>(() => [
    // Default selection = the FIRST case only. The second case joins the chat scope only if the user checks its docs.
    ...CASE_DOCS.map((d) => ({ ...d, caseId: "c1", checked: true, used: false })),
    ...CASE_DOCS_2.map((d) => ({ ...d, caseId: "c2", checked: false })),
  ]);
  // Personal name/summary edits are re-applied after mount (localStorage is not available during SSR).
  useEffect(() => { setDocs((p) => applyDocEdits(p)); }, []);
  // The open document is held by value, so re-read it from `docs` — otherwise the viewer keeps showing the name the
  // document had when it was opened, even after the user renames it in the table.
  const openDoc = openDocRaw ? (docs.find((d) => d.id === openDocRaw.id) ?? openDocRaw) : null;
  const [viewerWidth, setViewerWidth] = useState(700); // doc pane a touch wider than the chat when all three panes are open
  const [docExpanded, setDocExpanded] = useState(false); // user expanded the document over the chat
  const [readingDocW, setReadingDocW] = useState<number | null>(null); // manual doc/table split in reading mode (null = auto)
  const [chatCollapsed, setChatCollapsed] = useState(true); // reading-mode chat: true = minimal one-line bar, false = floating window
  const [chatPos, setChatPos] = useState<{ x: number; y: number } | null>(null); // null = default bottom-left anchor
  const [chatSize, setChatSize] = useState({ w: 380, h: 470 });
  const layoutRef = useRef<HTMLDivElement>(null); // positioning context for the floating chat
  const chatContainerRef = useRef<HTMLDivElement>(null); // the floating chat container (draggable from header or bar grip)
  const [vw, setVw] = useState(1280);
  useEffect(() => {
    const u = () => setVw(window.innerWidth);
    u();
    window.addEventListener("resize", u);
    return () => window.removeEventListener("resize", u);
  }, []);

  const iconCol = isDark ? dk.textMuted : c.iconGray;
  const sidebarBg = isDark ? dk.surface : "white";

  // #5 — chat floats over the document when there isn't room for all three.
  // forceFloat: no room (narrow) or the user explicitly expanded the doc → viewer fills, no resize handle.
  // chatSpace<360: the user dragged the viewer so wide the chat would get tiny → float, but keep the handle so they can drag back.
  const chatSpace = vw - 55 - viewerWidth - (isPanelOpen ? panelWidth : 40);
  const forceFloat = !!openDoc && (vw < 1100 || docExpanded);
  const chatFloating = forceFloat || (!!openDoc && chatSpace < 420);
  // Reading mode (#1) — the user expanded the document: it's pinned at a comfortable reading width and the
  // documents table absorbs the leftover width (instead of the viewer ballooning with grey side-margins).
  const readingMode = !!openDoc && docExpanded;
  // Doc width in reading mode — comfortable to read by default, capped, and never so wide the table drops below ~500px.
  // The user can override the doc/table split by dragging the table's edge (readingDocW); we still clamp it to sane bounds.
  const readingDefaultW = Math.max(600, Math.min(900, vw - 60 - 500));
  const readingW = Math.max(480, Math.min(vw - 60 - 400, readingDocW ?? readingDefaultW));
  // #2 — whenever the chat floats over the document it can collapse to a minimal question bar (any float, not just the expand-button reading mode).
  const chatBar = chatFloating && chatCollapsed;
  // Chat scope — the CHECKED documents ACROSS cases. When they span more than one case the label carries it
  // ("12 · 2 תיקים"), since an answer drawn from two cases is a thing the user must be able to see.
  const checkedDocs = docs.filter((d) => d.checked);
  const scopeCount = checkedDocs.length;
  const caseCount = new Set(checkedDocs.map((d) => d.caseId)).size;
  // "רק המסמך הזה" is an OVERRIDE, not a selection: the checkboxes are left untouched and merely ignored while it's on,
  // so switching back restores the user's hand-picked selection exactly. (The previous version rewrote the checkboxes,
  // which silently destroyed that selection with no way back.) The mode means "whatever document is open", so it
  // follows along when another document is opened — and it resets when there's no document to point at any more.
  const [scopeMode, setScopeMode] = useState<ScopeMode>("selection");
  const scopeDocs = scopeMode === "doc" && openDoc ? [openDoc] : checkedDocs;
  void scopeDocs; // the mock has no backend to send it to yet — this is what a real request would carry
  const closeDoc = () => { setOpenDoc(null); setDocExpanded(false); setReadingDocW(null); setChatCollapsed(true); setChatPos(null); setScopeMode("selection"); };
  // New conversation, chat only — keep the working context (table + open document) so the user can start fresh in place.
  const newChat = () => { setConvKey((k) => k + 1); setScopeMode("selection"); };
  // Full reset (logo) — back to the clean opening screen: fresh chat + close panel, document and any reading/dock state.
  const resetAll = () => { setConvKey((k) => k + 1); setIsPanelOpen(false); setFocusDocs(false); setOpenDoc(null); setDocExpanded(false); setReadingDocW(null); setChatPos(null); setChatCollapsed(true); setScopeMode("selection"); };
  // Dock the floating chat back into its column while keeping the document open (shrinks the viewer if needed so the chat fits)
  const dockChat = () => { setDocExpanded(false); setChatCollapsed(true); setChatPos(null); setViewerWidth((w) => Math.min(w, Math.max(380, vw - 55 - (isPanelOpen ? panelWidth : 40) - 430))); };
  // Reverse of docking — float the chat back over the document (as a window), giving the document the wider reading width again.
  const floatChat = () => { setDocExpanded(true); setChatCollapsed(false); setChatPos(null); };
  // Close the documents table. The table filled the space to the left of the document; if the chat is floating over the
  // document, dock it into that freed space (a column beside the document) instead of leaving empty white space.
  // (viewer width computed as if the panel is already closed — the 40px rail margin — since setIsPanelOpen is async here.)
  const closePanel = () => {
    setFocusDocs(false);
    setIsPanelOpen(false);
    if (openDoc && chatFloating) {
      setDocExpanded(false);
      setChatCollapsed(true);
      setChatPos(null);
      setViewerWidth((w) => Math.min(w, Math.max(380, vw - 55 - 40 - 430)));
    }
  };

  // Drag the floating chat by its header
  const startChatDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    const row = layoutRef.current?.getBoundingClientRect();
    const win = chatContainerRef.current?.getBoundingClientRect();
    if (!row || !win) return;
    const offX = e.clientX - win.left;
    const offY = e.clientY - win.top;
    const onMove = (ev: MouseEvent) => {
      const maxX = row.width - win.width;
      const maxY = row.height - 38; // keep at least the header in view
      setChatPos({ x: Math.max(0, Math.min(maxX, ev.clientX - row.left - offX)), y: Math.max(0, Math.min(maxY, ev.clientY - row.top - offY)) });
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  };

  // Resize the floating chat from its top-right corner (grows up/right; the bottom edge stays put)
  const startChatResize = (e: ReactMouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, w0 = chatSize.w, h0 = chatSize.h;
    const topAnchored = chatPos != null;
    const y0 = chatPos?.y ?? 0;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(300, Math.min(680, w0 + (ev.clientX - sx)));
      const newH = Math.max(280, Math.min(820, h0 - (ev.clientY - sy)));
      setChatSize({ w: newW, h: newH });
      if (topAnchored) setChatPos((p) => (p ? { x: p.x, y: y0 + (h0 - newH) } : p));
    };
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ backgroundColor: isDark ? dk.bg : "white" }}>
      <AppHeader isDark={isDark} onToggleDark={() => setIsDark((v) => !v)} onReset={resetAll} />

      <div ref={layoutRef} className="absolute top-12 bottom-0 left-0 right-0 flex" dir="ltr">
        {/* Chat — in-flow column normally; a draggable, resizable floating window over the document when there's no room for all three */}
        <div
          ref={chatContainerRef}
          className={chatFloating ? `absolute z-40 flex flex-col rounded-xl ${chatBar ? "" : "overflow-hidden"}` : "flex-1 flex min-w-0"}
          style={chatFloating ? {
            ...(chatPos ? { left: `${chatPos.x}px`, top: `${chatPos.y}px` } : { bottom: "16px", insetInlineStart: "12px" }),
            width: chatBar ? "min(360px, calc(100% - 32px))" : `${chatSize.w}px`,
            height: chatBar ? "auto" : `${chatSize.h}px`,
            border: chatBar ? "none" : `1px solid ${isDark ? dk.border : c.border}`,
            backgroundColor: chatBar ? "transparent" : (isDark ? dk.bg : "white"),
            boxShadow: chatBar ? "none" : "0 10px 34px rgba(0,0,0,0.22)",
          } : undefined}
        >
          {chatFloating && !chatBar && (
            <div onMouseDown={startChatDrag} className="flex items-center justify-between px-2.5 flex-shrink-0 cursor-move select-none" style={{ height: "38px", backgroundColor: isDark ? dk.surface : "#f1f3f7", borderBottom: `1px solid ${isDark ? dk.border : "#e2e6ee"}` }} dir="rtl">
              {/* Drag affordance — the whole bar is draggable; the dots make that clear */}
              <GripHorizontal size={16} style={{ color: isDark ? dk.textMuted : c.textLight }} />
              <div className="flex items-center gap-0.5">
                {/* Minimize back to the one-line bar — available on any floating chat window */}
                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setChatCollapsed(true)} title="מזעור לשורה" className="size-7 flex items-center justify-center rounded-md hover:bg-black/5" style={{ color: iconCol }}><ChevronDown size={16} /></button>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={dockChat} title="עיגון הצ׳אט למקומו (המסמך יישאר פתוח)" className="size-7 flex items-center justify-center rounded-md hover:bg-black/5" style={{ color: iconCol }}><Maximize2 size={15} /></button>
              </div>
            </div>
          )}
          <div className="flex-1 flex min-w-0 min-h-0 relative">
            {/* Docked beside a document → give a way back: re-float the chat over the document (reverse of the dock button) */}
            {!chatFloating && !!openDoc && (
              <button onClick={floatChat} title="החזרת הצ׳אט לחלון צף מעל המסמך" className="absolute z-20 size-7 flex items-center justify-center rounded-md hover:bg-black/5" style={{ top: "8px", insetInlineStart: "8px", color: iconCol, backgroundColor: isDark ? dk.surface : "#f1f3f7", border: `1px solid ${isDark ? dk.border : "#e2e6ee"}` }}><Minimize2 size={14} /></button>
            )}
            <ChatArea isDark={isDark} conversationKey={convKey} barMode={chatBar} overDoc={chatFloating && !!openDoc} openDocName={openDoc?.name} scopeCount={scopeCount} caseCount={caseCount} scopeMode={scopeMode} onScopeModeChange={setScopeMode} onEmptyChange={(e) => { if (!e) setChatCollapsed(false); }} onEnlarge={() => setChatCollapsed(false)} onDock={dockChat} onDragStart={startChatDrag} />
          </div>
          {chatFloating && !chatBar && (
            <div onMouseDown={startChatResize} className="absolute top-0 right-0 z-20" style={{ width: "18px", height: "18px", cursor: "nesw-resize" }} title="גרירה לשינוי גודל">
              <div className="absolute" style={{ right: "5px", top: "5px", width: "7px", height: "7px", borderRight: `2px solid ${isDark ? dk.textMuted : "#b7c0cf"}`, borderTop: `2px solid ${isDark ? dk.textMuted : "#b7c0cf"}` }} />
            </div>
          )}
        </div>

        {/* Reading mode with the table closed → push the document to the right edge (against the rail) at its set size */}
        {openDoc && readingMode && !isPanelOpen && <div className="flex-1" />}

        {/* Document viewer — third pane. Normally fills the area when the chat floats; in reading mode it's a fixed
            comfortable width (pinned left) so the documents table can absorb the leftover width instead. */}
        {openDoc && (
          <DocViewer
            doc={openDoc}
            isDark={isDark}
            width={readingMode ? readingW : viewerWidth}
            onWidthChange={readingMode ? setReadingDocW : setViewerWidth}
            onClose={closeDoc}
            fill={chatFloating && !readingMode}
            // Keep the document's own resize handle in expanded mode (peeking on the left edge, as it does when the doc
            // is resized manually) — so missing the collapse button, you can still grab it to resize the doc.
            showHandle={!forceFloat || readingMode}
            canExpand={vw >= 1100}
            expanded={readingMode}
            onToggleExpand={() => {
              // Toggle reading mode (doc pinned + table absorbs the width + chat floats). Reset the manual width on exit.
              if (readingMode) { setDocExpanded(false); setReadingDocW(null); setViewerWidth(700); }
              else { setDocExpanded(true); setChatCollapsed(true); }
            }}
          />
        )}

        {/* Focus backdrop — dims the chat behind the expanded documents; stops short of the icon rail so it stays clickable */}
        {isPanelOpen && focusDocs && (
          <div onClick={() => setFocusDocs(false)} className="absolute top-0 bottom-0 z-30" style={{ left: 0, right: "60px", backgroundColor: "rgba(0,0,0,0.3)" }} />
        )}

        {/* Document panel — opens to the left of the right rail; toggled by the rail's documents button */}
        {isPanelOpen && (
          <div
            className={focusDocs ? "absolute top-0 bottom-0 z-40" : `relative ${readingMode ? "flex-1 min-w-0" : "flex-shrink-0"}`}
            style={focusDocs
              ? { left: 0, right: "60px", backgroundColor: isDark ? dk.surface : "white" }
              : readingMode
                ? { overflow: "visible" }
                : { width: `${panelWidth}px`, overflow: "visible" }}
          >
            <div className="absolute inset-0" style={{ overflow: "visible" }}>
              {/* While the chat is narrowed to the open document, the table's selection is inert — dim the checkboxes
                  so the screen doesn't show N checked documents that aren't actually in the conversation. */}
              <SelectionDimmed.Provider value={scopeMode === "doc" && !!openDoc}>
                <DocumentPanelOpen isDark={isDark} panelWidth={focusDocs ? vw - 72 : (readingMode ? Math.max(400, vw - readingW - 60) : panelWidth)} isFocus={focusDocs} onToggleFocus={() => setFocusDocs((v) => !v)} onSetWidth={setPanelWidth} onOpenDoc={(doc) => { setFocusDocs(false); setOpenDoc(doc); }} onClosePanel={closePanel} openDocId={openDoc?.id} docs={docs} setDocs={setDocs} />
              </SelectionDimmed.Provider>
            </div>

            {/* Resize handle — left edge (panel sits to the left of the rail). Normal mode: resize the table width.
                Reading mode: the table is flex-1, so dragging adjusts the doc/table split (the doc's pinned-left width). */}
            {!focusDocs && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setResizing(true);
                  const onMove = (ev: MouseEvent) => {
                    if (readingMode) {
                      // Doc is pinned to the left edge, so its right edge (the handle) sits at x = doc width; drag it to re-split.
                      setReadingDocW(Math.max(480, Math.min(vw - 60 - 400, ev.clientX)));
                      return;
                    }
                    // 480 is the floor: below it the table's fixed-width columns (checkbox/date/process/type/submitter/attachments/words) alone
                    // exceed the panel width, and the name/summary columns get squeezed to nothing and overlap their neighbors.
                    // The ceiling scales with the window instead of a flat 720, so the panel can be dragged as wide as the user wants
                    // while still leaving the chat pane at least ~380px.
                    setPanelWidth(Math.min(vw - 380 - 60, Math.max(480, window.innerWidth - 60 - ev.clientX)));
                  };
                  const onUp = () => {
                    setResizing(false);
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                    document.body.style.userSelect = "";
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                  document.body.style.userSelect = "none";
                }}
                className="absolute top-0 bottom-0 left-0 z-10 group"
                style={{ width: "8px", cursor: "ew-resize" }}
                title="גרירה לשינוי רוחב"
              >
                <div className="absolute top-0 bottom-0 left-0" style={{ width: "2px", backgroundColor: resizing ? c.primary : "#dbe7f7" }} />
                {/* Grip-dots chip straddling the edge — reads clearly as a drag handle; turns blue on hover / while resizing */}
                <div
                  className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center rounded-md border transition-colors group-hover:!bg-[#0073ea] group-hover:!border-[#0073ea] group-hover:!text-white"
                  style={{ width: "15px", height: "30px", backgroundColor: resizing ? c.primary : (isDark ? "#2a3350" : "#eef2f8"), borderColor: resizing ? c.primary : (isDark ? dk.border : "#cfd8e6"), color: resizing ? "white" : (isDark ? dk.textMuted : "#8a97ad") }}
                >
                  <GripVertical size={13} strokeWidth={2} />
                </div>
              </div>
            )}

          </div>
        )}

        {/* Right icon rail — new conversation, documents (elevated), then secondary nav; help + model + version at the bottom */}
        <div className="w-[60px] flex-shrink-0 flex flex-col items-center pt-5 pb-4" style={{ borderInlineStart: `1px solid ${isDark ? dk.border : "#ebf3ff"}`, backgroundColor: sidebarBg }}>
          <button
            onClick={newChat}
            className="w-8 h-8 flex items-center justify-center rounded mb-3 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: c.primary, color: "white" }}
            title="שיחה חדשה"
          >
            <Plus size={16} />
          </button>
          {/* Documents — same icon language as the rest; turns blue when its panel is open. Distinguished only by position + divider */}
          <button
            onClick={() => { if (isPanelOpen) closePanel(); else { setIsPanelOpen(true); setFocusDocs(false); } }}
            className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors"
            style={{ color: isPanelOpen ? c.primary : iconCol }}
            title="מסמכים"
          >
            <Files size={19} />
          </button>
          <div className="w-8 border-t my-3" style={{ borderColor: isDark ? dk.border : c.border }} />
          <div className="flex flex-col items-center gap-2.5" style={{ color: iconCol }}>
            <button className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" title="שיחות אחרונות"><Clock size={19} /></button>
            <button className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" title="שאלות מועדפות"><Bookmark size={19} /></button>
            <button className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" title="דוגמאות"><Paperclip size={19} /></button>
          </div>
          <div className="flex-1" />
          <button className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: iconCol }} title="עזרה"><HelpCircle size={19} /></button>
          <div className="mt-2 text-center leading-tight" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }}>
            <div style={{ fontSize: "11px" }}>Opus 4.8</div>
            <div style={{ fontSize: "10px", opacity: 0.7 }}>v2.3</div>
          </div>
        </div>
      </div>
    </div>
  );
}
