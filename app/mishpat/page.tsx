"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Check, Clock, Copy, Eye, EyeClosed, FileText, FolderOpen, Globe,
  HelpCircle, Info, Layers, Link, Microscope, Minimize2,
  Moon, MoreHorizontal, PanelRightClose, Paperclip, Plus, Quote, RotateCw, Search, Shield,
  Split, Sun, ThumbsDown, ThumbsUp, X, Zap, ExternalLink,
  Bot, Activity, Folder, Terminal, Send, Equal, Pencil, Trash2,
  type LucideIcon,
} from "lucide-react";

// list-sort-descending — not yet published in our installed lucide-react version;
// hand-copied path data from lucide.dev so it renders identically once the icon lands upstream.
function ListSortDescendingIcon({ size = 24, strokeWidth = 2, style }: { size?: number; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M15 12H3" />
      <path d="M3 5h18" />
      <path d="M9 19H3" />
    </svg>
  );
}

// "שימוש בדוגמה" — a boxed return arrow (apply/insert). Not in lucide as a single glyph,
// so it's hand-drawn here to match the icon in the design.
function UseExampleIcon({ size = 24, style, className }: { size?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <path d="M16 8.5v3a1.5 1.5 0 0 1-1.5 1.5H9" />
      <path d="m11 11-2 2 2 2" />
    </svg>
  );
}

// ── Design tokens ──────────────────────────────────────────────────────────
const FOOTER_HEIGHT = 90; // page-level disclaimer footer — 3 lines at 14px + 20px bottom padding

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

// ── Auto tooltip text ──────────────────────────────────────────────────────
const AUTO_TIP = `כאשר אפשרות בחירת מסמכים אוטומטית מופעלת, צ'ט המשפט בוחר באופן אוטומטי במסמכים המתאימים ביותר למענה על השאלה שלך.
אם הבחירה האוטומטית לא מתאימה לך מכל סיבה שהיא, תוכל לכבות אותה בכל שלב ולבחור את המסמכים באופן ידני.`;

// ── Scope selector ────────────────────────────────────────────────────────
type ScopeOption = "תמציתי" | "מורחב" | "מקיף";
const SCOPE_ORDER: ScopeOption[] = ["תמציתי", "מורחב", "מקיף"];
const SCOPE_CONFIG: Record<ScopeOption, { desc: string; Icon: LucideIcon }> = {
  "תמציתי": { desc: "היקף ממוקד, מענה מהיר לרוב השאלות",       Icon: Zap },
  "מורחב":  { desc: "היקף רחב יותר, לשאלות הדורשות הקשר נוסף",  Icon: Layers },
  "מקיף":   { desc: "ההיקף הרחב ביותר, מומלץ לניתוח יסודי", Icon: Microscope },
};
const SCOPE_TOOLTIP = "היקף התוכן מהמסמכים הנבחרים שישולב בתשובה. ככל שההיקף קטן יותר, התשובה מהירה יותר.";

// ── Response-mode selector (agents / direct chat / fast chat) ───────────────
type ResponseMode = "agents" | "direct" | "fast";
const RESPONSE_MODE_ORDER: ResponseMode[] = ["agents", "direct", "fast"];
const RESPONSE_MODE_CONFIG: Record<ResponseMode, { label: string; desc: string; Icon: LucideIcon }> = {
  agents: { label: "סוכנים",    desc: "מענה לבקשות מורכבות על-ידי ניתוח הבקשה ובניית דרך פעולה", Icon: Bot },
  direct: { label: "צ'ט ישיר",  desc: "מענה לבקשות על-ידי שליחת הבקשה ישירות",                   Icon: Send },
  fast:   { label: "צ'ט מהיר",  desc: "מענה מהיר לבקשות ממוקדות",                              Icon: Zap },
};
const RESPONSE_MODE_TITLE = "בחרו את שיטת המענה המועדפת לשאלה זו";

type DocItem = { name: string; words: string; summary: string };
const initialDocs: { name: string; count: string; checked: boolean; items: DocItem[] }[] = [
  { name: "כתב תביעה", count: "320K", checked: false, items: [
    { name: "כתב תביעה מתוקן", words: "180K", summary: "כתב התביעה המתוקן המפרט את עילות התביעה, העובדות הנטענות, הבסיס המשפטי והסעדים הכספיים המבוקשים מבית המשפט." },
    { name: "כתב תביעה מקורי", words: "140K", summary: "כתב התביעה המקורי שהוגש בפתיחת ההליך, טרם תיקונו בעקבות החלטת בית המשפט להוספת ראשי נזק." },
  ] },
  { name: "כתב הגנה", count: "200K", checked: false, items: [
    { name: "כתב הגנה מתוקן", words: "120K", summary: "הנתבע דוחה את מלוא טענות התביעה, כופר בקשר הסיבתי וטוען לאשם תורם מצד התובע ולהתיישנות חלקית." },
    { name: "כתב הגנה מקורי", words: "80K", summary: "כתב ההגנה הראשון מטעם הנתבע, ובו הכחשה גורפת של העובדות והעלאת טענות מקדמיות לסילוק על הסף." },
  ] },
  { name: "תצהיר", count: "12.2K", checked: true, items: [
    { name: "תצהיר עדות ראשית — התובע", words: "7.1K", summary: "תצהיר עדותו הראשית של התובע, המתאר את השתלשלות האירועים, הטיפול שקיבל והנזקים הגופניים והכלכליים שנגרמו לו." },
    { name: "תצהיר עדות — עד מומחה", words: "5.1K", summary: "תצהיר עד מומחה מטעם התובע, המבסס את הקשר הסיבתי בין ההתרשלות הנטענת לבין הנזק שנגרם בפועל." },
  ] },
  { name: "פרוטוקול", count: "761", checked: false, items: [
    { name: "פרוטוקול קדם משפט", words: "761", summary: "תיעוד ישיבת קדם המשפט: גיבוש הפלוגתאות, הסכמות דיוניות בין הצדדים וקביעת לוח הזמנים להגשת הראיות." },
  ] },
  { name: "עתירה", count: "654", checked: true, items: [
    { name: "עתירה מנהלית", words: "654", summary: "עתירה לביטול החלטת הוועדה, בטענה לפגמים בהליך קבלת ההחלטה ולחריגה מסמכות מצד הרשות המוסמכת." },
  ] },
  { name: "בקשה", count: "940", checked: false, items: [
    { name: "בקשה לדחיית מועד דיון", words: "540", summary: "בקשת הנתבע לדחיית מועד הדיון בשל היעדרות עד מרכזי מהארץ, בצירוף הצעה למועד חלופי. התובע מתנגד." },
    { name: "בקשה לגילוי מסמכים", words: "400", summary: "בקשת התובע לחייב את הנתבע בגילוי רשומות רפואיות מלאות ויומני ניתוח הרלוונטיים לבירור התביעה." },
  ] },
  { name: "חוות דעת", count: "9K", checked: false, items: [
    { name: "חוות דעת מומחה מטעם בית המשפט", words: "6K", summary: "חוות דעת המומחה שמונה מטעם בית המשפט, הקובעת שיעור נכות צמיתה וקשר סיבתי חלקי לאירוע הנדון." },
    { name: "חוות דעת אקטוארית", words: "3K", summary: "חישוב הפסדי ההשתכרות לעבר ולעתיד על בסיס הנכות הנטענת, בתוספת הפסדי פנסיה וזכויות סוציאליות." },
  ] },
];

// Inner document row (inside an expanded type folder) — hover shows a summary bubble + open-in-new-tab
function DocItemRow({ item, isDark }: { item: DocItem; isDark: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <div
      className="flex items-center justify-between gap-2 py-0.5"
      style={{ paddingRight: "40px", paddingLeft: "20px" }}
      dir="rtl"
      onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.top, left: Math.min(window.innerWidth - 268, r.right + 8) }); }}
      onMouseLeave={() => setPos(null)}
    >
      <span className="doc-link text-[13px] truncate" style={{ fontFamily: "Noto Sans Hebrew, sans-serif", color: isDark ? dk.text : c.textGray }} title={item.name}>{item.name}</span>
      <span className="rounded-full px-2 py-px text-[12px] whitespace-nowrap flex-shrink-0" style={{ color: c.text, backgroundColor: isDark ? dk.input : "white", fontFamily: "Figtree, sans-serif" }}>{item.words}</span>
      {pos && (
        <div
          className="fixed z-[300] rounded-lg p-3"
          style={{ top: pos.top, left: pos.left, width: "256px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 6px 24px rgba(0,0,0,0.16)" }}
          dir="rtl"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <button onClick={(e) => e.stopPropagation()} className="size-6 flex items-center justify-center rounded hover:bg-black/5 flex-shrink-0 transition-colors" style={{ color: c.iconGray }} title="פתיחה בחלון חדש"><ExternalLink size={14} /></button>
            <span className="doc-link text-[14px] font-medium truncate" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }} title={item.name}>{item.name}</span>
          </div>
          <p className="text-[13px] leading-snug" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{item.summary}</p>
        </div>
      )}
    </div>
  );
}

// ── Document panel (open) ──────────────────────────────────────────────────
function DocumentPanelOpen({ isDark }: { isDark: boolean }) {
  const [isCaseOpen, setIsCaseOpen] = useState(true);
  const [isAuto, setIsAuto] = useState(true);
  const [allChecked, setAllChecked] = useState(true);
  const [docs, setDocs] = useState(initialDocs);
  const [showTip, setShowTip] = useState(false);
  const autoRef = useRef<HTMLButtonElement>(null);
  const caseCardRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState({ top: 0 });
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [openType, setOpenType] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false); // temporary "generate summaries" helper (interim phase)

  const q = search.trim();
  const visibleDocs = docs
    .map((d) => {
      const matchItems = q ? d.items.filter((it) => it.name.includes(q) || it.summary.includes(q)) : d.items;
      return { ...d, matchItems, typeMatch: q === "" || d.name.includes(q) || matchItems.length > 0 };
    })
    .filter((d) => d.typeMatch);

  const bg = isDark ? dk.surface : "white";
  const panelBg = isDark ? dk.bg : (isAuto ? c.panelBg : "white");
  const borderCol = isDark ? dk.border : c.border;
  const titleCol = isDark ? dk.textMuted : c.textLight;
  const grayCol = isDark ? dk.textMuted : c.iconGray;

  function toggleDoc(name: string) {
    setDocs((p) => p.map((d) => (d.name === name ? { ...d, checked: !d.checked } : d)));
  }
  function toggleAll() {
    const next = !allChecked;
    setAllChecked(next);
    setDocs((p) => p.map((d) => ({ ...d, checked: next })));
  }

  function handleAutoEnter() {
    if (caseCardRef.current) {
      const r = caseCardRef.current.getBoundingClientRect();
      setTipPos({ top: r.top });
    }
    setShowTip(true);
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto docs-scroll" style={{ backgroundColor: bg }}>
      {/* Header: title | אוטו' | RotateCw | Search */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2" dir="rtl">
        <span className="text-[17px] leading-[1.25] flex-1" style={{ color: titleCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
          מסמכים
        </span>

        {/* Auto button */}
        <button
          ref={autoRef}
          onClick={() => setIsAuto((v) => !v)}
          onMouseEnter={handleAutoEnter}
          onMouseLeave={() => setShowTip(false)}
          className="h-7 px-3 rounded-full text-[13px] leading-none flex-shrink-0 transition-all hover:opacity-90"
          style={{
            backgroundColor: isAuto ? c.primary : "transparent",
            color: isAuto ? "white" : c.iconGray,
            border: `1.5px solid ${isAuto ? c.primary : c.border}`,
            fontFamily: "Noto Sans Hebrew, sans-serif",
          }}
        >
          אוטו&apos;
        </button>

        {/* Tooltip — fixed, aligned to left edge of panel */}
        {showTip && (
          <div
            className="rounded-lg border text-right text-[13px] leading-relaxed whitespace-pre-line"
            style={{
              position: "fixed", left: "12px", top: tipPos.top, zIndex: 1000,
              width: "276px", padding: "16px 28px 20px", direction: "rtl",
              backgroundColor: "white", borderColor: c.border, color: c.text,
              fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif",
              boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
            }}
          >
            {AUTO_TIP}
          </div>
        )}

        {/* Temporary helper — generate summaries (interim phase) */}
        <button
          onClick={() => { setGenerating(true); setTimeout(() => setGenerating(false), 1800); }}
          disabled={generating}
          className="size-7 flex items-center justify-center rounded border hover:bg-black/5 transition-colors flex-shrink-0"
          style={{ borderColor: borderCol }}
          title={generating ? "מפיק תקצירים…" : "הפק תקצירים"}
        >
          <Zap size={14} className={generating ? "animate-pulse" : ""} style={{ color: generating ? c.primary : c.iconGray }} />
        </button>

        <button className="size-7 flex items-center justify-center rounded border hover:bg-black/5 transition-colors flex-shrink-0" style={{ borderColor: borderCol }} title="רענון">
          <RotateCw size={14} style={{ color: c.iconGray }} />
        </button>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="size-7 flex items-center justify-center rounded border hover:bg-black/5 transition-colors flex-shrink-0"
          style={{ borderColor: showSearch ? c.primary : borderCol, backgroundColor: showSearch ? (isDark ? "#22304a" : c.primaryLight) : "transparent" }}
          title="חיפוש"
        >
          <Search size={14} style={{ color: showSearch ? c.primary : c.iconGray }} />
        </button>
      </div>

      {/* Search field — opens below the buttons row */}
      {showSearch && (
        <div className="px-3 pb-2" dir="rtl">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ right: "10px", color: c.iconGray }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              placeholder="חיפוש בתקציר המסמך"
              className="w-full h-8 rounded-md text-[13px] outline-none"
              style={{ border: `1px solid ${borderCol}`, backgroundColor: isDark ? dk.input : "white", color: isDark ? dk.text : c.text, paddingRight: "30px", paddingLeft: "10px", fontFamily: "Noto Sans Hebrew, sans-serif" }}
            />
          </div>
        </div>
      )}

      {/* Case box */}
      <div className="mx-3 mb-3" ref={caseCardRef}>
        <div className="rounded-md border overflow-hidden transition-colors" style={{ backgroundColor: panelBg, borderColor: borderCol }}>
          <button className="w-full px-3 py-2.5 text-center relative hover:bg-black/5 transition-colors" dir="rtl" onClick={() => setIsCaseOpen((v) => !v)}>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: grayCol }}>
              {isCaseOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </span>
            <p className="text-[15px] leading-[18px]" style={{ color: grayCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>ת&quot;א • 12345-67-89</p>
            <p className="text-[14px] leading-[17px] mx-auto" style={{ color: grayCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", maxWidth: "180px" }}>
              יעקב אברמוב נגד המרכז הרפואי קדם בע&quot;מ
            </p>
          </button>

          {isCaseOpen && (
            <div className="pb-3">
              {/* כל המסמכים */}
              <div className="flex items-center justify-between py-1.5" style={{ paddingRight: "12px", paddingLeft: "12px" }} dir="rtl">
                <div className="flex items-center gap-2">
                  <CheckboxBlue checked={allChecked} onToggle={toggleAll} />
                  <span className="text-[14px] whitespace-nowrap" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>כל המסמכים</span>
                </div>
                <div className="bg-white rounded-full px-2 py-px text-[12px]" style={{ color: c.text, fontFamily: "Figtree, sans-serif" }}>855.7K</div>
              </div>

              {/* Type folders — expandable to inner documents */}
              <div className="mt-1 flex flex-col gap-1.5" dir="rtl">
                {visibleDocs.map((doc) => {
                  const open = openType === doc.name || (q !== "" && doc.matchItems.length > 0);
                  return (
                    <div key={doc.name} className="flex flex-col">
                      <div className="flex items-center justify-between" style={{ paddingRight: "20px", paddingLeft: "20px" }}>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span onClick={(e) => e.stopPropagation()}><CheckboxBlue checked={doc.checked} onToggle={() => toggleDoc(doc.name)} /></span>
                          <button onClick={() => setOpenType((o) => (o === doc.name ? null : doc.name))} className="text-[14px] whitespace-nowrap" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.name}</button>
                        </div>
                        <button onClick={() => setOpenType((o) => (o === doc.name ? null : doc.name))} className="flex items-center gap-1" title="פתיחת התיקייה">
                          <ChevronDown size={14} style={{ color: grayCol, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
                          <div className="bg-white rounded-full px-2 py-px text-[12px] whitespace-nowrap" style={{ color: c.text, fontFamily: "Figtree, sans-serif" }}>{doc.count}</div>
                        </button>
                      </div>
                      {open && (
                        <div className="mt-1 mb-0.5 flex flex-col gap-1">
                          {doc.matchItems.map((it) => (
                            <DocItemRow key={it.name} item={it} isDark={isDark} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleDocs.length === 0 && (
                  <div className="text-center py-4 text-[13px]" style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif" }}>לא נמצאו מסמכים תואמים</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentPanelClosed({ isDark }: { isDark: boolean }) {
  return (
    <div className="h-full flex flex-col items-center pt-12 gap-3" style={{ backgroundColor: isDark ? dk.surface : "white", borderRight: `1px solid ${isDark ? dk.border : "#e6e9f0"}` }}>
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

// ── "Thinking" dots — Gemini-style: solid grey balls bouncing in scale, never fading — shown next to the step in progress ──
function AgentEllipsis({ marginInlineStart = 10 }: { marginInlineStart?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1" style={{ marginInlineStart }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="inline-block rounded-full flex-shrink-0"
          style={{
            width: 6,
            height: 6,
            backgroundColor: c.iconGray,
            animation: `agentDotBounce 1.5s ease-in-out ${i * 0.22}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

// ── Chat area ──────────────────────────────────────────────────────────────
type Message = { q: string; isFirst: boolean; agent?: boolean };

// Agent-mode progress steps — dev team: replace the fixed timer with real step transitions from the backend
const PENDING_GRAY = "#b6c0cf"; // lighter than c.textLight — for steps that haven't started yet
type StepIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
const AGENT_STEPS: {
  Icon: StepIcon; text: string; subText?: string;
  altIcon?: StepIcon; altText?: string; // "מגבש תכנית עבודה" and "מנתח את מורכבות" are the same real step — swap in place instead of two rows
}[] = [
  { Icon: Search, text: "בודק את נתוני התיק" },
  {
    Icon: ListSortDescendingIcon, text: "מגבש תכנית עבודה למענה",
    altIcon: Activity, altText: "מנתח את מורכבות הבקשה",
    subText: "הבקשה תטופל כמשימה אחת מרוכזת",
  },
  { Icon: Folder, text: "מאתר מידע רלוונטי בתיק" },
  { Icon: Terminal, text: "מעבד את הנתונים, זה עשוי לקחת רגע" },
  { Icon: Send, text: "מכין את התשובה הסופית" },
];
const AGENT_ANSWER = "בבדיקת התיעוד שהוגש עד כה בתיק, קיימים שני תצהירים התומכים בגרסת התובע, וחוות דעת מומחה מטעם הנתבע המערערת על חלק מהממצאים. מומלץ להשלים בירור לגבי הפער בין חוות הדעת לפני הדיון.";

function ChatArea({ isDark, conversationKey, inUseName, onClearInUse }: { isDark: boolean; conversationKey: number; inUseName?: string | null; onClearInUse?: () => void }) {
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
  const scrollRef = useRef<HTMLDivElement>(null); // messages container — auto-scrolled to bottom as agent-step rows appear
  const [responseMode, setResponseMode] = useState<ResponseMode>("agents"); // independent of scope — can run alongside any scope level
  const [modeOpen, setModeOpen] = useState(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const [modePos, setModePos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const agentMode = responseMode === "agents";
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [agentSub, setAgentSub] = useState(false); // static sub-phase within a step (e.g. a concluding line) — not a new step, doesn't advance the counter
  const [agentIntro, setAgentIntro] = useState(false); // brief "thinking" beat (dots only) before anything else appears
  const [revealedSteps, setRevealedSteps] = useState(0); // step rows reveal one at a time before "thinking" starts again
  const stepsReady = revealedSteps >= AGENT_STEPS.length; // every row is on screen
  const [dotsReady, setDotsReady] = useState(false); // a beat after stepsReady — the current step resumes "thinking" (dots) and progressing

  useEffect(() => {
    if (!agentRunning || !agentIntro) return;
    const t = setTimeout(() => setAgentIntro(false), 1400);
    return () => clearTimeout(t);
  }, [agentRunning, agentIntro]);

  useEffect(() => {
    if (!agentRunning || !stepsReady) { setDotsReady(false); return; }
    const t = setTimeout(() => setDotsReady(true), 1100);
    return () => clearTimeout(t);
  }, [agentRunning, stepsReady]);

  // Stagger the rows in — one line, a beat, the next line, etc. — instead of dropping the whole list at once.
  // The pause after the very first row is a bit longer than the rest, so it doesn't feel like the list dumps in right behind it.
  useEffect(() => {
    if (!agentRunning || agentIntro || stepsReady) return;
    const delay = revealedSteps === 1 ? 650 : 350;
    const t = setTimeout(() => setRevealedSteps((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [agentRunning, agentIntro, stepsReady, revealedSteps]);

  // Keep the growing step list in view — scroll the conversation down as each row/answer lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [revealedSteps, agentStep, agentSub, agentIntro, agentRunning, messages]);

  // Demo-only timer chain (dev team: drive this from real step-completion events instead of a fixed delay).
  useEffect(() => {
    if (!agentRunning || !dotsReady) return;
    const step = AGENT_STEPS[agentStep];
    if (agentSub) {
      const t = setTimeout(() => {
        if (agentStep < AGENT_STEPS.length - 1) { setAgentStep((s) => s + 1); setAgentSub(false); }
        else setAgentRunning(false);
      }, 2800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (step.subText) { setAgentSub(true); return; } // hold on a static sub-line before advancing
      if (agentStep < AGENT_STEPS.length - 1) setAgentStep((s) => s + 1);
      else setAgentRunning(false); // last step done — reveal the final answer
    }, 3200);
    return () => clearTimeout(t);
  }, [agentRunning, agentStep, agentSub, dotsReady]);

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

  function handleModeToggle() {
    if (!modeOpen && modeBtnRef.current) {
      const r = modeBtnRef.current.getBoundingClientRect();
      const rightEdge = window.innerWidth - r.right;
      if (isEmpty) {
        setModePos({ top: r.bottom + 4, right: rightEdge });
      } else {
        setModePos({ bottom: window.innerHeight - r.top + 4, right: rightEdge });
      }
    }
    setModeOpen(v => !v);
  }

  useEffect(() => {
    setShowCitations(true);
    setShowBadges(true);
    setCitCollapsed(true);
    setInputText("");
    setMessages([]);          // start fresh — empty state
    setAgentRunning(false);   // a fresh conversation shouldn't inherit an in-progress run (send button stayed a stop button otherwise)
    setAgentStep(0);
    setAgentSub(false);
    setAgentIntro(false);
    setRevealedSteps(0);
  }, [conversationKey]);

  const isEmpty = messages.length === 0;
  const bg = isDark ? dk.bg : "white";
  const textCol = isDark ? dk.text : c.text;

  function handleSend() {
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      { q: inputText.trim(), isFirst: prev.length === 0, agent: agentMode },
    ]);
    setInputText("");
    if (agentMode) { setAgentStep(0); setAgentSub(false); setRevealedSteps(0); setAgentIntro(true); setAgentRunning(true); }
  }

  function handleStop() {
    setAgentRunning(false);
  }

  // Live step-tracker — all steps stay visible at once, each row's icon/color reflects its own status
  // (done / in-progress / pending) as agentStep advances.
  function renderAgentProgress() {
    if (agentIntro) {
      return (
        <div dir="rtl" style={{ marginTop: "8px" }}>
          <AgentEllipsis marginInlineStart={0} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2.5" dir="rtl" style={{ marginTop: "8px" }}>
        {AGENT_STEPS.slice(0, revealedSteps).map((step, i) => {
          const done = i < agentStep;
          const isCurrent = i === agentStep;
          // The "alt" phase (in-place swap) only applies while the step is actively being worked — once
          // it's done, the label reverts to the primary step name (that's the one that "really" happened).
          const inAlt = isCurrent && agentSub;
          const displayText = inAlt && step.altText ? step.altText : step.text;
          // Once the "one-part answer" note has appeared, it stays — it doesn't ride along with agentSub anymore.
          const subRevealed = !!step.subText && (done || (isCurrent && agentSub));
          const Icon = done ? Check : inAlt && step.altIcon ? step.altIcon : step.Icon;
          // Icons stay put and grey for current/pending — only the trailing dots signal what's active.
          // Pending (not-yet-started) rows use a lighter grey than the current row, so it reads as "further away".
          const color = done ? "#00854d" : isCurrent ? c.textLight : PENDING_GRAY;
          return (
            <div key={i} className="flex items-center gap-1.5" style={{ animation: "agentRowIn 0.25s ease-out" }}>
              <Icon size={17} strokeWidth={done ? 2.3 : 1.8} style={{ color, flexShrink: 0 }} />
              <span
                className="text-[14px]"
                style={{
                  color: isCurrent || done ? c.textGray : PENDING_GRAY,
                  fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif",
                }}
              >
                {displayText}
                {isCurrent && dotsReady && <AgentEllipsis />}
                {subRevealed && (
                  <span className="text-[12.5px] italic" style={{ color: c.textLight }}>
                    {" "}— {step.subText}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Input box (shared between empty and normal state) ──────────────────
  function renderInput() {
    return (
      <div className="flex flex-col gap-2">
      {/* Example in use — set from the examples panel's ⋮ menu */}
      {inUseName && (
        <div className="flex justify-center" dir="rtl">
          <div
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px]"
            style={{ backgroundColor: isDark ? "#243354" : c.badgeBg, color: isDark ? dk.text : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}
          >
            <button onClick={onClearInUse} className="opacity-60 hover:opacity-100 transition-opacity" title="הפסקת השימוש בדוגמה">
              <X size={13} />
            </button>
            <span>דוגמה בשימוש: {inUseName}</span>
          </div>
        </div>
      )}
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
          {/* Send button — becomes a stop button while an agent run is in progress */}
          <button
            onClick={agentRunning ? handleStop : handleSend}
            className="size-8 flex items-center justify-center rounded border flex-shrink-0 transition-colors"
            style={{
              borderColor: sendPressed ? c.primary : (isDark ? dk.border : c.border),
              backgroundColor: "transparent",
              color: c.iconGray,
            }}
            title={agentRunning ? "עצור" : "שלח"}
            onMouseEnter={e => { if (!sendPressed) e.currentTarget.style.backgroundColor = c.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; setSendPressed(false); }}
            onMouseDown={() => { setSendPressed(true); }}
            onMouseUp={() => setSendPressed(false)}
          >
            {agentRunning ? <Equal size={17} style={{ transform: "rotate(90deg)" }} /> : <ArrowUp size={17} />}
          </button>

          {/* Response-mode selector — icon + label + chevron, opens a dropdown to pick agents vs. direct chat */}
          <button
            ref={modeBtnRef}
            onClick={handleModeToggle}
            dir="rtl"
            className="flex items-center gap-1 h-7 px-2.5 rounded flex-shrink-0 text-[12.5px] transition-colors"
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: c.iconGray,
              fontFamily: "Noto Sans Hebrew, sans-serif",
            }}
            title="שיטת המענה"
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = c.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            {(() => { const ModeIcon = RESPONSE_MODE_CONFIG[responseMode].Icon; return <ModeIcon size={14} style={{ flexShrink: 0, transform: responseMode === "direct" ? "scaleX(-1)" : undefined }} />; })()}
            <span>{RESPONSE_MODE_CONFIG[responseMode].label}</span>
            <ChevronDown
              size={11}
              style={{ transition: "transform 0.15s", transform: modeOpen ? "rotate(180deg)" : "none" }}
            />
          </button>

          {/* Scope selector — temporarily hidden: dev says it doesn't yet work together with agent mode. Kept here (and the lab page has a working copy) so it's easy to bring back once compatible. */}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Citations + case info — wrapped together and nudged right so the case-info icon lines up with the input text
              above it, while both buttons keep their full, comfortable hover padding (not trimmed on one side). */}
          <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0" style={{ marginInlineEnd: "-8px" }}>
            {/* Citations toggle — left of case info */}
            <button
              onClick={() => setShowCitations((v) => !v)}
              className="size-6 flex items-center justify-center rounded flex-shrink-0 transition-colors"
              style={{
                backgroundColor: showCitations ? c.primaryLight : "transparent",
                border: `1px solid ${showCitations ? c.primary : c.border}`,
                color: c.iconGray,
              }}
              title={showCitations ? "ציטוטים מופעלים" : "ציטוטים מכובים"}
              onMouseEnter={e => { if (!showCitations) e.currentTarget.style.backgroundColor = c.hoverBg; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = showCitations ? c.primaryLight : "transparent"; }}
            >
              <Quote size={16} strokeWidth={2} />
            </button>

            {/* Case info — aligned to the right, hoverable */}
            <button
              className="flex items-center gap-1.5 flex-shrink-0 min-w-0 overflow-hidden max-w-[380px] h-8 px-2 rounded transition-colors"
              dir="rtl"
              style={{ backgroundColor: "transparent" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <FolderOpen size={15} style={{ color: c.iconGray, flexShrink: 0 }} />
              <span className="truncate text-[14px]" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>
                ת&quot;א • 12345-67-89
                <span className="inline-block align-middle" style={{ width: "14px", height: "1px", margin: "0 2px", backgroundColor: isDark ? dk.text : c.text }} />
                יעקב אברמוב נ&apos; המרכז הרפואי קדם בע...
              </span>
              <span className="flex-shrink-0 text-[14px]" style={{ color: "#0068f5" }}>+1</span>
            </button>
          </div>
        </div>
      </div>
      </div>
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

  // ── Response-mode dropdown (portal-like, fixed position) ────────────────
  function renderModeDropdown() {
    if (!modeOpen || !modePos) return null;
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-[190]" onClick={() => setModeOpen(false)} />
        {/* Dropdown */}
        <div
          style={{
            position: "fixed",
            ...(modePos.top !== undefined ? { top: modePos.top } : { bottom: modePos.bottom }),
            right: modePos.right,
            zIndex: 200,
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            width: "300px",
            overflow: "hidden",
          }}
          dir="rtl"
        >
          {/* Header */}
          <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: `1px solid ${c.border}`, lineHeight: 1.3 }}>
            <span className="text-[14px]" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              {RESPONSE_MODE_TITLE}
            </span>
          </div>
          {/* Options */}
          {RESPONSE_MODE_ORDER.map(opt => {
            const isCurrent = opt === responseMode;
            const { label, desc, Icon } = RESPONSE_MODE_CONFIG[opt];
            return (
              <button
                key={opt}
                onClick={() => { setResponseMode(opt); setModeOpen(false); }}
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
                    <Icon size={15} style={{ color: isCurrent ? c.primary : c.iconGray, flexShrink: 0, transform: opt === "direct" ? "scaleX(-1)" : undefined }} />
                    {label}
                  </span>
                  <span className="text-[14px] leading-snug" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
                    {desc}
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
          </div>
        </div>
        {renderScopeDropdown()}
        {renderModeDropdown()}
      </>
    );
  }

  // ── Normal state ───────────────────────────────────────────────────────
  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ backgroundColor: bg }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto docs-scroll">
          <div className="px-6 py-4 flex flex-col items-center gap-4">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const showingAgentProgress = !!msg.agent && isLast && agentRunning;
              return (
                <div key={i} className="w-full max-w-[768px] flex flex-col gap-3">
                  <div className="rounded px-4 py-3" style={{ backgroundColor: isDark ? "rgba(0,115,234,0.12)" : "rgba(204,229,255,0.5)" }} dir="rtl">
                    <p className="text-[15px] text-right" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>{msg.q}</p>
                  </div>
                  <div>
                    <div className="text-right text-[15px] leading-relaxed" style={{ color: textCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl" }}>
                      {showingAgentProgress ? renderAgentProgress()
                        : msg.agent ? <p>{AGENT_ANSWER}</p>
                        : msg.isFirst ? renderFirstAnswer()
                        : <p>מעבד את שאלתך...</p>}
                    </div>
                    {!showingAgentProgress && <MessageActions isDark={isDark} showBadges={showBadges} onToggleBadges={() => setShowBadges((v) => !v)} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-4 pt-2 flex flex-col items-center">
          <div className="w-full max-w-[768px]">
            {renderInput()}
          </div>
        </div>
      </div>
      {renderScopeDropdown()}
      {renderModeDropdown()}
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

// ── History (שיחות אחרונות) ────────────────────────────────────────────────
// Ported from the product's Figma (node 15215:8559), with the ⋯ menu from 17660:11727.
// Every conversation carries the case it ran on as a tag above its title; a conversation
// that spans several cases hides them behind a "N תיקים" chip that opens in place.
type HistCase = { name: string; num: string; kind: string };
type HistConv = { id: string; title: string; cases: HistCase[] };
type HistGroup = { label: string; items: HistConv[] };

const hc = (name: string, num: string, kind = 'ת"א'): HistCase => ({ name, num, kind });

// The case the chat is open on — the same one the composer shows. Users asked for the
// history to open already narrowed to it, so this is what the default filter matches.
const CURRENT_CASE = hc('יעקב אברמוב נ׳ המרכז הרפואי קדם בע"מ', "12345-67-89");

const CASE_POOL: HistCase[] = [
  hc('משה כהן ובניו בע"מ נ׳ משה לוי ובניו בע"מ', "59198-67-89"),
  hc('שרה יוסף בע"מ נ׳ דוד פרץ בע"מ', "59198-67-90"),
  hc("אורי אברהם נגד מיה גולד", "59198-67-91"),
  hc("יוסי רוזן נגד רונית דליה ואחרים", "59198-67-92"),
  hc("בת שבע אלמוג נ׳ עידו שחר", "59198-67-93"),
  hc('דניאל שמש בע"מ נ׳ אורלי בר', "59198-67-94"),
];
// A multi-case conversation just cycles the pool — what the seed is really showing is the
// count. `withCurrent` puts the open case in the list, so the filter has a multi-case hit too.
const manyCases = (n: number, withCurrent = false): HistCase[] => {
  const rest = Array.from({ length: withCurrent ? n - 1 : n }, (_, i) =>
    hc(CASE_POOL[i % CASE_POOL.length].name, `${59198 + i}-67-${89 + i}`));
  return withCurrent ? [CURRENT_CASE, ...rest] : rest;
};

const HISTORY_GROUPS: HistGroup[] = [
  {
    label: "היום",
    items: [
      { id: "h1", title: "הכן רשימת כל האזכורים בסיכומי התובע - חקיקה ופסיקה", cases: [CURRENT_CASE] },
      { id: "h2", title: "השווה בין גרסאות התצהיר של העדים", cases: manyCases(5, true) },
      { id: "h3", title: "סכם את החלטת הביניים מיום 12.6", cases: [CASE_POOL[0]] },
    ],
  },
  {
    label: "אתמול",
    items: [
      { id: "y1", title: "הכן רשימת כל האזכורים בסיכומי התובע - חקיקה ופסיקה", cases: [CASE_POOL[0]] },
      { id: "y2", title: "אתר סתירות בין כתב התביעה לתצהיר", cases: manyCases(5) },
      { id: "y3", title: "טיוטת החלטה בבקשה לסעד זמני", cases: [CURRENT_CASE] },
      { id: "y4", title: "רשימת מועדים דיוניים פתוחים", cases: [CASE_POOL[2]] },
    ],
  },
  {
    label: "ישן יותר",
    items: [
      { id: "o1", title: "הכן רשימת כל האזכורים בסיכומי התובע", cases: manyCases(20) },
      { id: "o2", title: "בדוק טענת התיישנות בכתב התביעה", cases: [CURRENT_CASE] },
      { id: "o3", title: "סכם את חוות דעת המומחה מטעם בית המשפט", cases: [CASE_POOL[4]] },
    ],
  },
];

// The tag reads right-to-left: סוג • מספר — שם התיק. The name sits on the left and is the
// part that gives way, so the identifying half (סוג + מספר) is never the thing that truncates.
function CaseTag({ cs, bg, fg }: { cs: HistCase; bg: string; fg: string }) {
  return (
    <div className="w-full h-5 flex items-center rounded-[4px] pr-2 pl-1 overflow-hidden" style={{ backgroundColor: bg }}>
      <div className="flex-1 min-w-0 flex items-center text-[12px] leading-[18px] whitespace-nowrap" style={{ color: fg }}>
        <span className="flex-shrink-0">{cs.kind}</span>
        <span className="flex-shrink-0 px-[2px] font-light">•</span>
        <span className="flex-shrink-0">{cs.num}</span>
        <span className="flex-shrink-0">{" — "}</span>
        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis">{cs.name}</span>
      </div>
    </div>
  );
}

function HistoryPanel({ isDark, onClose, caseOnly, onCaseOnly }: {
  isDark: boolean;
  onClose?: () => void;
  // Users asked for this: opening the history while a case is open shows that case only. The state
  // lives on the page, not here, so turning the filter off survives closing and reopening the panel.
  caseOnly: boolean;
  onCaseOnly: (v: boolean) => void;
}) {
  const [data, setData] = useState<HistGroup[]>(HISTORY_GROUPS);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HistConv | null>(null);
  // Which multi-case conversations have their case list open. Collapsed by default.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleCases = (id: string) =>
    setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Close the ⋯ menu on an outside press. Containment is tested rather than relying on
  // stopPropagation: mousedown fires before click, so closing blindly here would unmount
  // the menu and its own items would never receive the click.
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  // Same containment test as the ⋯ menu — the trigger sits outside scopeRef, so a blind close on
  // mousedown would swallow the click that is meant to toggle it shut.
  useEffect(() => {
    if (!scopeOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!scopeRef.current?.contains(t) && !scopeRef.current?.parentElement?.contains(t)) setScopeOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [scopeOpen]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 1800);
    return () => clearTimeout(t);
  }, [note]);

  const editItems = (id: string, fn: (it: HistConv) => HistConv[]) =>
    setData((d) => d.map((g) => ({ ...g, items: g.items.flatMap((it) => (it.id === id ? fn(it) : [it])) })));
  const removeConv = (id: string) => editItems(id, () => []);
  const duplicateConv = (it: HistConv) => editItems(it.id, (x) => [x, { ...x, id: `${x.id}-${uid()}` }]);
  const renameConv = (id: string, title: string) => editItems(id, (x) => [{ ...x, title: title.trim() || x.title }]);

  const bg = isDark ? dk.surface : "white";
  const titleCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.iconGray;
  const line = isDark ? dk.border : "#e6e9ef";
  const tagBg = isDark ? "#233150" : "#ebf3ff";
  const chipBg = isDark ? "#1e2a44" : "#f0f7ff";
  // Scoping the list to one case removed every case tag, and with them the panel's only colour.
  // The header line is where it comes back — it's also the element that should carry the most weight.
  const scopeBg = isDark ? "#1e2a44" : "#f0f7ff";
  const scopeBgHover = isDark ? "#24344f" : "#e4efff";
  const rowHover = isDark ? "#222a40" : "#f7fafd";
  const font = "Noto Sans Hebrew, sans-serif";

  const term = q.trim();
  const matchesCase = (it: HistConv) => it.cases.some((cs) => cs.num === CURRENT_CASE.num);
  const groups = data
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          (!caseOnly || matchesCase(it)) &&
          (!term || it.title.includes(term) || it.cases.some((cs) => cs.name.includes(term) || cs.num.includes(term))),
      ),
    }))
    .filter((g) => g.items.length > 0);

  const scopeItem = (v: boolean, label: string, sub: string) => (
    <button
      onClick={() => { setScopeOpen(false); onCaseOnly(v); }}
      className="w-full flex items-start gap-2 px-3 py-2 text-right transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? dk.border : "#ebf3ff")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <Check size={16} style={{ color: c.primary, flexShrink: 0, marginTop: "2px", visibility: caseOnly === v ? "visible" : "hidden" }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] leading-[18px]" style={{ color: titleCol }}>{label}</span>
        <span className="block truncate text-[12px] leading-[16px]" style={{ color: subCol }}>{sub}</span>
      </span>
    </button>
  );

  // The Figma keeps מחיקה in the same colour as the rest — no red — so this does too.
  const menuItem = (label: string, Icon: LucideIcon, onClick: () => void) => (
    <button
      onClick={() => { setMenu(null); onClick(); }}
      className="w-full flex items-center justify-start gap-2 px-[18px] py-2.5 text-[14px] transition-colors"
      style={{ color: titleCol }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? dk.border : "#ebf3ff")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <Icon size={18} style={{ color: subCol, flexShrink: 0 }} />
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: bg, borderLeft: `1px solid ${isDark ? dk.border : c.inputBorder}`, fontFamily: font }} dir="rtl">
      {/* Header — the title and the collapse control sit together on the right, and under them the
          panel names its own subject. The scope isn't a filter bolted onto the list; it's what this
          panel is showing, stated where an interface normally states context. That's what makes the
          default read as a default: there is no control to dismiss, only a subject to change. */}
      <div className="px-[18px] pt-4 pb-2">
        {/* Search is a button until it's wanted, and then it takes this row over. A permanent field
            made the header a third band; on demand it costs nothing while the panel sits idle. */}
        <div className="flex items-center gap-2 h-8">
          {/* The collapse control is the panel's own chrome, so it stays put in both states — only
              the title gives way to the field. Chrome persists, content swaps. */}
          <button
            onClick={onClose}
            className="size-6 flex items-center justify-center rounded hover:bg-black/5 transition-colors flex-shrink-0"
            style={{ color: subCol }}
            title="סגור היסטוריה"
          >
            <PanelRightClose size={18} />
          </button>
          {searchOpen ? (
            <>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setSearchOpen(false); } }}
                placeholder="חיפוש שיחה"
                className="flex-1 min-w-0 h-8 rounded-[4px] px-2.5 outline-none text-[14px] text-right"
                style={{ color: titleCol, fontFamily: font, backgroundColor: isDark ? dk.input : "white", border: `1px solid ${c.primary}` }}
              />
              <button
                onClick={() => { setQ(""); setSearchOpen(false); }}
                className="size-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors flex-shrink-0"
                style={{ color: subCol }}
                title="סגור חיפוש"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <span className="text-[16px] leading-[1.25]" style={{ color: subCol }}>שיחות אחרונות</span>
              <div className="flex-1" />
              <button
                onClick={() => setSearchOpen(true)}
                className="size-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors flex-shrink-0"
                style={{ color: subCol }}
                title="חיפוש שיחה"
              >
                <Search size={17} />
              </button>
            </>
          )}
        </div>
        <div className="relative mt-1">
          {/* One header object, not two bands: the panel name is a small label and the case is the
              line that matters, so they read as label-and-value. The right padding is set so the case
              text starts exactly where the title text does, past the collapse icon.
              The case number is fixed-width and must stay whole — a truncated number reads as a
              mistake — so the name is what gives way, the same rule the case tag follows. */}
          <button
            onClick={() => setScopeOpen((v) => !v)}
            className="w-full h-8 flex items-center gap-1.5 rounded-[4px] pr-3 pl-2 transition-colors"
            style={{ backgroundColor: scopeBg }}
            title={caseOnly ? `${CURRENT_CASE.kind} • ${CURRENT_CASE.num} — ${CURRENT_CASE.name}` : "כל התיקים"}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = scopeBgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = scopeBg)}
          >
            <FolderOpen size={14} style={{ color: subCol, flexShrink: 0 }} />
            <span className="flex-1 min-w-0 flex items-center text-[14px] leading-[20px] whitespace-nowrap" style={{ color: subCol }}>
              {caseOnly ? (
                <>
                  <span className="flex-shrink-0">{CURRENT_CASE.kind} • {CURRENT_CASE.num}</span>
                  <span className="flex-shrink-0 px-1">—</span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis">{CURRENT_CASE.name}</span>
                </>
              ) : "כל התיקים"}
            </span>
            <ChevronDown size={15} style={{ color: subCol, flexShrink: 0, transform: scopeOpen ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
          </button>
          {scopeOpen && (
              <div
                ref={scopeRef}
                className="absolute inset-x-0 top-full mt-1 z-[65] py-1"
                style={{
                  backgroundColor: isDark ? dk.surface : "white",
                  border: `1px solid ${isDark ? dk.border : c.inputBorder}`,
                  borderRadius: "4px",
                  boxShadow: "0px 6px 20px rgba(0,0,0,0.2)",
                }}
              >
                {scopeItem(true, `${CURRENT_CASE.kind} • ${CURRENT_CASE.num}`, CURRENT_CASE.name)}
                {scopeItem(false, "כל התיקים", "כל השיחות, מכל התיקים")}
              </div>
            )}
        </div>
      </div>

      {/* outer ltr → scrollbar on the right (like the chat); inner rtl keeps the content */}
      <div className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
        <div className="px-[18px] pb-4" dir="rtl">
          {groups.length === 0 && (
            <div className="pt-6 flex flex-col items-center gap-2 text-center">
              <p className="text-[14px]" style={{ color: subCol }}>
                {caseOnly && !term ? "אין שיחות קודמות בתיק הזה" : "לא נמצאו שיחות"}
              </p>
              {caseOnly && (
                <button onClick={() => onCaseOnly(false)} className="text-[13px] underline" style={{ color: c.primary }}>
                  הצג את כל התיקים
                </button>
              )}
            </div>
          )}
          {groups.map((g, gi) => (
            <div key={g.label}>
              {/* the day label belongs to the rows under it, so it sits close to them and far from the group above */}
              <div className={`${gi === 0 ? "pt-1" : "pt-4"} text-[14px] leading-[1.25]`} style={{ color: subCol }}>{g.label}</div>
              {g.items.map((it) => {
                const multi = it.cases.length > 1;
                const isOpen = expanded.has(it.id);
                return (
                  <div
                    key={it.id}
                    className="pt-2 pb-2.5 px-2 -mx-2 transition-colors"
                    style={{ borderBottom: `1px solid ${line}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {multi ? (
                      <div className="flex flex-col gap-1 items-start">
                        <button
                          onClick={() => toggleCases(it.id)}
                          className="flex items-center gap-0.5 rounded-[3px] px-[3px] py-[2px] cursor-pointer"
                          style={{ backgroundColor: chipBg, color: titleCol }}
                        >
                          <span className="text-[14px] leading-4">{it.cases.length} תיקים</span>
                          <ChevronDown size={14} style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
                        </button>
                        {isOpen && it.cases.map((cs, i) => <CaseTag key={i} cs={cs} bg={tagBg} fg={titleCol} />)}
                      </div>
                    ) : caseOnly ? null : (
                      // scoped to one case, every row would carry the same tag — the header already
                      // says it, so the list itself is what changes shape between the two scopes
                      <CaseTag cs={it.cases[0]} bg={tagBg} fg={titleCol} />
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      {renaming?.id === it.id ? (
                        <input
                          autoFocus
                          value={renaming.draft}
                          onChange={(e) => setRenaming({ id: it.id, draft: e.target.value })}
                          onBlur={() => { renameConv(it.id, renaming.draft); setRenaming(null); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { renameConv(it.id, renaming.draft); setRenaming(null); }
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="flex-1 min-w-0 text-right text-[14px] leading-4 rounded px-1 py-0.5 outline-none"
                          style={{ color: titleCol, backgroundColor: isDark ? dk.input : "white", border: `1px solid ${c.primary}`, fontFamily: font }}
                        />
                      ) : (
                        <button className="flex-1 min-w-0 text-right text-[14px] leading-4" style={{ color: titleCol }}>
                          <span
                            className="block overflow-hidden"
                            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}
                          >
                            {it.title}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu((m) => (m?.id === it.id ? null : { id: it.id, top: Math.min(r.bottom + 4, window.innerHeight - 150), left: r.left }));
                        }}
                        className="size-6 flex items-center justify-center rounded flex-shrink-0 hover:bg-black/5 transition-colors"
                        style={{ color: titleCol, backgroundColor: menu?.id === it.id ? (isDark ? dk.border : c.hoverBg) : undefined }}
                        title="אפשרויות"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>

                    {menu?.id === it.id && (
                      <div
                        ref={menuRef}
                        className="fixed z-[70] py-1 overflow-hidden"
                        style={{
                          top: menu.top, left: menu.left, width: "176px",
                          backgroundColor: isDark ? dk.surface : "white",
                          border: `1px solid ${isDark ? dk.border : c.inputBorder}`,
                          borderRadius: "4px",
                          boxShadow: "0px 6px 20px rgba(0,0,0,0.2)",
                        }}
                        dir="rtl"
                      >
                        {menuItem("העתקת שיחה", Copy, () => {
                          navigator.clipboard?.writeText(it.title);
                          setNote("השיחה הועתקה");
                        })}
                        {menuItem("שינוי שם", Pencil, () => setRenaming({ id: it.id, draft: it.title }))}
                        {menuItem("מחיקה", Trash2, () => setPendingDelete(it))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {note && (
        <div
          className="absolute left-1/2 bottom-4 z-[75] px-3 py-1.5 rounded-md text-[13px] whitespace-nowrap"
          style={{ transform: "translateX(-50%)", backgroundColor: "#2b3247", color: "white" }}
        >
          {note}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDelete
          isDark={isDark}
          kind="שיחה"
          name={pendingDelete.title}
          onConfirm={() => { removeConv(pendingDelete.id); setPendingDelete(null); }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ── Examples (דוגמאות) ─────────────────────────────────────────────────────
// A דוגמה is the named item in the panel; it holds up to MAX_TEXTS pasted טקסטים,
// and all of its texts together may not exceed MAX_WORDS. The quota is per‑example:
// one example filling up takes nothing away from another.
const MAX_TEXTS = 5;
const MAX_WORDS = 50000;
// Vibe's own status colours: --negative-color and --color-working_orange
const RED = "#d83a52";
const AMBER = "#fdab3d";
const NEAR_FULL = 0.8; // the bar turns amber from here up, so it warns instead of only mirroring

type ExText = { id: string; title: string; body: string };
type Example = { id: string; name: string; texts: ExText[]; edited: string };

const countWords = (s: string) => {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
};
const fmtNum = (n: number) => n.toLocaleString("he-IL");
const uid = () => Math.random().toString(36).slice(2, 9);

const SEED_EXAMPLES: Example[] = [
  {
    id: "ex1",
    name: "פסקי דין בנזקי גוף",
    edited: "01/03/2025",
    texts: [
      {
        id: "t1",
        title: "פס״ד שמעוני נ׳ טשרניחובסקי",
        body: "בית המשפט דן בתביעת נזקי גוף שהוגשה בגין תאונת דרכים מיום 14.2.2023. התובעת, ילידת 1978, נפגעה בעת שנהגה ברכבה בצומת מרומזר. הנתבעת לא הגישה כתב הגנה במועד, ובקשתה להארכת מועד נדחתה בהחלטה מיום 3.5.2023.\n\nלאחר שעיינתי בחוות דעת המומחה הרפואי מטעם בית המשפט, ובשים לב לנכות התפקודית שנקבעה בשיעור 19%, מצאתי כי יש לקבל את התביעה בחלקה.",
      },
      { id: "t2", title: "טקסט 2", body: "" },
    ],
  },
  {
    id: "ex2",
    name: "הודעות לצדדים לפני דיון",
    edited: "03/01/2025",
    texts: [
      {
        id: "t3",
        title: "טקסט 1",
        body: "לכבוד הצדדים — הנדון: דיון ההוכחות הקבוע ליום 19.5.2024. בית המשפט מבקש להפנות את תשומת לב הצדדים לכך שרשימת העדים תוגש לא יאוחר משבעה ימים לפני מועד הדיון.",
      },
    ],
  },
];

function ExamplesPanel({
  isDark, examples, onAdd, onUse, onEdit, onDelete,
}: {
  isDark: boolean;
  examples: Example[];
  onAdd: () => void;
  onUse: (ex: Example) => void;
  onEdit: (ex: Example) => void;
  onDelete: (ex: Example) => void;
}) {
  // The ⋮ menu is positioned fixed (anchored to the button) so it can open to the LEFT of the
  // dots and hang outside the panel without being clipped by its scroll container.
  const [menu, setMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    // Close on an outside press only. Testing containment (rather than relying on
    // stopPropagation) matters: mousedown fires before click, so closing blindly here
    // unmounts the item and its click never lands — which is why the menu's own
    // עריכה/מחיקה did nothing.
    const close = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (menuRef.current?.contains(t as Node)) return;
      if (t instanceof Element && t.closest("[data-ex-menu-btn]")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", close as unknown as EventListener);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("resize", close as unknown as EventListener); };
  }, [menu]);

  const bg = isDark ? dk.surface : "white";
  const titleCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : "#eef2f7";
  const openMenu = examples.find((e) => e.id === menu?.id);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bg, borderLeft: `1px solid ${isDark ? dk.border : c.inputBorder}` }} dir="rtl">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Paperclip size={18} style={{ color: isDark ? dk.textMuted : c.iconGray }} />
        <span className="text-[16px]" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>דוגמאות</span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="size-6 flex items-center justify-center rounded transition-colors hover:bg-black/5"
          style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: isDark ? dk.textMuted : c.iconGray }}
          title="הוספת דוגמה חדשה"
        >
          <Plus size={14} />
        </button>
      </div>


      <div className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
        <div className="px-3 pt-1 pb-3 flex flex-col gap-1.5" dir="rtl">
          {examples.length === 0 ? (
            <div className="px-4 pt-14 text-center" style={{ fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              <FileText size={40} style={{ color: subCol, opacity: 0.35, margin: "0 auto 14px" }} />
              <p className="text-[13px] leading-relaxed" style={{ color: subCol }}>
                עוד לא נוספו דוגמאות. כדי להוסיף דוגמה חדשה, יש ללחוץ על כפתור הפלוס בחלקו העליון של החלון.
              </p>
              <p className="text-[13px] leading-relaxed mt-3" style={{ color: subCol }}>
                בכל דוגמה ניתן להזין עד {MAX_TEXTS} טקסטים, בהיקף כולל של 50 אלף מילים.
              </p>
            </div>
          ) : (
            examples.map((ex) => (
              <div
                key={ex.id}
                className="relative rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[0.03] flex items-start gap-2"
                style={{ border: `1px solid ${isDark ? dk.border : "#e8eef7"}`, fontFamily: "Noto Sans Hebrew, sans-serif" }}
              >
                <button className="flex-1 min-w-0 text-right" onClick={() => onUse(ex)} title="שימוש בדוגמה">
                  <div className="text-[14px] truncate" style={{ color: titleCol }}>{ex.name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: subCol }}>עריכה אחרונה {ex.edited}</div>
                </button>
                <button
                  data-ex-menu-btn
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu(menu?.id === ex.id ? null : { id: ex.id, top: r.bottom + 4, right: window.innerWidth - r.right });
                  }}
                  className="size-6 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors"
                  style={{ color: isDark ? dk.textMuted : c.iconGray }}
                  title="פעולות"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ⋮ menu — opens to the left of the dots; icon leads each row (right side, RTL) */}
      {menu && openMenu && (
        <div
          dir="rtl"
          ref={menuRef}
          className="rounded-md overflow-hidden shadow-lg"
          style={{
            position: "fixed", top: menu.top, right: menu.right, zIndex: 55, minWidth: "168px",
            backgroundColor: bg, border: `1px solid ${isDark ? dk.border : c.border}`,
            fontFamily: "Noto Sans Hebrew, sans-serif",
          }}
        >
          {([
            { label: "שימוש בדוגמה", Icon: UseExampleIcon, act: () => onUse(openMenu), col: titleCol },
            { label: "עריכה", Icon: Pencil, act: () => onEdit(openMenu), col: titleCol },
            { label: "מחיקה", Icon: Trash2, act: () => onDelete(openMenu), col: RED },
          ] as const).map(({ label, Icon, act, col }, i) => (
            <button
              key={label}
              onClick={() => { setMenu(null); act(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
              style={{ color: col, borderTop: i ? `1px solid ${line}` : undefined }}
            >
              <Icon size={15} className="flex-none" />
              <span className="flex-1 text-right">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExampleModal({
  isDark, initial, onSave, onClose,
}: {
  isDark: boolean;
  initial: Example | null;
  onSave: (ex: Example) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [texts, setTexts] = useState<ExText[]>(
    initial?.texts.length ? initial.texts : [{ id: uid(), title: "טקסט 1", body: "" }]
  );
  const [active, setActive] = useState(0);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [pendingText, setPendingText] = useState<number | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const ruleRef = useRef<HTMLDivElement>(null);
  const ruleBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showRule) return;
    // containment test, not a blind close — see the ⋮ menu: mousedown precedes click
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ruleRef.current?.contains(t) || ruleBtnRef.current?.contains(t)) return;
      setShowRule(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showRule]);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textGray;
  const line = isDark ? dk.border : c.inputBorder;
  // Tabs: boxed and adjacent as in the Figma, sitting on top of the field. The active one
  // combines Vibe's blue underline with a תכלת fill. Hover is Vibe's --primary-background-hover-color.
  const titleCol = isDark ? dk.textMuted : c.textLight;
  // Tabs carry no fill in either state — the selected one is marked by Vibe's blue underline
  // alone, and a hairline separates neighbours.
  const hoverBg = isDark ? "rgba(200,214,229,0.08)" : c.hoverBg;

  const counts = texts.map((t) => countWords(t.body));
  const total = counts.reduce((a, b) => a + b, 0);
  const textsUsed = counts.filter((n) => n > 0).length;
  const over = total > MAX_WORDS;
  const near = !over && total >= MAX_WORDS * NEAR_FULL;
  const atTextLimit = texts.length >= MAX_TEXTS;

  // Save stays enabled, as it is in the live product. Validation is silent until the user
  // actually tries to save, then stays on and clears field by field as each is fixed.
  const nameMissing = attempted && !name.trim();
  const textMissing = attempted && total === 0;
  const saveBlocked = !name.trim() ? "יש להזין שם לדוגמה."
    : total === 0 ? "יש להזין טקסט בלפחות אחד המסכים."
    : over ? `לא ניתן לשמור בחריגה מהמכסה. יש להסיר ${fmtNum(total - MAX_WORDS)} מילים.`
    : "";

  const setBody = (i: number, v: string) =>
    setTexts((prev) => prev.map((t, k) => (k === i ? { ...t, body: v } : t)));
  const setTitle = (i: number, v: string) =>
    setTexts((prev) => prev.map((t, k) => (k === i ? { ...t, title: v } : t)));

  const addText = () => {
    if (atTextLimit) return;
    setTexts((prev) => [...prev, { id: uid(), title: `טקסט ${prev.length + 1}`, body: "" }]);
    setActive(texts.length);
  };
  const removeText = (i: number) => {
    if (texts.length === 1) { setBody(0, ""); return; }
    setTexts((prev) => prev.filter((_, k) => k !== i));
    setActive((a) => (a >= i && a > 0 ? a - 1 : a));
  };

  const save = () => {
    if (saveBlocked) { setAttempted(true); return; }
    onSave({
      id: initial?.id ?? uid(),
      name: name.trim(),
      texts: texts.filter((t) => t.body.trim()),
      edited: new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: "min(1100px, 92vw)", height: "min(760px, 88vh)",
          backgroundColor: surface, fontFamily: "Noto Sans Hebrew, sans-serif",
        }}
      >
        {/* header */}
        <div className="flex items-start px-6 pt-5 pb-4">
          <div className="flex-1 min-w-0">
            {/* pale title, as in the Figma — the work area carries the emphasis, not the chrome */}
            <div className="text-[18px]" style={{ color: textCol, fontWeight: 400 }}>
              {initial ? "עריכת דוגמה" : "הוספת דוגמה חדשה"}
            </div>
          </div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {/* name */}
        <div className="px-6 pb-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="הזינו שם לדוגמה"
            className="w-full px-3 py-2.5 text-[16px] outline-none transition-colors"
            style={{ border: `1px solid ${nameMissing ? RED : line}`, borderRadius: "4px", backgroundColor: surface, color: textCol }}
          />
        </div>

        {/* validation sits with the thing it is about — fixed height so nothing shifts */}
        <div className="px-6 pb-1 text-[12.5px]" style={{ color: RED, height: "20px", lineHeight: "16px" }}>
          {nameMissing ? "יש להזין שם לדוגמה" : ""}
        </div>

        {/* tabs — narrowed so five fit without scrolling */}
        <div className="px-6 flex items-stretch" style={{ height: "38px" }}>
          {texts.map((t, i) => {
            const on = i === active;
            return (
              <Fragment key={t.id}>
              {i > 0 && (
                <div className="flex-none self-end" style={{ width: "1px", height: "30px", marginBottom: "-1px", backgroundColor: line }} />
              )}
              <div
                onClick={() => setActive(i)}
                className="flex-1 min-w-0 max-w-[200px] cursor-pointer flex items-center gap-1.5 px-3 transition-colors relative"
                style={{
                  // React-controlled, never written straight to the DOM: setting it imperatively
                  // in onMouseEnter left the grey stuck once a hovered tab became the active one
                  backgroundColor: !on && hoveredTab === i ? hoverBg : "transparent",
                  // longhands only — mixing the `border` shorthand with `borderBottom` let the
                  // shorthand win and the bottom edge came back, doubling the field's own border
                  borderTop: "none",
                  borderInlineStart: "none",
                  borderInlineEnd: "none",
                  borderBottom: on ? `2px solid ${c.primary}` : "none",
                  borderRadius: "4px 4px 0 0",
                  marginBottom: on ? "-1px" : 0,
                  color: on ? textCol : subCol,
                  fontWeight: on ? 500 : 400,
                }}
                onMouseEnter={() => setHoveredTab(i)}
                onMouseLeave={() => setHoveredTab((h) => (h === i ? null : h))}
              >
                {renaming === i ? (
                  <input
                    autoFocus
                    value={t.title}
                    onChange={(e) => setTitle(i, e.target.value)}
                    onBlur={() => setRenaming(null)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setRenaming(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-right"
                    style={{ color: textCol }}
                  />
                ) : (
                  <span className="flex-1 min-w-0 truncate text-[14px] text-right" title={t.title}>{t.title}</span>
                )}
                {/* the two actions belong to the text you are editing — hidden on the rest */}
                {on && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenaming(i); }}
                      className="flex-none opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: subCol }}
                      title="שינוי שם"
                    ><Pencil size={13} /></button>
                    <button
                      // nothing to lose in an empty tab — only confirm when there is text
                      onClick={(e) => { e.stopPropagation(); if (counts[i] === 0) removeText(i); else setPendingText(i); }}
                      className="flex-none opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: subCol }}
                      title="מחיקת טקסט"
                    ><Trash2 size={13} /></button>
                  </>
                )}
              </div>
              </Fragment>
            );
          })}

          <div className="flex-none flex items-center px-1.5">
            <button
              onClick={addText}
              disabled={atTextLimit}
              className="size-7 flex items-center justify-center rounded transition-colors disabled:cursor-not-allowed"
              style={{ color: subCol, opacity: atTextLimit ? 0.4 : 1 }}
              onMouseEnter={(e) => { if (!atTextLimit) e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              title={atTextLimit ? `לא ניתן להוסיף יותר מ־${MAX_TEXTS} טקסטים לדוגמה. כדי להוסיף טקסט חדש, יש למחוק אחד מהקיימים.` : "הוספת טקסט"}
            >
              <Plus size={15} />
            </button>
          </div>

          {/* no rail past the plus — the line stops where the tabs stop */}
          <div className="flex-1" />
        </div>

        {/* the field — the guidance lives inside it as a placeholder while it is empty */}
        <div className="px-6 flex-1 min-h-0">
          <textarea
            value={texts[active]?.body ?? ""}
            onChange={(e) => setBody(active, e.target.value)}
            placeholder="לכאן ניתן להדביק את הנוסח עליו תרצו שהצ׳ט יתבסס בבניית הדוגמה (ככל שתוסיפו יותר טקסטים, יש יותר סיכוי שהצ׳ט יקלע למה שאתם מחפשים)"
            className="w-full h-full resize-none px-4 py-3 text-[14px] leading-relaxed outline-none transition-colors focus:border-[#0073ea] placeholder:text-[15px]"
            // top corners stay square where the tab strip meets it; the bottom two match the
            // name field's 4px so the two inputs read as one family
            style={{ border: `1px solid ${textMissing ? RED : line}`, borderRadius: "0 0 4px 4px", backgroundColor: surface, color: textCol }}
          />
        </div>

        {/* per-text count — bottom-left, outside the field */}
        {/* fixed height + line-height: a min-height alone still grew when the text appeared
            (12px inheriting the body's 1.72 line-height ≈ 20.6px), which nudged the field */}
        <div className="px-6 pt-1 text-[12px] flex items-start" style={{ height: "22px", lineHeight: "18px" }}>
          {/* the missing-text notice takes this row when there is nothing to count anywhere */}
          <span style={{ color: RED }}>{textMissing ? "יש להדביק טקסט אחד לפחות כדי לשמור" : ""}</span>
          <span className="flex-1" />
          <span style={{ color: subCol }}>{counts[active] > 0 ? `${fmtNum(counts[active])} מילים` : ""}</span>
        </div>

        {/* footer — quota counter pinned to the window's right edge, buttons at the left */}
        <div>
          <div className="flex items-start px-6 pt-0 pb-5 gap-3">
            <div className="flex-none text-right" style={{ width: "300px" }}>
              <div className="text-[13px] mb-1.5 whitespace-nowrap flex items-center gap-1.5 relative" style={{ color: over ? RED : subCol }}>
                <span>
                  {over ? (
                    <span style={{ fontWeight: 600 }}>חריגה של {fmtNum(total - MAX_WORDS)} מילים מהמכסה</span>
                  ) : (
                    <>
                      {/* what the user has entered reads dark; the ceiling stays muted */}
                      {/* counts texts that actually hold something — an empty tab is not a text,
                          and empty tabs are dropped on save anyway */}
                      <span style={{ color: textCol, fontWeight: 700 }}>{textsUsed}</span> מתוך {MAX_TEXTS} טקסטים
                      {" · "}
                      <span style={{ color: textCol, fontWeight: 700 }}>{fmtNum(total)}</span> מתוך {fmtNum(MAX_WORDS)} מילים
                    </>
                  )}
                </span>
                <span className="relative flex-none flex items-center">
                  <button
                    ref={ruleBtnRef}
                    onClick={() => setShowRule((v) => !v)}
                    className="flex items-center justify-center transition-opacity hover:opacity-100"
                    style={{ color: subCol, opacity: showRule ? 1 : 0.6, lineHeight: 0 }}
                    title="על המכסה"
                  ><Info size={14} /></button>

                  {showRule && (
                    <div
                      ref={ruleRef}
                      className="absolute shadow-lg px-3.5 py-2.5 text-[12.5px] leading-relaxed"
                      style={{
                        // the icon lands about three quarters down the popover, not at its middle
                        insetInlineStart: "calc(100% + 8px)", top: "50%", transform: "translateY(-90%)",
                        width: "270px", zIndex: 5, borderRadius: "4px",
                        backgroundColor: surface, border: `1px solid ${isDark ? dk.border : c.border}`,
                        color: subCol, fontWeight: 400, whiteSpace: "normal", textAlign: "right",
                      }}
                    >
                      בכל דוגמה ניתן להזין עד {MAX_TEXTS} טקסטים, בהיקף כולל של 50 אלף מילים.
                    </div>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? dk.border : "#eef1f7" }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${Math.min(100, (total / MAX_WORDS) * 100)}%`, backgroundColor: over ? RED : near ? AMBER : c.primary }}
                />
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="rounded-md px-5 py-2 text-[14px] transition-colors hover:bg-black/5 mt-4"
              style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}
            >ביטול</button>
            <button
              onClick={save}
              className="rounded-md px-6 py-2 text-[14px] text-white transition-opacity hover:opacity-90 mt-4"
              style={{ backgroundColor: c.primary }}
            >שמירה</button>
          </div>
        </div>
      </div>

      {pendingText !== null && (
        <ConfirmDelete
          isDark={isDark}
          kind="טקסט"
          name={texts[pendingText]?.title ?? ""}
          onConfirm={() => { removeText(pendingText); setPendingText(null); }}
          onClose={() => setPendingText(null)}
        />
      )}
    </div>
  );
}

function ConfirmDelete({ isDark, kind, name, onConfirm, onClose }: { isDark: boolean; kind: "דוגמה" | "טקסט" | "שיחה"; name: string; onConfirm: () => void; onClose: () => void }) {
  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-2xl px-7 py-6 text-center"
        style={{ width: "min(420px, 90vw)", backgroundColor: surface, fontFamily: "Noto Sans Hebrew, sans-serif" }}
      >
        <div className="text-[15px]" style={{ color: subCol }}>מחיקת {kind}</div>
        <div className="text-[16px] leading-relaxed mt-4" style={{ color: textCol }}>
          למחוק את ה{kind} ׳{name}׳?
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={onClose} className="rounded-md px-7 py-2 text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>ביטול</button>
          <button onClick={onConfirm} className="rounded-md px-8 py-2 text-[14px] text-white transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary }}>אישור</button>
        </div>
      </div>
    </div>
  );
}

export default function MishpatPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);     // documents
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [convKey, setConvKey] = useState(0);
  const [vw, setVw] = useState(1280);
  // History defaults to the open case. Turning it off is remembered while this conversation lasts —
  // it lives here rather than in the panel so closing and reopening the panel doesn't undo the
  // choice; a new conversation puts the default back.
  const [histCaseOnly, setHistCaseOnly] = useState(true);

  // Examples (דוגמאות) — the panel list, the open editor, the pending delete, and the save toast
  const [examples, setExamples] = useState<Example[]>(SEED_EXAMPLES);
  const [editing, setEditing] = useState<{ ex: Example | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Example | null>(null);
  const [inUse, setInUse] = useState<Example | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // Responsive breakpoints
  const BOTH_MIN = 1080; // >= : both side panels may be open together (push)
  const CHAT_ONLY = 760; // <  : drawer mode — a panel overlays the chat (ChatGPT-style)
  const canBoth = vw >= BOTH_MIN;
  const narrow = vw < CHAT_ONLY;

  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // On crossing INTO narrow (below CHAT_ONLY), default to closed — a drawer opens only on an explicit click.
  const prevNarrow = useRef(false);
  useEffect(() => {
    const nowNarrow = vw < CHAT_ONLY;
    if (nowNarrow && !prevNarrow.current) {
      setIsPanelOpen(false);
      setIsHistoryOpen(false);
      setIsExamplesOpen(false);
    }
    prevNarrow.current = nowNarrow;
    // When both can't fit, keep only one open — and do NOT auto-restore when the window grows again.
    if (vw < BOTH_MIN && isPanelOpen && (isHistoryOpen || isExamplesOpen)) { setIsHistoryOpen(false); setIsExamplesOpen(false); }
  }, [vw, isPanelOpen, isHistoryOpen, isExamplesOpen]);

  // Exclusive when there isn't room for both: opening one closes the other.
  // History and examples share the right-hand slot, so they always close each other.
  const toggleDocs = () =>
    setIsPanelOpen((v) => { const nv = !v; if (nv && vw < BOTH_MIN) { setIsHistoryOpen(false); setIsExamplesOpen(false); } return nv; });
  const toggleHistory = () =>
    setIsHistoryOpen((v) => { const nv = !v; if (nv) { setIsExamplesOpen(false); if (vw < BOTH_MIN) setIsPanelOpen(false); } return nv; });
  const toggleExamples = () =>
    setIsExamplesOpen((v) => { const nv = !v; if (nv) { setIsHistoryOpen(false); if (vw < BOTH_MIN) setIsPanelOpen(false); } return nv; });

  const saveExample = (ex: Example) => {
    setExamples((prev) => (prev.some((p) => p.id === ex.id) ? prev.map((p) => (p.id === ex.id ? ex : p)) : [ex, ...prev]));
    setEditing(null);
    setToast("הדוגמה נשמרה");
  };

  const topIcons = [
    { Icon: Clock, label: "היסטוריה" },
    { Icon: Bookmark, label: "סימניות" },
    { Icon: Paperclip, label: "דוגמאות" },
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
        {/* ── LEFT: Documents — column that PUSHES the chat (push mode); a 40px rail launcher in drawer mode ── */}
        <div
          className="relative flex-shrink-0 transition-all duration-300"
          style={{ width: isPanelOpen && !narrow ? "300px" : "40px", overflow: "visible", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}
        >
          <div className="absolute inset-0 overflow-y-auto docs-scroll" style={{ overflowX: "visible" }}>
            {isPanelOpen && !narrow ? <DocumentPanelOpen isDark={isDark} /> : <DocumentPanelClosed isDark={isDark} />}
          </div>

          {/* Toggle button */}
          <button
            onClick={toggleDocs}
            className="absolute z-20 size-6 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors"
            style={{ border: `1px solid ${c.border}`, top: "88px", right: "-12px" }}
            title={isPanelOpen ? "סגור מסמכים" : "פתח מסמכים"}
          >
            {isPanelOpen
              ? <ChevronLeft size={16} style={{ color: c.iconGray }} />
              : <ChevronRight size={16} style={{ color: c.iconGray }} />}
          </button>
        </div>

        {/* ── CHAT: flex-1 + min-w-0; hosts the drawer overlays in narrow mode ── */}
        <div className="flex-1 flex min-w-0 relative" style={{ paddingBottom: FOOTER_HEIGHT }}>
          <ChatArea isDark={isDark} conversationKey={convKey} inUseName={inUse?.name ?? null} onClearInUse={() => setInUse(null)} />

          {/* Drawer backdrop (narrow, any panel open) — click to dismiss → back to typing */}
          {narrow && (isPanelOpen || isHistoryOpen || isExamplesOpen) && (
            <div
              onClick={() => { setIsPanelOpen(false); setIsHistoryOpen(false); setIsExamplesOpen(false); }}
              className="absolute inset-0 z-30"
              style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
            />
          )}

          {/* Documents drawer (narrow) — overlays from the left */}
          {narrow && isPanelOpen && (
            <div className="absolute top-0 bottom-0 left-0 z-40" style={{ width: "300px", maxWidth: "85%", backgroundColor: isDark ? dk.surface : "white" }}>
              <div className="absolute inset-0 overflow-y-auto docs-scroll"><DocumentPanelOpen isDark={isDark} /></div>
              <button onClick={() => setIsPanelOpen(false)} className="absolute z-50 size-6 flex items-center justify-center rounded-full bg-white shadow" style={{ top: "8px", right: "8px", border: `1px solid ${c.border}` }} title="סגור">
                <X size={14} style={{ color: c.iconGray }} />
              </button>
            </div>
          )}

          {/* History drawer (narrow) — overlays from the right */}
          {narrow && isHistoryOpen && (
            <div className="absolute top-0 bottom-0 right-0 z-40" style={{ width: "300px", maxWidth: "85%", backgroundColor: isDark ? dk.surface : "white" }}>
              {/* the panel's own header control closes it — no floating X on top of it */}
              <HistoryPanel isDark={isDark} onClose={() => setIsHistoryOpen(false)} caseOnly={histCaseOnly} onCaseOnly={setHistCaseOnly} />
            </div>
          )}

          {/* Examples drawer (narrow) — overlays from the right, same slot as history */}
          {narrow && isExamplesOpen && (
            <div className="absolute top-0 bottom-0 right-0 z-40" style={{ width: "300px", maxWidth: "85%", backgroundColor: isDark ? dk.surface : "white" }}>
              <ExamplesPanel
                isDark={isDark}
                examples={examples}
                onAdd={() => setEditing({ ex: null })}
                onUse={(ex) => { setInUse(ex); setToast(`הדוגמה "${ex.name}" בשימוש`); }}
                onEdit={(ex) => setEditing({ ex })}
                onDelete={(ex) => setPendingDelete(ex)}
              />
              <button onClick={() => setIsExamplesOpen(false)} className="absolute z-50 size-6 flex items-center justify-center rounded-full bg-white shadow" style={{ top: "8px", left: "8px", border: `1px solid ${c.border}` }} title="סגור">
                <X size={14} style={{ color: c.iconGray }} />
              </button>
            </div>
          )}

          {/* ── Page footer — legal disclaimer, pinned once for the chat column (not repeated per chat state) ── */}
          <div
            className="absolute bottom-0 left-0 right-0 flex justify-center px-6 z-40"
            style={{ height: FOOTER_HEIGHT, backgroundColor: isDark ? dk.bg : "white" }}
          >
            <div className="w-full max-w-[768px] flex flex-col items-center justify-end gap-0.5" style={{ paddingBottom: "20px" }}>
              <p
                className="text-[14px] text-center"
                style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl" }}
              >
                תוכנה זו מבוססת AI, ועלולה שלא לדייק ואף להטעות; היא אינה תחליף לשיקול דעת שיפוטי ומחייבת בחינה עצמאית.
              </p>
              <p
                className="text-[14px] text-center"
                style={{ color: isDark ? dk.textMuted : c.textLight, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", direction: "rtl" }}
              >
                הכלי משמש כאמצעי עזר בלבד לביצוע משימות טכניות. על המשתמש חובה להפעיל שיקול דעת בעת עיון או שימוש בתוכן המופק. הכלי אינו מתחייב לכסות את מלוא הפרטים, העובדות והטענות.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: History panel — column that PUSHES the chat (push mode only) ── */}
        {!narrow && isHistoryOpen && (
          <div className="flex-shrink-0 transition-all duration-300" style={{ width: "300px", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}>
            <HistoryPanel isDark={isDark} onClose={() => setIsHistoryOpen(false)} caseOnly={histCaseOnly} onCaseOnly={setHistCaseOnly} />
          </div>
        )}

        {/* ── RIGHT: Examples panel — same slot as history (push mode only) ── */}
        {!narrow && isExamplesOpen && (
          <div className="flex-shrink-0 transition-all duration-300" style={{ width: "300px", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}>
            <ExamplesPanel
              isDark={isDark}
              examples={examples}
              onAdd={() => setEditing({ ex: null })}
              onUse={(ex) => { setInUse(ex); setToast(`הדוגמה "${ex.name}" בשימוש`); }}
              onEdit={(ex) => setEditing({ ex })}
              onDelete={(ex) => setPendingDelete(ex)}
            />
          </div>
        )}

        {/* ── Right icon bar ── */}
        <div className="w-[55px] flex-shrink-0 flex flex-col items-center pt-5 pb-4 border-l" style={{ borderColor: isDark ? dk.border : "#ebf3ff", backgroundColor: sidebarBg }}>
          <button
            onClick={() => { setConvKey((k) => k + 1); setIsPanelOpen(false); setIsHistoryOpen(false); setHistCaseOnly(true); }}
            className="size-8 flex items-center justify-center rounded mb-4 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: c.primary, color: "white" }}
            title="שיחה חדשה"
          >
            <Plus size={16} />
          </button>
          <div className="flex flex-col items-center gap-2">
            {topIcons.map(({ Icon, label }) => {
              const isHist = label === "היסטוריה";
              const isEx = label === "דוגמאות";
              const active = (isHist && isHistoryOpen) || (isEx && isExamplesOpen);
              return (
                <button
                  key={label}
                  onClick={isHist ? toggleHistory : isEx ? toggleExamples : undefined}
                  className="size-8 flex items-center justify-center rounded transition-colors hover:bg-black/5"
                  style={{ color: active ? "white" : iconCol, backgroundColor: active ? c.primary : undefined }}
                  title={label}
                >
                  <Icon size={19} />
                </button>
              );
            })}
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

        {/* ── Responsive-mode indicator (demo aid — resize the window to watch it switch) ── */}
        <div
          className="absolute left-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] shadow-md"
          style={{ bottom: FOOTER_HEIGHT + 12, transform: "translateX(-50%)", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${c.border}`, color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: narrow ? "#d83a52" : canBoth ? c.primary : "#e0a000" }} />
          <span>{narrow ? "מגירה (Drawer)" : canBoth ? "שני פאנלים אפשריים" : "פאנל אחד בכל פעם"}</span>
          <span style={{ color: c.textLight }}>·</span>
          <span style={{ color: c.textLight }}>{vw}px</span>
        </div>
      </div>

      {/* ── Examples: editor, delete confirmation, save toast ── */}
      {editing && (
        <ExampleModal
          key={editing.ex?.id ?? "new"}
          isDark={isDark}
          initial={editing.ex}
          onSave={saveExample}
          onClose={() => setEditing(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDelete
          isDark={isDark}
          kind="דוגמה"
          name={pendingDelete.name}
          onConfirm={() => {
            setExamples((prev) => prev.filter((p) => p.id !== pendingDelete.id));
            setInUse((u) => (u?.id === pendingDelete.id ? null : u));
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
      {toast && (
        <div
          className="fixed left-1/2 z-[80] flex items-center gap-2 px-4 py-2.5 rounded-md shadow-lg text-[13px]"
          style={{ bottom: "32px", transform: "translateX(-50%)", backgroundColor: "#2b3247", color: "white", fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
        >
          <Check size={15} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
