"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronUp,
  Clock, Copy, Eye, EyeClosed, FileText, Files, FolderOpen,
  HelpCircle, Info, Layers, Link, Sparkles, Microscope, Minimize2,
  Moon, MoreHorizontal, Plus, Quote, RotateCw, Search, Shield,
  Split, Sun, ThumbsDown, ThumbsUp, Zap,
  Calendar, ExternalLink, Check, Key, Gavel, Maximize2, X, Rows3, LayoutGrid, List, Table,
  type LucideIcon,
} from "lucide-react";

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
  return <img src="/studioOS/logo.png" alt="לוגו" className="h-[30px] w-auto" />;
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

// ── Scope selector ────────────────────────────────────────────────────────
type ScopeOption = "תמציתי" | "מורחב" | "מקיף";
const SCOPE_ORDER: ScopeOption[] = ["תמציתי", "מורחב", "מקיף"];
const SCOPE_CONFIG: Record<ScopeOption, { desc: string; Icon: LucideIcon }> = {
  "תמציתי": { desc: "היקף ממוקד, מענה מהיר לרוב השאלות",       Icon: Zap },
  "מורחב":  { desc: "היקף רחב יותר, לשאלות הדורשות הקשר נוסף",  Icon: Layers },
  "מקיף":   { desc: "בחינה מעמיקה של המסמכים, מומלץ לניתוח יסודי", Icon: Microscope },
};
const SCOPE_TOOLTIP = "היקף התוכן מהמסמכים הנבחרים שישולב בתשובה. ככל שההיקף קטן יותר, התשובה מהירה יותר.";

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
  processLabel?: string; // short topic name for the process — shown in the process badge's tooltip
}

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
    date: "02.06.26", time: "09:14", iso: "2026-06-02", bucket: "today", words: "1.1K",
    summary: "הנתבע מבקש לדחות את מועד הדיון הקבוע ל-21.6 בשל היעדרות מומחה מרכזי מהארץ, ומציע מועד חלופי בחודש יולי. התובע מתנגד לבקשה.",
    related: ["פרוטוקול דיון מקדמי", "החלטה בבקשת ארכה"], checked: false,
    isNew: true, pending: true, file: "/studioOS/docs/motion-1.pdf", processId: 1, processLabel: "דחיית מועד דיון",
  },
  {
    id: "d2", name: "תצהיר עדות ראשית — ד״ר לוי", type: "תצהירים", submitter: "תובע", submitterName: "יעקב אברמוב",
    date: "31.05.26", time: "16:40", iso: "2026-05-31", bucket: "week", words: "8.4K",
    summary: "תצהיר מומחה רפואי מטעם התובע הקובע קשר סיבתי בין הרשלנות הנטענת לנזק, ומפרט נכות צמיתה בשיעור 25%.",
    related: ["חוות דעת אקטוארית", "כתב תביעה", "פרוטוקול דיון מקדמי", "החלטה על מינוי מומחה"], checked: true, used: true, isNew: true,
    key: true, keyReason: "מסמך מרכזי — תצהיר מומחה שעליו נשענת התביעה; מסמכים נוספים מפנים אליו", file: "/studioOS/docs/affidavit-1.pdf",
  },
  {
    id: "d3", name: "תגובה לבקשת ארכה", type: "בקשות והוראות", submitter: "תובע",
    date: "29.05.26", time: "11:05", iso: "2026-05-29", bucket: "week", words: "640",
    summary: "התובע מתנגד לבקשת הארכה וטוען כי מדובר בניסיון לסחבת; לחלופין מבקש כי הדחייה תותנה בהוצאות.",
    related: ["בקשה לדחיית מועד דיון"], checked: false, file: "/studioOS/docs/motion-2.pdf", processId: 1, processLabel: "דחיית מועד דיון",
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
    date: "10.05.26", iso: "2026-05-10", bucket: "month", words: "12.1K",
    summary: "הנתבע דוחה את כל טענות הרשלנות, טוען להעדר קשר סיבתי ולאשם תורם של התובע, ומעלה טענת התיישנות חלקית.",
    related: ["כתב תביעה", "תצהיר עדות ראשית — ד״ר לוי"], checked: false, file: "/studioOS/docs/defense-1.pdf",
  },
  {
    id: "d6", name: "החלטה על מינוי מומחה", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "05.05.26", iso: "2026-05-05", bucket: "month", words: "820",
    summary: "בית המשפט ממנה את פרופ׳ זילברשטיין כמומחה מטעמו לבחינת שאלת הנכות, וקובע את חלוקת שכר הטרחה בין הצדדים.",
    related: ["פרוטוקול דיון מקדמי"], checked: false, file: "/studioOS/docs/decision-1.pdf", processId: 2, processLabel: "מינוי מומחה וחוות דעת",
  },
  {
    id: "d7", name: "כתב תביעה", type: "כתבי טענות", submitter: "תובע",
    date: "12.02.26", iso: "2026-02-12", bucket: "older", words: "15.7K",
    summary: "התובע, מר יעקב אברמוב, הגיש כתב תביעה כנגד הנתבע בגין רשלנות רפואית לכאורה בטיפול שניתן לו, בעקבותיו נגרמו נזקי גוף.",
    related: ["כתב הגנה מתוקן"], checked: false, file: "/studioOS/docs/claim-1.pdf",
  },
  {
    id: "d8", name: "חוות דעת אקטוארית", type: "חוות דעת", submitter: "תובע",
    date: "20.01.26", iso: "2026-01-20", bucket: "older", words: "3.6K",
    summary: "חישוב הפסדי השתכרות לעבר ולעתיד על בסיס הנכות הנטענת, בצירוף הפסדי פנסיה וזכויות סוציאליות.",
    related: ["תצהיר עדות ראשית — ד״ר לוי"], checked: false, file: "/studioOS/docs/expert-opinion-1.pdf",
  },
  {
    id: "d9", name: "הודעה על הגשת ראיות נוספות", type: "בקשות והוראות", submitter: "תובע",
    date: "02.06.26", time: "13:20", iso: "2026-06-02", bucket: "today", words: "420",
    summary: "התובע מודיע על כוונתו להגיש תיעוד רפואי עדכני שהצטבר לאחר הגשת התצהירים. הנתבע טרם הגיב.",
    related: ["תצהיר עדות ראשית — ד״ר לוי"], checked: false, file: "/studioOS/docs/motion-3.pdf", processId: 3, processLabel: "הגשת ראיות נוספות",
  },
  {
    id: "d10", name: "בקשה לזימון עד", type: "בקשות והוראות", submitter: "נתבע",
    date: "30.05.26", iso: "2026-05-30", bucket: "week", words: "0",
    summary: "המסמך טרם עובד — אין תקציר זמין.",
    related: [], checked: false, missing: true,
  },
  {
    id: "d11", name: "תצהיר עדות — גב' רוזן", type: "תצהירים", submitter: "נתבע",
    date: "28.05.26", iso: "2026-05-28", bucket: "week", words: "6.2K",
    summary: "תצהיר עדה מטעם הנתבע בנוגע לנסיבות מתן הטיפול ולנהלים שהיו נהוגים במחלקה.",
    related: ["כתב הגנה מתוקן"], checked: false, file: "/studioOS/docs/affidavit-2.pdf",
  },
  {
    id: "d12", name: "החלטה בבקשת ארכה", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "27.05.26", iso: "2026-05-27", bucket: "week", words: "390",
    summary: "בית המשפט נעתר חלקית לבקשת הארכה ומאריך את המועד להגשת סיכומים ב-14 יום.",
    related: ["בקשה לדחיית מועד דיון", "תגובה לבקשת ארכה"], checked: false, file: "/studioOS/docs/decision-2.pdf",
  },
  {
    id: "d13", name: "פרוטוקול ישיבת קדם משפט", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "15.05.26", iso: "2026-05-15", bucket: "month", words: "5.8K",
    summary: "תיעוד ישיבת קדם המשפט, לרבות עמדות הצדדים והחלטות ביניים בנוגע לגילוי מסמכים.",
    related: ["פרוטוקול דיון מקדמי"], checked: false, file: "/studioOS/docs/protocol-2.pdf",
  },
  {
    id: "d14", name: "בקשה לגילוי מסמכים", type: "בקשות והוראות", submitter: "תובע",
    date: "12.05.26", iso: "2026-05-12", bucket: "month", words: "1.4K",
    summary: "התובע מבקש לחייב את הנתבע בגילוי רשומות רפואיות מלאות ויומני ניתוח רלוונטיים. הנתבע מתנגד חלקית לבקשה.",
    related: ["כתב תביעה"], checked: false, file: "/studioOS/docs/motion-4.pdf", processId: 4, processLabel: "גילוי מסמכים",
  },
  {
    id: "d15", name: "תגובה לבקשת גילוי מסמכים", type: "בקשות והוראות", submitter: "נתבע",
    date: "14.05.26", iso: "2026-05-14", bucket: "month", words: "980",
    summary: "הנתבע מתנגד חלקית לגילוי וטוען לחיסיון רפואי ולחוסר רלוונטיות של חלק מהמסמכים.",
    related: ["בקשה לגילוי מסמכים"], checked: false, file: "/studioOS/docs/motion-1.pdf", processId: 4, processLabel: "גילוי מסמכים",
  },
  {
    id: "d16", name: "חוות דעת מומחה מטעם בית המשפט בשאלת הנכות הרפואית והקשר הסיבתי לאירוע", type: "חוות דעת", submitter: "בית המשפט",
    date: "08.05.26", iso: "2026-05-08", bucket: "month", words: "9.7K",
    summary: "חוות דעת המומחה שמונה מטעם בית המשפט, הקובעת נכות בשיעור 18% וקשר סיבתי חלקי.",
    related: ["החלטה על מינוי מומחה"], checked: false, file: "/studioOS/docs/expert-opinion-2.pdf", processId: 2, processLabel: "מינוי מומחה וחוות דעת",
  },
  {
    id: "d17", name: "כתב תביעה שכנגד", type: "כתבי טענות", submitter: "נתבע",
    date: "03.03.26", iso: "2026-03-03", bucket: "older", words: "8.9K",
    summary: "הנתבע מגיש תביעה שכנגד בטענה להוצאות שנגרמו לו עקב הגשת התביעה בחוסר תום לב.",
    related: ["כתב תביעה", "כתב הגנה מתוקן"], checked: false, file: "/studioOS/docs/claim-2.pdf", processId: 5, processLabel: "תביעה שכנגד",
  },
  {
    id: "d18", name: "כתב הגנה לתביעה שכנגד", type: "כתבי טענות", submitter: "תובע",
    date: "20.03.26", iso: "2026-03-20", bucket: "older", words: "4.1K",
    summary: "התובע דוחה את הטענות בתביעה שכנגד וטוען כי התביעה הוגשה בתום לב ועל בסיס ראיות.",
    related: ["כתב תביעה שכנגד"], checked: false, file: "/studioOS/docs/defense-2.pdf", processId: 5, processLabel: "תביעה שכנגד",
  },
  {
    id: "d19", name: "החלטה על איחוד דיון", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "25.03.26", iso: "2026-03-25", bucket: "older", words: "640",
    summary: "בית המשפט מורה על איחוד הדיון בתביעה ובתביעה שכנגד לשם יעילות דיונית.",
    related: ["כתב תביעה שכנגד"], checked: false, file: "/studioOS/docs/decision-3.pdf", processId: 5, processLabel: "תביעה שכנגד",
  },
  {
    id: "d20", name: "פרוטוקול דיון הוכחות ראשון", type: "פרוטוקולים", submitter: "בית המשפט",
    date: "10.04.26", iso: "2026-04-10", bucket: "older", words: "11.2K",
    summary: "תיעוד דיון ההוכחות הראשון, לרבות חקירת התובע ועד מטעמו וטענות הצדדים.",
    related: ["פרוטוקול ישיבת קדם משפט"], checked: false, file: "/studioOS/docs/protocol-1.pdf",
  },
  {
    id: "d21", name: "סיכומי התובע", type: "כתבי טענות", submitter: "תובע",
    date: "18.04.26", iso: "2026-04-18", bucket: "older", words: "7.3K",
    summary: "סיכומי התובע המסכמים את הראיות וטוענים לאחריות מלאה של הנתבע לנזקים שנגרמו.",
    related: [], checked: false, file: "/studioOS/docs/claim-1.pdf",
  },
  {
    id: "d22", name: "החלטה על הגשת תיעוד נוסף", type: "החלטות בתיק", submitter: "בית המשפט",
    date: "01.06.26", iso: "2026-06-01", bucket: "week", words: "300",
    summary: "בית המשפט מתיר הגשת תיעוד רפואי עדכני בכפוף למתן זכות תגובה לנתבע.", processId: 3, processLabel: "הגשת ראיות נוספות",
    related: ["הודעה על הגשת ראיות נוספות"], checked: false, file: "/studioOS/docs/decision-4.pdf",
  },
];

// Second case (mock) — documents for a different file
const CASE_DOCS_2: CaseDoc[] = [
  { id: "e1", name: "כתב תביעה", type: "כתבי טענות", submitter: "תובע", date: "29.05.26", iso: "2026-05-29", bucket: "week", words: "9.8K",
    summary: "תביעה כספית בגין הפרת חוזה בנייה ואיחור במסירת דירות לרוכשים.", related: [], checked: false, file: "/studioOS/docs/claim-1.pdf" },
  { id: "e2", name: "בקשה לסעד זמני", type: "בקשות והוראות", submitter: "תובע", date: "31.05.26", iso: "2026-05-31", bucket: "week", words: "1.2K",
    summary: "בקשה לצו מניעה זמני שימנע העברת זכויות בפרויקט עד להכרעה בתיק. הנתבע מתנגד לבקשה.", related: [], checked: false, file: "/studioOS/docs/motion-2.pdf", processId: 6, processLabel: "בקשה לסעד זמני" },
  { id: "e3", name: "כתב הגנה", type: "כתבי טענות", submitter: "נתבע", date: "15.04.26", iso: "2026-04-15", bucket: "older", words: "7.1K",
    summary: "הנתבע טוען לעיכובים מצד התובע ולכוח עליון שמנע עמידה בלוחות הזמנים.", related: ["כתב תביעה"], checked: false, file: "/studioOS/docs/defense-1.pdf" },
  { id: "e4", name: "החלטה בבקשת סעד זמני", type: "החלטות בתיק", submitter: "בית המשפט", date: "01.06.26", iso: "2026-06-01", bucket: "week", words: "540",
    summary: "בית המשפט נעתר חלקית ומורה על רישום הערת אזהרה עד לדיון.", related: ["בקשה לסעד זמני"], checked: false, used: true, file: "/studioOS/docs/decision-5.pdf", processId: 6, processLabel: "בקשה לסעד זמני" },
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

// Column-table row: "document" column (name + summary) + aligned meta columns (date · type · submitter · words).
function DocRowCompact({ doc, isDark, markNew, active, showTime, gridCols, compact, onOpenDoc, onToggleCheck, rowRef }: { doc: CaseDoc; isDark: boolean; markNew?: boolean; active?: boolean; showTime?: boolean; gridCols: string; compact?: boolean; onOpenDoc?: () => void; onToggleCheck: () => void; rowRef?: (el: HTMLDivElement | null) => void }) {
  const baseBg = isDark ? dk.input : "white"; // "new" is shown via a bold summary only (see below)
  const activeBg = isDark ? "#212c42" : "#f1f6fd";
  const metaCol = isDark ? dk.textMuted : c.textLight;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const partyName = doc.submitterName ?? (doc.caseId ? PARTY_NAMES[doc.caseId]?.[doc.submitter] : undefined);
  const typeC = TYPE_COLORS[doc.type] ?? { bg: isDark ? dk.input : "#eef1f4", color: isDark ? dk.textMuted : c.textGray };
  return (
    <div
      ref={rowRef}
      className="relative cursor-pointer transition-colors"
      style={{ borderBottom: `1px solid ${isDark ? dk.border : "#eef1f4"}`, backgroundColor: active ? activeBg : baseBg }}
      dir="rtl"
      title={compact ? `${doc.type} · ${doc.submitter === "בית המשפט" ? "ביהמ״ש" : doc.submitter}${partyName ? ` (${partyName})` : ""} · ${doc.words} מילים — פתיחה לצפייה` : "פתיחת המסמך לצפייה"}
      onClick={onOpenDoc}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? "#232c44" : (active ? "#e7f0fb" : "#f6f9ff"); }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? activeBg : baseBg; }}
    >
      {active && <span className="absolute inset-y-0" style={{ insetInlineStart: 0, width: "3px", backgroundColor: c.primary }} />}
      <div className="grid items-start gap-2 px-2 py-2.5" style={{ gridTemplateColumns: gridCols }}>
        <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0" style={{ marginTop: "2px" }}><CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} /></span>
        {/* Date (+ time) — to the right of the document column; nudged to sit on the name's line */}
        <span className="flex flex-col leading-tight text-right text-[12px]" style={{ color: metaCol, fontFamily: "Figtree, sans-serif", marginTop: "3px" }}>
          <span>{doc.date}</span>
          {showTime && doc.time && <span className="mt-0.5">{doc.time}</span>}
        </span>
        {/* Document — name (anchor) + full summary below */}
        <span className="flex flex-col min-w-0 gap-1">
          <span className="flex items-center gap-2 min-w-0">
            <span className="doc-link truncate text-[15px] font-semibold leading-tight" title={doc.name} style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.name}</span>
            {doc.used && <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="שימש בתשובת הצ׳אט האחרונה" />}
          </span>
          <span className="text-[13px] leading-snug" style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</span>
          {compact && (
            <span className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px]" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              <span className="rounded px-1.5 py-px" style={{ backgroundColor: typeC.bg, color: typeC.color }}>{doc.type}</span>
              <span style={{ opacity: 0.55 }}>·</span>
              <span title={partyName ? `${doc.submitter} · ${partyName}` : doc.submitter}>{doc.submitter === "בית המשפט" ? "ביהמ״ש" : doc.submitter}</span>
              {doc.processId != null && (
                <>
                  <span style={{ opacity: 0.55 }}>·</span>
                  <span className="rounded px-1 py-px" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={doc.processLabel ? `תהליך: ${doc.processLabel}` : undefined}>{`תהליך ${doc.processId}`}</span>
                </>
              )}
              <span style={{ opacity: 0.55 }}>·</span>
              <span style={{ fontFamily: "Figtree, sans-serif" }} title="מספר מילים">{doc.words}</span>
            </span>
          )}
        </span>
        {!compact && (
          <>
            {/* Type tag */}
            <span className="min-w-0 flex"><span className="text-[12px] truncate rounded px-1.5 py-px" style={{ backgroundColor: typeC.bg, color: typeC.color, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={doc.type}>{doc.type}</span></span>
            {/* Submitter — short role (full name in tooltip); court abbreviated to save space */}
            <span className="text-[12px] truncate min-w-0" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }} title={partyName ? `${doc.submitter} · ${partyName}` : doc.submitter}>{doc.submitter === "בית המשפט" ? "ביהמ״ש" : doc.submitter}</span>
            {/* Process — badge with the topic in the tooltip; before the words column */}
            <span className="text-[12px] truncate min-w-0" style={{ color: subCol, fontFamily: "Figtree, sans-serif" }} title={doc.processLabel ? `תהליך: ${doc.processLabel}` : undefined}>{doc.processId != null ? `#${doc.processId}` : ""}</span>
            {/* Words */}
            <span className="text-[12px] text-right" style={doc.missing ? { color: "#d83a52", fontFamily: "Figtree, sans-serif" } : { color: metaCol, fontFamily: "Figtree, sans-serif" }} title={doc.missing ? "המסמך ללא תוכן" : "מספר מילים"}>{doc.words}</span>
          </>
        )}
      </div>
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
      </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 flex-shrink-0" style={{ height: "52px", backgroundColor: isDark ? dk.surface : "#f1f3f7", borderBottom: `1px solid ${isDark ? dk.border : "#e2e6ee"}` }}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={17} style={{ color: iconCol, flexShrink: 0 }} />
          <span className="truncate text-[14px] font-medium" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.name}</span>
          <span className="text-[12px] flex-shrink-0" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }}>{doc.date}{doc.time ? ` · ${doc.time}` : ""}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {canExpand && (
            <button onClick={onToggleExpand} title={expanded ? "החזרת תצוגת עמודות" : "הרחבת המסמך (הצ׳אט יהפוך למרחף)"} className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: iconCol }}>
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {doc.file
            ? <a href={doc.file} target="_blank" rel="noopener noreferrer" title="פתיחה בלשונית חדשה" className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: iconCol }}><ExternalLink size={16} /></a>
            : <button title="פתיחה בלשונית חדשה" className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: iconCol }}><ExternalLink size={16} /></button>}
          <button onClick={onClose} title="סגירת המסמך" className="size-8 flex items-center justify-center rounded-md transition-colors hover:bg-black/5" style={{ color: iconCol }}><X size={19} /></button>
        </div>
      </div>
      {/* Body — a real PDF (iframe) when the mock doc has a file, otherwise the generated mock pages */}
      {doc.file ? (
        <iframe key={expanded ? "expanded" : "default"} src={`${doc.file}#navpanes=0&${expanded ? "zoom=150" : "view=FitH"}`} title={doc.name} className="flex-1 w-full" style={{ border: "none", backgroundColor: "#525659" }} />
      ) : (
        <div className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
          <div className="flex flex-col items-center gap-4 py-5 px-4" dir="rtl">
            {[1, 2].map((p) => (
              <div key={p} className="w-full shadow-lg" style={{ maxWidth: "640px", backgroundColor: "white", padding: "48px 56px", minHeight: "820px", fontFamily: "Noto Sans Hebrew, sans-serif" }} dir="rtl">
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
function DocumentPanelOpen({ isDark, panelWidth, isFocus, onToggleFocus, onSetWidth, onOpenDoc, openDocId }: { isDark: boolean; panelWidth: number; isFocus?: boolean; onToggleFocus?: () => void; onSetWidth?: (w: number) => void; onOpenDoc?: (doc: CaseDoc) => void; openDocId?: string }) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // When a document is opened (and the panel narrows out of focus mode), bring its row into view
  useEffect(() => {
    if (!openDocId) return;
    const el = rowRefs.current[openDocId];
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [openDocId, panelWidth]);
  const cols = Math.min(4, Math.max(1, Math.floor(panelWidth / 290))); // more columns when there's room (min ~290px/card)
  const multiCol = cols > 1;
  const headerWide = panelWidth >= 640; // filters move up onto the search row (wait for a meaningful width so search isn't cramped)
  const [search, setSearch]       = useState("");
  const [activeType, setActiveType] = useState("הכל");
  const [activeSubmitter, setActiveSubmitter] = useState("הכל");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [grouping, setGrouping]   = useState<"chrono" | "type">("chrono"); // chrono (flat) or grouped by type
  const [tableView, setTableView] = useState(false); // false = list (meta under summary), true = aligned columns
  const [sortKey, setSortKey]     = useState<"date" | "name" | "words" | "submitter" | "type" | "process" | null>(null); // table column sort
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");
  const [isAuto, setIsAuto]       = useState(true);
  // Auto mode is the default → all documents start selected
  const [docs, setDocs]           = useState<CaseDoc[]>(() => [
    ...CASE_DOCS.map((d) => ({ ...d, caseId: "c1", checked: true, used: false })),
    ...CASE_DOCS_2.map((d) => ({ ...d, caseId: "c2", checked: true })),
  ]);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null); // accordion — collapsed by default
  const [openType, setOpenType]     = useState<string | null>(null); // folder accordion (type view)
  const [lens, setLens]             = useState<"all" | "new" | "pending">("all"); // status lens

  const bg = isDark ? dk.surface : "white";

  function toggleSort(key: "date" | "name" | "words" | "submitter" | "type" | "process") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "date" || key === "words" ? "desc" : "asc"); } // names/submitter/type a→ב; dates/words high→low
  }
  const sortDocs = (arr: CaseDoc[]) => {
    if (!sortKey) return arr;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...arr].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "he") * dir;
      if (sortKey === "submitter") return a.submitter.localeCompare(b.submitter, "he") * dir;
      if (sortKey === "type") return a.type.localeCompare(b.type, "he") * dir;
      if (sortKey === "words") return (parseWords(a.words) - parseWords(b.words)) * dir;
      if (sortKey === "process") {
        // Documents with no process always sort last, regardless of direction — only tagged docs reverse order between clicks
        if (a.processId == null && b.processId == null) return 0;
        if (a.processId == null) return 1;
        if (b.processId == null) return -1;
        return (a.processId - b.processId) * dir;
      }
      return (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0) * dir; // date
    });
  };
  // List view (default) shows essentials + a meta line under the summary; table view spreads to aligned columns
  const compactCols = !tableView;
  // Table column layout (RTL → first track rightmost): checkbox · date · document(name+summary) [· type · submitter · words]
  const tableTemplate = compactCols ? "22px 70px minmax(0,1fr)" : "22px 70px minmax(0,1fr) 104px 64px 44px 46px";
  const sortHead = (key: "date" | "name" | "words" | "submitter" | "type" | "process", label: string) => (
    <button onClick={() => toggleSort(key)} className="flex items-center gap-0.5 h-full hover:opacity-80" style={{ color: sortKey === key ? c.primary : (isDark ? dk.textMuted : c.textGray), fontFamily: "Noto Sans Hebrew, sans-serif" }} title={`מיון לפי ${label}`}>
      <span>{label}</span>
      {sortKey === key && (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </button>
  );
  const tableHeader = (
    <div className="grid items-center gap-2 px-2 h-9 pb-1 sticky top-0 z-10 text-[13px] font-medium" style={{ gridTemplateColumns: tableTemplate, backgroundColor: bg, borderBottom: `1px solid ${isDark ? dk.border : "#e3ebf5"}`, color: isDark ? dk.textMuted : c.textGray }} dir="rtl">
      <span />
      {sortHead("date", "תאריך")}
      {sortHead("name", "מסמך")}
      {!compactCols && sortHead("type", "סוג")}
      {!compactCols && sortHead("submitter", "מגיש")}
      {!compactCols && sortHead("process", "תהליך")}
      {!compactCols && sortHead("words", "מילים")}
    </div>
  );

  function toggleDoc(id: string) {
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d)));
  }
  function toggleTypeAll(type: string, next: boolean) {
    setDocs((p) => p.map((d) => (d.type === type ? { ...d, checked: next } : d)));
  }
  function toggleAllDocs(next: boolean) {
    setDocs((p) => p.map((d) => ({ ...d, checked: next })));
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

  // Filtering — scoped to the currently open case
  const filtered = docs.filter((d) => d.caseId === openCaseId && matchesFilters(d));

  const filteredSorted = [...filtered].sort((a, b) => b.iso.localeCompare(a.iso)); // newest first
  // "New" = filed after the last visit → always the most-recent contiguous block (demo baseline)
  const LAST_VISIT = "2026-06-01";
  const isNewDoc = (d: CaseDoc) => d.iso > LAST_VISIT;
  const lensed = filteredSorted.filter((d) => lens === "all" || (lens === "pending" && d.pending));
  const typesInData = Array.from(new Set(lensed.map((d) => d.type)));
  const dateCount: Record<string, number> = {}; // how many docs share each date → show the time to disambiguate
  lensed.forEach((d) => { dateCount[d.iso] = (dateCount[d.iso] || 0) + 1; });
  const allChecked = docs.length > 0 && docs.every((d) => d.checked);

  // Single size control — cycles forward through the 3 rungs (default → table → full-screen → default…), same widths the table toggle itself uses.
  // No branching decision for the user: the button always just "grows" the panel one step, wrapping back to the start from full-screen.
  const cycleSize = () => {
    if (isFocus) { onToggleFocus?.(); setTableView(false); onSetWidth?.(420); }
    else if (tableView) { onToggleFocus?.(); }
    else { setTableView(true); onSetWidth?.(660); }
  };
  const expandBtn = onToggleFocus ? (
    <button
      onClick={cycleSize}
      className="size-9 flex items-center justify-center rounded-md flex-shrink-0 transition-opacity hover:opacity-85"
      style={{ border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, backgroundColor: isDark ? "#22304a" : "#eaf2fd", color: c.primary }}
      title={isFocus ? "חזרה לתצוגה הרגילה" : tableView ? "הרחבה למסך מלא" : "הרחבה לתצוגת טבלה"}
    >
      {isFocus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  ) : null;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bg, "--doc-link-color": isDark ? dk.text : "#323338", "--doc-link-hover": isDark ? "#5aa2ef" : "#0073ea" } as any}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2.5" dir="rtl">
        {/* Search + filters — stacked when narrow; one row when the panel is widened (saves height) */}
        <div className={headerWide ? "flex items-center gap-1.5" : "flex flex-col gap-2.5"}>
          <div className={`flex items-center gap-1.5 min-w-0 ${headerWide ? "" : "flex-1"}`} style={headerWide ? { width: "360px" } : undefined}>
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ right: "10px", color: c.iconGray }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש שם מסמך או תקציר"
                className="w-full h-9 rounded-md text-[13px] outline-none"
                style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}`, backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text, paddingRight: "32px", paddingLeft: "10px", fontFamily: "Noto Sans Hebrew, sans-serif" }}
              />
            </div>
            {/* Narrow: expand sits next to the search field */}
            {!headerWide && expandBtn}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            <FilterDropdown label="סוג" value={activeType} options={TYPE_OPTIONS} onChange={setActiveType} searchable isDark={isDark} />
            <FilterDropdown label="מגיש" value={activeSubmitter} options={SUBMITTER_OPTIONS} onChange={setActiveSubmitter} subLabels={openCaseId ? PARTY_NAMES[openCaseId] : undefined} isDark={isDark} />
            <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} isDark={isDark} />
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
            {filterActive && (
              <button
                onClick={() => { setActiveType("הכל"); setActiveSubmitter("הכל"); setDateFrom(""); setDateTo(""); setSearch(""); setLens("all"); }}
                className="flex items-center gap-1 h-8 px-2 rounded-md text-[13px] transition-colors whitespace-nowrap flex-shrink-0 hover:bg-black/5"
                style={{ color: isDark ? dk.textMuted : c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                title="ניקוי כל הסינונים"
              >
                <X size={14} />
                נקה סינון
              </button>
            )}
          </div>
          {/* Wide / expanded: a spacer pushes the expand button to the far-left end of the row */}
          {headerWide && <><div className="flex-1" />{expandBtn}</>}
        </div>

        {/* Thin separator between the filter controls and the checkbox controls */}
        <div className="h-px" style={{ backgroundColor: isDark ? dk.border : "#eef1f4" }} />

        {/* Chat-selection zone: auto/manual + select-all (right) · view controls — grouping + expand (left) */}
        <div className="flex items-center justify-between gap-3" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsAuto((v) => { const next = !v; if (next) toggleAllDocs(true); return next; })}
              className="h-7 px-2.5 rounded-full text-[13px] leading-none transition-colors flex items-center justify-center flex-shrink-0"
              style={{
                minWidth: "54px",
                backgroundColor: isAuto ? c.primary : "transparent",
                color: isAuto ? "white" : (isDark ? dk.textMuted : c.iconGray),
                border: `1.5px solid ${isAuto ? c.primary : (isDark ? dk.border : c.border)}`,
                fontFamily: "Noto Sans Hebrew, sans-serif",
              }}
              title={isAuto ? "בחירת מסמכים אוטומטית — לחצו למעבר לבחירה ידנית" : "בחירת מסמכים ידנית — לחצו למעבר לאוטומטית"}
            >
              {isAuto ? "אוטו׳" : "ידני"}
            </button>
            <button className="flex items-center gap-1.5 min-w-0" onClick={() => toggleAllDocs(!allChecked)}>
              <CheckboxBlue checked={allChecked} onToggle={() => toggleAllDocs(!allChecked)} />
              <span className="text-[14px] truncate" style={{ color: isDark ? dk.textMuted : c.textGray }}>בחר הכל לצ'ט</span>
            </button>
          </div>

          {/* View controls (left) — group by type, then the list/table toggle (left-most) */}
          {openCaseId && (
            <div className="flex items-center gap-3 flex-shrink-0" style={{ marginInlineEnd: "4px" }}>
              <button
                onClick={() => setGrouping((g) => { const next = g === "type" ? "chrono" : "type"; if (next === "type") setOpenType(null); return next; })}
                className="flex items-center gap-1.5 h-7 whitespace-nowrap hover:opacity-80 transition-colors"
                style={{ color: grouping === "type" ? c.primary : (isDark ? dk.textMuted : c.textGray) }}
                title="קיבוץ המסמכים לפי סוג"
              >
                <List size={16} />
                <span className="text-[13px]" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>קבץ לפי סוג</span>
              </button>
              {!isFocus && (
                <button
                  onClick={() => { const next = !tableView; setTableView(next); onSetWidth?.(next ? 660 : 420); }}
                  className="flex items-center justify-center size-7 rounded-md hover:bg-black/5 transition-colors"
                  style={{ color: tableView ? c.primary : (isDark ? dk.textMuted : c.textGray) }}
                  title={tableView ? "תצוגת רשימה" : "תצוגת טבלה (עמודות מיושרות)"}
                >
                  <Table size={17} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* List — outer ltr puts scrollbar on the right; inner rtl keeps content */}
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
                <button className="flex flex-col flex-1 text-right min-w-0 gap-0.5" onClick={() => setOpenCaseId(caseOpen ? null : cf.id)}>
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
                      <span className="text-[12px] whitespace-nowrap" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="סך המילים בכל מסמכי התיק">{formatWords(caseWords)}</span>
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
          <div className="flex flex-col">
            {tableHeader}
            {sortDocs(lensed).map((doc) => (
              <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} showTime={dateCount[doc.iso] > 1} gridCols={tableTemplate} compact={compactCols} onOpenDoc={() => onOpenDoc?.(doc)} onToggleCheck={() => toggleDoc(doc.id)} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
            ))}
          </div>
        )}

        {/* By type — column-table rows under type sub-headers; the column header only shows once a folder is open */}
        {grouping === "type" && (
          <div className="flex flex-col">
            {openType && tableHeader}
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
                      <span className="text-[14px] font-semibold truncate" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{type}</span>
                      {typeUsed && <span className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.primary }} title="כולל מסמך ששימש בתשובה" />}
                      <span className="flex-1" />
                      <span className="text-[13px] flex-shrink-0" style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Figtree, sans-serif" }} title="סה״כ מילים בקטגוריה">{typeWords}</span>
                      <ChevronDown size={16} style={{ color: c.iconGray, flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
                    </button>
                  </div>
                  {open && sortDocs(typeDocs).map((doc) => (
                    <DocRowCompact key={doc.id} doc={doc} isDark={isDark} markNew={lens === "all" && isNewDoc(doc)} active={openDocId === doc.id} showTime={dateCount[doc.iso] > 1} gridCols={tableTemplate} compact={compactCols} onOpenDoc={() => onOpenDoc?.(doc)} onToggleCheck={() => toggleDoc(doc.id)} rowRef={(el) => { rowRefs.current[doc.id] = el; }} />
                  ))}
                </div>
              );
            })}
          </div>
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

function ChatArea({ isDark, conversationKey }: { isDark: boolean; conversationKey: number }) {
  const [showCitations, setShowCitations] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [citCollapsed, setCitCollapsed] = useState(true);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { q: "מהי מוכנות התיק לדיון הקרוב?", isFirst: true },
  ]);
  const [scope, setScope]         = useState<ScopeOption>("תמציתי");
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeBtnRef = useRef<HTMLButtonElement>(null);
  const [scopePos, setScopePos]   = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [sendPressed, setSendPressed] = useState(false);

  function handleScopeToggle() {
    if (!scopeOpen && scopeBtnRef.current) {
      const r = scopeBtnRef.current.getBoundingClientRect();
      const rightEdge = window.innerWidth - r.right;
      // Empty state (input in center) → open downward; normal state (input at bottom) → open upward
      if (isEmpty) {
        setScopePos({ top: r.bottom + 4, right: rightEdge });
      } else {
        setScopePos({ bottom: window.innerHeight - r.top + 4, right: rightEdge });
      }
    }
    setScopeOpen(v => !v);
  }

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
        <input
          className={`w-full bg-transparent outline-none text-right text-[16px] min-h-[24px] ${isDark ? "dark-ph" : ""}`}
          style={{ color: isDark ? dk.text : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          dir="rtl"
          placeholder={isEmpty ? "אפשר לשאול כאן כל שאלה בנוגע לתיק" : ""}
          autoFocus={isEmpty}
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

          {/* Scope selector — plain text + chevron, no frame */}
          <button
            ref={scopeBtnRef}
            onClick={handleScopeToggle}
            dir="rtl"
            className="flex items-center gap-0.5 h-8 pl-1 pr-2 rounded flex-shrink-0 text-[14px]"
            style={{
              color: isDark ? dk.textMuted : c.textGray,
              backgroundColor: "transparent",
              border: "none",
              fontFamily: "Noto Sans Hebrew, sans-serif",
              cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = isDark ? dk.text : c.text; e.currentTarget.style.backgroundColor = c.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.color = isDark ? dk.textMuted : c.textGray; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {scope}
            <ChevronDown
              size={11}
              style={{ transition: "transform 0.15s", transform: scopeOpen ? "rotate(180deg)" : "none" }}
            />
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

  function renderDisclaimer() {
    return (
      <p
        className="text-[14px] mt-2"
        style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl", textAlign: "center" }}
      >
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

  // ── Scope dropdown (portal-like, fixed position) ──────────────────────
  function renderScopeDropdown() {
    if (!scopeOpen || !scopePos) return null;
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-[190]" onClick={() => setScopeOpen(false)} />
        {/* Dropdown */}
        <div
          style={{
            position: "fixed",
            ...(scopePos.top !== undefined ? { top: scopePos.top } : { bottom: scopePos.bottom }),
            right: scopePos.right,
            zIndex: 200,
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: "330px",
            overflow: "hidden",
          }}
          dir="rtl"
        >
          {/* Tooltip header */}
          <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: `1px solid ${c.border}`, lineHeight: 1.3 }}>
            <span className="text-[14px]" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              {SCOPE_TOOLTIP}
            </span>
          </div>
          {/* Options */}
          {SCOPE_ORDER.map(opt => {
            const isCurrent = opt === scope;
            return (
              <button
                key={opt}
                onClick={() => { setScope(opt); setScopeOpen(false); }}
                className="w-full flex items-start justify-between px-4 py-3 text-right"
                style={{ backgroundColor: "transparent", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div className="flex flex-col gap-0.5">
                  <span
                    className="flex items-center gap-1.5 text-[14px]"
                    style={{
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? c.primary : c.text,
                      fontFamily: "Noto Sans Hebrew, sans-serif",
                    }}
                  >
                    {(() => { const I = SCOPE_CONFIG[opt].Icon; return <I size={15} style={{ color: isCurrent ? c.primary : c.iconGray, flexShrink: 0 }} />; })()}
                    {opt}
                  </span>
                  <span className="text-[14px] leading-snug" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
                    {SCOPE_CONFIG[opt].desc}
                  </span>
                </div>
                {isCurrent && (
                  <div className="flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7L5.5 10.5L12 3.5" stroke={c.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 min-w-0" style={{ backgroundColor: bg }}>
          <div className="w-full max-w-[768px] flex flex-col gap-4">
            <p
              className="text-right text-[22px] font-medium mb-2"
              style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
            >
              שלום, טל. במה אוכל לעזור?
            </p>
            {renderInput()}
            {renderDisclaimer()}
          </div>
        </div>
        {renderScopeDropdown()}
      </>
    );
  }

  // ── Normal state ───────────────────────────────────────────────────────
  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: bg }}>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 flex flex-col items-center gap-4">
            {messages.map((msg, i) => (
              <div key={i} className="w-full max-w-[768px] flex flex-col gap-3">
                <div className="rounded px-4 py-3" style={{ backgroundColor: isDark ? "rgba(0,115,234,0.12)" : "rgba(204,229,255,0.5)" }} dir="rtl">
                  <p className="text-[15px] text-right" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>{msg.q}</p>
                </div>
                <div>
                  <div className="text-right text-[15px] leading-relaxed" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl" }}>
                    {msg.isFirst ? renderFirstAnswer() : <p>מעבד את שאלתך...</p>}
                  </div>
                  <MessageActions isDark={isDark} showBadges={showBadges} onToggleBadges={() => setShowBadges((v) => !v)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-4 pt-2 flex flex-col items-center">
          <div className="w-full max-w-[768px]">
            {renderInput()}
            {renderDisclaimer()}
          </div>
        </div>
      </div>
      {renderScopeDropdown()}
    </>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
// Mock: set isAdmin = true to simulate an admin user (dev team: wire to real auth)
const IS_ADMIN = true;

function AppHeader({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
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
            <div className="size-8 rounded-full flex items-center justify-center text-white text-[14px] flex-shrink-0 select-none" style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}>טח</div>
            <div className="flex flex-col leading-tight text-right">
              <span className="text-[13px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}>טל חבקין</span>
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
        <button onClick={onToggleDark} className="flex items-center gap-1.5 rounded-full h-7 px-2 cursor-pointer" style={{ backgroundColor: isDark ? "#334155" : c.border }} title={isDark ? "מצב בהיר" : "מצב כהה"}>
          {isDark ? <Sun size={14} style={{ color: "#FCD34D" }} /> : <Moon size={14} style={{ color: "#4A5568" }} />}
          <div className="size-[18px] rounded-full" style={{ backgroundColor: isDark ? "#94A3B8" : "white" }} />
        </button>
      </div>

      <div className="flex items-center gap-2" dir="rtl">
        <Logo />
        <span className="font-medium text-[20px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Rubik, sans-serif", lineHeight: "1" }}>נט המשפט</span>
      </div>
    </header>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function MishpatPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [convKey, setConvKey] = useState(0);
  const [panelWidth, setPanelWidth] = useState(420); // opens as a narrow list; the table toggle widens it for aligned columns
  const [resizing, setResizing] = useState(false);
  const [focusDocs, setFocusDocs] = useState(false);
  const [openDoc, setOpenDoc] = useState<CaseDoc | null>(null);
  const [viewerWidth, setViewerWidth] = useState(620);
  const [docExpanded, setDocExpanded] = useState(false); // user expanded the document over the chat
  const [chatMin, setChatMin] = useState(false);         // floating chat minimized to its header
  const [chatPos, setChatPos] = useState<{ x: number; y: number } | null>(null); // null = default bottom-left anchor
  const [chatSize, setChatSize] = useState({ w: 380, h: 470 });
  const layoutRef = useRef<HTMLDivElement>(null); // positioning context for the floating chat
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
  const closeDoc = () => { setOpenDoc(null); setDocExpanded(false); setChatMin(false); setChatPos(null); };
  // Dock the floating chat back into its column while keeping the document open (shrinks the viewer if needed so the chat fits)
  const dockChat = () => { setDocExpanded(false); setChatMin(false); setChatPos(null); setViewerWidth((w) => Math.min(w, Math.max(380, vw - 55 - (isPanelOpen ? panelWidth : 40) - 430))); };

  // Drag the floating chat by its header
  const startChatDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    const row = layoutRef.current?.getBoundingClientRect();
    const win = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
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
      <AppHeader isDark={isDark} onToggleDark={() => setIsDark((v) => !v)} />

      <div ref={layoutRef} className="absolute top-12 bottom-0 left-0 right-0 flex" dir="ltr">
        {/* Chat — in-flow column normally; a draggable, resizable floating window over the document when there's no room for all three */}
        <div
          className={chatFloating ? "absolute z-40 flex flex-col rounded-xl overflow-hidden" : "flex-1 flex min-w-0"}
          style={chatFloating ? {
            ...(chatPos ? { left: `${chatPos.x}px`, top: `${chatPos.y}px` } : { bottom: "16px", insetInlineStart: "16px" }),
            width: `${chatSize.w}px`,
            height: chatMin ? "auto" : `${chatSize.h}px`,
            border: `1px solid ${isDark ? dk.border : c.border}`,
            backgroundColor: isDark ? dk.bg : "white",
            boxShadow: "0 10px 34px rgba(0,0,0,0.22)",
          } : undefined}
        >
          {chatFloating && (
            <div onMouseDown={startChatDrag} className="flex items-center justify-between px-3 flex-shrink-0 cursor-move select-none" style={{ height: "38px", backgroundColor: isDark ? dk.surface : "#f1f3f7", borderBottom: chatMin ? "none" : `1px solid ${isDark ? dk.border : "#e2e6ee"}` }} dir="rtl">
              <span className="text-[13px] font-medium" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>צ׳אט</span>
              <div className="flex items-center gap-0.5">
                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setChatMin((v) => !v)} title={chatMin ? "הרחבה" : "מזעור"} className="size-7 flex items-center justify-center rounded-md hover:bg-black/5" style={{ color: iconCol }}>{chatMin ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={dockChat} title="עיגון הצ׳אט למקומו (המסמך יישאר פתוח)" className="size-7 flex items-center justify-center rounded-md hover:bg-black/5" style={{ color: iconCol }}><Maximize2 size={15} /></button>
              </div>
            </div>
          )}
          <div className={`flex-1 flex min-w-0 ${chatFloating && chatMin ? "hidden" : ""}`}>
            <ChatArea isDark={isDark} conversationKey={convKey} />
          </div>
          {chatFloating && !chatMin && (
            <div onMouseDown={startChatResize} className="absolute top-0 right-0 z-20" style={{ width: "18px", height: "18px", cursor: "nesw-resize" }} title="גרירה לשינוי גודל">
              <div className="absolute" style={{ right: "5px", top: "5px", width: "7px", height: "7px", borderRight: `2px solid ${isDark ? dk.textMuted : "#b7c0cf"}`, borderTop: `2px solid ${isDark ? dk.textMuted : "#b7c0cf"}` }} />
            </div>
          )}
        </div>

        {/* Document viewer — third pane (fills the area when the chat is floating) */}
        {openDoc && (
          <DocViewer
            doc={openDoc}
            isDark={isDark}
            width={viewerWidth}
            onWidthChange={setViewerWidth}
            onClose={closeDoc}
            fill={chatFloating}
            showHandle={!forceFloat}
            canExpand={vw >= 1100}
            expanded={chatFloating}
            onToggleExpand={() => {
              // Collapse (whether the fill came from the explicit expand button or from dragging the viewer very wide) back to the actual default: reset both the flag and the manually-dragged width.
              if (chatFloating) { setDocExpanded(false); setViewerWidth(620); }
              else setDocExpanded(true);
            }}
          />
        )}

        {/* Focus backdrop — dims the chat behind the expanded documents */}
        {isPanelOpen && focusDocs && (
          <div onClick={() => setFocusDocs(false)} className="absolute inset-0 z-30" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} />
        )}

        {/* Document panel — opens to the left of the right rail; toggled by the rail's documents button */}
        {isPanelOpen && (
          <div
            className={focusDocs ? "absolute top-0 bottom-0 z-40" : `relative flex-shrink-0 ${resizing ? "" : "transition-all duration-300"}`}
            style={focusDocs
              ? { left: 0, right: "60px", backgroundColor: isDark ? dk.surface : "white", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }
              : { width: `${panelWidth}px`, overflow: "visible" }}
          >
            <div className="absolute inset-0" style={{ overflow: "visible" }}>
              <DocumentPanelOpen isDark={isDark} panelWidth={focusDocs ? vw - 72 : panelWidth} isFocus={focusDocs} onToggleFocus={() => setFocusDocs((v) => !v)} onSetWidth={setPanelWidth} onOpenDoc={(doc) => { setFocusDocs(false); setOpenDoc(doc); }} openDocId={openDoc?.id} />
            </div>

            {/* Resize handle — left edge (panel sits to the left of the rail) */}
            {!focusDocs && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setResizing(true);
                  const onMove = (ev: MouseEvent) =>
                    setPanelWidth(Math.min(720, Math.max(320, window.innerWidth - 60 - ev.clientX)));
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
                className="absolute top-0 bottom-0 left-0 z-10"
                style={{ width: "8px", cursor: "ew-resize" }}
                title="גרירה לשינוי רוחב"
              >
                <div className="absolute top-0 bottom-0 left-0" style={{ width: "2px", backgroundColor: resizing ? c.primary : "#dbe7f7" }} />
              </div>
            )}

            {/* Close button — pokes out on the LEFT edge; a plain X so it reads unambiguously as "close", not another size control */}
            <button
              onClick={() => { setFocusDocs(false); setIsPanelOpen(false); }}
              className="absolute z-20 size-6 flex items-center justify-center rounded-full shadow-md transition-colors"
              style={{ border: `1px solid ${isDark ? dk.border : c.border}`, backgroundColor: isDark ? dk.surface : "white", top: "44px", left: "-12px" }}
              title="סגור מסמכים"
            >
              <X size={14} style={{ color: isDark ? dk.textMuted : c.iconGray }} />
            </button>
          </div>
        )}

        {/* Right icon rail — new conversation, documents (elevated), then secondary nav; help + model + version at the bottom */}
        <div className="w-[60px] flex-shrink-0 flex flex-col items-center pt-5 pb-4" style={{ borderInlineStart: `1px solid ${isDark ? dk.border : "#ebf3ff"}`, backgroundColor: sidebarBg }}>
          <button
            onClick={() => { setConvKey((k) => k + 1); setIsPanelOpen(false); }}
            className="w-8 h-8 flex items-center justify-center rounded mb-3 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: c.primary, color: "white" }}
            title="שיחה חדשה"
          >
            <Plus size={16} />
          </button>
          {/* Documents — same icon language as the rest; turns blue when its panel is open. Distinguished only by position + divider */}
          <button
            onClick={() => { setIsPanelOpen((v) => !v); setFocusDocs(false); }}
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
            <button className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" title="דוגמאות"><Sparkles size={19} /></button>
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
