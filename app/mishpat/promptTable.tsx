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
import { Bookmark, ChevronDown, GripVertical, Info, Maximize2, Minimize2, MoreVertical, Plus, Search, WandSparkles, X } from "lucide-react";
import { c, dk, FONT } from "./theme";
import { UseExampleIcon } from "./icons";
import { Tick } from "./proofread";
import {
  ANY, GENERAL, CASE_TYPES, MATTERS_BY, TAGS_BY, GENERAL_TAGS, ALL_LISTED_TAGS, STAGES, COURTS,
  MultiDropdown, FavMark, RowMenu, SourceMark, menuFor, matches, srcName, authorName, authorFull, roleOf, avgOf,
  saved, EMPTY_FILTERS, SOURCE_OPTS, SOURCE_RANK, dateOf, byDate,
  type Prompt, type Filters, type SortKey,
} from "./prompts";

// The data columns the user can show, hide and reorder. The saved mark, the name and the two
// row actions are structural and always there.
type ColKey = "source" | "author" | "date" | "court" | "caseType" | "matter" | "stage" | "tags" | "rating";
const COL_LABELS: Record<ColKey, string> = {
  source: "מקור", author: "מחבר", date: "תאריך", court: "ערכאה", caseType: "סוג תיק", matter: "תחום", stage: "שלב", tags: "תגיות", rating: "דירוג",
};
const COL_TRACKS: Record<ColKey, string> = {
  source: "48px", author: "128px", date: "76px", court: "96px", caseType: "76px", matter: "108px", stage: "104px", tags: "152px", rating: "76px",
};
// tags last: the table is wider than the side panel by default, and the column that gets cut is the tags,
// enough of them showing that people know they're there
const DEFAULT_ORDER: ColKey[] = ["source", "author", "date", "court", "caseType", "matter", "stage", "rating", "tags"];
// מקור, סוג תיק, תחום and דירוג fit the side panel's width with a readable name; the rest are there to add
const DEFAULT_SHOWN: Record<ColKey, boolean> = {
  source: true, author: false, date: false, court: false, caseType: true, matter: true, stage: false, tags: true, rating: true,
};
// v3: the defaults changed (uses gone, tags and the categories in, then דירוג), so older saved picks start over
// the filters that take several values, and what each one reads off a prompt
type MKey = "source" | "caseType" | "matter" | "stage" | "court" | "tag";
type Multi = Record<MKey, string[]>;
const M_KEYS: MKey[] = ["source", "caseType", "matter", "stage", "court", "tag"];
const EMPTY_MULTI: Multi = { source: [], caseType: [], matter: [], stage: [], court: [], tag: [] };
const VALUE_OF: Record<MKey, (pr: Prompt) => string | string[]> = {
  source: srcName, caseType: (pr) => pr.caseType, matter: (pr) => pr.matter, stage: (pr) => pr.stage, court: (pr) => pr.court, tag: (pr) => pr.tags,
};
// the filter picks are kept between visits, like the columns — a judge who works in one area
// shouldn't have to pick it again each time
const FILTERS_LS_KEY = "mishpat-promptFilters-v1";
const loadMulti = (shown: Record<ColKey, boolean>): Multi => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(FILTERS_LS_KEY) ?? "null");
    if (raw) {
      const out = { ...EMPTY_MULTI };
      for (const k of M_KEYS) {
        // a filter whose column is hidden doesn't apply, so it isn't restored either
        const col: ColKey = k === "tag" ? "tags" : k;
        if (Array.isArray(raw[k]) && shown[col]) out[k] = raw[k].filter((v: unknown): v is string => typeof v === "string");
      }
      return out;
    }
  } catch { /* fall back to nothing picked */ }
  return EMPTY_MULTI;
};
const COLS_LS_KEY = "mishpat-promptCols-v4";
const COLW_LS_KEY = "mishpat-promptColW-v1";
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
  isDark, prompts, isFocus, onToggleFocus, onClose, openId, onOpen, onNew, onUse, onFav, onEdit, onShare, onDelete,
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

  const [colState, setColState] = useState<ColState>(loadCols);
  const saveCols = (next: ColState) => {
    setColState(next);
    try { window.localStorage.setItem(COLS_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const shownCols = colState.order.filter((k) => colState.shown[k]);
  const [colsMenu, setColsMenu] = useState<DOMRect | null>(null);
  const [info, setInfo] = useState<DOMRect | null>(null); // the disclaimer, open from the i by the count
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
  // hiding a column takes its filter with it, so nothing filters the table out of sight
  const FILTERED: ColKey[] = ["source", "court", "caseType", "matter", "stage", "tags"];
  const toggleCol = (k: ColKey) => {
    if (colState.shown[k] && FILTERED.includes(k)) {
      setMulti(k === "tags" ? "tag" : (k as MKey), []);
    }
    saveCols({ ...colState, shown: { ...colState.shown, [k]: !colState.shown[k] } });
  };
  const resetCols = () => {
    setM((prev) => ({ ...prev, court: [], stage: [], tag: [] })); // their columns go back to hidden
    setColState({ order: DEFAULT_ORDER, shown: DEFAULT_SHOWN });
    try { window.localStorage.removeItem(COLS_LS_KEY); } catch { /* ignore */ }
    setColsMenu(null);
  };

  // Column widths set by dragging a header's edge; only the columns the user resized, saved per user
  const [colW, setColW] = useState<Partial<Record<ColKey, number>>>(() => {
    try { return JSON.parse(window.localStorage.getItem(COLW_LS_KEY) ?? "{}") ?? {}; } catch { return {}; }
  });
  const startResize = (k: ColKey, e: ReactMouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startW = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().width;
    const startX = e.clientX; let last = startW;
    // RTL: the handle is on the column's left edge, so dragging left widens it
    const onMove = (ev: MouseEvent) => { last = Math.max(40, Math.round(startW + (startX - ev.clientX))); setColW((prev) => ({ ...prev, [k]: last })); };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.userSelect = "";
      setColW((prev) => { const next = { ...prev, [k]: last }; try { window.localStorage.setItem(COLW_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); document.body.style.userSelect = "none";
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));
  // the column filters take several values each — נזיקין together with כללי, say. Nothing picked = all.
  const [m, setMState] = useState<Multi>(() => loadMulti(colState.shown));
  const setM = (next: Multi | ((prev: Multi) => Multi)) => setMState((prev) => {
    const v = typeof next === "function" ? next(prev) : next;
    try { window.localStorage.setItem(FILTERS_LS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
    return v;
  });
  // תחום and תגית are open from the start, with everything grouped under its case type (and a search in
  // the menu); picking case types narrows them to those types, and removing a type lets go of its values
  const sub = (cts: string[]) => {
    const chosen = cts.filter((t) => t !== GENERAL);
    const picked = chosen.length ? chosen : CASE_TYPES.filter((t) => t !== GENERAL);
    const free = [...new Set(prompts.filter((pr) => !chosen.length || chosen.includes(pr.caseType)).flatMap((pr) => pr.tags))]
      .filter((t) => !ALL_LISTED_TAGS.has(t)).sort((a, b) => a.localeCompare(b, "he"));
    const matterGroups = picked.length > 1
      ? [{ title: "", options: [GENERAL] }, ...picked.map((ct) => ({ title: ct, options: MATTERS_BY[ct] ?? [] })).filter((g) => g.options.length > 0)]
      : [{ title: "", options: [GENERAL, ...(MATTERS_BY[picked[0]] ?? [])] }];
    const tagGroups = [
      ...picked.map((ct) => ({ title: ct, options: TAGS_BY[ct] ?? [] })),
      { title: "כללי", options: GENERAL_TAGS },
      { title: "תגיות נוספות", options: free },
    ].filter((g) => g.options.length > 0);
    const flat = (gs: { options: string[] }[]) => [...new Set(gs.flatMap((g) => g.options))];
    return { matterGroups, tagGroups, matters: flat(matterGroups), tags: flat(tagGroups) };
  };
  const setMulti = (k: MKey, v: string[]) => setM((prev) => {
    if (k !== "caseType") return { ...prev, [k]: v };
    const s2 = sub(v);
    return { ...prev, caseType: v, matter: prev.matter.filter((x) => s2.matters.includes(x)), tag: prev.tag.filter((x) => s2.tags.includes(x)) };
  });
  const subs = sub(m.caseType);
  const filtered = f.q !== "" || f.favOnly || M_KEYS.some((k) => m[k].length > 0);
  const clearFilters = () => { setF((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort, dir: prev.dir })); setM(EMPTY_MULTI); };
  const sortBy = (key: SortKey) =>
    setF((prev) => ({ ...prev, sort: key, dir: prev.sort === key && prev.dir === "desc" ? "asc" : "desc" }));

  const pass = (pr: Prompt, ff: Filters, mm: Multi) =>
    matches(pr, ff) && M_KEYS.every((k) => !mm[k].length || [VALUE_OF[k](pr)].flat().some((v) => mm[k].includes(v)));

  const list = useMemo(() => {
    const out = prompts.filter((pr) => pass(pr, f, m));
    // the open case can't be matched to this classification, so the default order stands on its own:
    // favorites, then rating, then case type A to ת with כללי first (which is all it is at launch,
    // before there are ratings), then name. The case type header sorts the same way.
    const ctKey = (pr: Prompt) => (pr.caseType === GENERAL ? "" : pr.caseType);
    const byCaseType = (a: Prompt, b: Prompt) => ctKey(a).localeCompare(ctKey(b), "he");
    const cmp: Record<SortKey, (a: Prompt, b: Prompt) => number> = {
      relevance: (a, b) => saved(a) - saved(b) || avgOf(b) - avgOf(a) || byCaseType(a, b) || a.name.localeCompare(b.name, "he"),
      name: (a, b) => b.name.localeCompare(a.name, "he"),
      source: (a, b) => SOURCE_RANK[srcName(a)] - SOURCE_RANK[srcName(b)] || authorName(a).localeCompare(authorName(b), "he"),
      author: (a, b) => (authorName(a) ? 0 : 1) - (authorName(b) ? 0 : 1) || authorName(a).localeCompare(authorName(b), "he"),
      caseType: (a, b) => byCaseType(a, b) || a.name.localeCompare(b.name, "he"),
      matter: (a, b) => b.matter.localeCompare(a.matter, "he"),
      stage: (a, b) => b.stage.localeCompare(a.stage, "he"),
      court: (a, b) => b.court.localeCompare(a.court, "he"),
      rating: (a, b) => avgOf(b) - avgOf(a) || b.ratingCount - a.ratingCount,
      tags: (a, b) => (b.tags[0] ?? "").localeCompare(a.tags[0] ?? "", "he"),
      date: byDate,
      fav: (a, b) => saved(a) - saved(b) || avgOf(b) - avgOf(a),
    };
    const sorted = out.sort(cmp[f.sort] ?? cmp.relevance);
    return f.dir === "asc" && f.sort !== "relevance" ? sorted.reverse() : sorted;
  }, [prompts, f, m]);

  const facets = useMemo(() => {
    // each count leaves out its own filter's picks, so it says what ticking that value would add
    const tally = (key: MKey, values: readonly string[]) => {
      const base = prompts.filter((pr) => pass(pr, f, { ...m, [key]: [] }));
      const out: Record<string, number> = { [ANY]: base.length };
      for (const v of values) out[v] = 0;
      for (const pr of base) for (const v of [VALUE_OF[key](pr)].flat()) if (v in out) out[v] += 1;
      return out;
    };
    return {
      source: tally("source", SOURCE_OPTS),
      caseType: tally("caseType", CASE_TYPES),
      matter: tally("matter", subs.matters),
      stage: tally("stage", STAGES),
      court: tally("court", COURTS),
      tag: tally("tag", subs.tags),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, f, m]);

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
  // in the side panel the rating shows without its count (it's in the tooltip), which leaves the tags more room
  // and the tags column is a single chip ending in "...", like the documents table in /lab, so the default columns fit
  const SIDE: Partial<Record<ColKey, string>> = { rating: "48px", tags: "64px", caseType: "68px", matter: "96px" };
  // a width the user dragged wins over both (as in the documents table in /lab)
  const track = (k: ColKey) => (colW[k] ? `${colW[k]}px` : isFocus ? COL_TRACKS[k] : SIDE[k] ?? COL_TRACKS[k]);
  const nameMin = isFocus ? 160 : 120;
  const cols = ["20px", "30px", `minmax(${nameMin}px,1fr)`, ...shownCols.map(track), "34px", "32px"].join(" ");
  // the scroller is ltr (for its scrollbar's side), so a sideways scroll opens at the name's end
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols]);
  const minW = 20 + 30 + nameMin + shownCols.reduce((sum, k) => sum + parseInt(track(k), 10), 0) + 34 + 32 + 24;
  const CENTERED: ColKey[] = ["source"];
  const cell = (k: ColKey, pr: Prompt) => {
    switch (k) {
      case "source":
        return (
          <div key={k} className="flex items-center justify-center" title={srcName(pr)}>
            <SourceMark pr={pr} isDark={isDark} size={16} />
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
          ? <div key={k} className="px-1.5 text-[12.5px]" style={{ color: cellCol, fontFamily: "Figtree, sans-serif" }} title={d}>{`${dd}.${mm}.${yy.slice(2)}`}</div>
          : <div key={k} className="px-1.5 text-[12.5px]" style={{ color: subCol }}>—</div>;
      }
      case "court": case "caseType": case "matter": case "stage":
        return (
          <div key={k} className="px-1.5 min-w-0 text-[12.5px] truncate" style={{ color: cellCol }} title={pr[k]}>
            {pr[k]}
          </div>
        );
      case "rating":
        return (
          <div key={k} className="px-1.5 text-[12.5px] flex items-center gap-1" style={{ color: cellCol }} title={pr.ratingCount ? `${avgOf(pr).toFixed(1)} מתוך 5 · ${pr.ratingCount} מדרגים` : "עדיין לא דורג"}>
            {pr.ratingCount ? (
              <>
                <span>{avgOf(pr).toFixed(1)}</span>
                {isFocus && <span style={{ color: subCol }}>({pr.ratingCount})</span>}
              </>
            ) : <span style={{ color: subCol }}>—</span>}
          </div>
        );
      case "tags":
        // side panel: the first tag in one chip, cut with "..."; all of them in the tooltip
        if (!isFocus && !colW.tags) return (
          <div key={k} className="px-1.5 min-w-0 flex items-center" title={pr.tags.join(", ")}>
            {pr.tags.length > 0 && (
              <span className="h-6 px-2 min-w-0 rounded-[4px] text-[12.5px] leading-6 truncate" style={{ backgroundColor: isDark ? dk.input : "#f1f3f6", color: cellCol }}>{pr.tags[0]}</span>
            )}
          </div>
        );
        // expanded (or widened): one line; what doesn't fit is cut, and the whole list is in the tooltip
        return (
          <div key={k} className="px-1.5 min-w-0 flex items-center gap-1 overflow-hidden *:shrink-0" title={pr.tags.join(", ")}>
            {pr.tags.map((t) => (
              <span key={t} className="h-6 px-2 flex items-center rounded-[4px] text-[12.5px]" style={{ backgroundColor: isDark ? dk.input : "#f1f3f6", color: cellCol }}>{t}</span>
            ))}
          </div>
        );
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
                  onClick={() => { if (!justDragged.current) toggleCol(k); }}
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
              <button onClick={resetCols} className="text-[13px] hover:underline" style={{ color: c.primary }} title="החזרת סדר והצגת העמודות למצב ההתחלתי">איפוס לברירת מחדל</button>
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

        {/* Row B: the case chip, then the filters — one line; past the panel's edge they're cut, and widening shows them */}
        <div className="flex items-center gap-1.5 overflow-hidden *:shrink-0">
          {/* a column's filter shows only while the column does */}
          {colState.shown.source && <MultiDropdown label="מקור" value={m.source} options={SOURCE_OPTS} onChange={(v) => setMulti("source", v)} isDark={isDark} width={96} counts={facets.source} />}
          {colState.shown.court && <MultiDropdown label="ערכאה" value={m.court} options={COURTS} onChange={(v) => setMulti("court", v)} isDark={isDark} width={100} counts={facets.court} />}
          {colState.shown.caseType && <MultiDropdown label="סוג תיק" value={m.caseType} options={CASE_TYPES} onChange={(v) => setMulti("caseType", v)} isDark={isDark} width={100} counts={facets.caseType} />}
          {colState.shown.matter && <MultiDropdown label="תחום" value={m.matter} options={subs.matters} groups={subs.matterGroups} onChange={(v) => setMulti("matter", v)} isDark={isDark} width={150} counts={facets.matter} searchable />}
          {colState.shown.tags && <MultiDropdown label="תגית" value={m.tag} options={subs.tags} groups={subs.tagGroups} onChange={(v) => setMulti("tag", v)} isDark={isDark} width={104} counts={facets.tag} searchable />}
          {colState.shown.stage && <MultiDropdown label="שלב" value={m.stage} options={STAGES} onChange={(v) => setMulti("stage", v)} isDark={isDark} width={110} counts={facets.stage} />}
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
            {/* the columns menu, in a column of its own at the header's end, so the saved column can sort */}
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
            <button
              // one click puts the favorites first, a second goes back to the usual order
              onClick={() => setF((prev) => ({ ...prev, sort: prev.sort === "fav" ? "relevance" : "fav", dir: "desc" }))}
              className="h-full flex items-center justify-center transition-colors hover:bg-black/[0.04]"
              title="מיון: המועדפים קודם"
            >
              <Bookmark size={14} fill="currentColor" style={{ color: f.sort === "fav" ? c.primary : subCol }} />
            </button>
            {th("name", "שם הפרומפט")}
            {shownCols.map((k) => (
              <div key={k} className="relative min-w-0">
                {th(k, COL_LABELS[k], CENTERED.includes(k) ? "center" : "right")}
                <div
                  onMouseDown={(e) => startResize(k, e)}
                  onDoubleClick={() => setColW((prev) => { const next = { ...prev }; delete next[k]; try { window.localStorage.setItem(COLW_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; })}
                  className="absolute top-0 bottom-0 z-10 group/rz"
                  style={{ insetInlineEnd: "-3px", width: "7px", cursor: "col-resize" }}
                  title="גרירה לשינוי רוחב העמודה"
                >
                  <div className="absolute inset-y-1 transition-colors group-hover/rz:bg-[#9db6d6]" style={{ insetInlineEnd: "3px", width: "2px", borderRadius: "1px" }} />
                </div>
              </div>
            ))}
            {/* the row actions stay in view when the table is wider than the panel; the last column is what gets cut */}
            <div className="sticky z-[1]" style={{ left: "32px", backgroundColor: surface }} />
            <div className="sticky left-0 z-[1]" style={{ backgroundColor: surface }} />
          </div>

          {list.length === 0 && (
            <div className="py-16 text-center text-[13.5px]" style={{ color: subCol }}>
              לא נמצאו פרומפטים התואמים לחיפוש.
            </div>
          )}

          {list.map((pr) => {
            const active = openId === pr.id;
            return (
              <div
                key={pr.id}
                onClick={() => onOpen(pr)}
                className="group relative grid items-center cursor-pointer transition-colors"
                style={{ gridTemplateColumns: cols, minHeight: "60px", borderBottom: `1px solid ${rowLine}`, backgroundColor: active ? activeBg : surface }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.03)" : "#f7f9fc"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = surface; }}
              >
                {/* the open row carries the documents table's blue edge */}
                {active && <div className="absolute top-0 bottom-0 right-0" style={{ width: "3px", backgroundColor: c.primary }} />}
                <div />
                <div className="flex items-center justify-center">
                  <FavMark on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} quiet />
                </div>

                <div className="min-w-0 text-right px-1.5 py-2">
                  <div className="text-[14px] truncate" style={{ color: active ? c.primary : textCol }}>{pr.name}</div>
                  {/* a detailed prompt's wand sits with the line that says so, so every name starts at the same edge */}
                  {pr.parts ? (
                    <div className="text-[13px] mt-0.5 flex items-center gap-1 min-w-0" style={{ color: subCol }}>
                      <WandSparkles size={13} className="flex-none" style={{ transform: "scaleX(-1)" }} />
                      <span className="truncate">פרומפט מפורט · {pr.parts.length === 1 ? "חלק אחד" : `${pr.parts.length} חלקים`}</span>
                    </div>
                  ) : (
                    <div className="text-[13px] truncate mt-0.5" style={{ color: subCol }} title={pr.body}>{pr.body}</div>
                  )}
                </div>

                {shownCols.map((k) => cell(k, pr))}

                {/* Using a prompt stays one click: it doesn't need the editor open first */}
                {/* no z-index on these sticky cells: one would trap the row menu (position: fixed) under the panel's edge handle */}
                <div className="self-stretch sticky flex items-center justify-center" style={{ left: "32px", backgroundColor: "inherit" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onUse(pr); }}
                    className="size-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/5 transition-opacity"
                    style={{ color: c.primary }}
                    title="שימוש בפרומפט"
                  >
                    <UseExampleIcon size={16} />
                  </button>
                </div>

                <div className="self-stretch sticky left-0 flex items-center justify-center" style={{ backgroundColor: "inherit" }}>
                  <RowMenu isDark={isDark} items={menuFor(pr, onUse, onEdit, onShare, onDelete, onFav)} />
                </div>
              </div>
            );
          })}

          {/* the count, with the platform's disclaimer behind the i — the chat carries its own
              disclaimer, and two of them side by side read as one too many */}
          <div className="pt-3 px-2 flex items-center gap-1.5 text-[12.5px]" style={{ color: subCol }}>
            <span>{list.length} פרומפטים</span>
            <button
              onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setInfo((v) => (v ? null : rect)); }}
              className="size-6 flex items-center justify-center rounded transition-colors hover:bg-black/5"
              style={{ color: info ? c.primary : c.iconGray }}
              title="על מאגר הפרומפטים"
            >
              <Info size={16} />
            </button>
          </div>
        </div>
      </div>

      {info && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={() => setInfo(null)} />
          <div
            dir="rtl"
            className="fixed z-[200] rounded-[8px] px-4 py-3 text-[13px] leading-relaxed"
            style={{
              bottom: window.innerHeight - info.top + 6, right: Math.max(8, window.innerWidth - info.right - 8), width: "320px",
              backgroundColor: surface, color: textCol, border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            }}
          >
            הנהלת בתי המשפט מעמידה פלטפורמה זו לשיתוף ידע בלבד, ואינה נושאת באחריות לתוכן, לדיוק או לתוצאות השימוש בפרומפטים בחלק שלא עבר תיקוף.
          </div>
        </>
      )}
    </div>
  );
}
