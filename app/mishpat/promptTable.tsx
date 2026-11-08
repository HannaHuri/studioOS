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

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Bookmark, Pin, ChevronDown, GripVertical, Info, Maximize2, Minimize2, MoreVertical, Plus, Search, WandSparkles, X } from "lucide-react";
import { c, dk, FONT } from "./theme";
import { Tick } from "./proofread";
import {
  ANY, GENERAL, CASE_TYPES, MATTERS_BY, STAGES, COURTS,
  MultiDropdown, FavMark, RowMenu, SourceMark, SourceNameMark, menuFor, matches, srcName, authorName, authorFull, avgOf,
  saved, EMPTY_FILTERS, SOURCE_OPTS, SOURCE_RANK, dateOf, byDate,
  type Prompt, type Filters, type SortKey,
} from "./prompts";

// The data columns the user can show, hide and reorder. The saved mark, the name and the two
// row actions are structural and always there.
// caseType reads "תחום" and matter "תת תחום" (2026-11-08); the prompt's text is a column of its own, off by default
// The favorite and the kind are narrow icon columns at the row's start, and the author a column of its
// own with its mark and מערכת / אני / אחרים (Hanna, 2026-11-08, after trying them as icons by the ⋯).
type ColKey = "content" | "author" | "date" | "court" | "caseType" | "matter" | "stage" | "rating";
const COL_LABELS: Record<ColKey, string> = {
  content: "תוכן", author: "מחבר", date: "תאריך", court: "ערכאה", caseType: "תחום", matter: "תת תחום", stage: "שלב בתיק", rating: "דירוג",
};
const COL_TRACKS: Record<ColKey, string> = {
  content: "240px", author: "56px", date: "76px", court: "96px", caseType: "76px", matter: "108px", stage: "104px", rating: "76px",
};
// the author after תחום and תת תחום (Hanna, 2026-11-08)
const DEFAULT_ORDER: ColKey[] = ["content", "date", "court", "caseType", "matter", "author", "stage", "rating"];
// תחום, תת תחום and דירוג fit the side panel's width with a readable name; the rest are there to add
const DEFAULT_SHOWN: Record<ColKey, boolean> = {
  content: false, author: true, date: false, court: false, caseType: true, matter: true, stage: false, rating: true,
};
// a detailed prompt is one built of parts; the rest are plain
const KIND_OPTS = ["פשוט", "מפורט"];
const kindOf = (pr: Prompt) => (pr.parts ? "מפורט" : "פשוט");
// v3: the defaults changed (uses gone, tags and the categories in, then דירוג), so older saved picks start over
// the filters that take several values, and what each one reads off a prompt
// (the author and the kind have no column, so their filters are always there)
type MKey = "source" | "caseType" | "matter" | "stage" | "court" | "kind";
type Multi = Record<MKey, string[]>;
const M_KEYS: MKey[] = ["source", "caseType", "matter", "stage", "court", "kind"];
const EMPTY_MULTI: Multi = { source: [], caseType: [], matter: [], stage: [], court: [], kind: [] };
const VALUE_OF: Record<MKey, (pr: Prompt) => string | string[]> = {
  source: srcName, caseType: (pr) => pr.caseType, matter: (pr) => pr.matter, stage: (pr) => pr.stage, court: (pr) => pr.court, kind: kindOf,
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
        if (Array.isArray(raw[k]) && (k === "kind" || k === "source" || shown[k as ColKey])) out[k] = raw[k].filter((v: unknown): v is string => typeof v === "string")
          .map((v: string) => (k === "source" && v === "שלי" ? "אני" : k === "source" && v === "משותף" ? "אחרים" : v)); // renamed values
      }
      return out;
    }
  } catch { /* fall back to nothing picked */ }
  return EMPTY_MULTI;
};
const COLS_LS_KEY = "mishpat-promptCols-v9"; // v5: tags gone, content in; v8: the author column on by default; v9: it moved after תת תחום
const COLW_LS_KEY = "mishpat-promptColW-v1";
type ColState = { order: ColKey[]; shown: Record<ColKey, boolean> };
// The panel only mounts once the library is opened, after hydration, so it can read storage up front
// the content column is on by default only where the table is wide enough to show it (Hanna, 2026-11-08)
const defaultShown = (width: number): Record<ColKey, boolean> => ({ ...DEFAULT_SHOWN, content: width >= 900 });
const loadCols = (width: number): ColState => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(COLS_LS_KEY) ?? "null");
    if (raw) {
      const order = (raw.order as string[]).filter((k): k is ColKey => k in COL_LABELS);
      return { order: [...order, ...DEFAULT_ORDER.filter((k) => !order.includes(k))], shown: { ...defaultShown(width), ...raw.shown } };
    }
  } catch { /* fall back to the defaults */ }
  return { order: DEFAULT_ORDER, shown: defaultShown(width) };
};

// /lab's text-wrap glyph (Google's format_text_wrap, Material Symbols, Apache-2.0), the one its תקציר uses
function WrapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="M180-180v-600h60v600h-60Zm540 0v-600h60v600h-60Zm-290.61-92.23L301.62-400l127.77-126.77L471.15-485l-55 55h98.46q37.62 0 63.81-26.19 26.2-26.19 26.2-63.81 0-37.62-26.2-63.81Q552.23-610 514.61-610H295.39v-60h219.22q62.16 0 106.08 43.92 43.92 43.93 43.92 106.08t-43.92 106.08Q576.77-370 514.61-370h-98.46l55 55-41.76 42.77Z" />
    </svg>
  );
}

export function PromptTablePanel({
  isDark, prompts, width, isFocus, onToggleFocus, onClose, openId, onOpen, onNew, onUse, onFav, onPin, onEdit, onShare, onDelete, onMinWidth,
}: {
  isDark: boolean; prompts: Prompt[]; width: number;
  isFocus: boolean; onToggleFocus: () => void; onClose: () => void;
  openId: string | null;              // the prompt open in the editor — its row is marked
  onOpen: (pr: Prompt) => void; onNew: () => void;
  onUse: (pr: Prompt) => void; onFav: (id: string) => void; onPin: (id: string) => void; onEdit: (pr: Prompt) => void;
  onShare: (pr: Prompt) => void; onDelete: (pr: Prompt) => void;
  onMinWidth?: (w: number) => void; // the narrowest the panel goes: every filter still in view
}) {
  // Opens on what suits the open case — the job the narrow "מוצעים" panel did before the table
  // replaced it. One click on the chip takes it back to the whole מאגר.
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);

  const [colState, setColState] = useState<ColState>(() => loadCols(width));
  // the filters' full line, plus the panel's padding, is the narrowest the panel may be dragged
  // (Hanna, 2026-11-08: no filter cut off)
  const filtersRef = useRef<HTMLDivElement>(null);
  const lastMin = useRef(0);
  useEffect(() => {
    const el = filtersRef.current;
    if (!el || !onMinWidth) return;
    // the line's own width (its filters and the gaps between them), not the room it was given
    const kids = [...el.children] as HTMLElement[];
    const line = kids.reduce((sum, k) => sum + k.offsetWidth, 0) + 6 * Math.max(0, kids.length - 1);
    const need = Math.ceil(line + (width - el.clientWidth));
    if (need !== lastMin.current) { lastMin.current = need; onMinWidth(need); }
  });
  const saveCols = (next: ColState) => {
    setColState(next);
    try { window.localStorage.setItem(COLS_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const shownCols = colState.order.filter((k) => colState.shown[k]);
  const [colsMenu, setColsMenu] = useState<DOMRect | null>(null);
  const [info, setInfo] = useState<DOMRect | null>(null);

  // the content cell's tooltip: larger than the native one, as on the documents table in /lab
  // over a name it opens with the name itself, since a long one is cut
  const [contentWrap, setContentWrap] = useState(false); // the תוכן column: wrap to several lines, or one line cut
  const [tip, setTip] = useState<{ title?: string; text: string; x: number; y: number } | null>(null);
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
  const FILTERED: ColKey[] = ["court", "caseType", "matter", "stage"];
  const toggleCol = (k: ColKey) => {
    if (colState.shown[k] && FILTERED.includes(k)) {
      setMulti(k as MKey, []);
    }
    saveCols({ ...colState, shown: { ...colState.shown, [k]: !colState.shown[k] } });
  };
  const resetCols = () => {
    setM((prev) => ({ ...prev, court: [], stage: [] })); // their columns go back to hidden
    setColState({ order: DEFAULT_ORDER, shown: defaultShown(width) });
    setColW({}); // dragged widths too
    try { window.localStorage.removeItem(COLS_LS_KEY); window.localStorage.removeItem(COLW_LS_KEY); } catch { /* ignore */ }
    setColsMenu(null);
  };

  // Column widths set by dragging a header's edge; only the columns the user resized, saved per user
  const [colW, setColW] = useState<Partial<Record<ColKey | "name", number>>>(() => {
    try { return JSON.parse(window.localStorage.getItem(COLW_LS_KEY) ?? "{}") ?? {}; } catch { return {}; }
  });
  const startResize = (k: ColKey | "name", e: ReactMouseEvent) => {
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
  // תת תחום is open from the start, with everything grouped under its תחום (and a search in the menu);
  // picking תחומים narrows it to those, and removing one lets go of its values
  const sub = (cts: string[]) => {
    const chosen = cts.filter((t) => t !== GENERAL);
    const picked = chosen.length ? chosen : CASE_TYPES.filter((t) => t !== GENERAL);
    const matterGroups = picked.length > 1
      ? [{ title: "", options: [GENERAL] }, ...picked.map((ct) => ({ title: ct, options: MATTERS_BY[ct] ?? [] })).filter((g) => g.options.length > 0)]
      : [{ title: "", options: [GENERAL, ...(MATTERS_BY[picked[0]] ?? [])] }];
    const flat = (gs: { options: string[] }[]) => [...new Set(gs.flatMap((g) => g.options))];
    return { matterGroups, matters: flat(matterGroups) };
  };
  const setMulti = (k: MKey, v: string[]) => setM((prev) => {
    if (k !== "caseType") return { ...prev, [k]: v };
    const s2 = sub(v);
    return { ...prev, caseType: v, matter: prev.matter.filter((x) => s2.matters.includes(x)) };
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
      content: (a, b) => b.body.localeCompare(a.body, "he"),
      kind: (a, b) => (b.parts ? 1 : 0) - (a.parts ? 1 : 0) || saved(a) - saved(b) || avgOf(b) - avgOf(a),
      date: byDate,
      fav: (a, b) => saved(a) - saved(b) || avgOf(b) - avgOf(a),
    };
    const sorted = out.sort(cmp[f.sort] ?? cmp.relevance);
    const ordered = f.dir === "asc" && f.sort !== "relevance" ? sorted.reverse() : sorted;
    // pinned prompts head the table under any sort, the last pinned first; filters still apply to them
    const pinned = ordered.filter((pr) => pr.pinned).sort((a, b) => (b.pinned ?? 0) - (a.pinned ?? 0));
    return [...pinned, ...ordered.filter((pr) => !pr.pinned)];
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
      kind: tally("kind", KIND_OPTS),
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

  // the arrow shows on the sorted column, and on hover over any other, to say a click sorts it (Hanna, 2026-11-08)
  const th = (key: SortKey, label: ReactNode, align: "right" | "center" = "right", tip?: string) => (
    <button
      onClick={() => sortBy(key)}
      className={`group/th h-full w-full min-w-0 flex items-center gap-0.5 ${align === "center" ? "px-0" : "px-1.5"} text-[12.5px] transition-colors hover:bg-black/[0.04]`}
      style={{ color: f.sort === key ? c.primary : subCol, justifyContent: align === "center" ? "center" : "flex-start" }}
      title={`מיון לפי ${tip ?? label}`}
    >
      {typeof label === "string" ? <span className="truncate">{label}</span> : label}
      <ChevronDown size={12} className={f.sort === key ? "" : "opacity-0 group-hover/th:opacity-70"}
        style={{ transform: f.sort === key && f.dir === "asc" ? "rotate(180deg)" : "none", flexShrink: 0 }} />
    </button>
  );
  // the favorite and detailed headers: the column's icon, always there in a very light grey, darker on
  // hover and blue while on. A click puts those rows first and a second click goes back to the usual
  // order; there is no arrow, since "favorites last" means nothing (Hanna, 2026-11-08)
  const iconTh = (key: SortKey, icon: ReactNode, tip: string) => {
    const on = f.sort === key;
    return (
      <button
        onClick={() => setF((prev) => ({ ...prev, sort: prev.sort === key ? "relevance" : key, dir: "desc" }))}
        className="group/ic h-full w-full flex items-center justify-center transition-colors hover:bg-black/[0.04]"
        title={on ? `ביטול המיון לפי ${tip}` : `${tip} קודם`}
        aria-pressed={on}
      >
        <span className={`flex ${on ? "" : "text-[var(--idle)] group-hover/ic:text-[var(--hov)]"}`}
          style={{ color: on ? c.primary : undefined, ["--idle" as string]: isDark ? dk.border : "#cfd4dc", ["--hov" as string]: subCol }}>{icon}</span>
      </button>
    );
  };
  // the columns' sort: the author column sorts by source (אני, מערכת, אחרים), then by name
  const sortKeyOf = (k: ColKey): SortKey => (k === "author" ? "source" : k);

  // the name keeps a readable width; with many columns on, the table scrolls sideways instead
  // in the side panel the rating shows without its count (it's in the tooltip), which leaves the tags more room
  // and the tags column is a single chip ending in "...", like the documents table in /lab, so the default columns fit
  const SIDE: Partial<Record<ColKey, string>> = { rating: "56px", content: "160px", caseType: "68px", matter: "96px" };
  // a width the user dragged wins over both (as in the documents table in /lab)
  const track = (k: ColKey) => (colW[k] ? `${colW[k]}px` : isFocus ? COL_TRACKS[k] : SIDE[k] ?? COL_TRACKS[k]);
  const nameMin = isFocus ? 160 : 120;
  const nameMax = isFocus ? 360 : 260;
  // The rows are separate grids, so the widths are set for the list as a whole. Each column starts at
  // what it needs (the name at the average name's width, plus padding), and the room left over is
  // shared out: two parts to the name, one to every other column, so the spacing stays even and no
  // gap collects in one place (Hanna, 2026-11-08). A width the user dragged stays as dragged.
  const nameW = useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx || !list.length) return nameMin;
    ctx.font = `400 14px ${FONT}`;
    const ws = list.map((pr) => ctx.measureText(pr.name).width).sort((a, b) => a - b);
    // beside the content column the name doesn't stretch, so it takes most names whole (the 80th
    // percentile) and the content starts right after it; otherwise the average, with spare room on top
    const base = shownCols.includes("content") ? ws[Math.min(ws.length - 1, Math.floor(ws.length * 0.8))] : ws.reduce((a, b) => a + b, 0) / ws.length;
    return Math.round(Math.min(nameMax, Math.max(nameMin, base + 16)));
  }, [list, nameMin, nameMax, shownCols]);
  const ICON_COL = 34; // the favorite and the detailed columns: a mark, and the header's sort arrow on hover
  // the short columns (an icon, a number) keep their width: the room they'd get sat as a gap on their
  // left, before the detailed mark (Hanna, 2026-11-08); the text columns share it out instead
  const FIXED: ColKey[] = ["rating"];
  // the favorite opens the row and the detailed mark closes it, by the ⋯ (Hanna, 2026-11-08)
  // with the content column on, the name keeps its own width and the content takes the spare room,
  // so it starts right after the name instead of across a white gap (Hanna, 2026-11-08)
  const hasContent = shownCols.includes("content");
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number; n: number } | null>(null);
  // When the panel is narrower than the columns' widths, every column (the name and dragged widths
  // included) shrinks by the same factor instead of the table scrolling the first ones out of view
  // (Hanna, 2026-11-08); it scrolls only below each column's floor.
  const EDGES = 20 + 2 * ICON_COL + 32 + 24; // the ⋮ and icon columns, the ⋯ and the padding
  const GUTTER = 14; // the panel's border and the scrollbar's gutter, outside the table's own width
  const baseOf = (k: ColKey) => parseInt(track(k), 10);
  const nameBase = colW.name ?? nameW;
  // the icon and number columns keep their width, so their headers stay whole; the rest share what's left
  const KEEP: ColKey[] = ["author", "rating"];
  const floorOf = (k: ColKey) => (KEEP.includes(k) ? Math.min(56, baseOf(k)) : 40);
  const kept = shownCols.filter((k) => KEEP.includes(k)).reduce((sum, k) => sum + floorOf(k), 0);
  const fit = Math.min(1, Math.max(0, (width - GUTTER - EDGES - kept) / (nameBase + shownCols.filter((k) => !KEEP.includes(k)).reduce((sum, k) => sum + baseOf(k), 0))));
  const sc = (v: number, floor: number) => Math.max(floor, Math.round(v * fit));
  const flexCol = (k: ColKey) => {
    const w = sc(baseOf(k), floorOf(k));
    return colW[k] || FIXED.includes(k) ? `${w}px` : `minmax(${w}px,${k === "content" ? 4 : 1}fr)`;
  };
  const nameTrack = colW.name || hasContent ? `${sc(nameBase, 100)}px` : `minmax(${sc(nameBase, 100)}px,3fr)`;
  const cols = ["20px", `${ICON_COL}px`, nameTrack, ...shownCols.map(flexCol), `${ICON_COL}px`, "32px"].join(" ");
  // the scroller is ltr (for its scrollbar's side), so a sideways scroll opens at the name's end
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols]);
  const minW = EDGES + sc(nameBase, 100) + shownCols.reduce((sum, k) => sum + sc(baseOf(k), floorOf(k)), 0);
  const CENTERED: ColKey[] = [];
  const cell = (k: ColKey, pr: Prompt) => {
    switch (k) {
      case "author": {
        // the mark alone (Hanna, 2026-11-08: less text in the table); its word, and who wrote a shared
        // one, are in the tooltip, and the מחבר filter shows each mark with its word
        const n = srcName(pr);
        return (
          <div key={k} className="px-1.5 min-w-0 flex items-center" title={pr.source === "shared" ? `${n} · ${authorFull(pr)}` : n}>
            <SourceMark pr={pr} isDark={isDark} size={14} plain />
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
      case "content":
        // one line, cut, or up to six with the wrap toggle (a detailed prompt runs far longer); the whole
        // text in the documents table's large tooltip (/lab's תקציר)
        return (
          <div key={k} className={`px-1.5 min-w-0 text-[12.5px] ${contentWrap ? "py-2" : "truncate"}`} style={{ color: cellCol }}
            onMouseEnter={(e) => setTip({ text: pr.body, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
            {/* the clamp on an inner block, so the padding doesn't let a seventh line peek out */}
            {contentWrap ? <div className="whitespace-pre-line leading-snug line-clamp-6">{pr.body}</div> : pr.body}
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
        <div ref={filtersRef} className="flex items-center gap-1.5 overflow-hidden *:shrink-0">
          {/* a column's filter shows only while the column does */}
          {/* the favorites first, as their column opens the row, and the kind last, as its column closes it
              (Hanna, 2026-11-08). The favorites, the author and the kind are always there */}
          <button
            onClick={() => set("favOnly", !f.favOnly)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-[4px] text-[13px] transition-colors hover:bg-black/[0.03]"
            style={{ border: `1px solid ${f.favOnly ? c.primary : (isDark ? dk.border : c.border)}`, color: f.favOnly ? c.primary : textCol, backgroundColor: isDark ? dk.input : "white" }}
            title={f.favOnly ? "הצגת כל הפרומפטים" : "הצגת המועדפים בלבד"}
            aria-pressed={f.favOnly}
          >
            <Bookmark size={13} fill={f.favOnly ? "currentColor" : "none"} />
            מועדפים
          </button>
          {colState.shown.caseType && <MultiDropdown label="תחום" value={m.caseType} options={CASE_TYPES} onChange={(v) => setMulti("caseType", v)} isDark={isDark} width={100} counts={facets.caseType} />}
          {colState.shown.matter && <MultiDropdown label="תת תחום" value={m.matter} options={subs.matters} groups={subs.matterGroups} onChange={(v) => setMulti("matter", v)} isDark={isDark} width={150} counts={facets.matter} searchable />}
          <MultiDropdown label="מחבר" value={m.source} options={SOURCE_OPTS} onChange={(v) => setMulti("source", v)} isDark={isDark} width={96} counts={facets.source}
            icons={Object.fromEntries(SOURCE_OPTS.map((o) => [o, <SourceNameMark key={o} name={o} isDark={isDark} size={14} />]))} />
          {colState.shown.court && <MultiDropdown label="ערכאה" value={m.court} options={COURTS} onChange={(v) => setMulti("court", v)} isDark={isDark} width={100} counts={facets.court} />}
          {colState.shown.stage && <MultiDropdown label="שלב בתיק" value={m.stage} options={STAGES} onChange={(v) => setMulti("stage", v)} isDark={isDark} width={110} counts={facets.stage} />}
          <MultiDropdown label="סוג פרומפט" value={m.kind} options={KIND_OPTS} onChange={(v) => setMulti("kind", v)} isDark={isDark} width={112} counts={facets.kind} />
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
            {iconTh("fav", <Bookmark size={14} />, "מועדפים")}
            <div className="relative min-w-0">
              {th("name", "שם הפרומפט")}
              <div
                onMouseDown={(e) => startResize("name", e)}
                onDoubleClick={() => setColW((prev) => { const next = { ...prev }; delete next.name; try { window.localStorage.setItem(COLW_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; })}
                className="absolute top-0 bottom-0 z-10 group/rz"
                style={{ insetInlineEnd: "-3px", width: "7px", cursor: "col-resize" }}
                title="גרירה לשינוי רוחב העמודה"
              >
                <div className="absolute inset-y-1 transition-colors group-hover/rz:bg-[#9db6d6]" style={{ insetInlineEnd: "3px", width: "2px", borderRadius: "1px" }} />
              </div>
            </div>
            {shownCols.map((k) => (
              <div key={k} className="relative min-w-0">
                {k === "content" ? (
                  // the documents table's wrap toggle (/lab's תקציר): the text on several lines or on one
                  <div className="h-full flex items-center min-w-0">
                    <div className="min-w-0 h-full">{th("content", COL_LABELS.content)}</div>
                    <button onClick={() => setContentWrap((v) => !v)} title={contentWrap ? "צמצום התוכן לשורה אחת" : "פריסת התוכן לכמה שורות"}
                      className="flex-none flex items-center hover:opacity-70" style={{ color: contentWrap ? c.primary : (isDark ? dk.textMuted : c.iconGray) }}>
                      <WrapIcon />
                    </button>
                  </div>
                ) : th(sortKeyOf(k), COL_LABELS[k], CENTERED.includes(k) ? "center" : "right")}
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
            {iconTh("kind", <WandSparkles size={14} style={{ transform: "scaleX(-1)" }} />, "פרומפטים מפורטים")}
            {/* the row actions stay in view when the table is wider than the panel; the last column is what gets cut */}
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
                onClick={() => onUse(pr)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu((v) => ({ id: pr.id, x: e.clientX, y: e.clientY, n: (v?.n ?? 0) + 1 })); }}
                title="לחיצה מכניסה את הפרומפט לצ'אט"
                className="group relative grid items-center cursor-pointer transition-colors"
                style={{ gridTemplateColumns: cols, minHeight: "44px", borderBottom: `1px solid ${rowLine}`, backgroundColor: active ? activeBg : surface }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.03)" : "#f7f9fc"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = surface; }}
              >
                {/* the open row carries the documents table's blue edge */}
                {active && <div className="absolute top-0 bottom-0 right-0" style={{ width: "3px", backgroundColor: c.primary }} />}
                <div />
                {/* favorite: filled grey when saved, a light grey outline when not */}
                <div className="flex justify-center"><FavMark on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} small faint /></div>
                {/* the name alone; the text is in the תוכן column */}
                <div className="min-w-0 text-right px-1.5 py-2 flex items-center gap-1.5">
                  {/* a touch heavier than the cells; its text shows on hover, as in the תוכן column */}
                  <span className="text-[14px] font-normal truncate" style={{ color: active ? c.primary : textCol }}
                    onMouseEnter={(e) => setTip({ title: pr.name, text: pr.body, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>{pr.name}</span>
                  {/* why it is at the top */}
                  {pr.pinned && <span className="flex-none flex" style={{ color: subCol, transform: "translateY(1.5px)" }} title="נעוץ למעלה"><Pin size={13} fill="currentColor" /></span>}
                </div>

                {shownCols.map((k) => cell(k, pr))}
                {/* detailed: an empty grey wand, only on a detailed prompt */}
                <div className="flex justify-center" style={{ color: subCol }}
                  title={pr.parts ? `פרומפט מפורט · ${pr.parts.length === 1 ? "חלק אחד" : `${pr.parts.length} חלקים`}` : undefined}>
                  {pr.parts && <WandSparkles size={14} style={{ transform: "scaleX(-1)" }} />}
                </div>
                {/* a click on the row puts the prompt in the chat; viewing and editing are in the ⋯ menu */}
                <div className="self-stretch sticky left-0 flex items-center justify-center" style={{ backgroundColor: "inherit" }}>
                  <RowMenu isDark={isDark} items={menuFor(pr, onUse, onEdit, onShare, onDelete, onFav, onOpen, onPin)} openAt={ctxMenu?.id === pr.id ? ctxMenu : null} />
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

      {tip && (
        <div
          className="fixed z-[300] pointer-events-none whitespace-pre-wrap overflow-hidden"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 336), top: Math.min(tip.y + 18, window.innerHeight - 320), maxWidth: "320px", maxHeight: "300px", padding: "9px 12px", borderRadius: "8px", backgroundColor: isDark ? "#0d1424" : "#1e2732", color: "#fff", fontSize: "14.5px", lineHeight: 1.5, fontFamily: "Noto Sans Hebrew, sans-serif", boxShadow: "0 8px 26px rgba(0,0,0,0.28)", direction: "rtl" }}
        >
          {tip.title && <div className="font-semibold mb-1">{tip.title}</div>}
          {tip.text}
        </div>
      )}
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
