"use client";

/* ──────────────────────────────────────────────────────────────────────────
   מאגר הפרומפטים — one library that replaces the three separate pools
   (מוצעים / מועדפים אישיים / משותפים בערוצים חיצוניים).

   Two axes, deliberately kept apart:
     • מקור   — who wrote it (מערכת / משתמש אחר / אני). A fact; never changes.
     • מועדף  — my own flag. A shared prompt I starred is still "משותף" by source,
                but it shows up under "המועדפים שלי". If these were one axis, the
                source filter would hide prompts I had saved.

   Editing someone else's prompt forks it: their copy is untouched, mine is a new
   prompt whose source is "שלי" — which also means an edited copy of a system
   prompt is no longer "מוצע ע״י המערכת", i.e. no longer לשכה-approved. That falls
   out of the model rather than needing a rule.
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronDown, MoreHorizontal, Pencil, Plus, Search, Share2,
  Star, Trash2, X, PanelRightClose, Copy, ShieldCheck, Sparkles,
} from "lucide-react";
import { c, dk, RED, FONT } from "./theme";

// ── Model ──────────────────────────────────────────────────────────────────
export type PromptSource = "system" | "shared" | "mine";

export type Prompt = {
  id: string;
  name: string;
  body: string;
  source: PromptSource;
  author: string | null;   // null = המערכת; "אנונימי" for an anonymous share
  fav: boolean;            // my flag — separate from source
  basedOn?: string;        // the prompt this was forked from, kept for orientation only
  caseType: string; matter: string; stage: string; court: string;
  tags: string[];
  uses: number;            // global, counted on insert (a popularity signal, not accuracy)
  ratingSum: number; ratingCount: number;
  myRating: number | null; // once set, final — the stars lock
  edited: string;
};

export const ANY = "הכל";
export const GENERAL = "כללי";

export const CASE_TYPES = [GENERAL, "אזרחי", "פלילי", "משפחה", "עבודה", "מנהלי"];
export const MATTERS = [GENERAL, "רשלנות רפואית", "נזקי גוף", "חוזים", "מקרקעין", "לשון הרע", "משמורת"];
export const STAGES = [GENERAL, "קדם משפט", "לפני דיון", "הוכחות", "סיכומים", "כתיבת פסק דין", "ערעור"];
export const COURTS = [GENERAL, "שלום", "מחוזי", "עליון", "בית דין לעבודה"];
export const TAGS = ["הגהה", "ניסוח", "סיכום", "השוואה", "בדיקת טיוטה", "איתור", "חקיקה ופסיקה"];

// What the open case is, for the panel's "מותאם לתיק" shortlist.
export const CASE_CONTEXT = { caseType: "אזרחי", matter: "רשלנות רפואית", stage: "הוכחות", court: "מחוזי" };

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });

const p = (x: Partial<Prompt> & { name: string; body: string; source: PromptSource }): Prompt => ({
  id: uid(), author: null, fav: false, tags: [], uses: 0, ratingSum: 0, ratingCount: 0,
  myRating: null, edited: "01/02/2025", caseType: GENERAL, matter: GENERAL, stage: GENERAL, court: GENERAL,
  ...x,
});

export const SEED_PROMPTS: Prompt[] = [
  p({
    name: "איתור סתירות בין עדויות",
    body: "עבור על פרוטוקולי ההוכחות בתיק ואתר סתירות בין עדותם של [שם העד] לבין יתר העדים. הצג כל סתירה כשורה בטבלה: הנושא, מה נאמר, ההפניה לפרוטוקול. אין להסיק מסקנות משפטיות בשלב זה.",
    source: "system", caseType: "אזרחי", matter: "רשלנות רפואית", stage: "הוכחות", court: "מחוזי",
    tags: ["השוואה", "איתור"], uses: 412, ratingSum: 1123, ratingCount: 244, edited: "12/01/2025",
  }),
  p({
    name: "סיכום חוות דעת רפואית",
    body: "סכם את חוות הדעת הרפואית שצורפה. ציין: תחום המומחיות, הנכות הרפואית והתפקודית שנקבעה, ההנמקה, והנקודות שבהן המומחה הסתייג. אם קיימת חוות דעת נגדית — הצג את הפערים ביניהן.",
    source: "system", caseType: "אזרחי", matter: "רשלנות רפואית", stage: "הוכחות", court: "מחוזי",
    tags: ["סיכום"], uses: 388, ratingSum: 1002, ratingCount: 218, edited: "12/01/2025",
  }),
  p({
    name: "בדיקת טיוטת פסק דין",
    body: "עבור על טיוטת פסק הדין ובדוק: האם כל טענה מרכזית של הצדדים נדונה, האם כל קביעה עובדתית נסמכת על ראיה שהוצגה, והאם ההכרעה האופרטיבית עקבית עם ההנמקה. חייבים לציין במפורש האם התביעה נדחית או מתקבלת.",
    source: "system", stage: "כתיבת פסק דין",
    tags: ["בדיקת טיוטה", "הגהה"], uses: 907, ratingSum: 2371, ratingCount: 502, edited: "05/01/2025",
  }),
  p({
    name: "רשימת אזכורים בסיכומים",
    body: "הכן רשימה של כל האזכורים בסיכומי [הצד] — חקיקה ופסיקה בנפרד. לכל אזכור ציין היכן הוא מופיע ולאיזו טענה הוא נטען לתמוך.",
    source: "system", stage: "סיכומים",
    tags: ["איתור", "חקיקה ופסיקה"], uses: 654, ratingSum: 1704, ratingCount: 371, edited: "05/01/2025",
  }),
  p({
    name: "טיוטת החלטה בבקשה לסעד זמני",
    body: "נסח טיוטת החלטה בבקשה לסעד זמני. התייחס לשלושת התנאים: קיומה של זכות לכאורה, מאזן הנוחות, ותום לב ושיהוי. השתמש ב[דוגמה] כמבנה ההחלטה.",
    source: "system", caseType: "אזרחי", stage: "קדם משפט",
    tags: ["ניסוח"], uses: 233, ratingSum: 561, ratingCount: 126, edited: "22/12/2024",
  }),
  p({
    name: "בדיקת טענת התיישנות",
    body: "בדוק את טענת ההתיישנות שהועלתה בכתב ההגנה: מתי קם עילת התביעה, מהי תקופת ההתיישנות החלה, והאם מתקיים אחד מחריגי ההשעיה. הצג את התאריכים כציר זמן.",
    source: "system", caseType: "אזרחי",
    tags: ["איתור", "חקיקה ופסיקה"], uses: 341, ratingSum: 812, ratingCount: 181, edited: "22/12/2024",
  }),
  p({
    name: "הגהה לשונית לפני הוצאה",
    body: "עבור על המסמך והגה אותו לשונית בלבד — שגיאות כתיב, תחביר, אחידות מונחים, ומספור סעיפים. אל תשנה ניסוח משפטי ואל תוסיף תוכן. הצג את התיקונים כרשימה.",
    source: "shared", author: "עו״ד רונית שגב", stage: GENERAL,
    tags: ["הגהה"], uses: 188, ratingSum: 431, ratingCount: 97, edited: "18/02/2025",
  }),
  p({
    name: "השוואת גרסאות של הסכם",
    body: "השווה בין שתי הגרסאות של ההסכם שצורפו והצג טבלת הבדלים: הסעיף, הנוסח הקודם, הנוסח החדש, ומשמעות השינוי לצד [הצד].",
    source: "shared", author: "אנונימי", caseType: "אזרחי", matter: "חוזים",
    tags: ["השוואה", "בדיקת טיוטה"], uses: 96, ratingSum: 214, ratingCount: 48, edited: "11/02/2025",
  }),
  p({
    name: "תמצית תיק לקראת דיון",
    body: "הכן תמצית של התיק לקראת הדיון הקרוב: הצדדים, מה נטען, מה כבר הוכרע בהחלטות ביניים, ומה פתוח להכרעה. עד עמוד אחד.",
    source: "shared", author: "השופט א׳ מזרחי", stage: "לפני דיון",
    tags: ["סיכום"], uses: 421, ratingSum: 1180, ratingCount: 249, edited: "03/02/2025",
  }),
  p({
    name: "איתור מסמכים שלא הוגשו במועד",
    body: "עבור על מסמכי התיק ואתר מסמכים שהוגשו לאחר המועד שנקבע בהחלטה. ציין לכל מסמך: מי הגיש, מתי, מה היה המועד, והאם התבקשה הארכה.",
    source: "shared", author: "אנונימי",
    tags: ["איתור"], uses: 54, ratingSum: 108, ratingCount: 26, edited: "28/01/2025",
  }),
  p({
    name: "סיכום חוות דעת — הגרסה שלי",
    body: "סכם את חוות הדעת הרפואית שצורפה בטבלה בת שלוש עמודות: ממצא, ההנמקה של המומחה, וההפניה לעמוד. בסוף הוסף שורה אחת: מה הכי שנוי במחלוקת בין המומחים.",
    source: "mine", fav: true, basedOn: "סיכום חוות דעת רפואית",
    caseType: "אזרחי", matter: "רשלנות רפואית", stage: "הוכחות", court: "מחוזי",
    tags: ["סיכום"], uses: 31, ratingSum: 0, ratingCount: 0, edited: "24/02/2025",
  }),
  p({
    name: "מכתב תזכורת לצדדים",
    body: "נסח הודעה לצדדים לקראת הדיון ביום [תאריך הדיון]: תזכורת להגשת רשימת עדים שבעה ימים מראש, ואזהרה לגבי אי-התייצבות. נוסח קצר ופורמלי.",
    source: "mine", fav: true, stage: "לפני דיון",
    tags: ["ניסוח"], uses: 12, ratingSum: 0, ratingCount: 0, edited: "20/02/2025",
  }),
];

// ── Fields — [שם השדה] inside the body ─────────────────────────────────────
// A prompt can carry instructions the user fills in before it runs. [דוגמה] is the one
// special field: it binds to the examples panel instead of being typed.
export const EXAMPLE_FIELD = "דוגמה";
const NO_EXAMPLE = "ללא דוגמה";
export const fieldsOf = (body: string): string[] => {
  const out: string[] = [];
  for (const m of body.matchAll(/\[([^\]\n]{1,40})\]/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
};
export const fillFields = (body: string, values: Record<string, string>) =>
  body.replace(/\[([^\]\n]{1,40})\]/g, (whole, key: string) => (values[key]?.trim() ? values[key].trim() : whole));

// ── Identifying details ────────────────────────────────────────────────────
// A question that was actually asked names the parties. Sharing it verbatim publishes
// the case. We do NOT strike the details out — a redacted prompt is unusable. Each one is
// swapped for a field, which is the same mechanism the prompt already has for its variables,
// so the next person gets a prompt that still works. Replaced by default, undoable per item.
type Hit = { start: number; end: number; text: string; field: string };

const FIRST_NAMES = ["יעקב", "משה", "שרה", "דוד", "אורי", "מיה", "יוסי", "רונית", "דניאל", "אורלי", "בת שבע", "עידו", "אברהם", "רחל", "נועה", "איתי"];
const LAST_NAMES = ["אברמוב", "כהן", "לוי", "יוסף", "פרץ", "גולד", "רוזן", "דליה", "אלמוג", "שחר", "שמש", "בר", "מזרחי", "שגב"];

export function findIdentifiers(text: string): Hit[] {
  const hits: Hit[] = [];
  const push = (re: RegExp, field: string) => {
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      hits.push({ start: m.index, end: m.index + m[0].length, text: m[0], field });
    }
  };
  push(/\b\d{4,5}-\d{2}-\d{2}\b/g, "מספר תיק");
  push(/\b\d{9}\b/g, "ת״ז");
  push(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, "תאריך");
  const names = [...FIRST_NAMES, ...LAST_NAMES].sort((a, b) => b.length - a.length).join("|");
  push(new RegExp(`(?:^|(?<=[\\s"׳'(,.\\-]))(?:${names})(?:\\s+(?:${names}))?`, "g"), "שם הצד");
  // longest match wins where two patterns overlap
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Hit[] = [];
  for (const h of hits) if (!out.some((o) => h.start < o.end && o.start < h.end)) out.push(h);
  return out;
}

// Replace every hit with its field. Numbering is per field and only once a field actually
// repeats — two different names become [שם הצד] and [שם הצד 2], while one name and one date
// stay [שם הצד] and [תאריך]. The same value appearing twice keeps the same label.
export function hitLabels(hits: Hit[], skip: Set<number>): string[] {
  const label = new Map<string, string>();  // original text → field label
  const count = new Map<string, number>();  // field → how many distinct values seen
  return hits.map((h, i) => {
    if (skip.has(i)) return "";
    let l = label.get(h.text);
    if (!l) {
      const n = (count.get(h.field) ?? 0) + 1;
      count.set(h.field, n);
      l = n === 1 ? h.field : `${h.field} ${n}`;
      label.set(h.text, l);
    }
    return l;
  });
}

export function scrub(text: string, hits: Hit[], skip: Set<number>) {
  const labels = hitLabels(hits, skip);
  let out = "";
  let cursor = 0;
  hits.forEach((h, i) => {
    out += text.slice(cursor, h.start) + (skip.has(i) ? h.text : `[${labels[i]}]`);
    cursor = h.end;
  });
  return out + text.slice(cursor);
}

// ── Small pieces ───────────────────────────────────────────────────────────
const sourceLabel = (pr: Prompt) =>
  pr.source === "system" ? "מוצע ע״י המערכת"
  : pr.source === "mine" ? "שלי"
  : `שותף ע״י ${pr.author ?? "אנונימי"}`;

function Stars({ pr, onRate, isDark }: { pr: Prompt; onRate: (n: number) => void; isDark: boolean }) {
  const [hov, setHov] = useState(0);
  const locked = pr.myRating !== null;
  const avg = pr.ratingCount ? pr.ratingSum / pr.ratingCount : 0;
  const shown = locked ? pr.myRating! : hov;
  const sub = isDark ? dk.textMuted : c.textLight;
  return (
    <div className="flex items-center gap-1.5" dir="rtl" title={locked ? `דירגת ${pr.myRating}` : "דירוג — פעם אחת בלבד"}>
      <div className="flex items-center" dir="ltr" onMouseLeave={() => setHov(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            disabled={locked}
            onMouseEnter={() => !locked && setHov(n)}
            onClick={(e) => { e.stopPropagation(); if (!locked) onRate(n); }}
            className="p-[1px]"
            style={{ cursor: locked ? "default" : "pointer" }}
          >
            <Star size={14} strokeWidth={1.8}
              style={{ color: n <= shown ? "#fdab3d" : sub, opacity: n <= shown ? 1 : 0.55 }}
              fill={n <= shown ? "#fdab3d" : "none"} />
          </button>
        ))}
      </div>
      <span className="text-[12px] whitespace-nowrap" style={{ color: sub }}>
        {pr.ratingCount ? `${avg.toFixed(1)} · ${pr.ratingCount} מדרגים` : "טרם דורג"}
      </span>
    </div>
  );
}

function Dropdown({ label, value, options, onChange, isDark, width = 132, noAny = false }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; isDark: boolean; width?: number;
  // noAny: a form field always has a value (כללי is one), so it gets no "הכל" row —
  // that row only makes sense for a filter, where nothing chosen means everything.
  noAny?: boolean;
}) {
  // The menu is positioned fixed, anchored to the button: inside a scrolling dialog an
  // absolutely-positioned list gets clipped by the scroll container and loses its last rows.
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const open = at !== null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAt(null); };
    const off = () => setAt(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", off);
    window.addEventListener("scroll", off, true);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("resize", off); window.removeEventListener("scroll", off, true); };
  }, [open]);
  const set = !noAny && value !== ANY;
  const line = isDark ? dk.border : c.border;
  const txt = isDark ? dk.text : c.text;
  return (
    <div ref={ref} className="relative" style={{ width }}>
      <button
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(open ? null : { top: r.bottom + 4, right: window.innerWidth - r.right });
        }}
        className="w-full h-8 flex items-center gap-1 px-2.5 rounded-[4px] text-[13px] transition-colors hover:bg-black/[0.03]"
        style={{ border: `1px solid ${set ? c.primary : line}`, color: set ? c.primary : txt, backgroundColor: isDark ? dk.input : "white" }}
        title={label}
      >
        <span className="flex-1 min-w-0 text-right truncate">{noAny || set ? value : label}</span>
        <ChevronDown size={12} style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {at && (
        <div
          className="rounded-md shadow-lg overflow-hidden max-h-[280px] overflow-y-auto"
          style={{ position: "fixed", top: at.top, right: at.right, zIndex: 90, minWidth: width, backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${line}` }}
        >
          {(noAny ? options : [ANY, ...options]).map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setAt(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-right hover:bg-black/5 transition-colors"
              style={{ color: txt }}
            >
              <span className="w-3.5 flex-none">{o === value && <Check size={13} style={{ color: c.primary }} />}</span>
              <span className="flex-1">{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Tag({ t, isDark, onClick, active }: { t: string; isDark: boolean; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="px-2 h-[20px] rounded-[3px] text-[11.5px] transition-colors"
      style={{
        backgroundColor: active ? c.primary : isDark ? "#243354" : "#f0f3f9",
        color: active ? "white" : isDark ? dk.textMuted : c.textGray,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {t}
    </button>
  );
}

function FavStar({ on, onToggle, isDark }: { on: boolean; onToggle: () => void; isDark: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors"
      title={on ? "הסרה מהמועדפים" : "שמירה במועדפים"}
    >
      <Star size={16} fill={on ? "#fdab3d" : "none"} style={{ color: on ? "#fdab3d" : isDark ? dk.textMuted : c.iconGray }} />
    </button>
  );
}

// ── Row menu (⋮) — fixed position so it isn't clipped by a scroll container ──
function RowMenu({ items, isDark }: { items: { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; act: () => void; danger?: boolean }[]; isDark: boolean }) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!at) return;
    // containment test, not a blind close: mousedown precedes click, and closing blindly
    // unmounts the row before its own click lands
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || btnRef.current?.contains(t)) return;
      setAt(null);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", close as unknown as EventListener);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("resize", close as unknown as EventListener); };
  }, [at]);
  const line = isDark ? dk.border : "#eef2f7";
  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { top: r.bottom + 4, right: window.innerWidth - r.right });
        }}
        className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors"
        style={{ color: isDark ? dk.textMuted : c.iconGray }}
        title="פעולות"
      >
        <MoreHorizontal size={16} />
      </button>
      {at && (
        <div
          dir="rtl" ref={ref}
          className="rounded-md overflow-hidden shadow-lg"
          style={{
            position: "fixed", top: at.top, right: at.right, zIndex: 80, minWidth: "176px",
            backgroundColor: isDark ? dk.surface : "white", border: `1px solid ${isDark ? dk.border : c.border}`, fontFamily: FONT,
          }}
        >
          {items.map(({ label, Icon, act, danger }, i) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); setAt(null); act(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-black/5 transition-colors"
              style={{ color: danger ? RED : isDark ? dk.text : c.text, borderTop: i ? `1px solid ${line}` : undefined }}
            >
              <Icon size={15} className="flex-none" />
              <span className="flex-1 text-right">{label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── The side panel — a short, case-shaped shortlist; the full library is a window ──
export function PromptsPanel({
  isDark, prompts, caseLine, onClose, onUse, onFav, onEdit, onShare, onDelete, onNew, onOpenLibrary,
}: {
  isDark: boolean; prompts: Prompt[]; caseLine: string;
  onClose: () => void; onUse: (pr: Prompt) => void; onFav: (id: string) => void;
  onEdit: (pr: Prompt) => void; onShare: (pr: Prompt) => void; onDelete: (pr: Prompt) => void;
  onNew: () => void; onOpenLibrary: () => void;
}) {
  const bg = isDark ? dk.surface : "white";
  const titleCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;

  // The panel states its subject rather than offering a filter: prompts fitted to the open
  // case, plus the ones marked כללי. Everything else is one click away in the full library.
  const shortlist = useMemo(() => {
    const fits = (pr: Prompt) =>
      (pr.caseType === GENERAL || pr.caseType === CASE_CONTEXT.caseType) &&
      (pr.matter === GENERAL || pr.matter === CASE_CONTEXT.matter) &&
      (pr.stage === GENERAL || pr.stage === CASE_CONTEXT.stage) &&
      (pr.court === GENERAL || pr.court === CASE_CONTEXT.court);
    const rank = (pr: Prompt) => (pr.fav ? 0 : pr.source === "mine" ? 1 : pr.source === "system" ? 2 : 3);
    return prompts.filter(fits).sort((a, b) => rank(a) - rank(b) || b.uses - a.uses);
  }, [prompts]);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: bg, borderLeft: `1px solid ${isDark ? dk.border : c.inputBorder}`, fontFamily: FONT }} dir="rtl">
      <div className="px-[18px] pt-4 pb-2">
        <div className="flex items-center gap-2 h-8">
          <button onClick={onClose} className="size-6 flex items-center justify-center rounded hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: subCol }} title="סגור פרומפטים">
            <PanelRightClose size={18} />
          </button>
          <span className="text-[16px] leading-[1.25]" style={{ color: subCol }}>פרומפטים</span>
          <div className="flex-1" />
          <button onClick={onNew} className="size-7 flex items-center justify-center rounded hover:bg-black/5 transition-colors flex-shrink-0" style={{ color: subCol }} title="פרומפט חדש">
            <Plus size={16} />
          </button>
        </div>
        {/* the subject, stated — not a control to dismiss */}
        <div className="mt-1 text-[13px] leading-[20px] truncate" style={{ color: subCol }} title={caseLine}>
          מותאם ל{caseLine}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
        <div className="px-3 pt-1 pb-3 flex flex-col gap-1.5" dir="rtl">
          {shortlist.map((pr) => (
            <div
              key={pr.id}
              className="relative rounded-lg px-2.5 py-2 transition-colors hover:bg-black/[0.03] flex items-start gap-1"
              style={{ border: `1px solid ${isDark ? dk.border : "#e8eef7"}` }}
            >
              <FavStar on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} />
              <button className="flex-1 min-w-0 text-right py-0.5" onClick={() => onUse(pr)} title="הכנסה לשורת השאלה">
                <div className="text-[14px] truncate" style={{ color: titleCol }}>{pr.name}</div>
                <div className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: subCol }}>
                  {pr.source === "system" && <ShieldCheck size={12} style={{ flexShrink: 0 }} />}
                  <span className="truncate">{sourceLabel(pr)}</span>
                  {pr.ratingCount > 0 && <span className="flex-none">· {(pr.ratingSum / pr.ratingCount).toFixed(1)}★</span>}
                </div>
              </button>
              <RowMenu
                isDark={isDark}
                items={[
                  { label: "הכנסה לשורת השאלה", Icon: Sparkles, act: () => onUse(pr) },
                  { label: pr.source === "mine" ? "עריכה" : "עריכה ושמירה כשלי", Icon: Pencil, act: () => onEdit(pr) },
                  ...(pr.source === "mine" ? [{ label: "שיתוף", Icon: Share2, act: () => onShare(pr) }] : []),
                  ...(pr.source === "mine" || pr.author === "אני"
                    ? [{ label: pr.source === "mine" ? "מחיקה" : "הסרה משיתוף", Icon: Trash2, act: () => onDelete(pr), danger: true }]
                    : []),
                ]}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-3" style={{ borderTop: `1px solid ${isDark ? dk.border : "#eef2f7"}` }}>
        <button
          onClick={onOpenLibrary}
          className="w-full h-9 rounded-[4px] text-[14px] transition-colors hover:bg-black/[0.03]"
          style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: isDark ? dk.text : c.text }}
        >
          כל מאגר הפרומפטים
        </button>
      </div>
    </div>
  );
}

// ── The library window ─────────────────────────────────────────────────────
type Filters = { q: string; source: string; caseType: string; matter: string; stage: string; court: string; tag: string; favOnly: boolean; sort: string };
const EMPTY_FILTERS: Filters = { q: "", source: ANY, caseType: ANY, matter: ANY, stage: ANY, court: ANY, tag: ANY, favOnly: false, sort: "רלוונטיות" };
const SORTS = ["רלוונטיות", "דירוג", "שימושים", "שם", "עדכון אחרון", "מחבר"];
const SOURCE_OPTS = ["מוצע ע״י המערכת", "משותף", "שלי"];
const FILTER_KEY = "mishpat.prompts.filters";

export function PromptLibrary({
  isDark, prompts, onClose, onUse, onFav, onEdit, onShare, onDelete, onRate, onNew,
}: {
  isDark: boolean; prompts: Prompt[]; onClose: () => void;
  onUse: (pr: Prompt) => void; onFav: (id: string) => void; onEdit: (pr: Prompt) => void;
  onShare: (pr: Prompt) => void; onDelete: (pr: Prompt) => void; onRate: (id: string, n: number) => void; onNew: () => void;
}) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  // the last search is remembered, so reopening the library resumes where it left off
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) setF({ ...EMPTY_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) });
    } catch { /* private mode / cleared storage — the defaults are fine */ }
  }, []);
  // Skip the write that belongs to the mount render: it would run before the effect above has
  // applied what was stored, and overwrite the remembered search with the defaults.
  const firstWrite = useRef(true);
  useEffect(() => {
    if (firstWrite.current) { firstWrite.current = false; return; }
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  }, [f]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const dirty = JSON.stringify({ ...f, sort: "" }) !== JSON.stringify({ ...EMPTY_FILTERS, sort: "" });

  const list = useMemo(() => {
    const srcName = (pr: Prompt) => (pr.source === "system" ? "מוצע ע״י המערכת" : pr.source === "shared" ? "משותף" : "שלי");
    const q = f.q.trim();
    const out = prompts.filter((pr) =>
      (!q || pr.name.includes(q)) &&
      (f.source === ANY || srcName(pr) === f.source) &&
      (f.caseType === ANY || pr.caseType === f.caseType) &&
      (f.matter === ANY || pr.matter === f.matter) &&
      (f.stage === ANY || pr.stage === f.stage) &&
      (f.court === ANY || pr.court === f.court) &&
      (f.tag === ANY || pr.tags.includes(f.tag)) &&
      (!f.favOnly || pr.fav)
    );
    const avg = (pr: Prompt) => (pr.ratingCount ? pr.ratingSum / pr.ratingCount : 0);
    const fits = (pr: Prompt) =>
      (pr.caseType === CASE_CONTEXT.caseType ? 2 : pr.caseType === GENERAL ? 1 : 0) +
      (pr.matter === CASE_CONTEXT.matter ? 2 : pr.matter === GENERAL ? 1 : 0) +
      (pr.stage === CASE_CONTEXT.stage ? 2 : pr.stage === GENERAL ? 1 : 0);
    const cmp: Record<string, (a: Prompt, b: Prompt) => number> = {
      // rating sorts on the average, but a 5.0 from two raters shouldn't outrank a 4.6 from
      // forty — the number of raters is the tie-break, and it's on the card either way
      "דירוג": (a, b) => avg(b) - avg(a) || b.ratingCount - a.ratingCount,
      "שימושים": (a, b) => b.uses - a.uses,
      "שם": (a, b) => a.name.localeCompare(b.name, "he"),
      "עדכון אחרון": (a, b) => b.edited.split("/").reverse().join("").localeCompare(a.edited.split("/").reverse().join("")),
      "מחבר": (a, b) => (a.author ?? "המערכת").localeCompare(b.author ?? "המערכת", "he"),
      "רלוונטיות": (a, b) => fits(b) - fits(a) || b.uses - a.uses,
    };
    return out.sort(cmp[f.sort] ?? cmp["רלוונטיות"]);
  }, [prompts, f]);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(1100px, 92vw)", height: "min(760px, 88vh)", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-4">
          <div className="text-[18px]" style={{ color: textCol, fontWeight: 400 }}>מאגר הפרומפטים</div>
          <div className="flex-1" />
          <button
            onClick={onNew}
            className="h-8 px-3 flex items-center gap-1.5 rounded-[4px] text-[13px] transition-opacity hover:opacity-90"
            style={{ backgroundColor: c.primary, color: "white" }}
          >
            <Plus size={14} /> פרומפט חדש
          </button>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {/* search + filters */}
        <div className="px-6 pb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} style={{ position: "absolute", top: 10, right: 10, color: subCol }} />
              <input
                value={f.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="חיפוש לפי שם הפרומפט"
                className="w-full h-9 rounded-[4px] pr-8 pl-3 outline-none text-[14px] text-right"
                style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : "white", color: textCol }}
              />
            </div>
            <span className="text-[13px] whitespace-nowrap" style={{ color: subCol }}>מיון</span>
            <Dropdown label="מיון" value={f.sort} options={SORTS} onChange={(v) => set("sort", v === ANY ? "רלוונטיות" : v)} isDark={isDark} width={130} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Dropdown label="מקור" value={f.source} options={SOURCE_OPTS} onChange={(v) => set("source", v)} isDark={isDark} width={140} />
            <Dropdown label="סוג תיק" value={f.caseType} options={CASE_TYPES} onChange={(v) => set("caseType", v)} isDark={isDark} />
            <Dropdown label="סוג עניין" value={f.matter} options={MATTERS} onChange={(v) => set("matter", v)} isDark={isDark} width={146} />
            <Dropdown label="שלב" value={f.stage} options={STAGES} onChange={(v) => set("stage", v)} isDark={isDark} />
            <Dropdown label="ערכאה" value={f.court} options={COURTS} onChange={(v) => set("court", v)} isDark={isDark} width={124} />
            <Dropdown label="תגית" value={f.tag} options={TAGS} onChange={(v) => set("tag", v)} isDark={isDark} width={124} />
            <button
              onClick={() => set("favOnly", !f.favOnly)}
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-[4px] text-[13px] transition-colors hover:bg-black/[0.03]"
              style={{ border: `1px solid ${f.favOnly ? c.primary : isDark ? dk.border : c.border}`, color: f.favOnly ? c.primary : textCol, backgroundColor: isDark ? dk.input : "white" }}
              title="המועדפים שלי — דגל אישי, לא מקור"
            >
              <Star size={13} fill={f.favOnly ? "#fdab3d" : "none"} style={{ color: f.favOnly ? "#fdab3d" : undefined }} />
              המועדפים שלי
            </button>
            {dirty && (
              <button onClick={() => setF((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort }))} className="h-8 px-2 text-[13px] rounded-[4px] hover:bg-black/5 transition-colors" style={{ color: subCol }}>
                ניקוי
              </button>
            )}
            <div className="flex-1" />
            <span className="text-[12.5px]" style={{ color: subCol }}>{list.length} פרומפטים</span>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto docs-scroll px-6 pb-5" dir="ltr">
          <div dir="rtl" className="flex flex-col gap-2">
            {list.length === 0 && (
              <div className="pt-16 text-center text-[13.5px]" style={{ color: subCol }}>לא נמצאו פרומפטים התואמים לחיפוש.</div>
            )}
            {list.map((pr) => (
              <div key={pr.id} className="rounded-lg px-3 py-3 flex items-start gap-2 transition-colors hover:bg-black/[0.02]" style={{ border: `1px solid ${isDark ? dk.border : "#e8eef7"}` }}>
                <FavStar on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px]" style={{ color: textCol }}>{pr.name}</span>
                    {pr.source === "system" && (
                      <span className="flex items-center gap-1 text-[11.5px] px-1.5 h-[19px] rounded-[3px]" style={{ backgroundColor: isDark ? "#243354" : c.badgeBg, color: isDark ? dk.text : c.darkBlue }}>
                        <ShieldCheck size={11} /> אושר ע״י הלשכה המשפטית
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] mt-1 leading-relaxed" style={{ color: isDark ? dk.textMuted : c.textGray, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {pr.body}
                  </p>
                  <div className="text-[12px] mt-1.5 flex items-center gap-1.5 flex-wrap" style={{ color: subCol }}>
                    <span>{sourceLabel(pr)}</span>
                    {pr.basedOn && <span>· מבוסס על &quot;{pr.basedOn}&quot;</span>}
                    <span>·</span>
                    <span>{[pr.caseType, pr.matter, pr.stage, pr.court].filter((x) => x !== GENERAL).join(" · ") || GENERAL}</span>
                    <span>·</span>
                    <span>{pr.uses} שימושים</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {pr.tags.map((t) => <Tag key={t} t={t} isDark={isDark} active={f.tag === t} onClick={() => set("tag", f.tag === t ? ANY : t)} />)}
                    <div className="flex-1" />
                    <Stars pr={pr} isDark={isDark} onRate={(n) => onRate(pr.id, n)} />
                    <button
                      onClick={() => onUse(pr)}
                      className="h-7 px-3 rounded-[4px] text-[13px] transition-colors hover:bg-black/[0.03]"
                      style={{ border: `1px solid ${c.primary}`, color: c.primary }}
                    >
                      שימוש
                    </button>
                  </div>
                </div>
                <RowMenu
                  isDark={isDark}
                  items={[
                    { label: pr.source === "mine" ? "עריכה" : "עריכה ושמירה כשלי", Icon: Pencil, act: () => onEdit(pr) },
                    ...(pr.source === "mine"
                      ? [{ label: "שיתוף", Icon: Share2, act: () => onShare(pr) }, { label: "מחיקה", Icon: Trash2, act: () => onDelete(pr), danger: true }]
                      : [
                          { label: "שכפול לעריכה", Icon: Copy, act: () => onEdit(pr) },
                          // Withdrawing a share has to be possible — the reason to want it is
                          // usually that the prompt shouldn't have gone out. Copies others already
                          // saved are theirs and stay.
                          ...(pr.author === "אני" ? [{ label: "הסרה משיתוף", Icon: Trash2, act: () => onDelete(pr), danger: true }] : []),
                        ]),
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Editor — new prompt, editing mine, forking someone else's, saving a sent question ──
export function PromptEditor({
  isDark, initial, mode, onSave, onClose,
}: {
  isDark: boolean;
  initial: Partial<Prompt> | null;
  mode: "new" | "edit" | "fork" | "fromMessage";
  onSave: (pr: Prompt) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [attempted, setAttempted] = useState(false);
  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;

  const title = mode === "edit" ? "עריכת פרומפט"
    : mode === "fork" ? "עריכה ושמירה כפרומפט שלי"
    : mode === "fromMessage" ? "שמירת השאלה כפרומפט"
    : "פרומפט חדש";

  // Tags are assigned automatically from the wording, so the user is never asked to tag.
  const tags = useMemo(() => {
    const t = new Set<string>(initial?.tags ?? []);
    const s = `${name} ${body}`;
    if (/הגה|כתיב|תחביר|לשונ/.test(s)) t.add("הגהה");
    if (/נסח|ניסוח|טיוט(?!ה)|מכתב|הודעה/.test(s)) t.add("ניסוח");
    if (/סכם|סיכום|תמצית/.test(s)) t.add("סיכום");
    if (/השווה|השוואה|סתיר|פער/.test(s)) t.add("השוואה");
    if (/בדוק|בדיקה|טיוטה/.test(s)) t.add("בדיקת טיוטה");
    if (/אתר|איתור|רשימה|מצא/.test(s)) t.add("איתור");
    if (/פסיק|חקיק|סעיף|חוק/.test(s)) t.add("חקיקה ופסיקה");
    return [...t];
  }, [name, body, initial?.tags]);

  const fields = fieldsOf(body);
  const nameMissing = attempted && !name.trim();
  const bodyMissing = attempted && !body.trim();

  const save = () => {
    if (!name.trim() || !body.trim()) { setAttempted(true); return; }
    const keep = mode === "edit" ? initial as Prompt : null;
    onSave({
      ...(keep ?? {
        id: uid(), source: "mine", author: null, fav: true, uses: 0,
        ratingSum: 0, ratingCount: 0, myRating: null,
        // a fork keeps the original's classification — it's the same kind of work
        caseType: initial?.caseType ?? GENERAL, matter: initial?.matter ?? GENERAL,
        stage: initial?.stage ?? GENERAL, court: initial?.court ?? GENERAL,
      } as Prompt),
      ...(mode === "fork" ? { basedOn: initial?.name } : {}),
      name: name.trim(), body: body.trim(), tags, edited: today(),
      source: "mine", fav: keep ? keep.fav : true,
    });
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(760px, 92vw)", maxHeight: "88vh", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-4">
          <div className="flex-1 text-[18px]" style={{ color: textCol, fontWeight: 400 }}>{title}</div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {mode === "fork" && (
          <div className="mx-6 mb-3 px-3 py-2 rounded-[4px] text-[13px] leading-relaxed" style={{ backgroundColor: isDark ? "#243354" : "#f0f5ff", color: isDark ? dk.text : c.darkBlue }}>
            הפרומפט המקורי נשאר במאגר כפי שהוא. מה שנשמור כאן הוא עותק שלך{initial?.source === "system" ? " — ולכן הוא כבר לא נושא את אישור הלשכה המשפטית" : ""}.
          </div>
        )}

        <div className="px-6 pb-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הפרומפט"
            className="w-full px-3 py-2.5 text-[16px] outline-none transition-colors rounded-[4px]"
            style={{ border: `1px solid ${nameMissing ? RED : line}`, backgroundColor: surface, color: textCol }}
            autoFocus
          />
          {nameMissing && <div className="text-[12.5px] mt-1" style={{ color: RED }}>יש להזין שם — החיפוש במאגר הוא לפי שם.</div>}
        </div>

        <div className="px-6 pb-2 flex-1 min-h-0 flex flex-col">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="נוסח הפרומפט. אפשר להשאיר שדות למילוי בסוגריים מרובעים, למשל [שם העד]"
            className="w-full outline-none text-[14.5px] leading-relaxed rounded-[4px] px-3 py-2.5 resize-none"
            style={{ border: `1px solid ${bodyMissing ? RED : line}`, backgroundColor: isDark ? dk.input : surface, color: textCol, minHeight: "180px" }}
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[12.5px]" style={{ color: subCol }}>
            <span>שדות למילוי:</span>
            {fields.length ? fields.map((x) => <Tag key={x} t={`[${x}]`} isDark={isDark} />) : <span>אין. אפשר להוסיף בסוגריים מרובעים.</span>}
            {fields.includes(EXAMPLE_FIELD) && <span>· [{EXAMPLE_FIELD}] נבחרת מתוך פאנל הדוגמאות</span>}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-[12.5px]" style={{ color: subCol }}>
            <span>תגיות אוטומטיות:</span>
            {tags.length ? tags.map((t) => <Tag key={t} t={t} isDark={isDark} />) : <span>—</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4">
          <button onClick={save} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            שמירה במועדפים שלי
          </button>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share ──────────────────────────────────────────────────────────────────
export function PromptShare({
  isDark, initial, onShare, onClose,
}: {
  isDark: boolean; initial: Partial<Prompt> & { body: string }; onShare: (pr: Prompt) => void; onClose: () => void;
}) {
  const raw = initial.body;
  const hits = useMemo(() => findIdentifiers(raw), [raw]);
  // Identifiers are swapped out on arrival, not on request: the safe state is the default,
  // and each swap can be undone if the detector was wrong.
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [body, setBody] = useState(() => scrub(raw, hits, new Set()));
  const [edited, setEdited] = useState(false);
  // The name is scrubbed too — a name proposed from the question's opening words carries the
  // same party names the body does, and it's the part that shows in every list.
  const [name, setName] = useState(() => {
    const n = initial.name ?? "";
    return scrub(n, findIdentifiers(n), new Set());
  });
  const [caseType, setCaseType] = useState(initial.caseType ?? GENERAL);
  const [matter, setMatter] = useState(initial.matter ?? GENERAL);
  const [stage, setStage] = useState(initial.stage ?? GENERAL);
  const [court, setCourt] = useState(initial.court ?? GENERAL);
  const [anon, setAnon] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // While the text hasn't been hand-edited, toggling a detection re-derives it.
  const toggleHit = (i: number) => {
    const next = new Set(kept);
    if (next.has(i)) next.delete(i); else next.add(i);
    setKept(next);
    if (!edited) setBody(scrub(raw, hits, next));
  };

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const replaced = hits.length - kept.size;
  const labels = hitLabels(hits, kept);

  const share = () => {
    if (!name.trim() || !body.trim()) { setAttempted(true); return; }
    onShare({
      id: uid(), name: name.trim(), body: body.trim(), source: "shared",
      author: anon ? "אנונימי" : "אני", fav: false, caseType, matter, stage, court,
      tags: initial.tags ?? [], uses: 0, ratingSum: 0, ratingCount: 0, myRating: null, edited: today(),
    });
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(760px, 92vw)", maxHeight: "88vh", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-3">
          <div className="flex-1">
            <div className="text-[18px]" style={{ color: textCol, fontWeight: 400 }}>שיתוף פרומפט</div>
            <div className="text-[13px] mt-1" style={{ color: subCol }}>הפרומפט ייראה לכל משתמשי המערכת.</div>
          </div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 pb-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הפרומפט"
            className="w-full px-3 py-2.5 text-[16px] outline-none rounded-[4px]"
            style={{ border: `1px solid ${attempted && !name.trim() ? RED : line}`, backgroundColor: surface, color: textCol }}
          />

          {hits.length > 0 && (
            <div className="mt-3 px-3 py-2.5 rounded-[4px]" style={{ backgroundColor: isDark ? "#243354" : "#f0f5ff" }}>
              <div className="text-[13px] leading-relaxed" style={{ color: isDark ? dk.text : c.darkBlue }}>
                {replaced > 0
                  ? `${replaced} פרטים שעשויים לזהות את התיק הוחלפו בשדות למילוי, כדי שהפרומפט יישאר שמיש למי שיפעיל אותו.`
                  : "כל הפרטים שזוהו הוחזרו לנוסח."}
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {hits.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => toggleHit(i)}
                    disabled={edited}
                    className="px-2 h-[22px] rounded-[3px] text-[12px] transition-colors"
                    style={{
                      backgroundColor: kept.has(i) ? (isDark ? "#3a2530" : "#fdeaec") : (isDark ? dk.surface : "white"),
                      color: kept.has(i) ? RED : c.primary,
                      border: `1px solid ${kept.has(i) ? RED : c.primary}`,
                      opacity: edited ? 0.45 : 1, cursor: edited ? "default" : "pointer",
                    }}
                    title={kept.has(i) ? "החלפה בשדה" : "השארת הפרט המקורי"}
                  >
                    {/* bdi so a case number or date keeps its own direction inside the RTL line */}
                    <bdi>{h.text}</bdi> {kept.has(i) ? "— נשאר בנוסח" : `→ [${labels[i]}]`}
                  </button>
                ))}
              </div>
              {edited && <div className="text-[12px] mt-2" style={{ color: subCol }}>הנוסח נערך ידנית — הסימון מוקפא.</div>}
            </div>
          )}

          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setEdited(true); }}
            className="w-full outline-none text-[14.5px] leading-relaxed rounded-[4px] px-3 py-2.5 resize-none mt-3"
            style={{ border: `1px solid ${attempted && !body.trim() ? RED : line}`, backgroundColor: isDark ? dk.input : surface, color: textCol, minHeight: "150px" }}
          />

          <div className="text-[13px] mt-4 mb-2" style={{ color: subCol }}>שיוך הפרומפט — כך אחרים ימצאו אותו</div>
          {/* Four boxes that can all read "כללי" need their names above them, not in a tooltip. */}
          <div className="flex items-start gap-2 flex-wrap">
            {([
              { t: "סוג תיק", v: caseType, o: CASE_TYPES, set: setCaseType, w: 140 },
              { t: "סוג עניין", v: matter, o: MATTERS, set: setMatter, w: 150 },
              { t: "שלב", v: stage, o: STAGES, set: setStage, w: 140 },
              { t: "ערכאה", v: court, o: COURTS, set: setCourt, w: 130 },
            ] as const).map(({ t, v, o, set, w }) => (
              <div key={t}>
                <div className="text-[12px] mb-1" style={{ color: subCol }}>{t}</div>
                <Dropdown label={t} value={v} options={[...o]} onChange={set} isDark={isDark} width={w} noAny />
              </div>
            ))}
          </div>
          <div className="text-[12.5px] mt-1.5" style={{ color: subCol }}>ברירת המחדל היא &quot;כללי&quot; — פרומפט כללי יופיע לכל התיקים.</div>

          <div className="text-[13px] mt-4 mb-2" style={{ color: subCol }}>מי מופיע כמחבר</div>
          <div className="flex items-center gap-2">
            {[{ k: false, t: "בשמי" }, { k: true, t: "אנונימי" }].map(({ k, t }) => (
              <button
                key={t}
                onClick={() => setAnon(k)}
                className="h-8 px-3 rounded-[4px] text-[13px] transition-colors"
                style={{ border: `1px solid ${anon === k ? c.primary : isDark ? dk.border : c.border}`, color: anon === k ? c.primary : textCol }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4">
          <button onClick={share} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            שיתוף
          </button>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fill the prompt's fields before it lands in the question line ───────────
export function PromptFill({
  isDark, prompt, exampleNames, onInsert, onClose,
}: {
  isDark: boolean; prompt: Prompt; exampleNames: string[];
  onInsert: (text: string, exampleName: string | null) => void; onClose: () => void;
}) {
  const fields = fieldsOf(prompt.body);
  const [vals, setVals] = useState<Record<string, string>>({});
  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;

  const insert = () => {
    const ex = vals[EXAMPLE_FIELD]?.trim() || null;
    // an unfilled field is left standing in the text rather than blocking the insert — the
    // user can see exactly what is missing once it's in the question line
    onInsert(fillFields(prompt.body, vals), ex);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(620px, 92vw)", maxHeight: "88vh", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start px-6 pt-5 pb-2">
          <div className="flex-1">
            <div className="text-[18px]" style={{ color: textCol, fontWeight: 400 }}>{prompt.name}</div>
            <div className="text-[13px] mt-1" style={{ color: subCol }}>מילוי השדות שבפרומפט</div>
          </div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto docs-scroll px-6 py-2 flex flex-col gap-3">
          {fields.map((fld) => (
            <div key={fld}>
              <div className="text-[13px] mb-1" style={{ color: subCol }}>{fld}</div>
              {fld === EXAMPLE_FIELD ? (
                <Dropdown
                  label="בחירת דוגמה"
                  value={vals[fld] || NO_EXAMPLE}
                  options={[NO_EXAMPLE, ...exampleNames]}
                  onChange={(v) => setVals((prev) => ({ ...prev, [fld]: v === NO_EXAMPLE ? "" : v }))}
                  isDark={isDark}
                  width={320}
                  noAny
                />
              ) : (
                <input
                  value={vals[fld] ?? ""}
                  onChange={(e) => setVals((p) => ({ ...p, [fld]: e.target.value }))}
                  className="w-full px-3 py-2 text-[14px] outline-none rounded-[4px] text-right"
                  style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : surface, color: textCol }}
                />
              )}
            </div>
          ))}
          <div className="text-[13px] leading-relaxed rounded-[4px] px-3 py-2.5 mt-1" style={{ backgroundColor: isDark ? dk.input : c.hoverBg, color: isDark ? dk.textMuted : c.textGray }}>
            {fillFields(prompt.body, vals)}
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4">
          <button onClick={insert} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            הכנסה לשורת השאלה
          </button>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm removing a prompt / withdrawing a share ────────────────────────
export function PromptConfirm({
  isDark, title, note, confirmLabel, onConfirm, onClose,
}: {
  isDark: boolean; title: string; note: string; confirmLabel: string; onConfirm: () => void; onClose: () => void;
}) {
  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="rounded-lg overflow-hidden shadow-2xl px-6 py-5"
        style={{ width: "min(460px, 92vw)", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="text-[17px]" style={{ color: textCol }}>{title}</div>
        <div className="text-[13.5px] mt-2 leading-relaxed" style={{ color: subCol }}>{note}</div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={onConfirm} className="h-9 px-5 rounded-[4px] text-[14px] text-white transition-opacity hover:opacity-90" style={{ backgroundColor: RED }}>
            {confirmLabel}
          </button>
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The two actions under a question that was sent ─────────────────────────
export function QuestionActions({ isDark, onSave, onShare }: { isDark: boolean; onSave: () => void; onShare: () => void }) {
  const col = isDark ? dk.textMuted : c.iconGray;
  const btn = "flex items-center gap-1.5 h-7 px-2 rounded-md text-[12.5px] transition-colors hover:bg-black/5";
  return (
    <div className="flex items-center gap-1 mt-1.5" dir="rtl" style={{ fontFamily: FONT }}>
      <button className={btn} style={{ color: col }} onClick={onSave} title="שמירת השאלה כפרומפט מועדף">
        <Star size={15} /> שמירה למועדפים
      </button>
      <button className={btn} style={{ color: col }} onClick={onShare} title="שיתוף השאלה כפרומפט">
        <Share2 size={15} /> שיתוף
      </button>
    </div>
  );
}
