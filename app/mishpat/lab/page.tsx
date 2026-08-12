"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp,
  Clock, Copy, Eye, EyeClosed, FileText, Files, FolderOpen,
  HelpCircle, Info, Layers, Link, Sparkles, Minimize2,
  Moon, MoreHorizontal, MoreVertical, Plus, Quote, RotateCw, Search, Shield,
  Split, Sun, ThumbsDown, ThumbsUp,
  Calendar, ExternalLink, Check, Key, Gavel, Maximize2, X, Rows3, LayoutGrid, Paperclip, SlidersHorizontal,
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
function CheckboxBlue({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="size-4 rounded-[2px] flex-shrink-0 flex items-center justify-center cursor-pointer select-none"
      style={{ backgroundColor: checked ? c.primary : "transparent", border: checked ? "none" : `1px solid ${c.border}` }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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
  pending?: boolean;     // awaiting the judge's decision
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
    related: ["פרוטוקול דיון מקדמי", "החלטה בבקשת ארכה"], checked: false,
    isNew: true, pending: true, file: "/studioOS/docs/motion-1.pdf", processId: 1,
  },
  {
    id: "d2", name: "תצהיר עדות ראשית — ד״ר לוי", type: "תצהירים", submitter: "תובע", submitterName: "יעקב אברמוב",
    date: "31.05.26", time: "16:40", iso: "2026-05-31", bucket: "week", words: "8.4K",
    summary: "תצהיר מומחה רפואי מטעם התובע הקובע קשר סיבתי בין הרשלנות הנטענת לנזק, ומפרט נכות צמיתה בשיעור 25%.",
    related: ["חוות דעת אקטוארית", "כתב תביעה", "פרוטוקול דיון מקדמי", "החלטה על מינוי מומחה"], checked: true, used: true, isNew: true,
    attachments: ["נספח א — תעודת התמחות ד״ר לוי", "נספח ב — צילומי MRI"],
    key: true, keyReason: "מסמך מרכזי — תצהיר מומחה שעליו נשענת התביעה; מסמכים נוספים מפנים אליו", file: "/studioOS/docs/affidavit-1.pdf",
  },
  {
    id: "d3", name: "תגובה לבקשת ארכה", type: "בקשות והוראות", submitter: "תובע",
    date: "29.05.26", time: "11:05", iso: "2026-05-29", bucket: "week", words: "640",
    summary: "התובע מתנגד לבקשת הארכה וטוען כי מדובר בניסיון לסחבת; לחלופין מבקש כי הדחייה תותנה בהוצאות.",
    related: ["בקשה לדחיית מועד דיון"], checked: false, file: "/studioOS/docs/motion-2.pdf", processId: 1,
  },
  {
    id: "d4", name: "פרוטוקול דיון מקדמי", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "18.05.26", time: "14:22", iso: "2026-05-18", bucket: "month", words: "4.2K",
    summary: "סיכום הדיון המקדמי: נקבעו פלוגתאות, הוסכם על מינוי מומחה מטעם בית המשפט ונקבע לוח זמנים להגשת ראיות.",
    related: ["החלטה על מינוי מומחה"], checked: false, used: true,
    key: true, keyReason: "מסמך מרכזי — פרוטוקול הקובע את הפלוגתאות ולוח הזמנים בתיק", file: "/studioOS/docs/protocol-1.pdf",
  },
  {
    id: "d5", name: "כתב הגנה מתוקן", type: "כתבי טענות", submitter: "נתבע",
    date: "10.05.26", time: "11:30", iso: "2026-05-10", bucket: "month", words: "12.1K",
    summary: "הנתבע דוחה את כל טענות הרשלנות, טוען להעדר קשר סיבתי ולאשם תורם של התובע, ומעלה טענת התיישנות חלקית.",
    related: ["כתב תביעה", "תצהיר עדות ראשית — ד״ר לוי"], checked: false, file: "/studioOS/docs/defense-1.pdf",
  },
  {
    id: "d6", name: "החלטה על מינוי מומחה", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "05.05.26", time: "09:45", iso: "2026-05-05", bucket: "month", words: "820",
    summary: "בית המשפט ממנה את פרופ׳ זילברשטיין כמומחה מטעמו לבחינת שאלת הנכות, וקובע את חלוקת שכר הטרחה בין הצדדים.",
    related: ["פרוטוקול דיון מקדמי"], checked: false, file: "/studioOS/docs/decision-1.pdf",
  },
  {
    id: "d7", name: "כתב תביעה", type: "כתבי טענות", submitter: "תובע",
    date: "12.02.26", time: "14:10", iso: "2026-02-12", bucket: "older", words: "15.7K",
    summary: "התובע, מר יעקב אברמוב, הגיש כתב תביעה כנגד הנתבע בגין רשלנות רפואית לכאורה בטיפול שניתן לו, בעקבותיו נגרמו נזקי גוף.",
    related: ["כתב הגנה מתוקן"], checked: false, file: "/studioOS/docs/claim-1.pdf",
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
    related: ["בקשה לדחיית מועד דיון", "תגובה לבקשת ארכה"], checked: false, file: "/studioOS/docs/decision-2.pdf",
  },
  {
    id: "d13", name: "פרוטוקול ישיבת קדם משפט", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "15.05.26", time: "09:30", iso: "2026-05-15", bucket: "month", words: "5.8K",
    summary: "תיעוד ישיבת קדם המשפט, לרבות עמדות הצדדים והחלטות ביניים בנוגע לגילוי מסמכים.",
    related: ["פרוטוקול דיון מקדמי"], checked: false, file: "/studioOS/docs/protocol-2.pdf",
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
    related: ["בקשה לגילוי מסמכים"], checked: false, file: "/studioOS/docs/motion-1.pdf", processId: 3,
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
    related: ["כתב תביעה", "כתב הגנה מתוקן"], checked: false, file: "/studioOS/docs/claim-2.pdf",
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
    related: ["פרוטוקול ישיבת קדם משפט"], checked: false, file: "/studioOS/docs/protocol-1.pdf",
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
    related: ["בקשה לגילוי מסמכים", "הודעה על הגשת ראיות נוספות"], checked: false, file: "/studioOS/docs/decision-4.pdf",
    processIds: [2, 3],
  },
];

// Second case (mock) — documents for a different file
const CASE_DOCS_2: CaseDoc[] = [
  { id: "e1", name: "כתב תביעה", type: "כתבי טענות", submitter: "תובע", date: "29.05.26", time: "09:20", iso: "2026-05-29", bucket: "week", words: "9.8K",
    summary: "תביעה כספית בגין הפרת חוזה בנייה ואיחור במסירת דירות לרוכשים.", related: [], checked: false, file: "/studioOS/docs/claim-1.pdf" },
  { id: "e2", name: "בקשה לסעד זמני", type: "בקשות והוראות", submitter: "תובע", date: "31.05.26", time: "14:45", iso: "2026-05-31", bucket: "week", words: "1.2K",
    summary: "בקשה לצו מניעה זמני שימנע העברת זכויות בפרויקט עד להכרעה בתיק. הנתבע מתנגד לבקשה.", related: [], checked: false, file: "/studioOS/docs/motion-2.pdf", processId: 1 },
  { id: "e3", name: "כתב הגנה", type: "כתבי טענות", submitter: "נתבע", date: "15.04.26", time: "11:00", iso: "2026-04-15", bucket: "older", words: "7.1K",
    summary: "הנתבע טוען לעיכובים מצד התובע ולכוח עליון שמנע עמידה בלוחות הזמנים.", related: ["כתב תביעה"], checked: false, file: "/studioOS/docs/defense-1.pdf" },
  { id: "e4", name: "החלטה בבקשת סעד זמני", type: "החלטות בתיק", submitter: "בית המשפט", date: "01.06.26", time: "10:30", iso: "2026-06-01", bucket: "week", words: "540",
    summary: "בית המשפט נעתר חלקית ומורה על רישום הערת אזהרה עד לדיון.", related: ["בקשה לסעד זמני"], checked: false, used: true, file: "/studioOS/docs/decision-5.pdf", processId: 1 },
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
  label, value, options, onChange, searchable = false, subLabels, isDark,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; searchable?: boolean; subLabels?: Record<string, string>; isDark?: boolean;
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
            className="absolute z-40 mt-1 rounded-lg py-1 overflow-hidden"
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
                return (
                  <button
                    key={opt}
                    dir="rtl"
                    onClick={() => { onChange(opt); setOpen(false); setQ(""); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-right"
                    style={{ backgroundColor: sel ? (isDark ? "#22304a" : "#eff4ff") : "transparent", color: sel ? c.primary : (isDark ? dk.text : c.text), fontWeight: sel ? 600 : 400, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                    onMouseEnter={(e) => { if (!sel) e.currentTarget.style.backgroundColor = isDark ? dk.border : c.hoverBg; }}
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
            className="absolute z-40 mt-1 rounded-lg p-3 flex flex-col gap-2.5"
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
  const activeBg = isDark ? "#212c42" : "#f1f6fd"; // gentle takhelet tint for the currently-open document
  return (
    <div
      ref={rowRef}
      className="rounded-[8px] border h-full overflow-hidden flex flex-col cursor-pointer transition-colors"
      style={{ borderColor: active ? c.primary : (isDark ? dk.border : "#dce8f6"), backgroundColor: active ? activeBg : baseBg, boxShadow: markNew ? "inset -2px 0 0 0 rgba(0,115,234,0.45)" : undefined }}
      dir="rtl"
      title="פתיחת המסמך לצפייה"
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

      {/* Row 2: all metadata + icons on one line (date · submitter · key · used · pending · open · count) */}
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
              <button key={r} onClick={(e) => e.stopPropagation()} className="doc-link flex items-center gap-1 text-right min-w-0" title="פתיחת המסמך">
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
// Clicking it toggles an inline detail row that opens in place (RowDetail) — no floating popover.
// `picked` turns the icon blue once any of this group's nested items are selected for the chat (otherwise it
// stays the default gray). No partial vs. full distinction — just picked / not picked.
function RowIconTrigger({ children, active, onClick, title, isDark, picked = false }: { children: React.ReactNode; active: boolean; onClick: (e: ReactMouseEvent) => void; title: string; isDark: boolean; picked?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center flex-shrink-0 rounded transition-colors hover:opacity-75"
      style={{ color: active || picked ? c.primary : (isDark ? dk.textMuted : c.textGray) }}
      title={title}
    >
      {children}
    </button>
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

// Inline detail panel that expands directly under a table row, in place of the old floating popovers.
// One nested document rendered inside an expanded detail, using the SAME dynamic columns as the parent table so
// every field lines up (and the pinned block stays put on horizontal scroll). The checkbox column is live: related
// and process-thread docs are real case documents, so ticking one here toggles that document's own `checked` state.
function NestedDocRow({ doc, gridCols, colGap, colMeta, showType, isDark, isOpen, isSelf, onOpenDoc, onToggleCheck }: { doc: CaseDoc; gridCols: string; colGap: string; colMeta: ColMeta; showType: boolean; isDark: boolean; isOpen?: boolean; isSelf?: boolean; onOpenDoc?: (doc: CaseDoc) => void; onToggleCheck?: () => void }) {
  const metaCol = isDark ? dk.textMuted : c.textLight;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const partyName = doc.submitterName ?? (doc.caseId ? PARTY_NAMES[doc.caseId]?.[doc.submitter] : undefined);
  const typeC = TYPE_COLORS[doc.type] ?? { bg: isDark ? dk.input : "#eef1f4", color: isDark ? dk.textMuted : c.textGray };
  const num = colMeta.docNumbers[doc.id];
  // Opaque backgrounds (so pinned sticky cells occlude scrolling content): base = detail-panel bg, plus open/hover tints.
  const baseBg = isDark ? "#181f33" : "#f4f8fd";
  const restBg = isOpen ? (isDark ? "#22293f" : "#e8f0fc") : baseBg;
  const hoverBg = isOpen ? restBg : (isDark ? "#232a3d" : "#edf1f8");
  const cellContent = (key: string) => {
    switch (key) {
      case "checkbox": return onToggleCheck ? <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} /></span> : <span className="flex-shrink-0" />;
      case "num":      return <span className="text-center w-full text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="מספר מסמך">{num ?? ""}</span>;
      case "date":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.time ? `${doc.date} ${doc.time}` : doc.date}>{doc.date}</span>;
      case "time":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="שעת הגשה">{doc.time ?? "—"}</span>;
      case "process":  return <span className="min-w-0 flex justify-center w-full" style={{ color: metaCol }}>{docProcessIds(doc).length > 0 && <ProcessChips ids={docProcessIds(doc)} isDark={isDark} />}</span>;
      case "name":     return (
        <span className="flex items-center gap-1 min-w-0" style={{ paddingInlineStart: "6px" }}>
          <span className="flex-shrink-0" style={{ color: metaCol, opacity: 0.7, fontSize: "11px", lineHeight: 1 }}>↳</span>
          <span className="doc-link truncate text-[12.5px] leading-tight" title={doc.name} style={{ fontFamily: "Noto Sans Hebrew, sans-serif", fontStyle: isSelf ? "italic" : undefined, color: isOpen ? c.primary : undefined, textDecoration: isOpen ? "underline" : undefined, textDecorationColor: isOpen ? c.primary : undefined, textUnderlineOffset: "2px", paddingBottom: "2px" }}>{doc.name}</span>
          {doc.used && <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="שימש בתשובת הצ׳אט האחרונה" />}
        </span>
      );
      case "summary":  return <span className="truncate text-[12.5px] min-w-0" title={doc.summary} style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</span>;
      case "type":     return <span className="min-w-0 flex"><span className="text-[11.5px] truncate rounded px-1.5 py-px" style={{ backgroundColor: typeC.bg, color: typeC.color, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={doc.type}>{doc.type}</span></span>;
      case "submitter":return <span className="text-[11.5px] truncate min-w-0" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={partyName ? `${doc.submitter} · ${partyName}` : doc.submitter}>{doc.submitter === "בית המשפט" ? "ביהמ״ש" : doc.submitter}</span>;
      case "related":  return <span />;
      case "attachments": return <span />;
      case "words":    return <span className="text-[11.5px] text-left w-full" style={doc.missing ? { color: "#d83a52", fontFamily: "Figtree, sans-serif" } : { color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.missing ? "המסמך ללא תוכן" : "מספר מילים"}>{doc.words}</span>;
      default:         return null;
    }
  };
  return (
    <div
      className="grid items-center px-2 py-1 rounded transition-colors cursor-pointer"
      style={{ gridTemplateColumns: gridCols, columnGap: colGap, minWidth: `${showType ? colMeta.minWidthType : colMeta.minWidthNoType}px`, ["--row-bg" as string]: restBg, backgroundColor: "var(--row-bg)" } as React.CSSProperties}
      title="פתיחת המסמך לצפייה"
      onClick={() => onOpenDoc?.(doc)}
      onMouseEnter={(e) => { e.currentTarget.style.setProperty("--row-bg", hoverBg); }}
      onMouseLeave={(e) => { e.currentTarget.style.setProperty("--row-bg", restBg); }}
    >
      {COL_ORDER.filter((key) => colShown(key, colMeta, showType)).map((key) => (
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
type DocColKey = "num" | "date" | "time" | "process" | "summary" | "type" | "submitter" | "related" | "attachments" | "words";
const DOC_COL_ORDER: DocColKey[] = ["num", "date", "time", "process", "summary", "type", "submitter", "related", "attachments", "words"];
const DOC_COL_LABELS: Record<DocColKey, string> = { num: "מספר מסמך", date: "תאריך", time: "שעת הגשה", process: "תהליך", summary: "תקציר", type: "סוג", submitter: "מגיש", related: "מסמכים קשורים", attachments: "נספחים", words: "מילים" };
const DOC_COL_DEFAULTS: Record<DocColKey, boolean> = { num: false, date: true, time: false, process: true, summary: true, type: true, submitter: true, related: true, attachments: true, words: true };
const DOC_COLS_LS_KEY = "mishpat-lab-docCols";
const loadDocCols = (): Record<DocColKey, boolean> => {
  if (typeof window === "undefined") return { ...DOC_COL_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(DOC_COLS_LS_KEY);
    if (raw) return { ...DOC_COL_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DOC_COL_DEFAULTS };
};

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

// Renders one of three things depending on which row icon was clicked: the process thread (status + its
// documents), the related documents, or the attachments. Related docs and process-thread docs are real
// documents, so they render as full column-aligned rows (NestedDocRow) with live checkboxes that toggle the
// underlying document's `checked`. Attachments are exhibits, not case documents, so they have no column data
// and stay a simple labeled list with their own checkbox state (attachmentSel). Each group offers "בחר הכל".
function RowDetail({ kind, accent, doc, processDocs, siblingDocs, gridCols, colGap, colMeta, showType, showSelfInThread, openDocId, isDark, onOpenDoc, onClose, onToggleDocById, onSetChecked, attachmentSel, onToggleAttachment, onSetAttachments }: { kind: "related" | "attachments" | "process"; accent?: string; doc: CaseDoc; processDocs?: CaseDoc[]; siblingDocs?: CaseDoc[]; gridCols: string; colGap: string; colMeta: ColMeta; showType: boolean; showSelfInThread?: boolean; openDocId?: string; isDark: boolean; onOpenDoc?: (doc: CaseDoc) => void; onClose: () => void; onToggleDocById?: (id: string) => void; onSetChecked?: (ids: string[], next: boolean) => void; attachmentSel?: Set<string>; onToggleAttachment?: (key: string) => void; onSetAttachments?: (keys: string[], next: boolean) => void }) {
  const panelBg = isDark ? "#181f33" : "#f4f8fd";
  const titleCol = isDark ? dk.textMuted : c.textLight;
  const textCol = isDark ? dk.text : c.text;
  const metaCol = isDark ? dk.textMuted : c.textLight;

  let title = "";
  let TitleIcon: LucideIcon = FileText;
  let meta: React.ReactNode = null;
  let body: React.ReactNode = null;
  let preBody: React.ReactNode = null; // an optional block between the header and the rows (used to list process names)
  // Whether every selectable item in this group is currently picked, and the toggle that selects/clears all of them.
  let allSelected = false;
  let onSelectAll: (() => void) | null = null;

  if (kind === "process") {
    const docs = processDocs ?? [];
    // In the by-type view (showSelfInThread === false) the folder already names the process and lists all its docs, so
    // the source doc itself is dropped from its thread. In chronological it's kept (italic) — it helps locate the doc
    // within a long thread.
    const sorted = [...docs].filter((d) => showSelfInThread !== false || d.id !== doc.id).sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
    const isResolution = (d: CaseDoc) => d.type === "החלטות בתיק" || d.type === "פסקי דין";
    const closed = docs.some(isResolution); // status reflects the FULL thread — even when the source doc (the decision itself) is hidden from its own thread

    const procIds = docProcessIds(doc);
    const multi = procIds.length > 1;
    // One process → keep its name in the header (not crowded). Several → shorten the header to just "תהליכים" (a count
    // like "(2)" read as process #2) and list the names on their own light lines below.
    title = multi ? "תהליכים" : `${processTitle(doc)} (${docs.length})`;
    TitleIcon = Layers;
    if (multi) {
      preBody = (
        <div className="flex flex-col gap-0.5 mb-1.5 px-2" style={{ paddingInlineStart: "34px" }}>
          {procIds.map((pid) => (
            <div key={pid} className="flex items-center gap-1.5 text-[12px] min-w-0" style={{ color: metaCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              <span style={{ fontFamily: "Figtree, sans-serif", fontWeight: 600, flexShrink: 0 }}>{pid}</span>
              <span style={{ opacity: 0.4, flexShrink: 0 }}>·</span>
              <span className="truncate">{processLabel(doc.caseId, pid)}</span>
              <span style={{ opacity: 0.6, flexShrink: 0 }}>({docs.filter((d) => docProcessIds(d).includes(pid)).length})</span>
            </div>
          ))}
        </div>
      );
    }
    // Status only — open / closed (per feedback: drop doc-count and open/decision dates)
    meta = (
      <span className="text-[11px] rounded-full px-1.5 py-px whitespace-nowrap" style={{ fontWeight: 400, fontFamily: "Noto Sans Hebrew, sans-serif", backgroundColor: closed ? (isDark ? "#1c3a2c" : "#e5f4ec") : (isDark ? "#3a2e1c" : "#fbf0df"), color: closed ? "#0f8a5f" : "#b9670c" }}>
        {closed ? "הושלם" : "פתוח"}
      </span>
    );
    if (sorted.length > 0 && onSetChecked) {
      allSelected = sorted.every((d) => d.checked);
      onSelectAll = () => onSetChecked(sorted.map((d) => d.id), !allSelected);
    }
    body = (
      <div className="flex flex-col">
        {sorted.map((d) => (
          <NestedDocRow key={d.id} doc={d} gridCols={gridCols} colGap={colGap} colMeta={colMeta} showType={showType} isDark={isDark} isOpen={d.id === openDocId} isSelf={d.id === doc.id} onOpenDoc={onOpenDoc} onToggleCheck={onToggleDocById ? () => onToggleDocById(d.id) : undefined} />
        ))}
      </div>
    );
  } else if (kind === "related") {
    title = "מסמכים קשורים";
    TitleIcon = Link;
    // Resolve each related name to a real document in the same case (so we can show its full columns).
    const relDocs = doc.related.map((name) => siblingDocs?.find((d) => d.name === name)).filter((d): d is CaseDoc => !!d);
    if (relDocs.length > 0 && onSetChecked) {
      allSelected = relDocs.every((d) => d.checked);
      onSelectAll = () => onSetChecked(relDocs.map((d) => d.id), !allSelected);
    }
    body = (
      <div className="flex flex-col">
        {doc.related.map((name) => {
          const rel = siblingDocs?.find((d) => d.name === name);
          return rel
            ? <NestedDocRow key={name} doc={rel} gridCols={gridCols} colGap={colGap} colMeta={colMeta} showType={showType} isDark={isDark} isOpen={rel.id === openDocId} onOpenDoc={onOpenDoc} onToggleCheck={onToggleDocById ? () => onToggleDocById(rel.id) : undefined} />
            : (
              <div key={name} className="flex items-center gap-2 py-1 px-2" style={{ paddingInlineStart: "40px" }}>
                <FileText size={13} style={{ flexShrink: 0, color: isDark ? dk.textMuted : c.iconGray }} />
                <span className="text-[12.5px] truncate min-w-0" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{name}</span>
                <span className="text-[11px] flex-shrink-0" style={{ color: metaCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>אינו בתיק</span>
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
                <span className="text-[11.5px] flex-shrink-0 tabular-nums" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="מספר נספח">{parentNum}{hebLetter(i)}׳</span>
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
      style={{ backgroundColor: panelBg, borderTop: `1px solid ${isDark ? dk.border : "#e3ebf5"}` }}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-1 px-2" style={{ paddingInlineStart: "34px" }}>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: titleCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
          <TitleIcon size={12} />
          {title}
          {meta && <><span style={{ opacity: 0.4 }}>·</span>{meta}</>}
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
      {preBody}
      {body}
    </div>
  );
}

// The full column order + which cells are shown, shared by DocRowCompact / NestedDocRow / the header so they stay aligned.
type ColMeta = { visible: Record<DocColKey, boolean>; pin: Record<string, number | undefined>; gapPx: number; docNumbers: Record<string, number>; minWidthType: number; minWidthNoType: number };
const COL_ORDER = ["checkbox", "num", "process", "date", "time", "sp", "name", "summary", "type", "submitter", "related", "attachments", "words"] as const;
const colShown = (key: string, cm: ColMeta, showType: boolean): boolean =>
  key === "checkbox" || key === "name" || key === "sp" ? true
  : key === "type" ? (cm.visible.type && showType)
  : !!cm.visible[key as DocColKey];
const pinCellStyle = (key: string, cm: ColMeta): React.CSSProperties | undefined =>
  cm.pin[key] !== undefined ? { position: "sticky", right: cm.pin[key], zIndex: 2, background: "var(--row-bg)" } : undefined;

// Dense table row — one line per document; columns come from `colMeta` (user-customizable, some pinned while scrolling).
function DocRowCompact({ doc, isDark, markNew, active, gridCols, colGap = "4px", colMeta, showType = true, showSelfInThread, lockProcess, processDocs, siblingDocs, openDocId, expandedKinds, onToggleExpand, onOpenDoc, onOpenAnyDoc, onToggleCheck, onToggleDocById, onSetChecked, attachmentSel, onToggleAttachment, onSetAttachments, rowRef }: { doc: CaseDoc; isDark: boolean; markNew?: boolean; active?: boolean; gridCols: string; colGap?: string; colMeta: ColMeta; showType?: boolean; showSelfInThread?: boolean; lockProcess?: boolean; processDocs?: CaseDoc[]; siblingDocs?: CaseDoc[]; openDocId?: string; expandedKinds?: ("related" | "attachments" | "process")[]; onToggleExpand?: (kind: "related" | "attachments" | "process") => void; onOpenDoc?: () => void; onOpenAnyDoc?: (doc: CaseDoc) => void; onToggleCheck: () => void; onToggleDocById?: (id: string) => void; onSetChecked?: (ids: string[], next: boolean) => void; attachmentSel?: Set<string>; onToggleAttachment?: (key: string) => void; onSetAttachments?: (keys: string[], next: boolean) => void; rowRef?: (el: HTMLDivElement | null) => void }) {
  const baseBg = isDark ? dk.input : "white";
  const activeBg = isDark ? "#212c42" : "#f1f6fd";
  // Which detail panels are open for this row (parallel — related / process / attachments can all be open at once).
  const openKinds = new Set(expandedKinds ?? []);
  const anyOpen = openKinds.size > 0;
  const hoverBg = isDark ? "#232c44" : (active || anyOpen ? "#e7f0fb" : "#f6f9ff");
  const metaCol = isDark ? dk.textMuted : c.textLight;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const partyName = doc.submitterName ?? (doc.caseId ? PARTY_NAMES[doc.caseId]?.[doc.submitter] : undefined);
  const typeC = TYPE_COLORS[doc.type] ?? { bg: isDark ? dk.input : "#eef1f4", color: isDark ? dk.textMuted : c.textGray };
  const attNames = doc.attachments ?? [];
  const attPicked = attNames.some((name) => !!attachmentSel?.has(attKey(doc.id, name)));
  const lit = active || anyOpen;
  const restBg = lit ? activeBg : baseBg;
  // Fixed stacking order for the open panels, and an accent color per kind (a colored right border so each labeled card reads distinctly).
  const PANEL_ORDER: ("process" | "related" | "attachments")[] = ["process", "related", "attachments"];
  const openPanels = PANEL_ORDER.filter((k) => openKinds.has(k));
  const PANEL_ACCENT: Record<string, string> = { process: "#6b62c9", related: c.primary, attachments: "#c1841f" };
  const toggle = (kind: "related" | "attachments" | "process") => (e: ReactMouseEvent) => { e.stopPropagation(); onToggleExpand?.(kind); };
  const num = colMeta.docNumbers[doc.id];

  const cellContent = (key: string) => {
    switch (key) {
      case "checkbox": return <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} /></span>;
      case "num":      return <span className="text-center w-full text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="מספר מסמך">{num ?? ""}</span>;
      case "date":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.time ? `${doc.date} ${doc.time}` : doc.date}>{doc.date}</span>;
      case "time":     return <span className="text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif" }} title="שעת הגשה">{doc.time ?? "—"}</span>;
      // Process — the id(s) as small numeric chips. Clickable (opens the thread) in the flat views; inside a type-view
      // process folder (lockProcess) the chips stay but are static — they still matter there to reveal that a doc is
      // linked to OTHER processes beyond the folder's own, but the thread isn't reopened (you're already in it).
      case "process":  return (
        <span className="min-w-0 flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
          {docProcessIds(doc).length > 0 && (lockProcess
            ? <ProcessChips ids={docProcessIds(doc)} isDark={isDark} />
            : <RowIconTrigger active={openKinds.has("process")} onClick={toggle("process")} title={`תהליך: ${processTitle(doc)}`} isDark={isDark}>
                <ProcessChips ids={docProcessIds(doc)} isDark={isDark} />
              </RowIconTrigger>)}
        </span>
      );
      case "name":     return (
        <span className="flex items-center gap-1.5 min-w-0" onClick={(e) => { e.stopPropagation(); onOpenDoc?.(); }} title="פתיחת המסמך לצפייה">
          <span className="doc-link truncate text-[12.5px] font-medium leading-tight" title={doc.name} style={{ fontFamily: "Noto Sans Hebrew, sans-serif", color: active ? c.primary : undefined, textDecoration: active ? "underline" : undefined, textDecorationColor: active ? c.primary : undefined, textUnderlineOffset: "2px", paddingBottom: "2px" }}>{doc.name}</span>
          {doc.used && <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="שימש בתשובת הצ׳אט האחרונה" />}
        </span>
      );
      case "summary":  return <span className="truncate text-[12.5px] min-w-0" title={doc.summary} style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</span>;
      case "type":     return <span className="min-w-0 flex"><span className="text-[11.5px] truncate rounded px-1.5 py-px" style={{ backgroundColor: typeC.bg, color: typeC.color, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={doc.type}>{doc.type}</span></span>;
      case "submitter":return <span className="text-[11.5px] truncate min-w-0" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={partyName ? `${doc.submitter} · ${partyName}` : doc.submitter}>{doc.submitter === "בית המשפט" ? "ביהמ״ש" : doc.submitter}</span>;
      case "related":  return (
        <span className="flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
          {doc.related.length > 0 && (
            <RowIconTrigger active={openKinds.has("related")} onClick={toggle("related")} title={`מסמכים קשורים (${doc.related.length})`} isDark={isDark}>
              <Link size={13} />
            </RowIconTrigger>
          )}
        </span>
      );
      case "attachments": return (
        <span className="flex justify-center w-full" onClick={(e) => e.stopPropagation()}>
          {(doc.attachments?.length ?? 0) > 0 && (
            <RowIconTrigger active={openKinds.has("attachments")} onClick={toggle("attachments")} title={`נספחים (${doc.attachments?.length})`} isDark={isDark} picked={attPicked}>
              <Paperclip size={13} />
            </RowIconTrigger>
          )}
        </span>
      );
      case "words":    return <span className="text-[11.5px] text-left w-full" style={doc.missing ? { color: "#d83a52", fontFamily: "Figtree, sans-serif" } : { color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.missing ? "המסמך ללא תוכן" : "מספר מילים"}>{doc.words}</span>;
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
        className="grid items-center px-2 py-1.5 cursor-pointer"
        style={{ gridTemplateColumns: gridCols, columnGap: colGap, ["--row-bg" as string]: restBg, backgroundColor: "var(--row-bg)" } as React.CSSProperties}
        title="פתיחת המסמך לצפייה"
        onClick={() => onOpenDoc?.()}
        onMouseEnter={(e) => { e.currentTarget.style.setProperty("--row-bg", hoverBg); }}
        onMouseLeave={(e) => { e.currentTarget.style.setProperty("--row-bg", restBg); }}
      >
        {COL_ORDER.filter((key) => colShown(key, colMeta, showType)).map((key) => (
          <div key={key} className="min-w-0 flex items-center h-full" style={pinCellStyle(key, colMeta)}>
            {cellContent(key)}
          </div>
        ))}
      </div>
      {/* Open detail panels stack as separate labeled cards (related / process / attachments can be open in parallel). */}
      {openPanels.map((kind) => (
        <RowDetail key={kind} kind={kind} accent={PANEL_ACCENT[kind]} doc={doc} processDocs={processDocs} siblingDocs={siblingDocs} gridCols={gridCols} colGap={colGap} colMeta={colMeta} showType={showType} showSelfInThread={showSelfInThread} openDocId={openDocId} isDark={isDark} onOpenDoc={onOpenAnyDoc} onClose={() => onToggleExpand?.(kind)} onToggleDocById={onToggleDocById} onSetChecked={onSetChecked} attachmentSel={attachmentSel} onToggleAttachment={onToggleAttachment} onSetAttachments={onSetAttachments} />
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
function DocumentPanelOpen({ isDark, panelWidth, isFocus, onToggleFocus, onSetWidth, onOpenDoc, onClosePanel, openDocId }: { isDark: boolean; panelWidth: number; isFocus?: boolean; onToggleFocus?: () => void; onSetWidth?: (w: number) => void; onOpenDoc?: (doc: CaseDoc) => void; onClosePanel?: () => void; openDocId?: string }) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Which detail panels are open — a Set of `${docId}::${kind}` so related / process / attachments can be open in
  // parallel (per user), across any rows. Each opens/closes independently from its own trigger or the card's × button.
  type PanelKind = "related" | "attachments" | "process";
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());
  const panelK = (id: string, kind: PanelKind) => `${id}::${kind}`;
  const togglePanel = (id: string, kind: PanelKind) => setOpenPanels((s) => { const n = new Set(s); const k = panelK(id, kind); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const openKindsFor = (id: string): PanelKind[] => (["process", "related", "attachments"] as PanelKind[]).filter((k) => openPanels.has(panelK(id, k)));
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
  const [docs, setDocs]           = useState<CaseDoc[]>(() => [
    ...CASE_DOCS.map((d) => ({ ...d, caseId: "c1", checked: true, used: false })),
    ...CASE_DOCS_2.map((d) => ({ ...d, caseId: "c2", checked: true })),
  ]);
  const [attachmentSel, setAttachmentSel] = useState<Set<string>>(new Set()); // chat-selected attachments (exhibits), keyed by `${docId}::${name}`
  // Customizable columns (persisted to localStorage) + the "columns" popover, and the per-case document numbers.
  const [visibleCols, setVisibleCols] = useState<Record<DocColKey, boolean>>(DOC_COL_DEFAULTS);
  const [colsMenuOpen, setColsMenuOpen] = useState(false);
  useEffect(() => { setVisibleCols(loadDocCols()); }, []); // hydrate from localStorage after mount (avoids SSR mismatch)
  const toggleCol = (k: DocColKey) => setVisibleCols((p) => { const next = { ...p, [k]: !p[k] }; try { window.localStorage.setItem(DOC_COLS_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const docNumbers = useMemo(() => buildDocNumbers(docs), [docs]);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null); // accordion — collapsed by default
  const [openType, setOpenType]     = useState<string | null>(null); // folder accordion (type view)
  const [openProcess, setOpenProcess] = useState<number | null>(null); // process sub-folder accordion, inside the "בקשות והוראות" type folder
  const [lens, setLens]             = useState<"all" | "new" | "pending">("all"); // status lens

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
  // checkbox · [num] · [date] · [time] · process · document · summary · [type] · submitter · icons · words.
  // The leading block (checkbox … name) is PINNED: it stays put while the rest scroll horizontally when the visible
  // columns don't fit. checkbox / name / icons are structural (always shown); the rest obey `visibleCols`.
  const roomy = isFocus || panelWidth >= 720;
  const gapPx = isFocus ? 8 : 4;
  const typeTrack = roomy ? "minmax(76px,92px)" : "minmax(34px,50px)";
  const submitterTrack = roomy ? "minmax(66px,78px)" : "minmax(56px,66px)";
  const COLS: { key: string; track: string; show: (st: boolean) => boolean; pinned: boolean; fixed?: number }[] = [
    { key: "checkbox",  track: "18px",                                                show: () => true,                     pinned: true, fixed: 18 },
    { key: "num",       track: "40px",                                                show: () => visibleCols.num,          pinned: true, fixed: 40 },
    { key: "process",   track: "34px",                                                show: () => visibleCols.process,      pinned: true, fixed: 34 },
    { key: "date",      track: "56px",                                                show: () => visibleCols.date,         pinned: true, fixed: 56 },
    { key: "time",      track: "48px",                                                show: () => visibleCols.time,         pinned: true, fixed: 48 },
    { key: "sp",        track: "5px",                                                 show: () => true,                     pinned: true, fixed: 5 },
    // Narrow: fr name/summary (so the default set fits with no scroll, matching the deployed layout); the px minima only
    // bite once extra columns are added → then it overflows and scrolls. Roomy keeps the capped name + flexible summary.
    { key: "name",      track: roomy ? "minmax(170px,240px)" : "minmax(120px,1.35fr)", show: () => true,                    pinned: true },
    { key: "summary",   track: roomy ? "minmax(150px,1fr)" : "minmax(120px,1.1fr)",   show: () => visibleCols.summary,      pinned: false },
    { key: "type",      track: typeTrack,                                             show: (st) => visibleCols.type && st, pinned: false },
    { key: "submitter", track: submitterTrack,                                        show: () => visibleCols.submitter,    pinned: false },
    { key: "related",   track: roomy ? "30px" : "26px",                               show: () => visibleCols.related,      pinned: false },
    { key: "attachments", track: roomy ? "30px" : "26px",                             show: () => visibleCols.attachments,  pinned: false },
    { key: "words",     track: roomy ? "minmax(36px,42px)" : "minmax(30px,36px)",     show: () => visibleCols.words,        pinned: false },
  ];
  const visCols = (showType: boolean) => COLS.filter((col) => col.show(showType));
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
  const colMeta: ColMeta = { visible: visibleCols, pin: pinMap, gapPx, docNumbers, minWidthType: tableMinWidth(true), minWidthNoType: tableMinWidth(false) };

  const sortHead = (key: "date" | "name" | "words" | "submitter" | "type" | "process", label: string, opts?: { center?: boolean; hideIcon?: boolean; alignLeft?: boolean }) => (
    <button onClick={() => toggleSort(key)} className={`flex items-center gap-0.5 h-full whitespace-nowrap hover:opacity-80 ${opts?.center ? "justify-center w-full" : ""} ${opts?.alignLeft ? "justify-end w-full" : ""}`} style={{ color: sortKey === key ? c.primary : (isDark ? dk.textMuted : c.textGray), fontFamily: "Noto Sans Hebrew, sans-serif" }} title={`מיון לפי ${label}`}>
      <span>{label}</span>
      {!opts?.hideIcon && sortKey === key && (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </button>
  );
  const headerCellContent = (key: string) => {
    switch (key) {
      case "checkbox": return <span />;
      case "num":      return <span className="text-center w-full" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }} title="מספר מסמך">מס׳</span>;
      case "date":     return sortHead("date", "תאריך");
      case "time":     return <span style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>שעה</span>;
      case "process":  return sortHead("process", "תהליך", { center: true, hideIcon: true });
      case "name":     return sortHead("name", "שם מסמך");
      case "summary":  return <span style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>תקציר</span>;
      case "type":     return sortHead("type", "סוג");
      case "submitter":return sortHead("submitter", "מגיש");
      case "related":  return (
        <button onClick={() => toggleSort("related")} title="מיון לפי מסמכים קשורים" className="flex items-center justify-center w-full h-full hover:opacity-80" style={{ color: sortKey === "related" ? c.primary : (isDark ? dk.textMuted : c.textGray) }}><Link size={13} /></button>
      );
      case "attachments": return (
        <button onClick={() => toggleSort("attachments")} title="מיון לפי נספחים" className="flex items-center justify-center w-full h-full hover:opacity-80" style={{ color: sortKey === "attachments" ? c.primary : (isDark ? dk.textMuted : c.textGray) }}><Paperclip size={13} /></button>
      );
      case "words":    return sortHead("words", "מילים", { alignLeft: true });
      default:         return <span />;
    }
  };
  const makeTableHeader = (showType: boolean) => (
    <div className="grid items-center px-2 h-8 pb-1 sticky top-0 z-20 text-[12.5px] font-medium" style={{ gridTemplateColumns: tableTemplate(showType), columnGap: `${gapPx}px`, minWidth: `${tableMinWidth(showType)}px`, backgroundColor: bg, borderBottom: `1px solid ${isDark ? dk.border : "#e3ebf5"}`, color: isDark ? dk.textMuted : c.textGray }} dir="rtl">
      {visCols(showType).map((col) => (
        <div key={col.key} className="min-w-0 flex items-center h-full" style={pinMap[col.key] !== undefined ? { position: "sticky", right: pinMap[col.key], zIndex: 21, backgroundColor: bg } : undefined}>
          {headerCellContent(col.key)}
        </div>
      ))}
    </div>
  );
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

  // A document matches the active top filters (type / submitter / date / search) — case-agnostic
  const matchesFilters = (d: CaseDoc) =>
    (activeType === "הכל" || d.type === activeType) &&
    (activeSubmitter === "הכל" || d.submitter === activeSubmitter) &&
    (!dateFrom || d.iso >= dateFrom) &&
    (!dateTo || d.iso <= dateTo) &&
    (search.trim() === "" || d.name.includes(search.trim()) || d.summary.includes(search.trim()));
  // Full active predicate (filters + the "pending" lens) — used for the per-case match count
  const matchesActive = (d: CaseDoc) => matchesFilters(d) && (lens !== "pending" || d.pending);
  // Is any filter currently narrowing the view? (drives the per-case "N matches" indicator)
  const filterActive =
    activeType !== "הכל" || activeSubmitter !== "הכל" || !!dateFrom || !!dateTo || search.trim() !== "" || lens === "pending";
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
  const lensed = filteredSorted.filter((d) => lens === "all" || (lens === "pending" && d.pending));
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

  // ממתין להחלטה — task-oriented lens. Lives inline on the top row while on the case list; moves into the filter row once a case is open.
  const pendingBtn = (
    <button
      onClick={() => setLens((l) => (l === "pending" ? "all" : "pending"))}
      className="flex items-center gap-1 h-8 px-2.5 rounded-md text-[13px] transition-colors whitespace-nowrap flex-shrink-0"
      style={{
        border: `1px solid ${lens === "pending" ? c.primary : (isDark ? dk.border : c.border)}`,
        color: lens === "pending" ? c.primary : (isDark ? dk.textMuted : c.textGray),
        backgroundColor: lens === "pending" ? (isDark ? "#22304a" : "#eff4ff") : (isDark ? dk.input : "white"),
        fontFamily: "Noto Sans Hebrew, sans-serif",
      }}
      title="הצג רק מסמכים הממתינים להחלטה"
    >
      <Gavel size={13} style={{ transform: "scaleX(-1)" }} />
      ממתין להחלטה
    </button>
  );

  // View toggle — chrono / group-by-type. Shown both on the case list and inside an open case, so the control set stays
  // consistent; on the list it just sets the preference that takes effect once a case is opened.
  const viewToggle = (
    <div className="flex items-center h-8 rounded-md overflow-hidden flex-shrink-0" style={{ border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}` }}>
      <button
        onClick={() => setGrouping("chrono")}
        className="h-full w-7 flex items-center justify-center transition-colors"
        style={{ backgroundColor: grouping === "chrono" ? (isDark ? "#22304a" : "#eaf2fd") : "transparent", color: grouping === "chrono" ? c.primary : (isDark ? dk.textMuted : c.textGray) }}
        title="תצוגה כרונולוגית"
      >
        <Clock size={15} />
      </button>
      <button
        onClick={() => { setGrouping("type"); setOpenType(null); }}
        className="h-full w-7 flex items-center justify-center transition-colors"
        style={{ backgroundColor: grouping === "type" ? (isDark ? "#22304a" : "#eaf2fd") : "transparent", color: grouping === "type" ? c.primary : (isDark ? dk.textMuted : c.textGray), borderInlineStart: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}` }}
        title="קיבוץ המסמכים לפי סוג"
      >
        <FolderOpen size={15} />
      </button>
    </div>
  );

  // Column customization — a borderless vertical-ellipsis (⋮) button pushed to the far (left) end so it reads as its own
  // control, distinct from the chrono/type view toggle. The checklist popover is LEFT-aligned to the button (left:0,
  // opens rightward): the button sits at the left edge, and in the expanded/full-width table right-aligning would push
  // the popover off the left side of the screen.
  const columnsBtn = (
    <div className="relative flex-shrink-0" style={{ marginInlineStart: "auto" }}>
      <button
        onClick={() => setColsMenuOpen((v) => !v)}
        title="התאמת עמודות"
        className="size-8 flex items-center justify-center rounded-md transition-colors"
        style={{ color: colsMenuOpen ? c.primary : (isDark ? dk.textMuted : c.iconGray), backgroundColor: colsMenuOpen ? (isDark ? "#22304a" : "#eff4ff") : "transparent" }}
        onMouseEnter={(e) => { if (!colsMenuOpen) e.currentTarget.style.backgroundColor = isDark ? dk.border : c.hoverBg; }}
        onMouseLeave={(e) => { if (!colsMenuOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <MoreVertical size={18} />
      </button>
      {colsMenuOpen && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setColsMenuOpen(false)} />
          <div className="absolute z-[200] rounded-lg overflow-hidden" style={{ top: "calc(100% + 4px)", left: 0, width: "212px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }} dir="rtl">
            <div className="px-3 py-2 text-[12px] font-semibold" style={{ color: isDark ? dk.textMuted : c.textGray, borderBottom: `1px solid ${isDark ? dk.border : "#eef1f4"}`, fontFamily: "Noto Sans Hebrew, sans-serif" }}>עמודות בטבלה</div>
            <div className="py-1">
              {DOC_COL_ORDER.map((k) => (
                <div key={k} className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 cursor-pointer" onClick={() => toggleCol(k)}>
                  <CheckboxBlue checked={visibleCols[k]} onToggle={() => {}} />
                  <span className="text-[13px]" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{DOC_COL_LABELS[k]}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bg, "--doc-link-color": isDark ? dk.text : "#323338", "--doc-link-hover": isDark ? "#5aa2ef" : "#0073ea" } as any}>
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
                {pendingBtn}
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
                  <FilterDropdown label="סוג" value={activeType} options={TYPE_OPTIONS} onChange={setActiveType} searchable isDark={isDark} />
                  <FilterDropdown label="מגיש" value={activeSubmitter} options={SUBMITTER_OPTIONS} onChange={setActiveSubmitter} subLabels={openCaseId ? PARTY_NAMES[openCaseId] : undefined} isDark={isDark} />
                  <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} isDark={isDark} />
                </>
              )}

              {/* Inside an open case ממתין joins the filter row (on the case list it lives up on Row A instead) */}
              {openCaseId && pendingBtn}

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

              {/* View toggle — chrono / group-by-type (inside an open case it lives here on the filter row) */}
              {openCaseId && viewToggle}
              {/* Column customization — only meaningful once a case (and its table) is open */}
              {openCaseId && columnsBtn}
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
          const caseUsed = caseDocs.some((d) => d.used);
          const caseMatch = filterActive ? caseDocs.filter(matchesActive).length : null; // # of docs matching the active filter (null when no filter)
          const caseWords = caseDocs.reduce((sum, d) => sum + parseWords(d.words), 0); // total words across the case's documents
          return (
            <div key={cf.id} className="flex flex-col">
              {/* Case header — typography for emphasis + a neutral structural underline that ties the title to the edge-aligned chevron at any width */}
              <div className="flex items-start gap-2 px-2 py-3 transition-opacity" style={{ borderBottom: `1px solid ${isDark ? dk.border : "#dde3ee"}`, opacity: caseMatch === 0 ? 0.5 : 1 }}>
                <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                  <CheckboxBlue checked={caseAllOn} onToggle={() => toggleCaseAll(cf.id, !caseAllOn)} />
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
                            title="מסמכים בתיק זה התואמים לסינון הפעיל"
                          >
                            {caseMatch === 0 ? "אין תואמים" : `${caseMatch} ${caseMatch === 1 ? "תואם" : "תואמים"}`}
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
              <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(true)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} processDocs={docThread(doc)} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id)} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
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
              const typeWords = formatWords(typeDocs.reduce((sum, d) => sum + parseWords(d.words), 0));
              const typeUsed = typeDocs.some((d) => d.used);
              return (
                <div key={type} className="flex flex-col" style={ti > 0 ? { borderTop: `1px solid ${isDark ? dk.border : "#eef1f4"}` } : undefined}>
                  <div className="flex items-center gap-2 px-2 pt-2.5 pb-1.5">
                    <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={allOn} onToggle={() => toggleTypeAll(type, !allOn)} /></span>
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
                          return (
                            <div key={pid} className="flex flex-col" style={{ borderTop: `1px solid ${isDark ? dk.border : "#eef1f4"}` }}>
                              <div className="flex items-center gap-2 py-1.5" style={{ paddingInlineStart: "28px", paddingInlineEnd: "8px" }}>
                                <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><CheckboxBlue checked={pAllOn} onToggle={() => setDocs((p) => p.map((d) => (docProcessIds(d).includes(pid) ? { ...d, checked: !pAllOn } : d)))} /></span>
                                <button onClick={() => setOpenProcess((o) => (o === pid ? null : pid))} className="flex items-center gap-1.5 flex-1 min-w-0 text-right" title={pOpen ? "כיווץ" : "פתיחה"}>
                                  <span className="text-[13px] font-medium truncate" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
                                    <span style={{ fontFamily: "Figtree, sans-serif" }}>{pid}</span> — {processLabel(openCaseId, pid)} <span style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }}>({pDocs.length})</span>
                                  </span>
                                  <span className="flex-1" />
                                  <ChevronDown size={15} style={{ color: c.iconGray, flexShrink: 0, transition: "transform 0.15s", transform: pOpen ? "rotate(180deg)" : "none" }} />
                                </button>
                              </div>
                              {pOpen && pDocs.map((doc) => (
                                <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(false)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} showType={false} showSelfInThread={false} lockProcess processDocs={processDocsById[pid]} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id).filter((k) => k !== "process")} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
                              ))}
                            </div>
                          );
                        })}
                        {noProcess.map((doc) => (
                          <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(false)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} showType={false} showSelfInThread={false} processDocs={undefined} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id)} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
                        ))}
                      </>
                    );
                  })() : open && sortDocs(typeDocs).map((doc) => (
                    <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} gridCols={tableTemplate(false)} colGap={isFocus ? "8px" : "4px"} colMeta={colMeta} showType={false} showSelfInThread={false} processDocs={docThread(doc)} siblingDocs={caseDocs} openDocId={openDocId} expandedKinds={openKindsFor(doc.id)} onToggleExpand={(kind) => togglePanel(doc.id, kind)} onOpenDoc={() => onOpenDoc?.(doc)} onOpenAnyDoc={onOpenDoc} onToggleCheck={() => toggleDoc(doc.id)} onToggleDocById={toggleDoc} onSetChecked={setDocsChecked} attachmentSel={attachmentSel} onToggleAttachment={toggleAttachment} onSetAttachments={setAttachmentsSelected} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
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

function ChatArea({ isDark, conversationKey, barMode, overDoc, onEmptyChange, onEnlarge, onDock, onDragStart }: { isDark: boolean; conversationKey: number; barMode?: boolean; overDoc?: boolean; onEmptyChange?: (isEmpty: boolean) => void; onEnlarge?: () => void; onDock?: () => void; onDragStart?: (e: ReactMouseEvent) => void }) {
  const [showCitations, setShowCitations] = useState(true);
  const [chatSubject, setChatSubject] = useState<"case" | "doc">("case"); // scope: whole case vs the open document — shown as a toggle above the input
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

  // ── Input box (shared between empty and normal state) ──────────────────
  function renderInput() {
    // Over the document (floating window): a single-row input with just a send button — no scope / citations / case chip.
    if (overDoc) {
      return (
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
            {overDoc ? (
              // Over the document: a scope toggle sits right above the input.
              <div className="flex items-center gap-2 flex-wrap" dir="rtl">
                <span className="text-[13px] flex-shrink-0" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif" }}>שיחה עם</span>
                <div className="flex items-center rounded-md overflow-hidden" style={{ border: `1px solid ${isDark ? dk.border : c.border}` }}>
                  {([["case", "התיק"], ["doc", "מסמך זה"]] as const).map(([val, label], i) => {
                    const sel = chatSubject === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setChatSubject(val)}
                        className="h-[26px] px-3 text-[13px]"
                        style={{ backgroundColor: sel ? (isDark ? "#22304a" : c.primaryLight) : "transparent", color: sel ? c.primary : (isDark ? dk.textMuted : c.textGray), fontWeight: sel ? 500 : 400, fontFamily: "Noto Sans Hebrew, sans-serif", borderInlineStart: i > 0 ? `1px solid ${isDark ? dk.border : c.border}` : "none" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p
                className="text-right text-[22px] font-medium mb-2"
                style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
              >
                שלום, אפרת. במה אוכל לעזור?
              </p>
            )}
            {renderInput()}
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
          <div className="w-full max-w-[768px] min-w-0">
            {renderInput()}
            {renderDisclaimer()}
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
            <div className="size-7 rounded-full flex items-center justify-center text-white text-[13px] flex-shrink-0 select-none" style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}>אש</div>
            <div className="flex flex-col leading-tight text-right">
              <span className="text-[13px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}>אפרת שפילמן</span>
            </div>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              className="absolute top-full mt-1 left-0 rounded-lg py-1 z-50"
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
  const [openDoc, setOpenDoc] = useState<CaseDoc | null>(null);
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
  const closeDoc = () => { setOpenDoc(null); setDocExpanded(false); setReadingDocW(null); setChatCollapsed(true); setChatPos(null); };
  // New conversation, chat only — keep the working context (table + open document) so the user can start fresh in place.
  const newChat = () => { setConvKey((k) => k + 1); };
  // Full reset (logo) — back to the clean opening screen: fresh chat + close panel, document and any reading/dock state.
  const resetAll = () => { setConvKey((k) => k + 1); setIsPanelOpen(false); setFocusDocs(false); setOpenDoc(null); setDocExpanded(false); setReadingDocW(null); setChatPos(null); setChatCollapsed(true); };
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
            <ChatArea isDark={isDark} conversationKey={convKey} barMode={chatBar} overDoc={chatFloating && !!openDoc} onEmptyChange={(e) => { if (!e) setChatCollapsed(false); }} onEnlarge={() => setChatCollapsed(false)} onDock={dockChat} onDragStart={startChatDrag} />
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
              <DocumentPanelOpen isDark={isDark} panelWidth={focusDocs ? vw - 72 : (readingMode ? Math.max(400, vw - readingW - 60) : panelWidth)} isFocus={focusDocs} onToggleFocus={() => setFocusDocs((v) => !v)} onSetWidth={setPanelWidth} onOpenDoc={(doc) => { setFocusDocs(false); setOpenDoc(doc); }} onClosePanel={closePanel} openDocId={openDoc?.id} />
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
