"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Copy, Eye, EyeClosed, FileText, FolderOpen, Globe,
  HelpCircle, Info, Layers, Link, MessageSquare, Microscope, Minimize2,
  Moon, MoreHorizontal, Paperclip, Plus, Quote, RotateCw, Search, Shield,
  Split, Sun, ThumbsDown, ThumbsUp, Zap,
  Calendar, ExternalLink, Check,
  type LucideIcon,
} from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────────────────
const c = {
  primary: "#0073ea",
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
  date: string;          // display date
  iso: string;           // ISO date (for range filtering)
  bucket: DocBucket;
  words: string;         // word count
  summary: string;       // תקציר
  related: string[];     // related document names
  checked: boolean;      // selected for chat
}

// Type filter chips with aggregate word counts (real case data)
const DOC_TYPE_TOTALS: { type: string; words: string }[] = [
  { type: "הכל",                       words: "237K" },
  { type: "תצהיר",                     words: "113.5K" },
  { type: "כתב הגנה",                  words: "76.8K" },
  { type: "כתב תביעה",                 words: "15.7K" },
  { type: "פרוטוקול",                  words: "14.6K" },
  { type: "פסק דין",                   words: "10.9K" },
  { type: "החלטה",                     words: "1.3K" },
  { type: "בקשה בתיק",                 words: "1.1K" },
];

// Mock documents (dev team: replace with real API data)
const CASE_DOCS: CaseDoc[] = [
  {
    id: "d1", name: "בקשה לדחיית מועד דיון", type: "בקשה בתיק", submitter: "הנתבעת",
    date: "02.06.26", iso: "2026-06-02", bucket: "today", words: "1.1K",
    summary: "הנתבעת מבקשת לדחות את מועד הדיון הקבוע ל-19.6 בשל היעדרות מומחה מרכזי מהארץ, ומציעה מועד חלופי בחודש יולי.",
    related: ["פרוטוקול דיון מקדמי", "החלטה בבקשת ארכה"], checked: false,
  },
  {
    id: "d2", name: "תצהיר עדות ראשית — ד״ר לוי", type: "תצהיר", submitter: "התובע",
    date: "31.05.26", iso: "2026-05-31", bucket: "week", words: "8.4K",
    summary: "תצהיר מומחה רפואי מטעם התובע הקובע קשר סיבתי בין הרשלנות הנטענת לנזק, ומפרט נכות צמיתה בשיעור 25%.",
    related: ["חוות דעת אקטוארית", "כתב תביעה"], checked: true,
  },
  {
    id: "d3", name: "תגובה לבקשת ארכה", type: "בקשה בתיק", submitter: "התובע",
    date: "29.05.26", iso: "2026-05-29", bucket: "week", words: "640",
    summary: "התובע מתנגד לבקשת הארכה וטוען כי מדובר בניסיון לסחבת; לחלופין מבקש כי הדחייה תותנה בהוצאות.",
    related: ["בקשה לדחיית מועד דיון"], checked: false,
  },
  {
    id: "d4", name: "פרוטוקול דיון מקדמי", type: "פרוטוקול", submitter: "בית המשפט",
    date: "18.05.26", iso: "2026-05-18", bucket: "month", words: "4.2K",
    summary: "סיכום הדיון המקדמי: נקבעו פלוגתאות, הוסכם על מינוי מומחה מטעם בית המשפט ונקבע לוח זמנים להגשת ראיות.",
    related: ["החלטה על מינוי מומחה"], checked: false,
  },
  {
    id: "d5", name: "כתב הגנה מתוקן", type: "כתב הגנה", submitter: "הנתבעת",
    date: "10.05.26", iso: "2026-05-10", bucket: "month", words: "12.1K",
    summary: "הנתבעת דוחה את כל טענות הרשלנות, טוענת להעדר קשר סיבתי ולאשם תורם של התובע, ומעלה טענת התיישנות חלקית.",
    related: ["כתב תביעה", "תצהיר עדות ראשית — ד״ר לוי"], checked: false,
  },
  {
    id: "d6", name: "החלטה על מינוי מומחה", type: "החלטה", submitter: "בית המשפט",
    date: "05.05.26", iso: "2026-05-05", bucket: "month", words: "820",
    summary: "בית המשפט ממנה את פרופ׳ כהן כמומחה מטעמו לבחינת שאלת הנכות, וקובע את חלוקת שכר הטרחה בין הצדדים.",
    related: ["פרוטוקול דיון מקדמי"], checked: false,
  },
  {
    id: "d7", name: "כתב תביעה", type: "כתב תביעה", submitter: "התובע",
    date: "12.02.26", iso: "2026-02-12", bucket: "older", words: "15.7K",
    summary: "התובע, מר משה כהן, הגיש כתב תביעה כנגד הנתבעת בגין רשלנות רפואית לכאורה בטיפול שניתן לו, בעקבותיו נגרמו נזקי גוף.",
    related: ["כתב הגנה מתוקן"], checked: false,
  },
  {
    id: "d8", name: "חוות דעת אקטוארית", type: "תצהיר", submitter: "התובע",
    date: "20.01.26", iso: "2026-01-20", bucket: "older", words: "3.6K",
    summary: "חישוב הפסדי השתכרות לעבר ולעתיד על בסיס הנכות הנטענת, בצירוף הפסדי פנסיה וזכויות סוציאליות.",
    related: ["תצהיר עדות ראשית — ד״ר לוי"], checked: false,
  },
];

// ── Filter options ──────────────────────────────────────────────────────────
const TYPE_OPTIONS = DOC_TYPE_TOTALS.map((t) => t.type);
const SUBMITTER_OPTIONS = ["הכל", "התובע", "הנתבעת", "בית המשפט"];

// ── Compact filter dropdown (optionally type-ahead searchable) ───────────────
function FilterDropdown({
  label, value, options, onChange, searchable = false,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; searchable?: boolean;
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
          border: `1px solid ${isFiltered ? c.primary : c.border}`,
          color: isFiltered ? c.primary : c.textGray,
          backgroundColor: isFiltered ? "#eff4ff" : "white",
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
            className="absolute z-40 mt-1 rounded-lg py-1"
            style={{ top: "100%", right: 0, minWidth: "180px", backgroundColor: "white", border: `1px solid ${c.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.13)" }}
          >
            {searchable && (
              <div className="px-2 pt-1 pb-1.5">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="הקלידו סוג..."
                  className="w-full h-8 rounded text-[13px] outline-none px-2"
                  style={{ border: `1px solid ${c.inputBorder}`, color: c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                />
              </div>
            )}
            <div className="max-h-[240px] overflow-y-auto">
              {shown.map((opt) => {
                const sel = opt === value;
                return (
                  <button
                    key={opt}
                    onClick={() => { onChange(opt); setOpen(false); setQ(""); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-right"
                    style={{ backgroundColor: sel ? "#eff4ff" : "transparent", color: sel ? c.primary : c.text, fontWeight: sel ? 600 : 400, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                    onMouseEnter={(e) => { if (!sel) e.currentTarget.style.backgroundColor = c.hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = sel ? "#eff4ff" : "transparent"; }}
                  >
                    <span>{opt}</span>
                    {sel && <Check size={13} style={{ color: c.primary }} />}
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
  from, to, onChange,
}: {
  from: string; to: string; onChange: (from: string, to: string) => void;
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
        style={{ border: `1px solid ${active ? c.primary : c.border}`, color: active ? c.primary : c.textGray, backgroundColor: active ? "#eff4ff" : "white", fontFamily: "Noto Sans Hebrew, sans-serif" }}
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
            style={{ top: "100%", right: 0, minWidth: "210px", backgroundColor: "white", border: `1px solid ${c.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.13)" }}
          >
            <label className="flex flex-col gap-1 text-[12px]" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              מתאריך
              <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="h-8 rounded px-2 text-[13px] outline-none" style={{ border: `1px solid ${c.inputBorder}`, color: c.text }} />
            </label>
            <label className="flex flex-col gap-1 text-[12px]" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              עד תאריך
              <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="h-8 rounded px-2 text-[13px] outline-none" style={{ border: `1px solid ${c.inputBorder}`, color: c.text }} />
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
function DocRow({
  doc, expanded, onToggleCheck, onHover, onLeave, onTogglePin,
}: {
  doc: CaseDoc; expanded: boolean;
  onToggleCheck: () => void; onHover: () => void; onLeave: () => void; onTogglePin: () => void;
}) {
  return (
    <div
      className="rounded-lg border transition-colors"
      style={{ borderColor: expanded ? c.primary : c.inputBorder, backgroundColor: expanded ? "#f7faff" : "white" }}
      dir="rtl"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Top: checkbox · name (link) · count · open */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <CheckboxBlue checked={doc.checked} onToggle={onToggleCheck} />
        <button className="flex-1 min-w-0 text-right" onClick={onTogglePin}>
          <span
            className="block text-[14px] font-medium truncate"
            style={{ color: expanded ? c.primary : c.text, textDecoration: expanded ? "underline" : "none", fontFamily: "Noto Sans Hebrew, sans-serif" }}
          >
            {doc.name}
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="פתיחה בחלון חדש" className="size-6 flex items-center justify-center rounded transition-colors hover:bg-black/5" style={{ color: c.iconGray }}>
            <ExternalLink size={14} />
          </button>
          <span className="rounded-full px-2 py-px text-[12px]" style={{ color: c.text, backgroundColor: c.hoverBg, fontFamily: "Figtree, sans-serif" }}>{doc.words}</span>
        </div>
      </div>

      {/* Meta: date (under checkbox, right) · submitter chip */}
      <div className="flex items-center gap-2 px-3 pt-1 pb-2.5">
        <span className="text-[12px]" style={{ color: c.textGray, fontFamily: "Figtree, sans-serif" }}>{doc.date}</span>
        <span className="rounded px-2 py-0.5 text-[12px]" style={{ backgroundColor: "#eef1f8", color: c.iconGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.submitter}</span>
      </div>

      {/* Expanded (hover / pinned): summary · type · related */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 flex flex-col gap-2 border-t" style={{ borderColor: c.inputBorder }} dir="rtl">
          <p className="text-[13px] leading-snug" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.summary}</p>
          <span className="self-start rounded px-1.5 py-px text-[12px]" style={{ backgroundColor: "#eef1f8", color: c.iconGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.type}</span>
          {doc.related.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px]" style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif" }}>מסמכים קשורים</span>
              <div className="flex flex-wrap gap-1.5">
                {doc.related.map((r) => (
                  <span
                    key={r}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[12px] cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: "white", color: c.textGray, border: `1px solid ${c.inputBorder}`, fontFamily: "Noto Sans Hebrew, sans-serif" }}
                  >
                    <FileText size={12} style={{ color: c.iconGray }} />
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Document panel (open) — chronological browser ────────────────────────────
function DocumentPanelOpen({ isDark }: { isDark: boolean }) {
  const [search, setSearch]       = useState("");
  const [activeType, setActiveType] = useState("הכל");
  const [activeSubmitter, setActiveSubmitter] = useState("הכל");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [grouping, setGrouping]   = useState<"chrono" | "type">("chrono");
  const [docs, setDocs]           = useState<CaseDoc[]>(CASE_DOCS);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId]   = useState<string | null>(null);
  const [openBuckets, setOpenBuckets] = useState<Record<DocBucket, boolean>>({ today: true, week: true, month: false, older: false });
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});

  const bg = isDark ? dk.surface : "white";

  function toggleDoc(id: string) {
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d)));
  }
  function toggleTypeAll(type: string, next: boolean) {
    setDocs((p) => p.map((d) => (d.type === type ? { ...d, checked: next } : d)));
  }

  // Filtering
  const filtered = docs.filter((d) =>
    (activeType === "הכל" || d.type === activeType) &&
    (activeSubmitter === "הכל" || d.submitter === activeSubmitter) &&
    (!dateFrom || d.iso >= dateFrom) &&
    (!dateTo || d.iso <= dateTo) &&
    (search.trim() === "" || d.name.includes(search.trim()) || d.summary.includes(search.trim()))
  );

  const typesInData = Array.from(new Set(filtered.map((d) => d.type)));

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bg }}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2.5" dir="rtl">
        {/* Row 1: title + grouping toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold" style={{ color: c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>מסמכי התיק</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-md" style={{ backgroundColor: c.hoverBg }}>
            {([["chrono", "כרונולוגי", Clock], ["type", "לפי סוג", FolderOpen]] as const).map(([key, label, Ico]) => (
              <button
                key={key}
                onClick={() => setGrouping(key)}
                className="flex items-center gap-1 px-2.5 h-7 rounded text-[12px] transition-colors"
                style={{
                  backgroundColor: grouping === key ? "white" : "transparent",
                  color: grouping === key ? c.primary : c.textGray,
                  fontWeight: grouping === key ? 600 : 400,
                  boxShadow: grouping === key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  fontFamily: "Noto Sans Hebrew, sans-serif",
                }}
              >
                <Ico size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: search */}
        <div className="relative">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ right: "10px", color: c.iconGray }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש במסמכי התיק..."
            className="w-full h-9 rounded-md text-[13px] outline-none"
            style={{ border: `1px solid ${c.inputBorder}`, color: c.text, paddingRight: "32px", paddingLeft: "10px", fontFamily: "Noto Sans Hebrew, sans-serif" }}
          />
        </div>

        {/* Row 3: filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterDropdown label="סוג מסמך" value={activeType} options={TYPE_OPTIONS} onChange={setActiveType} searchable />
          <FilterDropdown label="מגיש" value={activeSubmitter} options={SUBMITTER_OPTIONS} onChange={setActiveSubmitter} />
          <DateRangeFilter from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3" dir="rtl">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[13px]" style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
            לא נמצאו מסמכים תואמים
          </div>
        )}

        {/* Chronological grouping */}
        {grouping === "chrono" && filtered.length > 0 && BUCKET_ORDER.map((bucket) => {
          const bucketDocs = filtered.filter((d) => d.bucket === bucket);
          if (bucketDocs.length === 0) return null;
          const open = openBuckets[bucket];
          return (
            <div key={bucket} className="flex flex-col gap-2">
              <button
                className="flex items-center gap-1.5 text-right"
                onClick={() => setOpenBuckets((p) => ({ ...p, [bucket]: !p[bucket] }))}
              >
                <span className="text-[13px]" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{BUCKET_LABELS[bucket]}</span>
                <span className="text-[12px]" style={{ color: c.textLight, fontFamily: "Figtree, sans-serif" }}>({bucketDocs.length})</span>
                <ChevronDown size={15} style={{ color: c.iconGray, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
              </button>
              {open && bucketDocs.map((doc) => (
                <DocRow
                  key={doc.id} doc={doc}
                  expanded={hoveredId === doc.id || pinnedId === doc.id}
                  onToggleCheck={() => toggleDoc(doc.id)}
                  onHover={() => setHoveredId(doc.id)}
                  onLeave={() => setHoveredId(null)}
                  onTogglePin={() => setPinnedId((p) => (p === doc.id ? null : doc.id))}
                />
              ))}
            </div>
          );
        })}

        {/* Type grouping */}
        {grouping === "type" && filtered.length > 0 && typesInData.map((type) => {
          const typeDocs = filtered.filter((d) => d.type === type);
          const open = openTypes[type] ?? true;
          const allOn = typeDocs.every((d) => d.checked);
          return (
            <div key={type} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CheckboxBlue checked={allOn} onToggle={() => toggleTypeAll(type, !allOn)} />
                <button
                  className="flex items-center gap-1.5 flex-1 text-right"
                  onClick={() => setOpenTypes((p) => ({ ...p, [type]: !(p[type] ?? true) }))}
                >
                  <span className="text-[13px]" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{type}</span>
                  <span className="text-[12px]" style={{ color: c.textLight, fontFamily: "Figtree, sans-serif" }}>({typeDocs.length})</span>
                  <ChevronDown size={15} style={{ color: c.iconGray, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
                </button>
              </div>
              {open && typeDocs.map((doc) => (
                <DocRow
                  key={doc.id} doc={doc}
                  expanded={hoveredId === doc.id || pinnedId === doc.id}
                  onToggleCheck={() => toggleDoc(doc.id)}
                  onHover={() => setHoveredId(doc.id)}
                  onLeave={() => setHoveredId(null)}
                  onTogglePin={() => setPinnedId((p) => (p === doc.id ? null : doc.id))}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentPanelClosed({ isDark }: { isDark: boolean }) {
  return (
    <div className="h-full flex flex-col items-center pt-12 gap-3" style={{ backgroundColor: isDark ? dk.surface : "white" }}>
      <FileText size={18} style={{ color: c.iconGray }} />
      <span style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif", fontSize: "13px", writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", userSelect: "none" }}>
        מסמכים
      </span>
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

  return (
    <>
      <div className="flex items-center mt-3" style={{ gap: "2px" }} dir="ltr">
        <VibeBtn title="העתק"><Copy size={18} /></VibeBtn>
        <VibeBtn title="מועיל"><ThumbsUp size={18} /></VibeBtn>
        <VibeBtn title="לא מועיל" onClick={() => setShowFeedback(true)}>
          <ThumbsDown size={18} />
        </VibeBtn>
        <VibeBtn title="המשך בשיחה חדשה">
          <Split size={18} style={{ transform: "rotate(90deg)" }} />
        </VibeBtn>
        <VibeBtn title="נסה שוב"><RotateCw size={18} /></VibeBtn>
        <VibeBtn title={showBadges ? "הסתר ציטוטים" : "הצג ציטוטים"} active={!showBadges} onClick={onToggleBadges}>
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
        className="rounded-lg border flex flex-col gap-2 px-3 pt-3 pb-2"
        style={{
          borderColor: isDark ? dk.border : c.inputBorder,
          boxShadow: "0px 2px 15px 0px rgba(0,0,0,0.05)",
          backgroundColor: isDark ? dk.input : "white",
        }}
        dir="rtl"
      >
        <input
          className="w-full bg-transparent outline-none text-right text-[16px] min-h-[24px]"
          style={{ color: isDark ? dk.text : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          dir="rtl"
          placeholder={isEmpty ? "אפשר לשאול כאן כל שאלה בנוגע לתיק" : ""}
          autoFocus={isEmpty}
        />
        <div className="flex items-center gap-1.5" dir="ltr">
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
            className="size-8 flex items-center justify-center rounded flex-shrink-0 transition-colors"
            style={{
              backgroundColor: showCitations ? c.primary : c.primaryLight,
              color: showCitations ? "white" : c.iconGray,
            }}
            title={showCitations ? "ציטוטים מופעלים" : "ציטוטים מכובים"}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = showCitations ? "#0060c7" : "#e6e8ed"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = showCitations ? c.primary : c.primaryLight; }}
          >
            <Quote size={18} strokeWidth={2} />
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
              59198-67-89 • יוסי כהן נ&apos; משה כהן לוי ובניו ב...
            </span>
            <span className="flex-shrink-0 text-[14px]" style={{ color: "#0068f5" }}>+2</span>
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
          התיק מוכן לישיבת הוכחות אחרונה במועד 19/5/24. התובעת הגישה את כל ראיותיה, כולל תצהירים של עדים ומומחים רפואיים מטעמה.{" "}
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
          הנתבעת הגישה אף היא את ראיותיה, לרבות חוות דעת מומחה וחוות דעת אקטואריות.{" "}
          {showNum && <Badge num={6} />}
        </p>
        <p>
          התובעת הגישה בקשות להיתר להגשת תיעוד רפואי חדש שיצטבר עד למועד הדיון, וכן להארכת המועד להגשת סיכומים עקב שגיאות בחוות הדעת האקטואריות של הנתבעת.{" "}
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6" style={{ backgroundColor: bg }}>
          <div className="w-full max-w-[768px] flex flex-col gap-4">
            <p
              className="text-right text-[22px] font-medium mb-2"
              style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
            >
              שלום, דניאל. במה אוכל לעזור?
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
      <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: bg }}>
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
    <header className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 z-30" style={{ backgroundColor: isDark ? dk.header : c.headerBg }}>
      <div className="flex items-center gap-3">

        {/* User avatar + name — clickable for admin */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors"
            style={{ backgroundColor: menuOpen ? (isDark ? "#2a3150" : c.hoverBg) : "transparent" }}
          >
            <div className="size-8 rounded-full flex items-center justify-center text-white text-[14px] flex-shrink-0 select-none" style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}>דד</div>
            <div className="flex flex-col leading-tight text-right">
              <span className="text-[13px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}>דניאל דמביץ</span>
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
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [convKey, setConvKey] = useState(0);

  const topIcons = [
    { Icon: Clock, label: "היסטוריה" },
    { Icon: Bookmark, label: "סימניות" },
    { Icon: MessageSquare, label: "הודעות" },
    { Icon: Paperclip, label: "קבצים מצורפים" },
    { Icon: FileText, label: "מסמכים" },
  ];
  const botIcons = [
    { Icon: HelpCircle, label: "עזרה" },
    { Icon: Globe, label: "רשת" },
    { Icon: FileText, label: "דוחות" },
  ];
  const iconCol = isDark ? dk.textMuted : c.iconGray;
  const sidebarBg = isDark ? dk.surface : "white";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ backgroundColor: isDark ? dk.bg : "white" }}>
      <AppHeader isDark={isDark} onToggleDark={() => setIsDark((v) => !v)} />

      <div className="absolute top-16 bottom-0 left-0 right-0 flex" dir="ltr">
        {/* Left icon bar */}
        <div className="w-[55px] flex-shrink-0 flex flex-col items-center pt-5 pb-4 border-r" style={{ borderColor: isDark ? dk.border : "#ebf3ff", backgroundColor: sidebarBg }}>
          <button
            onClick={() => { setConvKey((k) => k + 1); setIsPanelOpen(false); }}
            className="size-8 flex items-center justify-center rounded mb-4 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: c.primary, color: "white" }}
            title="שיחה חדשה"
          >
            <Plus size={16} />
          </button>
          <div className="flex flex-col items-center gap-2">
            {topIcons.map(({ Icon, label }) => (
              <button key={label} className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: iconCol }} title={label}>
                <Icon size={19} />
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="w-9 border-t mb-3" style={{ borderColor: isDark ? dk.border : c.border }} />
          <div className="flex flex-col items-center gap-2">
            {botIcons.map(({ Icon, label }) => (
              <button key={label} className="size-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: iconCol }} title={label}>
                <Icon size={19} />
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <ChatArea isDark={isDark} conversationKey={convKey} />

        {/* Panel wrapper — right side */}
        <div
          className="relative flex-shrink-0 transition-all duration-300"
          style={{ width: isPanelOpen ? "380px" : "40px", overflow: "visible", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}
        >
          <div className="absolute inset-0 overflow-y-auto" style={{ overflowX: "visible" }}>
            {isPanelOpen ? <DocumentPanelOpen isDark={isDark} /> : <DocumentPanelClosed isDark={isDark} />}
          </div>

          {/* Toggle button — pokes out on the LEFT edge (panel is on the right) */}
          <button
            onClick={() => setIsPanelOpen((v) => !v)}
            className="absolute z-20 size-6 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors"
            style={{ border: `1px solid ${c.border}`, top: "58px", left: "-12px" }}
            title={isPanelOpen ? "סגור מסמכים" : "פתח מסמכים"}
          >
            {isPanelOpen
              ? <ChevronRight size={16} style={{ color: c.iconGray }} />
              : <ChevronLeft size={16} style={{ color: c.iconGray }} />}
          </button>
        </div>
      </div>
    </div>
  );
}
