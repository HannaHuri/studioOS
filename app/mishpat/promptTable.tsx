"use client";

/* ──────────────────────────────────────────────────────────────────────────
   מאגר הפרומפטים as a table — the documents screen's layout (mishpat/lab), applied
   to prompts. The rail's prompts icon opens this table beside the rail; a row opens
   the prompt in an editor to its left, where the documents screen opens the PDF.

   The table is the library window's table, moved into the page: same filters, same
   counts, same sort-by-header. Its columns are the user's to pick and order, from the ⋮
   in the header's corner, as on the documents table. The name is always there; the four
   classification columns start switched off, at any width.
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, GripVertical, Maximize2, Minimize2, MoreVertical, Plus, Search, WandSparkles, X } from "lucide-react";
import { c, dk, FONT } from "./theme";
import { UseExampleIcon } from "./icons";
import { Tick } from "./proofread";
import {
  ANY, GENERAL, CASE_CONTEXT, CASE_TYPES, MATTERS, STAGES, COURTS, TAGS, fitsCase,
  Dropdown, FavMark, RowMenu, SourceMark, menuFor, matches, srcName, authorName, authorFull, roleOf, avgOf,
  saved, mine, EMPTY_FILTERS, SOURCE_OPTS, SOURCE_RANK, dateOf, byDate,
  type Prompt, type Filters, type SortKey,
} from "./prompts";

// Wide enough for the matter and stage filters beside the others.
const WIDE = 980;

// The data columns the user can show, hide and reorder. The saved mark, the name and the two
// row actions are structural and always there.
type ColKey = "source" | "author" | "date" | "court" | "caseType" | "matter" | "stage" | "rating" | "uses";
const COL_LABELS: Record<ColKey, string> = {
  source: "מקור", author: "מחבר", date: "תאריך", court: "ערכאה", caseType: "סוג תיק", matter: "סוג עניין", stage: "שלב", rating: "דירוג", uses: "שימושים",
};
const COL_TRACKS: Record<ColKey, string> = {
  source: "44px", author: "112px", date: "64px", court: "90px", caseType: "84px", matter: "108px", stage: "96px", rating: "76px", uses: "64px",
};
const DEFAULT_ORDER: ColKey[] = ["source", "author", "date", "court", "caseType", "matter", "stage", "rating", "uses"];
const DEFAULT_SHOWN: Record<ColKey, boolean> = {
  source: true, author: true, date: false, court: false, caseType: false, matter: false, stage: false, rating: true, uses: true,
};
const COLS_LS_KEY = "mishpat-promptCols-v1";
type ColState = { order: ColKey[]; shown: Record<ColKey, boolean> };
// The panel only mounts once the library is opened, after hydration, so it can read storage up front
const loadCols = (): ColState => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COLS_LS_KEY) ?? "null");
    if (raw) {
      const order = (raw.order as string[]).filter((k): k is ColKey => k in COL_LABELS);
      return { order: [...order, ...DEFAULT_ORDER.filter((k) => !order.includes(k))], shown: { ...DEFAULT_SHOWN, ...raw.shown } };
    }
  } catch { /* fall back to the defaults */ }
  return { order: DEFAULT_ORDER, shown: DEFAULT_SHOWN };
};

export function PromptTablePanel({
  isDark, prompts, width, isFocus, onToggleFocus, onClose, openId, onOpen, onNew, onUse, onFav, onEdit, onShare, onDelete,
}: {
  isDark: boolean; prompts: Prompt[]; width: number;
  isFocus: boolean; onToggleFocus: () => void; onClose: () => void;
  openId: string | null;              // the prompt open in the editor — its row is marked
  onOpen: (pr: Prompt) => void; onNew: () => void;
  onUse: (pr: Prompt) => void; onFav: (id: string) => void; onEdit: (pr: Prompt) => void;
  onShare: (pr: Prompt) => void; onDelete: (pr: Prompt) => void;
}) {
  // Opens on what suits the open case — the job the narrow "מוצעים" panel did before the table
  // replaced it. One click on the chip takes it back to the whole מאגר.
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [caseOnly, setCaseOnly] = useState(true);
  const wide = width >= WIDE;

  const [colState, setColState] = useState<ColState>(loadCols);
  const saveCols = (next: ColState) => {
    setColState(next);
    try { window.localStorage.setItem(COLS_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const shownCols = colState.order.filter((k) => colState.shown[k]);
  const [colsMenu, setColsMenu] = useState<DOMRect | null>(null);
  // Reorder by dragging a row in the menu; a plain click still toggles the column
  const colRowRefs = useRef<Partial<Record<ColKey, HTMLDivElement | null>>>({});
  const [drag, setDrag] = useState<{ key: ColKey; to: number } | null>(null);
  const justDragged = useRef(false);
  const startColDrag = (key: ColKey, e: ReactMouseEvent) => {
    const startY = e.clientY;
    let dragging = false;
    let to = -1;
    const onMove = (ev: MouseEvent) => {
      if (!dragging) {
        if (Math.abs(ev.clientY - startY) < 4) return;
        dragging = true; document.body.style.userSelect = "none";
      }
      to = colState.order.length;
      for (let j = 0; j < colState.order.length; j++) {
        const el = colRowRefs.current[colState.order[j]];
        if (el && ev.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2) { to = j; break; }
      }
      setDrag({ key, to });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = "";
      if (!dragging) return;
      justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0);
      setDrag(null);
      const target = colState.order[to];
      if (target === key) return;
      const rest = colState.order.filter((k) => k !== key);
      rest.splice(target ? rest.indexOf(target) : rest.length, 0, key);
      saveCols({ ...colState, order: rest });
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };
  const resetCols = () => {
    setColState({ order: DEFAULT_ORDER, shown: DEFAULT_SHOWN });
    try { window.localStorage.removeItem(COLS_LS_KEY); } catch { /* ignore */ }
    setColsMenu(null);
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const FILTER_KEYS = ["q", "source", "caseType", "matter", "stage", "court", "tag", "favOnly"] as const;
  const filtered = FILTER_KEYS.some((k) => f[k] !== EMPTY_FILTERS[k]);
  const clearFilters = () => setF((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort, dir: prev.dir }));
  const sortBy = (key: SortKey) =>
    setF((prev) => ({ ...prev, sort: key, dir: prev.sort === key && prev.dir === "desc" ? "asc" : "desc" }));

  const pass = (pr: Prompt, ff: Filters) => matches(pr, ff) && (!caseOnly || fitsCase(pr));

  const list = useMemo(() => {
    const out = prompts.filter((pr) => pass(pr, f));
    const fit = (pr: Prompt) =>
      (pr.caseType === CASE_CONTEXT.caseType ? 2 : pr.caseType === GENERAL ? 1 : 0) +
      (pr.matter === CASE_CONTEXT.matter ? 2 : pr.matter === GENERAL ? 1 : 0) +
      (pr.stage === CASE_CONTEXT.stage ? 2 : pr.stage === GENERAL ? 1 : 0) +
      (pr.court === CASE_CONTEXT.court ? 2 : pr.court === GENERAL ? 1 : 0);
    const cmp: Record<SortKey, (a: Prompt, b: Prompt) => number> = {
      relevance: (a, b) => saved(a) - saved(b) || mine(a) - mine(b) || fit(b) - fit(a) || b.uses - a.uses,
      name: (a, b) => b.name.localeCompare(a.name, "he"),
      source: (a, b) => SOURCE_RANK[srcName(a)] - SOURCE_RANK[srcName(b)] || authorName(a).localeCompare(authorName(b), "he"),
      author: (a, b) => (authorName(a) ? 0 : 1) - (authorName(b) ? 0 : 1) || authorName(a).localeCompare(authorName(b), "he"),
      caseType: (a, b) => b.caseType.localeCompare(a.caseType, "he"),
      matter: (a, b) => b.matter.localeCompare(a.matter, "he"),
      stage: (a, b) => b.stage.localeCompare(a.stage, "he"),
      court: (a, b) => b.court.localeCompare(a.court, "he"),
      rating: (a, b) => avgOf(b) - avgOf(a) || b.ratingCount - a.ratingCount,
      uses: (a, b) => b.uses - a.uses,
      date: byDate,
    };
    const sorted = out.sort(cmp[f.sort] ?? cmp.relevance);
    return f.dir === "asc" && f.sort !== "relevance" ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, f, caseOnly]);

  const facets = useMemo(() => {
    const tally = (key: keyof Filters, values: readonly string[], of: (pr: Prompt) => string | string[]) => {
      const base = prompts.filter((pr) => pass(pr, { ...f, [key]: ANY }));
      const m: Record<string, number> = { [ANY]: base.length };
      for (const v of values) m[v] = 0;
      for (const pr of base) for (const v of [of(pr)].flat()) if (v in m) m[v] += 1;
      return m;
    };
    return {
      source: tally("source", SOURCE_OPTS, srcName),
      caseType: tally("caseType", CASE_TYPES, (pr) => pr.caseType),
      matter: tally("matter", MATTERS, (pr) => pr.matter),
      stage: tally("stage", STAGES, (pr) => pr.stage),
      court: tally("court", COURTS, (pr) => pr.court),
      tag: tally("tag", TAGS, (pr) => pr.tags),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, f, caseOnly]);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const cellCol = isDark ? dk.textMuted : c.textGray;
  const line = isDark ? dk.border : c.inputBorder;
  const rowLine = isDark ? dk.border : "#eef2f7";
  const activeBg = isDark ? "#22304a" : "#eaf2fd";
  // the documents table's light-blue window controls
  const lightBlueBtn = { border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, backgroundColor: isDark ? "#22304a" : "#eaf2fd", color: c.primary };

  const th = (key: SortKey, label: string, align: "right" | "center" = "right") => (
    <button
      onClick={() => sortBy(key)}
      className="h-full w-full min-w-0 flex items-center gap-1 px-1.5 text-[12.5px] transition-colors hover:bg-black/[0.04]"
      style={{ color: f.sort === key ? c.primary : subCol, justifyContent: align === "center" ? "center" : "flex-start" }}
      title={`מיון לפי ${label}`}
    >
      <span className="truncate">{label}</span>
      {f.sort === key && <ChevronDown size={12} style={{ transform: f.dir === "asc" ? "rotate(180deg)" : "none", flexShrink: 0 }} />}
    </button>
  );

  // the name keeps a readable width; with many columns on, the table scrolls sideways instead
  const cols = ["30px", "minmax(140px,1fr)", ...shownCols.map((k) => COL_TRACKS[k]), "34px", "32px"].join(" ");
  // the scroller is ltr (for its scrollbar's side), so a sideways scroll opens at the name's end
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols]);
  const minW = 30 + 140 + shownCols.reduce((sum, k) => sum + parseInt(COL_TRACKS[k], 10), 0) + 34 + 32 + 24;
  const CENTERED: ColKey[] = ["source", "uses"];
  const cell = (k: ColKey, pr: Prompt) => {
    switch (k) {
      case "source":
        return (
          <div key={k} className="flex items-center justify-center" title={srcName(pr)}>
            <SourceMark pr={pr} isDark={isDark} size={15} />
          </div>
        );
      case "author": {
        const n = authorName(pr) || "מערכת";
        const named = n !== "מערכת" && n !== "אנונימי";
        return (
          <div key={k} className="px-1.5 min-w-0 text-[12.5px] truncate" style={{ color: cellCol }} title={authorFull(pr) || "מערכת"}>
            <span style={named ? undefined : { color: subCol }}>{n}</span>
            {roleOf(pr) && authorName(pr) && <span style={{ color: subCol }}> ({roleOf(pr)})</span>}
          </div>
        );
      }
      case "date": {
        // the documents table's date: 27.05.26, in Figtree
        const d = dateOf(pr);
        const [dd, mm, yy] = d.split("/");
        return d
          ? <div key={k} className="px-1.5 text-[12px]" style={{ color: cellCol, fontFamily: "Figtree, sans-serif" }} title={d}>{`${dd}.${mm}.${yy.slice(2)}`}</div>
          : <div key={k} className="px-1.5 text-[12.5px]" style={{ color: subCol }}>—</div>;
      }
      case "court": case "caseType": case "matter": case "stage":
        return (
          <div key={k} className="px-1.5 min-w-0 text-[12.5px] truncate" style={{ color: cellCol }} title={pr[k]}>
            {pr[k] === GENERAL ? "" : pr[k]}
          </div>
        );
      case "rating":
        return (
          <div key={k} className="px-1.5 text-[12.5px] flex items-center gap-1" style={{ color: cellCol }}>
            {pr.ratingCount ? (
              <>
                <span>{avgOf(pr).toFixed(1)}</span>
                <span style={{ color: subCol }}>({pr.ratingCount})</span>
              </>
            ) : <span style={{ color: subCol }}>—</span>}
          </div>
        );
      case "uses":
        return <div key={k} className="px-1.5 text-[12.5px] text-center" style={{ color: cellCol }}>{pr.uses}</div>;
    }
  };

  return (
    <div dir="rtl" className="h-full flex flex-col" style={{ backgroundColor: surface, fontFamily: FONT }}>
      {colsMenu && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setColsMenu(null)} />
          <div
            className="fixed z-[200] rounded-[8px] overflow-hidden"
            style={{ top: colsMenu.bottom + 6, left: Math.max(8, colsMenu.right - 212), width: "212px", backgroundColor: surface, border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }}
          >
            <div className="px-3 py-2 text-[12px] font-semibold" style={{ color: isDark ? dk.textMuted : c.textGray, borderBottom: `1px solid ${rowLine}` }}>
              עמודות בטבלה <span className="font-normal" style={{ color: subCol }}>· גררו לשינוי סדר</span>
            </div>
            <div className="py-1">
              {colState.order.map((k, i) => (
                <div
                  key={k}
                  ref={(el) => { colRowRefs.current[k] = el; }}
                  onMouseDown={(e) => startColDrag(k, e)}
                  onClick={() => { if (!justDragged.current) saveCols({ ...colState, shown: { ...colState.shown, [k]: !colState.shown[k] } }); }}
                  className="relative flex items-center gap-2 px-3 py-1.5 hover:bg-black/5"
                  style={{ opacity: drag?.key === k ? 0.4 : 1, cursor: "grab" }}
                >
                  {drag && drag.to === i && <div className="absolute left-2 right-2 top-0" style={{ height: "2px", backgroundColor: c.primary }} />}
                  {drag && drag.to === colState.order.length && i === colState.order.length - 1 && <div className="absolute left-2 right-2 bottom-0" style={{ height: "2px", backgroundColor: c.primary }} />}
                  <span className="flex-shrink-0" style={{ color: isDark ? dk.textMuted : c.iconGray }} title="גרירה לשינוי סדר"><GripVertical size={13} /></span>
                  <Tick checked={colState.shown[k]} />
                  <span className="text-[13px]" style={{ color: textCol }}>{COL_LABELS[k]}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5" style={{ borderTop: `1px solid ${rowLine}` }}>
              <button onClick={resetCols} className="text-[12.5px] hover:underline" style={{ color: c.primary }} title="החזרת סדר והצגת העמודות למצב ההתחלתי">איפוס לברירת מחדל</button>
            </div>
          </div>
        </>
      )}
      {/* Row A: search, then the window controls pinned to the far end — as on the documents table */}
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{ right: "10px", color: c.iconGray }} />
            <input
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="חיפוש לפי שם הפרומפט או מחבר"
              className="w-full h-8 rounded-md text-[13px] outline-none"
              style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : "white", color: textCol, paddingRight: "32px", paddingLeft: "10px" }}
            />
          </div>
          {/* New is always a basic prompt; the editor offers the way to a detailed one */}
          <button
            onClick={onNew}
            className="h-8 px-2.5 flex items-center gap-1 rounded-md flex-shrink-0 text-[13px] transition-opacity hover:opacity-90"
            style={{ border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, backgroundColor: isDark ? dk.input : "white", color: c.primary }}
            title="פרומפט חדש"
          >
            <Plus size={15} />
            חדש
          </button>
          <button onClick={onToggleFocus} className="size-8 flex items-center justify-center rounded-md flex-shrink-0 transition-opacity hover:opacity-85" style={lightBlueBtn} title={isFocus ? "חזרה לתצוגה הרגילה" : "הרחבה למסך מלא"}>
            {isFocus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-md flex-shrink-0 transition-opacity hover:opacity-85" style={lightBlueBtn} title="סגירת הפרומפטים">
            <X size={15} />
          </button>
        </div>

        {/* Row B: the case chip, then the filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCaseOnly((v) => !v)}
            className="h-8 px-2.5 rounded-md text-[13px] transition-colors"
            style={caseOnly
              ? { border: `1px solid ${isDark ? "#2f4a6e" : "#cfe1f7"}`, backgroundColor: isDark ? "#22304a" : "#eaf2fd", color: c.primary }
              : { border: `1px solid ${isDark ? dk.border : c.border}`, backgroundColor: isDark ? dk.input : "white", color: textCol }}
            title={caseOnly ? "מוצגים רק פרומפטים שמתאימים לתיק הפתוח. לחיצה מציגה את כל המאגר" : "הצגת הפרומפטים שמתאימים לתיק הפתוח בלבד"}
          >
            מתאימים לתיק
          </button>
          <Dropdown label="מקור" value={f.source} options={SOURCE_OPTS} onChange={(v) => set("source", v)} isDark={isDark} width={96} counts={facets.source} />
          <Dropdown label="תגית" value={f.tag} options={TAGS} onChange={(v) => set("tag", v)} isDark={isDark} width={104} counts={facets.tag} />
          <Dropdown label="ערכאה" value={f.court} options={COURTS} onChange={(v) => set("court", v)} isDark={isDark} width={100} counts={facets.court} />
          <Dropdown label="סוג תיק" value={f.caseType} options={CASE_TYPES} onChange={(v) => set("caseType", v)} isDark={isDark} width={100} counts={facets.caseType} />
          {wide && <Dropdown label="סוג עניין" value={f.matter} options={MATTERS} onChange={(v) => set("matter", v)} isDark={isDark} width={130} counts={facets.matter} />}
          {wide && <Dropdown label="שלב" value={f.stage} options={STAGES} onChange={(v) => set("stage", v)} isDark={isDark} width={110} counts={facets.stage} />}
          {filtered && (
            <button onClick={clearFilters} className="h-8 px-2 text-[13px] rounded-md hover:bg-black/5 transition-colors" style={{ color: subCol }}>
              ניקוי
            </button>
          )}
        </div>
      </div>

      {/* Header row + rows */}
      <div ref={scroller} className="flex-1 min-h-0 overflow-auto docs-scroll" dir="ltr" style={{ scrollbarGutter: "stable" }}>
        <div dir="rtl" className="px-3 pb-4" style={{ minWidth: `${minW}px` }}>
          <div
            className="sticky top-0 z-10 grid items-stretch h-8"
            style={{ gridTemplateColumns: cols, backgroundColor: surface, borderBottom: `1px solid ${rowLine}` }}
          >
            {/* the columns menu, in the header's otherwise empty corner — where the documents table keeps it */}
            <div className="flex items-center justify-center">
              <button
                onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setColsMenu((v) => (v ? null : rect)); }}
                className="size-[18px] flex items-center justify-center rounded transition-colors hover:bg-black/5"
                style={{ color: colsMenu ? c.primary : (isDark ? dk.textMuted : c.textGray), backgroundColor: colsMenu ? (isDark ? "#22304a" : "#eff4ff") : undefined }}
                title="התאמת עמודות"
              >
                <MoreVertical size={15} />
              </button>
            </div>
            {th("name", "שם הפרומפט")}
            {shownCols.map((k) => <span key={k} className="contents">{th(k, COL_LABELS[k], CENTERED.includes(k) ? "center" : "right")}</span>)}
            <div />
            <div />
          </div>

          {list.length === 0 && (
            <div className="py-16 text-center text-[13.5px]" style={{ color: subCol }}>
              לא נמצאו פרומפטים התואמים לחיפוש.
              {caseOnly && (
                <button onClick={() => setCaseOnly(false)} className="block mx-auto mt-2 hover:underline" style={{ color: c.primary }}>הצגת כל המאגר</button>
              )}
            </div>
          )}

          {list.map((pr) => {
            const active = openId === pr.id;
            return (
              <div
                key={pr.id}
                onClick={() => onOpen(pr)}
                className="group relative grid items-center cursor-pointer transition-colors"
                style={{ gridTemplateColumns: cols, minHeight: "52px", borderBottom: `1px solid ${rowLine}`, backgroundColor: active ? activeBg : undefined }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.03)" : "#f7f9fc"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = ""; }}
              >
                {/* the open row carries the documents table's blue edge */}
                {active && <div className="absolute top-0 bottom-0 right-0" style={{ width: "3px", backgroundColor: c.primary }} />}
                <div className="flex items-center justify-center">
                  <FavMark on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} quiet />
                </div>

                <div className="min-w-0 text-right px-1.5 py-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {pr.parts && <span title="פרומפט מפורט" className="flex-none flex"><WandSparkles size={13} style={{ color: subCol, transform: "scaleX(-1)" }} /></span>}
                    <span className="text-[14px] truncate" style={{ color: active ? c.primary : textCol }}>{pr.name}</span>
                  </div>
                  <div className="text-[12px] truncate mt-0.5" style={{ color: subCol }} title={pr.body}>{pr.parts ? `פרומפט מפורט · ${pr.parts.length === 1 ? "חלק אחד" : `${pr.parts.length} חלקים`}` : pr.body}</div>
                </div>

                {shownCols.map((k) => cell(k, pr))}

                {/* Using a prompt stays one click: it doesn't need the editor open first */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUse(pr); }}
                    className="size-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/5 transition-opacity"
                    style={{ color: c.primary }}
                    title="שימוש בפרומפט"
                  >
                    <UseExampleIcon size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-center">
                  <RowMenu isDark={isDark} items={menuFor(pr, onUse, onEdit, onShare, onDelete, onFav)} />
                </div>
              </div>
            );
          })}

          {list.length > 0 && (
            <div className="pt-3 px-2 text-[12px]" style={{ color: subCol }}>{list.length} פרומפטים</div>
          )}
        </div>
      </div>
    </div>
  );
}
