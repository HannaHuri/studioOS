"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Copy, Eye, EyeClosed, FileText, FolderOpen, Globe,
  HelpCircle, Link, MessageSquare, Minimize2, Moon, MoreHorizontal,
  Paperclip, Plus, Quote, RotateCw, Search, Split, Sun,
  ThumbsDown, ThumbsUp,
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

// ── Auto tooltip text ──────────────────────────────────────────────────────
const AUTO_TIP = `כאשר אפשרות בחירת מסמכים אוטומטית מופעלת, צ'ט המשפט בוחר באופן אוטומטי במסמכים המתאימים ביותר למענה על השאלה שלך.
אם הבחירה האוטומטית לא מתאימה לך מכל סיבה שהיא, תוכל לכבות אותה בכל שלב ולבחור את המסמכים באופן ידני.`;

const initialDocs = [
  { name: "כתב תביעה", count: "320K", checked: false },
  { name: "כתב הגנה", count: "200K", checked: false },
  { name: "תצהיר", count: "12.2K", checked: true },
  { name: "פרוטוקול", count: "761", checked: false },
  { name: "עתירה", count: "654", checked: true },
  { name: "בקשה", count: "940", checked: false },
  { name: "חוות דעת", count: "9K", checked: false },
];

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
    <div className="h-full flex flex-col overflow-y-auto" style={{ backgroundColor: bg }}>
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

        <button className="size-7 flex items-center justify-center rounded border hover:bg-black/5 transition-colors flex-shrink-0" style={{ borderColor: borderCol }} title="רענון">
          <RotateCw size={14} style={{ color: c.iconGray }} />
        </button>
        <button className="size-7 flex items-center justify-center rounded border hover:bg-black/5 transition-colors flex-shrink-0" style={{ borderColor: borderCol }} title="חיפוש">
          <Search size={14} style={{ color: c.iconGray }} />
        </button>
      </div>

      {/* Case box */}
      <div className="mx-3 mb-3" ref={caseCardRef}>
        <div className="rounded-md border overflow-hidden transition-colors" style={{ backgroundColor: panelBg, borderColor: borderCol }}>
          <button className="w-full px-3 py-2.5 text-center relative hover:bg-black/5 transition-colors" dir="rtl" onClick={() => setIsCaseOpen((v) => !v)}>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: grayCol }}>
              {isCaseOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </span>
            <p className="text-[15px] leading-[18px]" style={{ color: grayCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>12345-67-89</p>
            <p className="text-[14px] leading-[17px] mx-auto" style={{ color: grayCol, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif", maxWidth: "180px" }}>
              משה כהן ובניו בע&quot;מ נגד משה לוי ובניו בע&quot;מ
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

              {/* Individual rows — indented both sides */}
              <div className="mt-1 flex flex-col gap-2.5" dir="rtl">
                {docs.map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between" style={{ paddingRight: "20px", paddingLeft: "20px" }}>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <CheckboxBlue checked={doc.checked} onToggle={() => toggleDoc(doc.name)} />
                      <span className="text-[14px] whitespace-nowrap" style={{ color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ChevronDown size={14} style={{ color: grayCol }} />
                      <div className="bg-white rounded-full px-2 py-px text-[12px] whitespace-nowrap" style={{ color: c.text, fontFamily: "Figtree, sans-serif" }}>{doc.count}</div>
                    </div>
                  </div>
                ))}
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
    <div className="h-full flex flex-col items-center pt-12 gap-3" style={{ backgroundColor: isDark ? dk.surface : "white" }}>
      <FileText size={18} style={{ color: c.iconGray }} />
      <span style={{ color: c.textLight, fontFamily: "Noto Sans Hebrew, sans-serif", fontSize: "13px", writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", userSelect: "none" }}>
        מסמכים
      </span>
    </div>
  );
}

// ── Message action bar ─────────────────────────────────────────────────────
function MessageActions({ isDark, showBadges, onToggleBadges }: {
  isDark: boolean; showBadges: boolean; onToggleBadges: () => void;
}) {
  return (
    <div className="flex items-center mt-3" style={{ gap: "2px" }} dir="ltr">
      <VibeBtn title="העתק"><Copy size={18} /></VibeBtn>
      <VibeBtn title="מועיל"><ThumbsUp size={18} /></VibeBtn>
      <VibeBtn title="לא מועיל"><ThumbsDown size={18} /></VibeBtn>
      <VibeBtn title="המשך בשיחה חדשה">
        <Split size={18} style={{ transform: "rotate(90deg)" }} />
      </VibeBtn>
      <VibeBtn title="נסה שוב"><RotateCw size={18} /></VibeBtn>
      <VibeBtn title={showBadges ? "הסתר ציטוטים" : "הצג ציטוטים"} active={!showBadges} onClick={onToggleBadges}>
        {showBadges ? <Eye size={18} /> : <EyeClosed size={18} />}
      </VibeBtn>

      {/* מקורות — icon + label */}
      <SourcesBtn isDark={isDark} />
    </div>
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
        <div className="flex items-center gap-2" dir="ltr">
          <button
            onClick={handleSend}
            className="size-8 flex items-center justify-center rounded border flex-shrink-0 hover:bg-gray-50 transition-colors"
            style={{ borderColor: isDark ? dk.border : c.border, color: c.iconGray }}
            title="שלח"
          >
            <ArrowUp size={15} />
          </button>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden" dir="rtl">
            <FolderOpen size={15} style={{ color: c.iconGray, flexShrink: 0 }} />
            <span className="truncate text-[13px]" style={{ color: isDark ? dk.text : c.text, fontFamily: "Noto Sans Hebrew, Noto Sans, sans-serif" }}>
              59198-67-89 • יוסי כהן נ&apos; משה כהן לוי ובניו ב...
            </span>
            <span className="flex-shrink-0 text-[13px]" style={{ color: "#0068f5" }}>+2</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowCitations((v) => !v)}
              className="size-6 flex items-center justify-center rounded transition-colors"
              style={{ backgroundColor: showCitations ? c.primary : c.primaryLight, color: showCitations ? "white" : c.text }}
              title={showCitations ? "כבה ציטוטים" : "הפעל ציטוטים"}
            >
              <Quote size={12} />
            </button>
            <button
              className="size-6 flex items-center justify-center rounded hover:opacity-80 transition-opacity"
              style={{ backgroundColor: c.primaryLight }}
              title="צרף קובץ"
            >
              <Paperclip size={12} style={{ color: c.text }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDisclaimer() {
    return (
      <p
        className="text-[13px] mt-2"
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

  // ── Empty state (new conversation) ────────────────────────────────────
  if (isEmpty) {
    return (
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
    );
  }

  // ── Normal state ───────────────────────────────────────────────────────
  return (
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
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function AppHeader({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
  return (
    <header className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 z-10" style={{ backgroundColor: isDark ? dk.header : c.headerBg }}>
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full flex items-center justify-center text-white text-[15px] flex-shrink-0 select-none" style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}>דד</div>
        <span className="text-[14px] whitespace-nowrap" style={{ color: isDark ? dk.blue : c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}>דניאל דמביץ</span>
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
        {/* Panel wrapper */}
        <div
          className="relative flex-shrink-0 transition-all duration-300"
          style={{ width: isPanelOpen ? "300px" : "40px", overflow: "visible", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}
        >
          <div className="absolute inset-0 overflow-y-auto" style={{ overflowX: "visible" }}>
            {isPanelOpen ? <DocumentPanelOpen isDark={isDark} /> : <DocumentPanelClosed isDark={isDark} />}
          </div>

          {/* Toggle button — size-6, arrow-16, top-36 */}
          <button
            onClick={() => setIsPanelOpen((v) => !v)}
            className="absolute z-20 size-6 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors"
            style={{ border: `1px solid ${c.border}`, top: "32px", right: "-12px" }}
            title={isPanelOpen ? "סגור מסמכים" : "פתח מסמכים"}
          >
            {isPanelOpen
              ? <ChevronLeft size={16} style={{ color: c.iconGray }} />
              : <ChevronRight size={16} style={{ color: c.iconGray }} />}
          </button>
        </div>

        {/* Chat */}
        <ChatArea isDark={isDark} conversationKey={convKey} />

        {/* Right icon bar */}
        <div className="w-[55px] flex-shrink-0 flex flex-col items-center pt-5 pb-4 border-l" style={{ borderColor: isDark ? dk.border : "#ebf3ff", backgroundColor: sidebarBg }}>
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
      </div>
    </div>
  );
}
