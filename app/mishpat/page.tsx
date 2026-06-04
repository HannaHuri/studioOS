"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, Bookmark, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Copy, Eye, EyeClosed, FileText, FolderOpen, Globe,
  HelpCircle, Info, Layers, Link, MessageSquare, Microscope, Minimize2,
  Moon, MoreHorizontal, Paperclip, Plus, Quote, RotateCw, Search, Shield,
  Split, Sun, ThumbsDown, ThumbsUp, Zap,
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

// ── Auto tooltip text ──────────────────────────────────────────────────────
const AUTO_TIP = `כאשר אפשרות בחירת מסמכים אוטומטית מופעלת, צ'ט המשפט בוחר באופן אוטומטי במסמכים המתאימים ביותר למענה על השאלה שלך.
אם הבחירה האוטומטית לא מתאימה לך מכל סיבה שהיא, תוכל לכבות אותה בכל שלב ולבחור את המסמכים באופן ידני.`;

// ── Scope selector ────────────────────────────────────────────────────────
type ScopeOption = "תמציתי" | "מורחב" | "מקיף";
const SCOPE_ORDER: ScopeOption[] = ["תמציתי", "מורחב", "מקיף"];
const SCOPE_CONFIG: Record<ScopeOption, { desc: string; Icon: LucideIcon }> = {
  "תמציתי": { desc: "היקף ממוקד, מענה מהיר לרוב השאלות",       Icon: Zap },
  "מורחב":  { desc: "היקף רחב יותר, לשאלות הדורשות הקשר נוסף",  Icon: Layers },
  "מקיף":   { desc: "בחינה מעמיקה של המסמכים, מומלץ לניתוח יסודי", Icon: Microscope },
};
const SCOPE_TOOLTIP = "היקף התוכן מהמסמכים הנבחרים שישולב בתשובה. ככל שההיקף קטן יותר, התשובה מהירה יותר.";

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
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 min-w-0" style={{ backgroundColor: bg }}>
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
function HistoryPanel({ isDark }: { isDark: boolean }) {
  const items = [
    { t: "תביעה כספית — כהן נ׳ לוי", d: "היום, 14:32" },
    { t: "סכסוך מקרקעין — חלקה 1123", d: "אתמול, 09:10" },
    { t: "ערעור על החלטת ביניים", d: "2 ביוני 2026" },
    { t: "בקשה לסעד זמני דחוף", d: "30 במאי 2026" },
    { t: "תצהיר עדות ראשית — עד מומחה", d: "28 במאי 2026" },
    { t: "כתב הגנה מתוקן", d: "21 במאי 2026" },
  ];
  const bg = isDark ? dk.surface : "white";
  const titleCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bg }} dir="rtl">
      <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${isDark ? dk.border : "#eef2f7"}` }}>
        <Clock size={18} style={{ color: c.primary }} />
        <span className="text-[16px]" style={{ color: subCol, fontFamily: "Noto Sans Hebrew, sans-serif" }}>היסטוריית שיחות</span>
      </div>
      <div className="flex-1 overflow-y-auto docs-scroll px-3 py-3 flex flex-col gap-1.5">
        {items.map((it, i) => (
          <button
            key={i}
            className="text-right rounded-lg px-3 py-2.5 transition-colors hover:bg-black/[0.03]"
            style={{ border: `1px solid ${isDark ? dk.border : "#e8eef7"}`, fontFamily: "Noto Sans Hebrew, sans-serif" }}
          >
            <div className="text-[14px]" style={{ color: titleCol }}>{it.t}</div>
            <div className="text-[12px] mt-0.5" style={{ color: subCol }}>{it.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MishpatPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [convKey, setConvKey] = useState(0);
  const [vw, setVw] = useState(1280);

  // Responsive breakpoints — ALL behavior is PUSH (panels reflow the chat, never overlay it)
  const BOTH_MIN = 1080; // >= : both side panels may be open together
  const CHAT_ONLY = 760; // <  : panels auto-close, only the conversation remains
  const canBoth = vw >= BOTH_MIN;
  const chatOnly = vw < CHAT_ONLY;

  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-adjust open panels to the available width
  useEffect(() => {
    if (vw < CHAT_ONLY) { setIsPanelOpen(false); setIsHistoryOpen(false); }
    else if (vw < BOTH_MIN && isPanelOpen && isHistoryOpen) { setIsHistoryOpen(false); }
  }, [vw, isPanelOpen, isHistoryOpen]);

  // When both can't fit, opening one panel closes the other (exclusive)
  const toggleDocs = () =>
    setIsPanelOpen((v) => { const nv = !v; if (nv && vw < BOTH_MIN) setIsHistoryOpen(false); return nv; });
  const toggleHistory = () =>
    setIsHistoryOpen((v) => { const nv = !v; if (nv && vw < BOTH_MIN) setIsPanelOpen(false); return nv; });

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
        {/* ── LEFT: Documents panel — always a column that PUSHES the chat (never overlay). Hidden when chat-only ── */}
        {!chatOnly && (
        <div
          className="relative flex-shrink-0 transition-all duration-300"
          style={{ width: isPanelOpen ? "300px" : "40px", overflow: "visible", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}
        >
          <div className="absolute inset-0 overflow-y-auto" style={{ overflowX: "visible" }}>
            {isPanelOpen ? <DocumentPanelOpen isDark={isDark} /> : <DocumentPanelClosed isDark={isDark} />}
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
        )}

        {/* ── CHAT: flex-1 + min-w-0 → column shrinks fluidly so the input never overflows under a panel ── */}
        <div className="flex-1 flex min-w-0">
          <ChatArea isDark={isDark} conversationKey={convKey} />
        </div>

        {/* ── RIGHT: History panel — always a column that PUSHES the chat. Hidden when chat-only ── */}
        {!chatOnly && isHistoryOpen && (
          <div className="flex-shrink-0 transition-all duration-300" style={{ width: "300px", boxShadow: "0px 1px 2px rgba(0,0,0,0.3),0px 1px 3px 1px rgba(0,0,0,0.15)" }}>
            <HistoryPanel isDark={isDark} />
          </div>
        )}

        {/* ── Right icon bar ── */}
        <div className="w-[55px] flex-shrink-0 flex flex-col items-center pt-5 pb-4 border-l" style={{ borderColor: isDark ? dk.border : "#ebf3ff", backgroundColor: sidebarBg }}>
          <button
            onClick={() => { setConvKey((k) => k + 1); setIsPanelOpen(false); setIsHistoryOpen(false); }}
            className="size-8 flex items-center justify-center rounded mb-4 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: c.primary, color: "white" }}
            title="שיחה חדשה"
          >
            <Plus size={16} />
          </button>
          <div className="flex flex-col items-center gap-2">
            {topIcons.map(({ Icon, label }) => {
              const isHist = label === "היסטוריה";
              const active = isHist && isHistoryOpen;
              const disabled = isHist && chatOnly;
              return (
                <button
                  key={label}
                  onClick={isHist && !chatOnly ? toggleHistory : undefined}
                  className="size-8 flex items-center justify-center rounded transition-colors hover:bg-black/5"
                  style={{ color: active ? "white" : iconCol, backgroundColor: active ? c.primary : undefined, opacity: disabled ? 0.35 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
                  title={disabled ? `${label} (המסך צר מדי)` : label}
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
          className="absolute bottom-3 left-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] shadow-md"
          style={{ transform: "translateX(-50%)", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${c.border}`, color: c.textGray, fontFamily: "Noto Sans Hebrew, sans-serif", direction: "rtl" }}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: chatOnly ? "#d83a52" : canBoth ? c.primary : "#e0a000" }} />
          <span>{chatOnly ? "צ'אט בלבד" : canBoth ? "שני פאנלים אפשריים" : "פאנל אחד בכל פעם"}</span>
          <span style={{ color: c.textLight }}>·</span>
          <span style={{ color: c.textLight }}>{vw}px</span>
        </div>
      </div>
    </div>
  );
}
