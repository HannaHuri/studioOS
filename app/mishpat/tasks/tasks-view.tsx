"use client";

// ── The judge's task list ───────────────────────────────────────────────────
// Same table language as the documents panel (dense rows, per-column show/hide + drag-to-reorder + drag-to-resize,
// persisted to localStorage), with three differences that follow from what a task is:
//
//  1. It spreads to the full width by default — this is a screen, not a side panel.
//  2. No selection checkbox. A judge does not assemble a set of tasks the way they assemble a set of documents to
//     ask about; they work one task at a time. The chat scope is set from the open DOCUMENT instead.
//  3. It carries a רקע column: a short paragraph, composed per task, saying only what actually matters in this
//     particular request. See TASK_PLAYBOOKS in ./tasks-data for the model layer behind it.
//
// Clicking anywhere on a row opens its document, exactly as clicking a row opens a document in the documents
// table. The one control that does something else is the תהליך chip, which opens the request's thread in place.

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, MoreVertical, Route, Search, X } from "lucide-react";
import { c, dk, type CaseDoc } from "./shared";
import {
  TASKS, TASK_DOCS, TASK_KIND_COLORS, URGENCY_LABEL, URGENCY_ORDER,
  daysFrom, daysUntil, fmtDate, fmtDays, fmtEstimate, threadDocsFor,
  type JudgeTask, type TaskUrgency,
} from "./tasks-data";

// ── Columns ────────────────────────────────────────────────────────────────
// "subject" is the anchor: it is always visible and never listed in the columns menu, exactly like שם מסמך in the
// documents table — it is the row's identity.
type TaskColKey =
  | "urgency" | "kind" | "caseNumber" | "caseName" | "waiting" | "due" | "hearing"
  | "background" | "estimate" | "process" | "opened" | "submitter" | "notes" | "handler";
type TaskLayoutKey = TaskColKey | "subject";

// The text-wrap glyph. This is Google's own `format_text_wrap` (Material Symbols, Apache-2.0) — the icon Sheets
// puts on this exact control, and the one the PM recognised on sight. Three rounds of stroke-based glyphs failed
// here for a reason worth keeping: a stroke icon spends its budget on THREE horizontal text lines stacked inside
// ~10px, so nothing has room. This one spends it on two long VERTICAL bars — the cell's edges — which stay crisp
// at any size and carry the whole silhouette, leaving one big filled arrow between them. Filled beats stroked at
// this size (more ink per pixel), so it holds together where our own drawings smudged.
// NOT mirrored for RTL, deliberately (her call): the arrow points left exactly as it does in Sheets, because what
// this icon is doing here is being recognised, and it is recognised by the shape people already know.
function WrapIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d="M160-160v-640h80v640h-80Zm560 0v-640h80v640h-80Zm-296-98L282-400l142-141 56 56-45 45h85q33 0 56.5-23.5T600-520q0-33-23.5-56.5T520-600H280v-80h240q66 0 113 47t47 113q0 66-47 113t-113 47h-85l45 45-56 57Z" />
    </svg>
  );
}

const TASK_COL_KEYS: TaskColKey[] = [
  "urgency", "kind", "caseNumber", "caseName", "waiting", "due", "hearing",
  "background", "estimate", "process", "opened", "submitter", "notes", "handler",
];
const TASK_COL_LABELS: Record<TaskColKey, string> = {
  urgency: "דחיפות", kind: "סוג משימה", caseNumber: "מס׳ תיק", caseName: "שם תיק",
  waiting: "בהמתנה", due: "תאריך יעד", hearing: "ת. דיון קרוב", background: "רקע",
  estimate: "זמן טיפול", process: "תהליך", opened: "תאריך פתיחה",
  submitter: "מגיש", notes: "הערות", handler: "גורם מטפל",
};
const TASK_COL_DEFAULTS: Record<TaskColKey, boolean> = {
  urgency: true, kind: true, caseNumber: true, caseName: true, waiting: true, due: true, hearing: true,
  background: true, estimate: true, process: true, opened: false, submitter: false, notes: false, handler: false,
};
const DEFAULT_TASK_LAYOUT: TaskLayoutKey[] = [
  "urgency", "kind", "process", "subject", "caseNumber", "caseName", "waiting", "due", "hearing",
  "background", "estimate", "opened", "submitter", "notes", "handler",
];
// Base widths in px. רקע is the one flexible track — see the docs-table rule: at least one uncapped `fr` must stay
// reachable in every visibility combination, or the columns bunch up at the right edge on a wide screen.
const TASK_COL_W: Record<TaskLayoutKey, number> = {
  urgency: 30, kind: 132, subject: 260, caseNumber: 104, caseName: 178, waiting: 74, due: 82, hearing: 92,
  background: 300, estimate: 74, process: 34, opened: 82, submitter: 74, notes: 168, handler: 132,
};

const COLS_LS = "mishpat-tasks-cols-v2";     // v2: "thread" became "process"
const LAYOUT_LS = "mishpat-tasks-layout-v2"; // v2: תהליך moved next to סוג משימה
const WIDTH_LS = "mishpat-tasks-colw-v2";
const GROUP_LS = "mishpat-tasks-group-v1";

const readLS = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const writeLS = (key: string, v: unknown) => { try { window.localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };

const reconcileLayout = (stored: string[]): TaskLayoutKey[] => {
  const all: TaskLayoutKey[] = ["subject", ...TASK_COL_KEYS];
  const valid = stored.filter((k): k is TaskLayoutKey => all.includes(k as TaskLayoutKey));
  const withAnchor: TaskLayoutKey[] = valid.includes("subject") ? valid : [...valid, "subject"];
  return [...withAnchor, ...all.filter((k) => !withAnchor.includes(k))];
};

// ── Grouping / sorting ─────────────────────────────────────────────────────
type GroupKey = "urgency" | "kind" | "case" | "none";
const GROUP_LABELS: Record<GroupKey, string> = {
  urgency: "דחיפות", kind: "סוג משימה", case: "תיק", none: "ללא קיבוץ",
};
type SortKey = "urgency" | "due" | "waiting" | "kind" | "caseName" | "estimate" | "subject";

const URG_COLOR: Record<TaskUrgency, string> = {
  critical: "#d83a52", high: "#f0a202", normal: "#7f8da6", low: "#c3cad6",
};

export default function TasksView({
  isDark, docs, openDocId, activeTaskId, onOpenTask, onOpenDoc, onCloseTask,
}: {
  isDark: boolean;
  docs: CaseDoc[];                       // the fully-modelled cases — a task in one of them opens its real document
  openDocId?: string;
  activeTaskId?: string;                 // stays highlighted while reading another document from the same thread
  onOpenTask: (task: JudgeTask, doc: CaseDoc) => void;
  onOpenDoc: (doc: CaseDoc) => void;     // a document opened from inside a thread, without changing the active task
  onCloseTask?: () => void;
}) {
  const bg = isDark ? dk.surface : "white";
  const text = isDark ? dk.text : c.text;
  const muted = isDark ? dk.textMuted : c.textGray;
  const border = isDark ? dk.border : "#e3ebf5";

  const [visible, setVisible] = useState<Record<TaskColKey, boolean>>(TASK_COL_DEFAULTS);
  const [layout, setLayout] = useState<TaskLayoutKey[]>(DEFAULT_TASK_LAYOUT);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [dragFreeze, setDragFreeze] = useState<Record<string, number> | null>(null);
  const [group, setGroup] = useState<GroupKey>("urgency");
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("הכל");
  const [bgWrap, setBgWrap] = useState(false);          // header arrow — every row shows its full background
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  // Once a document is open the table keeps its place but loses most of its width. Rather than leaving the judge to
  // scroll a 1500px table sideways inside a 640px column, drop to the columns that carry the jump-to-the-next-task
  // decision. The user's own column choices are untouched — this is a display mode, not a change to their layout.
  const [paneW, setPaneW] = useState(0);
  // Measured on every render as well as through a ResizeObserver: the observer alone misses the case that matters
  // most here — opening a document re-lays-out this pane from ~1540px to ~640px without the pane's own box being
  // resized by anything the observer is watching.
  const measurePane = () => {
    const el = rootRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    setPaneW((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  };
  useEffect(measurePane);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measurePane);
    ro.observe(el);
    window.addEventListener("resize", measurePane);
    return () => { ro.disconnect(); window.removeEventListener("resize", measurePane); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const narrow = paneW > 0 && paneW < 880;
  const NARROW_COLS: TaskLayoutKey[] = ["urgency", "process", "subject", "due", "background"];
  const NARROW_W: Partial<Record<TaskLayoutKey, number>> = { subject: 176, background: 160, due: 76 };
  // Hand-set widths are honoured in the full layout only — they were chosen for a table twice this wide.
  const colW = (k: TaskLayoutKey) => (narrow ? NARROW_W[k] ?? TASK_COL_W[k] : widths[k] ?? TASK_COL_W[k]);

  // Saved state is read after mount — localStorage does not exist during SSR, and reading it in useState would
  // make the server and client markup disagree.
  useEffect(() => {
    setVisible({ ...TASK_COL_DEFAULTS, ...readLS(COLS_LS, {} as Partial<Record<TaskColKey, boolean>>) });
    setLayout(reconcileLayout(readLS<string[]>(LAYOUT_LS, DEFAULT_TASK_LAYOUT)));
    setWidths(readLS<Record<string, number>>(WIDTH_LS, {}));
    setGroup(readLS<GroupKey>(GROUP_LS, "urgency"));
  }, []);

  const toggleCol = (key: TaskColKey) =>
    setVisible((prev) => { const next = { ...prev, [key]: !prev[key] }; writeLS(COLS_LS, next); return next; });
  const changeGroup = (g: GroupKey) => { setGroup(g); writeLS(GROUP_LS, g); setCollapsedGroups(new Set()); };
  const resetCols = () => {
    setVisible({ ...TASK_COL_DEFAULTS }); setLayout([...DEFAULT_TASK_LAYOUT]); setWidths({});
    [COLS_LS, LAYOUT_LS, WIDTH_LS].forEach((k) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } });
    setColsOpen(false);
  };
  // Reorder BY KEY (never by index) — an index-based move reinserts the anchor at a fixed slot and makes the
  // subject column jump around, which is what broke drag-reorder in the documents table.
  const moveCol = (from: TaskColKey, to: TaskColKey) => {
    setLayout((prev) => {
      const next = prev.filter((k) => k !== from);
      const at = next.indexOf(to);
      if (at < 0) return prev;
      next.splice(at, 0, from);
      writeLS(LAYOUT_LS, next);
      return next;
    });
  };

  const docById = useMemo(() => {
    const m = new Map<string, CaseDoc>();
    [...TASK_DOCS, ...docs].forEach((d) => m.set(d.id, d));
    return m;
  }, [docs]);

  const kinds = useMemo(() => ["הכל", ...Array.from(new Set(TASKS.map((t) => t.kind)))], []);

  const filtered = useMemo(() => {
    const q = query.trim();
    return TASKS.filter((t) => {
      if (kindFilter !== "הכל" && t.kind !== kindFilter) return false;
      if (!q) return true;
      return [t.subject, t.caseName, t.caseNumber, t.kind, t.background].some((f) => f.includes(q));
    });
  }, [query, kindFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (t: JudgeTask): string | number => {
      switch (sortKey) {
        case "urgency": return URGENCY_ORDER.indexOf(t.urgency);
        case "due": return t.dueIso ?? "9999";
        case "waiting": return -daysFrom(t.openedIso);
        case "estimate": return t.estimate;
        case "kind": return t.kind;
        case "caseName": return t.caseName;
        case "subject": return t.subject;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "he") * dir;
    });
  }, [filtered, sortKey, sortDir]);

  // Groups. Urgency is the default because it is the only ordering that answers "what do I do now" — but the
  // court system groups by task type, so that stays one click away.
  const groups = useMemo(() => {
    if (group === "none") return [{ key: "all", label: "", items: sorted }];
    if (group === "urgency") {
      return URGENCY_ORDER
        .map((u) => ({ key: u, label: URGENCY_LABEL[u], items: sorted.filter((t) => t.urgency === u) }))
        .filter((g) => g.items.length > 0);
    }
    if (group === "kind") {
      const seen = Array.from(new Set(sorted.map((t) => t.kind)));
      return seen
        .map((k) => ({ key: k, label: k, items: sorted.filter((t) => t.kind === k) }))
        .sort((a, b) => b.items.length - a.items.length);
    }
    const seen = Array.from(new Set(sorted.map((t) => t.caseNumber)));
    return seen.map((num) => {
      const items = sorted.filter((t) => t.caseNumber === num);
      return { key: num, label: `${items[0].caseName} · ${num}`, items };
    });
  }, [sorted, group]);

  // ── Column geometry ───────────────────────────────────────────────────────
  const visCols = useMemo(
    () => narrow
      ? layout.filter((k) => NARROW_COLS.includes(k))
      : layout.filter((k) => k === "subject" || visible[k as TaskColKey]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, visible, narrow],
  );
  const template = useMemo(() => {
    const frozen = dragFreeze;
    // Prefer a column the user has NOT resized by hand (רקע, then the task name), but if both carry an explicit
    // width, promote one anyway — a layout with no `fr` anywhere leaves dead space on the left of a wide screen.
    const flexible = frozen ? null : (
      visCols.includes("background") && widths.background === undefined ? "background"
        : widths.subject === undefined ? "subject"
        : visCols.includes("background") ? "background" : "subject"
    );
    return visCols
      .map((k) => {
        if (frozen?.[k] !== undefined) return `${frozen[k]}px`;
        const w = colW(k);
        return k === flexible ? `minmax(${w}px, 1fr)` : `${w}px`;
      })
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visCols, widths, dragFreeze, narrow]);
  const minWidth = useMemo(
    () => visCols.reduce((sum, k) => sum + colW(k) + 10, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visCols, widths, narrow],
  );

  const startResize = (e: ReactMouseEvent, key: TaskLayoutKey) => {
    e.preventDefault(); e.stopPropagation();
    const cell = e.currentTarget.parentElement as HTMLElement;
    const grid = cell.parentElement as HTMLElement;
    const frozen: Record<string, number> = {};
    visCols.forEach((k, i) => {
      const el = grid.children[i] as HTMLElement;
      if (el) frozen[k] = Math.round(el.getBoundingClientRect().width);
    });
    setDragFreeze(frozen);
    const startW = frozen[key]; const startX = e.clientX; let last = startW;
    // RTL: the column grows from its LEFT edge, where the handle sits — drag left to widen.
    const onMove = (ev: MouseEvent) => {
      last = Math.max(28, Math.round(startW + (startX - ev.clientX)));
      setDragFreeze((p) => ({ ...(p || frozen), [key]: last }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      setWidths((prev) => { const next = { ...prev, [key]: last }; writeLS(WIDTH_LS, next); return next; });
      setDragFreeze(null);
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const sortHead = (k: SortKey, label: string) => (
    <button onClick={() => toggleSort(k)} title={`מיון לפי ${label}`} className="flex items-center gap-0.5 h-full whitespace-nowrap hover:opacity-80"
      style={{ color: sortKey === k ? c.primary : muted }}>
      <span>{label}</span>
      {sortKey === k && (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
    </button>
  );

  const headerCell = (k: TaskLayoutKey) => {
    switch (k) {
      case "urgency": return (
        <button onClick={() => toggleSort("urgency")} title="מיון לפי דחיפות" className="flex items-center justify-center w-full h-full hover:opacity-80">
          <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: sortKey === "urgency" ? c.primary : (isDark ? dk.textMuted : "#aab4c4") }} />
        </button>
      );
      case "kind": return sortHead("kind", "סוג משימה");
      case "subject": return sortHead("subject", "משימה");
      case "caseNumber": return <span>מס׳ תיק</span>;
      case "caseName": return sortHead("caseName", "שם תיק");
      case "waiting": return sortHead("waiting", "בהמתנה");
      case "due": return sortHead("due", "יעד");
      case "hearing": return <span>ת. דיון</span>;
      case "background": return (
        <span className="flex items-center gap-1">
          <span>רקע</span>
          <button
            onClick={() => setBgWrap((v) => !v)}
            title={bgWrap ? "צמצום הרקע לשתי שורות" : "פריסת הרקע המלא בכל השורות"}
            className="flex items-center hover:opacity-70"
            style={{ color: bgWrap ? c.primary : (isDark ? dk.textMuted : c.iconGray) }}
          >
            <WrapIcon />
          </button>
        </span>
      );
      case "estimate": return sortHead("estimate", "זמן טיפול");
      case "process": return <span title="תהליך — שרשור הבקשה" className="flex items-center justify-center w-full" style={{ color: muted }}><Route size={13} /></span>;
      case "opened": return <span>נפתחה</span>;
      case "submitter": return <span>מגיש</span>;
      case "notes": return <span>הערות</span>;
      case "handler": return <span>גורם מטפל</span>;
    }
  };

  const openTask = (t: JudgeTask) => {
    const doc = docById.get(t.docId);
    if (doc) onOpenTask(t, doc);
  };
  const toggleThread = (id: string) =>
    setOpenThreads((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const cell = (k: TaskLayoutKey, t: JudgeTask, isOpen: boolean, threadOpen: boolean, threadCount: number) => {
    switch (k) {
      case "urgency":
        return (
          <span className="flex items-center justify-center w-full" title={`דחיפות: ${URGENCY_LABEL[t.urgency]}`}>
            <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: URG_COLOR[t.urgency] }} />
          </span>
        );
      case "kind": {
        const kc = TASK_KIND_COLORS[t.kind];
        return (
          <span className="min-w-0 flex">
            <span className="text-[11.5px] truncate rounded px-1.5 py-px" title={t.kind}
              style={{ backgroundColor: kc.bg, color: kc.color, fontFamily: "Noto Sans Hebrew, sans-serif" }}>
              {t.kind}
            </span>
          </span>
        );
      }
      case "subject":
        return (
          <span className="truncate" title={`פתיחת המסמך: ${docById.get(t.docId)?.name ?? t.subject}`}
            style={{ color: isOpen ? c.primary : text, fontWeight: isOpen ? 600 : 500 }}>
            {t.subject}
          </span>
        );
      case "process":
        // "pill = data, box = button" — the thread trigger wears the same boxed chip as the documents table's, so it
        // reads as something to press rather than as a number printed in the row.
        return (
          <span className="flex justify-center w-full">
            <button
              onClick={(e) => { e.stopPropagation(); toggleThread(t.id); }}
              title={`${t.processTitle} · ${threadCount} מסמכים`}
              className="flex items-center justify-center rounded transition-colors"
              style={{
                width: 19, height: 19, fontSize: "11.5px",
                border: `1px solid ${threadOpen ? c.primary : (isDark ? dk.border : "#d4dceb")}`,
                backgroundColor: threadOpen ? (isDark ? "#243050" : "#eff4ff") : "transparent",
                color: threadOpen ? c.primary : (isDark ? dk.textMuted : c.iconGray),
              }}
            >
              {threadCount}
            </button>
          </span>
        );
      case "caseNumber":
        return <span className="truncate" style={{ color: c.primary, direction: "ltr", unicodeBidi: "isolate", textAlign: "right" }}>{t.caseNumber}</span>;
      case "caseName":
        return <span className="truncate" style={{ color: muted }} title={t.caseName}>{t.caseName}</span>;
      case "waiting": {
        const d = daysFrom(t.openedIso);
        const col = d >= 30 ? "#d83a52" : d >= 14 ? "#c07d00" : muted;
        return <span style={{ color: col }} title={`נפתחה ב-${fmtDate(t.openedIso)}`}>{fmtDays(d)}</span>;
      }
      case "due": {
        if (!t.dueIso) return <span style={{ color: muted }}>—</span>;
        const left = daysUntil(t.dueIso);
        const col = left < 0 ? "#d83a52" : left <= 3 ? "#c07d00" : muted;
        return (
          <span style={{ color: col }} title={left < 0 ? `חריגה של ${fmtDays(-left)}` : `נותרו ${fmtDays(left)}`}>
            {fmtDate(t.dueIso)}
          </span>
        );
      }
      case "hearing": {
        if (!t.hearingIso) return <span style={{ color: muted }}>—</span>;
        const left = daysUntil(t.hearingIso);
        return (
          <span style={{ color: left <= 14 ? "#c07d00" : muted }} title={`הדיון בעוד ${fmtDays(left)}`}>
            {fmtDate(t.hearingIso)}
          </span>
        );
      }
      case "background":
        return (
          <span className="min-w-0" style={{ color: muted }}>
            <span
              className={bgWrap ? "whitespace-normal leading-snug" : ""}
              style={bgWrap ? undefined : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.35" }}
            >
              {t.background}
            </span>
            {/* The recommendation rides along with the full background rather than living behind its own control:
                with the row no longer expandable, the wrap toggle is the one place the whole background is shown. */}
            {bgWrap && t.recommendation && (
              <span className="block mt-1 leading-snug">
                <span style={{ color: c.takhelet, fontWeight: 500 }}>הצעה: </span>
                <span>{t.recommendation}</span>
              </span>
            )}
          </span>
        );
      case "estimate":
        return <span style={{ color: muted }}>{fmtEstimate(t.estimate)}</span>;
      case "opened": return <span style={{ color: muted }}>{fmtDate(t.openedIso)}</span>;
      case "submitter": return <span className="truncate" style={{ color: muted }}>{t.submitter}</span>;
      case "notes": return <span className="truncate" style={{ color: muted }} title={t.notes}>{t.notes ?? "—"}</span>;
      case "handler": return <span className="truncate" style={{ color: muted }} title={t.handler}>{t.handler ?? "—"}</span>;
    }
  };

  const totalMinutes = filtered.reduce((s, t) => s + t.estimate, 0);
  const overdue = filtered.filter((t) => t.dueIso && daysUntil(t.dueIso) < 0).length;

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col" style={{ backgroundColor: bg }} dir="rtl">
      {/* Title + the one-line state of the desk */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 flex-shrink-0">
        <h1 className="text-[17px] font-semibold" style={{ color: text, fontFamily: "Noto Sans Hebrew, sans-serif" }}>משימות</h1>
        <span className="text-[12.5px]" style={{ color: muted }}>
          {filtered.length} משימות
          {overdue > 0 && <span style={{ color: "#d83a52" }}> · {overdue} בחריגת מועד</span>}
          <span> · זמן טיפול משוער {fmtEstimate(totalMinutes)}</span>
        </span>
        <div className="flex-1" />
        {onCloseTask && (
          <button onClick={onCloseTask} title="סגירת המסמך וחזרה לרשימה המלאה" className="size-7 flex items-center justify-center rounded hover:bg-black/5" style={{ color: isDark ? dk.textMuted : c.iconGray }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filters — search, task type, grouping, and the columns menu pushed to the far left like in the docs table */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2 flex-shrink-0 text-[12.5px]">
        <div className="flex items-center gap-1 rounded px-2 h-7" style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}` }}>
          <Search size={13} style={{ color: isDark ? dk.textMuted : c.iconGray }} />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש במשימות"
            className="bg-transparent outline-none w-[170px]"
            style={{ color: text, fontFamily: "Noto Sans Hebrew, sans-serif" }}
          />
          {query && <button onClick={() => setQuery("")} className="hover:opacity-70" style={{ color: muted }}><X size={12} /></button>}
        </div>

        <select
          value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}
          className="rounded px-2 h-7 outline-none"
          style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}`, backgroundColor: bg, color: text }}
        >
          {kinds.map((k) => <option key={k} value={k}>{k === "הכל" ? "כל סוגי המשימות" : k}</option>)}
        </select>

        <span style={{ color: muted }}>קיבוץ:</span>
        <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${isDark ? dk.border : c.inputBorder}` }}>
          {(Object.keys(GROUP_LABELS) as GroupKey[]).map((g) => (
            <button
              key={g} onClick={() => changeGroup(g)} className="px-2 h-[26px] transition-colors"
              style={{
                backgroundColor: group === g ? (isDark ? "#243050" : "#eff4ff") : "transparent",
                color: group === g ? c.primary : muted,
              }}
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <div className="relative">
          <button
            onClick={() => setColsOpen((v) => !v)} title="התאמת עמודות"
            className="size-7 flex items-center justify-center rounded hover:bg-black/5"
            style={{ color: colsOpen ? c.primary : (isDark ? dk.textMuted : c.iconGray) }}
          >
            <MoreVertical size={16} />
          </button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setColsOpen(false)} />
              <div className="absolute z-50 rounded-md py-1 text-[12.5px]"
                style={{ top: "32px", left: 0, width: "212px", backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
                <div className="px-3 py-1.5 font-medium" style={{ color: muted }}>התאמת עמודות</div>
                {layout.filter((k): k is TaskColKey => k !== "subject").map((k) => (
                  <div
                    key={k}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", k)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain") as TaskColKey; if (from && from !== k) moveCol(from, k); }}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-grab hover:bg-black/5"
                    style={{ color: text }}
                  >
                    <input type="checkbox" checked={visible[k]} onChange={() => toggleCol(k)} />
                    <span>{TASK_COL_LABELS[k]}</span>
                  </div>
                ))}
                <div className="border-t mt-1 pt-1" style={{ borderColor: isDark ? dk.border : c.border }}>
                  <button onClick={resetCols} className="w-full text-right px-3 py-1.5 hover:bg-black/5" style={{ color: c.primary }}>
                    איפוס לברירת מחדל
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto" dir="rtl">
        <div style={{ minWidth: `${minWidth}px` }}>
          {/* Header */}
          <div
            className="grid items-center px-3 h-8 sticky top-0 z-20 text-[12.5px] font-medium"
            style={{ gridTemplateColumns: template, columnGap: "10px", backgroundColor: bg, borderBottom: `1px solid ${border}`, color: muted, fontFamily: "Noto Sans Hebrew, sans-serif" }}
          >
            {visCols.map((k) => (
              <div key={k} className="min-w-0 flex items-center h-full relative">
                {headerCell(k)}
                {!narrow && (
                  <div
                    onMouseDown={(e) => startResize(e, k)}
                    className="absolute top-0 bottom-0 z-10 group/rz"
                    style={{ insetInlineEnd: "-5px", width: "9px", cursor: "col-resize" }}
                    title="גרירה לשינוי רוחב העמודה"
                  >
                    <div className="absolute inset-y-1 transition-colors group-hover/rz:bg-[#9db6d6]" style={{ insetInlineEnd: "4px", width: "2px", borderRadius: 1 }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {groups.map((g) => {
            const isCollapsed = collapsedGroups.has(g.key);
            return (
              <div key={g.key}>
                {group !== "none" && (
                  <button
                    onClick={() => setCollapsedGroups((p) => { const n = new Set(p); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                    className="flex items-center gap-1.5 w-full px-3 h-7 text-[12.5px] font-medium sticky top-8 z-10"
                    style={{ backgroundColor: isDark ? "#1a2033" : "#f6f8fc", color: isDark ? dk.text : c.darkBlue, borderBottom: `1px solid ${border}` }}
                  >
                    <ChevronLeft size={13} className="transition-transform" style={{ transform: isCollapsed ? "none" : "rotate(-90deg)" }} />
                    {group === "urgency" && (
                      <span style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: URG_COLOR[g.key as TaskUrgency] }} />
                    )}
                    <span>{g.label}</span>
                    <span style={{ color: muted, fontWeight: 400 }}>({g.items.length})</span>
                  </button>
                )}
                {!isCollapsed && g.items.map((t) => {
                  // The row stays lit while the judge reads any document of the request, not only the leading one.
                  const isOpen = activeTaskId ? t.id === activeTaskId : t.docId === openDocId;
                  const threadOpen = openThreads.has(t.id);
                  const thread = threadDocsFor(t, docs);
                  return (
                    <div key={t.id}>
                      <div
                        onClick={() => openTask(t)}
                        title="פתיחת המסמך"
                        className="grid items-center px-3 text-[12.5px] cursor-pointer transition-colors hover:bg-black/[0.02]"
                        style={{
                          gridTemplateColumns: template, columnGap: "10px",
                          minHeight: bgWrap ? "auto" : "38px",
                          paddingTop: 6, paddingBottom: 6,
                          borderBottom: `1px solid ${isDark ? "#222a42" : "#f0f4fa"}`,
                          backgroundColor: isOpen ? (isDark ? "#1e2942" : "#eff6ff") : "transparent",
                          fontFamily: "Noto Sans Hebrew, sans-serif",
                        }}
                      >
                        {visCols.map((k) => (
                          <div key={k} className="min-w-0 flex" style={{ alignItems: k === "background" && bgWrap ? "flex-start" : "center" }}>
                            {cell(k, t, isOpen, threadOpen, thread.length)}
                          </div>
                        ))}
                      </div>
                      {threadOpen && (
                        <ThreadPanel
                          task={t} docs={thread} isDark={isDark} openDocId={openDocId}
                          onOpenDoc={onOpenDoc} onClose={() => toggleThread(t.id)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: muted }}>לא נמצאו משימות התואמות לסינון</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── The request's thread ───────────────────────────────────────────────────
// The same idea as the documents table's process panel: a labelled card under the row listing the documents of the
// thread in order (motion → response → decision), each one opening on click.
function ThreadPanel({ task, docs, isDark, openDocId, onOpenDoc, onClose }: {
  task: JudgeTask; docs: CaseDoc[]; isDark: boolean; openDocId?: string;
  onOpenDoc: (doc: CaseDoc) => void; onClose: () => void;
}) {
  const muted = isDark ? dk.textMuted : c.textGray;
  const text = isDark ? dk.text : c.text;
  return (
    <div
      className="px-3 py-2"
      style={{ backgroundColor: isDark ? "#171d2e" : "#fbfcfe", borderBottom: `1px solid ${isDark ? "#222a42" : "#eaf0f8"}` }}
      dir="rtl"
    >
      <div className="flex items-center gap-1.5 mb-1.5 text-[12px]">
        <Route size={13} style={{ color: isDark ? dk.textMuted : c.iconGray }} />
        <span className="font-medium" style={{ color: isDark ? dk.text : c.darkBlue }}>{task.processTitle}</span>
        <span style={{ color: muted }}>({docs.length} מסמכים)</span>
        <div className="flex-1" />
        <button onClick={onClose} title="סגירת התהליך" className="size-5 flex items-center justify-center rounded hover:bg-black/5" style={{ color: muted }}>
          <X size={13} />
        </button>
      </div>
      <div className="rounded overflow-hidden" style={{ border: `1px solid ${isDark ? dk.border : "#e6ecf6"}` }}>
        {docs.map((d, i) => (
          <button
            key={d.id}
            onClick={(e) => { e.stopPropagation(); onOpenDoc(d); }}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[12px] text-right hover:bg-black/[0.03] transition-colors"
            style={{
              borderTop: i === 0 ? "none" : `1px solid ${isDark ? "#222a42" : "#eef2f8"}`,
              backgroundColor: d.id === openDocId ? (isDark ? "#1e2942" : "#eff6ff") : "transparent",
            }}
          >
            <span style={{ color: muted, width: 58, flexShrink: 0 }}>{d.date}</span>
            <span className="truncate flex-1 min-w-0" style={{ color: d.id === openDocId ? c.primary : text, fontWeight: d.id === openDocId ? 600 : 400 }}>{d.name}</span>
            <span className="flex-shrink-0" style={{ color: muted }}>{d.submitter === "בית המשפט" ? "ביהמ״ש" : d.submitter}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
