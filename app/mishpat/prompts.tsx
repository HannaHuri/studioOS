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
  Bookmark, Check, ChevronDown, Info, MoreHorizontal, Pencil, Plus, Search, Share2,
  Star, Trash2, User, Users, X, PanelRightClose, Copy, ShieldCheck, LibraryBig,
} from "lucide-react";
import { c, dk, RED, FONT } from "./theme";
import { UseExampleIcon } from "./icons";

// ── Model ──────────────────────────────────────────────────────────────────
export type PromptSource = "system" | "shared" | "mine";

export type Prompt = {
  id: string;
  name: string;
  body: string;
  source: PromptSource;
  // The name alone, so a list of authors sorts by name. The title is stored apart and shown
  // after it — "השופט א׳ מזרחי" filed every judge under ה and no one could be found by name.
  author: string | null;   // null = המערכת; "אנונימי" for an anonymous share
  authorRole?: string;     // כב׳ / עו״ד — shown after the name, never sorted on
  fav: boolean;            // my flag — separate from source
  basedOn?: string;        // the prompt this was forked from, kept for orientation only
  caseType: string; matter: string; stage: string; court: string;
  tags: string[];
  uses: number;            // global, counted on insert (a popularity signal, not accuracy)
  ratingSum: number; ratingCount: number;
  myRating: number | null; // once set, final — the stars lock
  edited: string;
};

// The product doesn't colour its icons, and a mark that keeps its meaning without colour is one
// that survives a busy table, a print, and colour-blindness. Filled means on, outline means off —
// the shape carries it, not the hue.
const markCol = (isDark: boolean) => (isDark ? dk.textMuted : c.iconGray);

// In the panel a rating is shown only when it says something: a high average that enough people
// stand behind. Printing a score on every row made the mark noise and the number meaningless —
// this way the few rows that carry one are exactly the ones worth noticing. Both numbers are a
// dial; raise them and fewer rows earn the mark.
const NOTABLE_AVG = 4.5;
const NOTABLE_RATERS = 100;
const isNotable = (pr: Prompt) => pr.ratingCount >= NOTABLE_RATERS && pr.ratingSum / pr.ratingCount >= NOTABLE_AVG;

export const ANY = "הכל";
export const GENERAL = "כללי";

export const CASE_TYPES = [GENERAL, "אזרחי", "פלילי", "משפחה", "עבודה", "מנהלי"];
export const MATTERS = [GENERAL, "רשלנות רפואית", "נזקי גוף", "חוזים", "מקרקעין", "לשון הרע", "משמורת"];
export const STAGES = [GENERAL, "קדם משפט", "לפני דיון", "הוכחות", "סיכומים", "פס״ד", "ערעור"];
export const COURTS = [GENERAL, "שלום", "מחוזי", "עליון", "בית דין לעבודה"];
export const TAGS = ["הגהה", "ניסוח", "סיכום", "השוואה", "בדיקת טיוטה", "איתור", "חקיקה ופסיקה"];

// What the open case is, for the panel's shortlist and the table's relevance tint.
export const CASE_CONTEXT = { caseType: "אזרחי", matter: "רשלנות רפואית", stage: "הוכחות", court: "מחוזי" };

// A prompt fits the case when nothing about it contradicts the case — כללי fits everything.
export const fitsCase = (pr: { caseType: string; matter: string; stage: string; court: string }) =>
  (pr.caseType === GENERAL || pr.caseType === CASE_CONTEXT.caseType) &&
  (pr.matter === GENERAL || pr.matter === CASE_CONTEXT.matter) &&
  (pr.stage === GENERAL || pr.stage === CASE_CONTEXT.stage) &&
  (pr.court === GENERAL || pr.court === CASE_CONTEXT.court);

// whoever is signed in — the name and title a prompt shared בשמי carries
export const ME = "טל חבקין";
export const MY_ROLE = "כב׳";

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
    source: "system", stage: "פס״ד",
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
    source: "shared", author: "רונית שגב", authorRole: "עו״ד", stage: GENERAL,
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
    source: "shared", author: "עמית מזרחי", authorRole: "כב׳", stage: "לפני דיון",
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
    // written by me but not starred — "שלי" and "מועדף" are two different things
    source: "mine", fav: false, stage: "לפני דיון",
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
// The source is a mark rather than a word wherever it repeats: three values only, and a shape
// is read faster than text down a column or across a row. The shield is the one the לשכה badge
// carried, so it keeps saying "vetted" — one head is mine, two are shared.
const SOURCE_ICON = { system: ShieldCheck, shared: Users, mine: User } as const;

function SourceMark({ pr, isDark, size = 13 }: { pr: Prompt; isDark: boolean; size?: number }) {
  const I = SOURCE_ICON[pr.source];
  // The one mark that carries colour: a prompt of mine. It is the row the reader is looking for
  // in a table sorted around them, and blue finds it faster than a head-shaped outline does.
  return <I size={size} style={{ flexShrink: 0, color: pr.source === "mine" ? c.primary : markCol(isDark) }} />;
}

// One wording, used wherever the source is named: the same word the column shows and the filter
// offers. The author rides along with it — "משותף" without a name says less than it could.
const sourceLabel = (pr: Prompt) =>
  pr.source === "system" ? "מערכת"
  : pr.source === "mine" ? "שלי"
  : `משותף · ${authorFull(pr)}`;

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
              style={{ color: n <= shown ? markCol(isDark) : sub, opacity: n <= shown ? 1 : 0.55 }}
              fill={n <= shown ? markCol(isDark) : "none"} />
          </button>
        ))}
      </div>
      <span className="text-[12px] whitespace-nowrap" style={{ color: sub }}>
        {pr.ratingCount ? `${avg.toFixed(1)} · ${pr.ratingCount} מדרגים` : "טרם דורג"}
      </span>
    </div>
  );
}

function Dropdown({ label, value, options, onChange, isDark, width = 132, noAny = false, counts }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; isDark: boolean; width?: number;
  // noAny: a form field always has a value (כללי is one), so it gets no "הכל" row —
  // that row only makes sense for a filter, where nothing chosen means everything.
  noAny?: boolean;
  // counts: how many rows each value would leave. A filter row is a promise about the result;
  // the number is the promise made explicit, and an empty one says so before it's clicked.
  counts?: Record<string, number>;
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
              <span className="flex-1" style={{ opacity: counts && counts[o] === 0 ? 0.5 : 1 }}>
                {o}
                {counts && <span style={{ color: isDark ? dk.textMuted : c.textLight }}> ({counts[o] ?? 0})</span>}
              </span>
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

// Two different things were both a gold star: the prompt I saved, and the score everyone gives.
// The saved one becomes a blue bookmark — the mark for "keep this" — and gold stars are left to
// mean one thing only, a rating.
function FavMark({ on, onToggle, isDark, quiet }: { on: boolean; onToggle: () => void; isDark: boolean; quiet?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      // quiet: in a long table only the saved rows carry a mark, and the empty one comes out on
      // hover — a column of grey outlines reads as a column of half-done things.
      className={`size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-${quiet && !on ? "opacity opacity-0 group-hover:opacity-100 focus:opacity-100" : "colors"}`}
      title={on ? "הסרה מהמועדפים" : "שמירה במועדפים"}
    >
      <Bookmark size={16} fill={on ? markCol(isDark) : "none"} style={{ color: markCol(isDark) }} />
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
  isDark, prompts, onClose, onUse, onFav, onEdit, onShare, onDelete, onNew, onOpenLibrary,
}: {
  isDark: boolean; prompts: Prompt[];
  onClose: () => void; onUse: (pr: Prompt) => void; onFav: (id: string) => void;
  onEdit: (pr: Prompt) => void; onShare: (pr: Prompt) => void; onDelete: (pr: Prompt) => void;
  onNew: () => void; onOpenLibrary: () => void;
}) {
  const bg = isDark ? dk.surface : "white";
  const titleCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  // One list, scoped to the case, saved prompts first. Giving favourites a section of their own
  // put an unbounded list above the case's — with thirty saved prompts, what the panel is for
  // would sit below the fold. Most saved prompts are כללי and so appear here anyway; the ones
  // tagged for another kind of case are exactly the ones that don't belong on this screen, and
  // the whole set is one bookmark-click away in the library.
  //
  // What another user shared does NOT appear here. Putting a prompt in this list is the system
  // recommending it, and the system can only vouch for what the לשכה approved. Shared material is
  // browsed in the library, where a list is only a list. The exception is a shared prompt I saved
  // myself: that choice is mine, and it's already been made.
  const shortlist = useMemo(() => {
    const rank = (pr: Prompt) => (pr.fav ? 0 : pr.source === "mine" ? 1 : 2);
    return prompts
      .filter((pr) => (pr.source !== "shared" || pr.fav) && fitsCase(pr))
      .sort((a, b) => rank(a) - rank(b) || b.uses - a.uses);
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
          {/* Blue, so the way out of the shortlist is the one thing in the header that isn't grey */}
          <button
            onClick={onOpenLibrary}
            className="size-6 flex items-center justify-center rounded transition-colors hover:bg-black/[0.03] flex-shrink-0"
            style={{ border: `1px solid ${c.primary}`, color: c.primary }}
            title="כל מאגר הפרומפטים"
          >
            <LibraryBig size={14} />
          </button>
          <button
            onClick={onNew}
            className="size-6 flex items-center justify-center rounded transition-colors hover:bg-black/5 flex-shrink-0"
            style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: isDark ? dk.textMuted : c.iconGray }}
            title="פרומפט חדש"
          >
            <Plus size={14} />
          </button>
        </div>
        {/* stated, not offered: saying the list is scoped is what keeps a prompt that isn't here
            from reading as a prompt that's gone */}
        <div className="mt-1 text-[13px] leading-[18px]" style={{ color: subCol }}>מותאם לתיק זה</div>
      </div>

      <div className="flex-1 overflow-y-auto docs-scroll" dir="ltr">
        <div className="px-3 pt-1 pb-3 flex flex-col gap-1.5" dir="rtl">
          {shortlist.length === 0 && (
            <div className="pt-10 px-4 text-center">
              <p className="text-[13.5px] leading-relaxed" style={{ color: subCol }}>אין פרומפטים המותאמים לתיק זה.</p>
              <button onClick={onOpenLibrary} className="text-[13px] underline mt-2" style={{ color: c.primary }}>
                פתיחת מאגר הפרומפטים
              </button>
            </div>
          )}
          {shortlist.map((pr) => (
            <div
              key={pr.id}
              className="group relative rounded-lg px-2.5 py-2 transition-colors hover:bg-black/[0.03] flex items-start gap-1"
              style={{ border: `1px solid ${isDark ? dk.border : "#e8eef7"}` }}
            >
              {/* same rule as the table: a mark only where something is saved, and on hover where
                  it is not — one behaviour, so the gesture is learned once */}
              <FavMark on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} quiet />
              <button className="flex-1 min-w-0 text-right py-0.5" onClick={() => onUse(pr)} title="שימוש בפרומפט">
                <div className="text-[14px] truncate" style={{ color: titleCol }}>{pr.name}</div>
                {/* The mark says which kind of prompt this is, so it doesn't need to be said in
                    words too. The only text worth its room here is a person's name, which the
                    mark can't give. */}
                <div className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: subCol }}>
                  <SourceMark pr={pr} isDark={isDark} />
                  {pr.source === "shared" && <span className="truncate">{authorFull(pr)}</span>}
                  {isNotable(pr) && (
                    <span className="flex-none flex items-center gap-0.5" title={`${pr.ratingCount} מדרגים`}>
                      {/* same size and stroke as the table's: at 10px lucide's outline lands on a
                          half pixel and the star comes out with a broken edge */}
                      <Star size={12} strokeWidth={1.8} fill={markCol(isDark)} style={{ color: markCol(isDark) }} /> {(pr.ratingSum / pr.ratingCount).toFixed(1)}
                    </span>
                  )}
                </div>
              </button>
              <RowMenu isDark={isDark} items={menuFor(pr, onUse, onEdit, onShare, onDelete, onFav)} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── The library window ─────────────────────────────────────────────────────
type SortKey = "relevance" | "name" | "source" | "author" | "caseType" | "matter" | "stage" | "court" | "rating" | "uses";
type Filters = {
  q: string; source: string; caseType: string; matter: string; stage: string; court: string;
  tag: string; favOnly: boolean; sort: SortKey; dir: "asc" | "desc";
};
const EMPTY_FILTERS: Filters = { q: "", source: ANY, caseType: ANY, matter: ANY, stage: ANY, court: ANY, tag: ANY, favOnly: false, sort: "relevance", dir: "desc" };
// mine first, then the vetted ones, then what other people shared — the order they matter in
const SOURCE_OPTS = ["שלי", "מערכת", "משותף"];
const SOURCE_RANK: Record<string, number> = { "שלי": 0, "מערכת": 1, "משותף": 2 };
const FILTER_KEY = "mishpat.prompts.filters";
// The table scrolls and its scrollbar (8px, see globals.css) eats into the row's right edge.
// The rows above it don't scroll, so they reserve the same strip — otherwise the search field
// hangs a few pixels past the table it belongs to.
const GUTTER = "calc(1.5rem + 8px)";

const matches = (pr: Prompt, ff: Filters) => {
  const q = ff.q.trim();
  // name or author: with no author filter left, typing a name is how you find one person's
  // prompts in a מאגר the whole court writes into.
  return (!q || pr.name.includes(q) || authorFull(pr).includes(q)) &&
    (ff.source === ANY || srcName(pr) === ff.source) &&
    (ff.caseType === ANY || pr.caseType === ff.caseType) &&
    (ff.matter === ANY || pr.matter === ff.matter) &&
    (ff.stage === ANY || pr.stage === ff.stage) &&
    (ff.court === ANY || pr.court === ff.court) &&
    (ff.tag === ANY || pr.tags.includes(ff.tag)) &&
    (!ff.favOnly || pr.fav);
};
// ★ | שם + תקציר | מקור | מחבר | סוג תיק | סוג עניין | שלב | ערכאה | דירוג | שימושים | ⋮
// Every dimension is its own column: each is a separate thing to filter and sort by, and one
// joined cell could only ever be truncated. מקור and מחבר are two such questions — which kind of
// prompt is this, and whose is it — and a reader looking for one judge's prompts needs the second.
const COLS = "34px minmax(0,1fr) 54px 136px 84px 108px 96px 90px 92px 74px 36px";

// The column value is one word, so it can be scanned down a column and matched against the
// filter.
const srcName = (pr: Prompt) => (pr.source === "system" ? "מערכת" : pr.source === "shared" ? "משותף" : "שלי");

// What the cell shows: the mark already says which of the three kinds it is, so the text can
// spend itself on who — which is the part worth reading, and worth being credited for.
// מחבר is a person, so it holds a person: my own prompts are signed with my name, and a prompt
// the system supplies has no author at all — מקור is the column that says where it came from.
const authorName = (pr: Prompt) =>
  pr.source === "system" ? "" : pr.source === "mine" ? ME : pr.author ?? "אנונימי";
// My own prompts aren't stamped with my title in the data — it's mine, and it follows me.
const roleOf = (pr: Prompt) => (pr.source === "mine" ? MY_ROLE : pr.authorRole);
// The title trails the name, so the column reads as people and sorts as names.
const authorFull = (pr: Prompt) => {
  const n = authorName(pr);
  const r = roleOf(pr);
  return n && r ? `${n} (${r})` : n;
};

const avgOf = (pr: Prompt) => (pr.ratingCount ? pr.ratingSum / pr.ratingCount : 0);

// One menu, used by both the panel and the table, so the two never drift apart.
const menuFor = (
  pr: Prompt,
  onUse: (p: Prompt) => void, onEdit: (p: Prompt) => void, onShare: (p: Prompt) => void, onDelete: (p: Prompt) => void,
  onFav: (id: string) => void,
) => [
  { label: "שימוש בפרומפט", Icon: UseExampleIcon, act: () => onUse(pr) },
  // The bookmark is the quick gesture; this is where the action is named. A mark that only
  // appears on hover can't teach anyone that it exists.
  { label: pr.fav ? "הסרה מהמועדפים" : "שמירה במועדפים", Icon: Bookmark, act: () => onFav(pr.id) },
  { label: pr.source === "mine" ? "עריכה" : "עריכה ושמירה כשלי", Icon: Pencil, act: () => onEdit(pr) },
  ...(pr.source === "mine" ? [{ label: "שיתוף", Icon: Share2, act: () => onShare(pr) }] : []),
  ...(pr.source === "mine" || pr.author === ME
    ? [{ label: pr.source === "mine" ? "מחיקה" : "הסרה משיתוף", Icon: Trash2, act: () => onDelete(pr), danger: true }]
    : []),
];

export function PromptLibrary({
  isDark, prompts, onClose, onUse, onFav, onEdit, onShare, onDelete, onRate,
}: {
  isDark: boolean; prompts: Prompt[]; onClose: () => void;
  onUse: (pr: Prompt) => void; onFav: (id: string) => void; onEdit: (pr: Prompt) => void;
  onShare: (pr: Prompt) => void; onDelete: (pr: Prompt) => void; onRate: (id: string, n: number) => void;
}) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [open, setOpen] = useState<string | null>(null);   // the row expanded in place
  // the last search is remembered, so reopening the library resumes where it left off
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      // The search and the filters come back; the sort doesn't. Relevance is the default and no
      // column owns it, so a remembered sort would be one there's no way back from.
      if (raw) setF({ ...EMPTY_FILTERS, ...(JSON.parse(raw) as Partial<Filters>), sort: "relevance", dir: "desc" });
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
  // Sorting isn't filtering: clicking a column header shouldn't put a "ניקוי" on screen, and
  // ניקוי shouldn't throw away the order the user chose.
  const FILTER_KEYS = ["q", "source", "caseType", "matter", "stage", "court", "tag", "favOnly"] as const;
  const filtered = FILTER_KEYS.some((k) => f[k] !== EMPTY_FILTERS[k]);
  const clearFilters = () => setF((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort, dir: prev.dir }));

  // Clicking a column header is the sort control — there is no separate מיון menu to keep in
  // step with it. Same column again reverses; the default is relevance, which no column owns.
  const sortBy = (key: SortKey) =>
    setF((prev) => ({ ...prev, sort: key, dir: prev.sort === key && prev.dir === "desc" ? "asc" : "desc" }));

  const list = useMemo(() => {
    const out = prompts.filter((pr) => matches(pr, f));
    // How well a prompt suits the open case: an exact match on a field is worth more than כללי,
    // which is worth more than a field that contradicts it. All four fields, the same four the
    // panel checks.
    const fit = (pr: Prompt) =>
      (pr.caseType === CASE_CONTEXT.caseType ? 2 : pr.caseType === GENERAL ? 1 : 0) +
      (pr.matter === CASE_CONTEXT.matter ? 2 : pr.matter === GENERAL ? 1 : 0) +
      (pr.stage === CASE_CONTEXT.stage ? 2 : pr.stage === GENERAL ? 1 : 0) +
      (pr.court === CASE_CONTEXT.court ? 2 : pr.court === GENERAL ? 1 : 0);
    // The window opens on what the reader built for themselves — saved first, then written.
    // The panel already answers "what suits this case", and it is the screen this one is reached
    // FROM: opening on the same order would hand back the rows the panel just showed.
    const mineFirst = (pr: Prompt) => (pr.fav ? 0 : pr.source === "mine" ? 1 : 2);
    const cmp: Record<SortKey, (a: Prompt, b: Prompt) => number> = {
      relevance: (a, b) => mineFirst(a) - mineFirst(b) || fit(b) - fit(a) || b.uses - a.uses,
      name: (a, b) => b.name.localeCompare(a.name, "he"),
      source: (a, b) => SOURCE_RANK[srcName(a)] - SOURCE_RANK[srcName(b)] || authorName(a).localeCompare(authorName(b), "he"),
      // the name, never the title; the authorless system rows land at the end of the list
      author: (a, b) => (authorName(a) ? 0 : 1) - (authorName(b) ? 0 : 1) || authorName(a).localeCompare(authorName(b), "he"),
      caseType: (a, b) => b.caseType.localeCompare(a.caseType, "he"),
      matter: (a, b) => b.matter.localeCompare(a.matter, "he"),
      stage: (a, b) => b.stage.localeCompare(a.stage, "he"),
      court: (a, b) => b.court.localeCompare(a.court, "he"),
      // rating sorts on the average, but a 5.0 from two raters shouldn't outrank a 4.6 from
      // forty — the number of raters is the tie-break, and it's in the cell either way
      rating: (a, b) => avgOf(b) - avgOf(a) || b.ratingCount - a.ratingCount,
      uses: (a, b) => b.uses - a.uses,
    };
    const sorted = out.sort(cmp[f.sort] ?? cmp.relevance);
    return f.dir === "asc" && f.sort !== "relevance" ? sorted.reverse() : sorted;
  }, [prompts, f]);

  // Every value carries how many prompts it would leave — counted against the OTHER filters in
  // force, not against the whole מאגר, so the number answers the question actually being asked:
  // if I pick this one, what do I get. That's also what makes a (0) worth showing.
  const facets = useMemo(() => {
    const tally = (key: keyof Filters, values: readonly string[], of: (pr: Prompt) => string | string[]) => {
      const base = prompts.filter((pr) => matches(pr, { ...f, [key]: ANY }));
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
  }, [prompts, f]);

  const surface = isDark ? dk.surface : "white";
  const textCol = isDark ? dk.text : c.text;
  const subCol = isDark ? dk.textMuted : c.textLight;
  const line = isDark ? dk.border : c.inputBorder;
  const rowLine = isDark ? dk.border : "#eef2f7";
  const headBg = isDark ? dk.header : "#f7f9fc";

  const th = (key: SortKey, label: string, align: "right" | "center" = "right") => (
    <button
      onClick={() => sortBy(key)}
      className="h-full w-full flex items-center gap-1 px-2 text-[12.5px] transition-colors hover:bg-black/[0.04]"
      style={{ color: f.sort === key ? c.primary : subCol, justifyContent: align === "center" ? "center" : "flex-start" }}
      title={`מיון לפי ${label}`}
    >
      <span>{label}</span>
      {f.sort === key && (
        <ChevronDown size={12} style={{ transform: f.dir === "asc" ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        dir="rtl" onClick={(e) => e.stopPropagation()}
        className="flex flex-col rounded-lg overflow-hidden shadow-2xl"
        style={{ width: "min(1240px, 94vw)", height: "min(760px, 88vh)", backgroundColor: surface, fontFamily: FONT }}
      >
        <div className="flex items-start gap-3 px-6 pt-5 pb-4" style={{ paddingInlineStart: GUTTER }}>
          {/* A count of everything says nothing. It only earns its place once a filter is on,
              where it reports how much of the מאגר is left — so it appears then, and not before. */}
          <div className="flex-1 min-w-0 text-[18px]" style={{ color: textCol, fontWeight: 400 }}>
            מאגר הפרומפטים
            {filtered && <span style={{ color: subCol }}> ({list.length})</span>}
          </div>
          <button onClick={onClose} className="size-7 flex-none flex items-center justify-center rounded hover:bg-black/5 transition-colors" style={{ color: subCol }} title="סגירה">
            <X size={18} />
          </button>
        </div>

        {/* One row: the search and the six filters do the same job, and the window is wide
            enough to hold them side by side. */}
        <div className="px-6 pb-3" style={{ paddingInlineStart: GUTTER }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative" style={{ width: "268px" }}>
              <Search size={14} style={{ position: "absolute", top: 9, right: 9, color: subCol }} />
              <input
                value={f.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="חיפוש לפי שם הפרומפט או מחבר"
                className="w-full h-8 rounded-[4px] pr-7 pl-3 outline-none text-[13px] text-right"
                style={{ border: `1px solid ${line}`, backgroundColor: isDark ? dk.input : "white", color: textCol }}
              />
            </div>
            <Dropdown label="מקור" value={f.source} options={SOURCE_OPTS} onChange={(v) => set("source", v)} isDark={isDark} width={124} counts={facets.source} />
            <Dropdown label="סוג תיק" value={f.caseType} options={CASE_TYPES} onChange={(v) => set("caseType", v)} isDark={isDark} width={124} counts={facets.caseType} />
            <Dropdown label="סוג עניין" value={f.matter} options={MATTERS} onChange={(v) => set("matter", v)} isDark={isDark} width={146} counts={facets.matter} />
            <Dropdown label="שלב" value={f.stage} options={STAGES} onChange={(v) => set("stage", v)} isDark={isDark} width={132} counts={facets.stage} />
            <Dropdown label="ערכאה" value={f.court} options={COURTS} onChange={(v) => set("court", v)} isDark={isDark} width={122} counts={facets.court} />
            <Dropdown label="תגית" value={f.tag} options={TAGS} onChange={(v) => set("tag", v)} isDark={isDark} width={122} counts={facets.tag} />
            {filtered && (
              <button onClick={clearFilters} className="h-8 px-2 text-[13px] rounded-[4px] hover:bg-black/5 transition-colors" style={{ color: subCol }}>
                ניקוי
              </button>
            )}
          </div>
        </div>

        {/* table */}
        <div className="flex-1 overflow-y-auto docs-scroll px-6 pb-5" dir="ltr" style={{ scrollbarGutter: "stable" }}>
          <div dir="rtl" style={{ border: `1px solid ${rowLine}`, borderRadius: "4px", overflow: "hidden" }}>
            <div
              className="sticky top-0 z-10 grid items-stretch h-8"
              style={{ gridTemplateColumns: COLS, backgroundColor: headBg, borderBottom: `1px solid ${rowLine}` }}
            >
              {/* the column's own header is its filter: click the bookmark, see only saved rows */}
              <button
                onClick={() => set("favOnly", !f.favOnly)}
                className="h-full flex items-center justify-center transition-colors hover:bg-black/[0.04]"
                title={f.favOnly ? "הצגת כל הפרומפטים" : "הצגת המועדפים שלי בלבד"}
              >
                <Bookmark size={14} fill={f.favOnly ? markCol(isDark) : "none"} style={{ color: f.favOnly ? markCol(isDark) : subCol }} />
              </button>
              {th("name", "שם הפרומפט")}
              {th("source", "מקור", "center")}
              {th("author", "מחבר")}
              {th("caseType", "סוג תיק")}
              {th("matter", "סוג עניין")}
              {th("stage", "שלב")}
              {th("court", "ערכאה")}
              {th("rating", "דירוג")}
              {th("uses", "שימושים", "center")}
              <div />
            </div>

            {list.length === 0 && (
              <div className="py-16 text-center text-[13.5px]" style={{ color: subCol }}>לא נמצאו פרומפטים התואמים לחיפוש.</div>
            )}

            {list.map((pr) => {
              const expanded = open === pr.id;
              return (
                <div key={pr.id} style={{ borderBottom: `1px solid ${rowLine}` }}>
                  <div
                    className="group grid items-center transition-colors hover:bg-black/[0.02]"
                    style={{ gridTemplateColumns: COLS, minHeight: "46px", backgroundColor: expanded ? (isDark ? "#222a40" : "#f7fafd") : undefined }}
                  >
                    <div className="flex items-center justify-center">
                      <FavMark on={pr.fav} onToggle={() => onFav(pr.id)} isDark={isDark} quiet />
                    </div>

                    {/* the name column carries a line of the prompt itself: unlike a document, a
                        prompt's name doesn't tell you whether it's the one you want */}
                    <button onClick={() => setOpen(expanded ? null : pr.id)} className="min-w-0 text-right px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown size={13} style={{ color: subCol, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(90deg)", transition: "transform .15s" }} />
                        <span className="text-[14px] truncate" style={{ color: textCol }}>{pr.name}</span>
                      </div>
                      {!expanded && (
                        <div className="text-[12px] truncate mt-0.5" style={{ color: subCol, paddingInlineStart: "19px" }} title={pr.body}>{pr.body}</div>
                      )}
                    </button>

                    <div className="flex items-center justify-center" title={srcName(pr)}>
                      <SourceMark pr={pr} isDark={isDark} size={15} />
                    </div>

                    <div className="px-2 min-w-0 text-[12.5px] truncate" style={{ color: isDark ? dk.textMuted : c.textGray }} title={authorFull(pr)}>
                      {authorName(pr) || <span style={{ color: subCol }}>—</span>}
                      {roleOf(pr) && authorName(pr) && <span style={{ color: subCol }}> ({roleOf(pr)})</span>}
                    </div>

                    {/* כללי is the absence of a value, so it sits back a shade and the real ones read first */}
                    {([pr.caseType, pr.matter, pr.stage, pr.court] as const).map((v, i) => (
                      <div
                        key={i}
                        className="px-2 min-w-0 text-[12.5px] truncate"
                        style={{ color: v === GENERAL ? subCol : isDark ? dk.textMuted : c.textGray }}
                        title={v}
                      >
                        {v}
                      </div>
                    ))}

                    {/* the cell is the way in: rating happens in the open row, where the stars are */}
                    <button
                      onClick={() => setOpen(expanded ? null : pr.id)}
                      className="px-2 h-full text-[12.5px] flex items-center gap-1 transition-colors hover:bg-black/[0.04]"
                      style={{ color: isDark ? dk.textMuted : c.textGray }}
                      title={pr.myRating !== null ? `דירגת ${pr.myRating}` : "לדירוג הפרומפט"}
                    >
                      {pr.ratingCount ? (
                        <>
                          {/* The number is the rating; this star only says which number it is,
                              so it stays an outline. Fill belongs to the control, where filling
                              stars in is how a rating is read and given. */}
                          <Star size={12} strokeWidth={1.8} style={{ color: markCol(isDark), flexShrink: 0 }} />
                          <span>{avgOf(pr).toFixed(1)}</span>
                          <span style={{ color: subCol }}>({pr.ratingCount})</span>
                        </>
                      ) : <span style={{ color: subCol }}>טרם דורג</span>}
                    </button>

                    <div className="px-2 text-[12.5px] text-center" style={{ color: isDark ? dk.textMuted : c.textGray }}>{pr.uses}</div>

                    <div className="flex items-center justify-center">
                      <RowMenu isDark={isDark} items={menuFor(pr, onUse, onEdit, onShare, onDelete, onFav)} />
                    </div>
                  </div>

                  {expanded && (
                    <div className="px-4 pb-4 pt-1" style={{ backgroundColor: isDark ? "#222a40" : "#f7fafd" }}>
                      <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: isDark ? dk.text : c.textGray, paddingInlineStart: "27px" }}>
                        {pr.body}
                      </p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap" style={{ paddingInlineStart: "27px" }}>
                        {pr.tags.map((t) => <Tag key={t} t={t} isDark={isDark} active={f.tag === t} onClick={() => set("tag", f.tag === t ? ANY : t)} />)}
                        <span className="text-[12px] flex items-center gap-1" style={{ color: subCol }}>
                          <SourceMark pr={pr} isDark={isDark} size={12} /> {sourceLabel(pr)}
                        </span>
                        {pr.basedOn && <span className="text-[12px]" style={{ color: subCol }}>· מבוסס על &quot;{pr.basedOn}&quot;</span>}
                        <div className="flex-1" />
                        <Stars pr={pr} isDark={isDark} onRate={(n) => onRate(pr.id, n)} />
                        <button
                          onClick={() => onUse(pr)}
                          className="h-7 px-3 rounded-[4px] text-[13px] transition-opacity hover:opacity-90"
                          style={{ backgroundColor: c.primary, color: "white" }}
                        >
                          שימוש בפרומפט
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
  // The classification isn't only for sharing: it's what decides whether a prompt shows up in
  // the panel for the case you have open, so it has to be settable on your own prompts too.
  const [caseType, setCaseType] = useState(initial?.caseType ?? GENERAL);
  const [matter, setMatter] = useState(initial?.matter ?? GENERAL);
  const [stage, setStage] = useState(initial?.stage ?? GENERAL);
  const [court, setCourt] = useState(initial?.court ?? GENERAL);
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
      } as Prompt),
      caseType, matter, stage, court,
      ...(mode === "fork" ? { basedOn: initial?.name } : {}),
      name: name.trim(), body: body.trim(), tags, edited: today(),
      source: "mine",
      // Only the star gesture stars: saving a question that was sent came from pressing a star,
      // so it lands starred; writing one from scratch, or forking someone else's, does not. If
      // every prompt of mine were starred, the star would stop sorting anything.
      fav: keep ? keep.fav : mode === "fromMessage",
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
          <div
            className="mx-6 mb-3 px-3 py-2 rounded-[4px] text-[12.5px] leading-relaxed flex items-start gap-2"
            style={{ backgroundColor: isDark ? "#243354" : "#f0f5ff", color: isDark ? dk.text : c.darkBlue }}
          >
            <Info size={14} className="flex-none" style={{ marginTop: "2px" }} />
            <span>הפרומפט המקורי נשאר במאגר כפי שהוא. נשמור בנוסף גם עותק שלך.</span>
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
          {/* Both lines report what the text already produced, so neither appears until there is
              something to report — the placeholder inside the field is what explains the brackets,
              and saying it twice made an empty editor look like it had a problem. */}
          {fields.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap text-[12.5px]" style={{ color: subCol }}>
              <span>שדות למילוי:</span>
              {fields.map((x) => <Tag key={x} t={`[${x}]`} isDark={isDark} />)}
              {fields.includes(EXAMPLE_FIELD) && <span>· [{EXAMPLE_FIELD}] נבחרת מתוך פאנל הדוגמאות</span>}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap text-[12.5px]" style={{ color: subCol }}>
              <span>תגיות שזוהו:</span>
              {tags.map((t) => <Tag key={t} t={t} isDark={isDark} />)}
            </div>
          )}

          {/* Optional, and "כללי" means it fits every case — which is why it's the default. */}
          <div className="text-[12.5px] mt-3 mb-1.5" style={{ color: subCol }}>
            שיוך — קובע באילו תיקים הפרומפט יוצע לך בפאנל
          </div>
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
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={save} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            {mode === "fromMessage" ? "שמירה למועדפים" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share ──────────────────────────────────────────────────────────────────
// NOTE (open, parked 2026-09-01): a shared prompt goes straight to every user — no approval
// step, and no way to report one that turns out to be wrong or inappropriate. Both were
// deliberately left out of this version. If the two are ever added, they belong together:
// reporting is only useful if something happens to the report, and an approval queue is what
// gives it somewhere to go. There is also no route yet from משותף to מאושר ע״י הלשכה, and a
// well-rated shared prompt is the obvious candidate for one.
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
      author: anon ? "אנונימי" : ME, authorRole: anon ? undefined : MY_ROLE,
      fav: false, caseType, matter, stage, court,
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

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={share} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            שיתוף
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

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={insert} className="h-9 px-5 rounded-[4px] text-[14px] transition-opacity hover:opacity-90" style={{ backgroundColor: c.primary, color: "white" }}>
            הכנסה לשורת השאלה
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
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="h-9 px-4 rounded-[4px] text-[14px] transition-colors hover:bg-black/5" style={{ border: `1px solid ${isDark ? dk.border : c.border}`, color: textCol }}>
            ביטול
          </button>
          <button onClick={onConfirm} className="h-9 px-5 rounded-[4px] text-[14px] text-white transition-opacity hover:opacity-90" style={{ backgroundColor: RED }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The two actions under a question that was sent ─────────────────────────
export function QuestionActions({ isDark, onSave, onShare }: { isDark: boolean; onSave: () => void; onShare: () => void }) {
  const col = isDark ? dk.textMuted : c.iconGray;
  const btn = "size-6 flex items-center justify-center rounded transition-colors hover:bg-black/10";
  return (
    <div className="flex items-center" dir="ltr" style={{ gap: "2px", fontFamily: FONT }}>
      <button className={btn} style={{ color: col }} onClick={onSave} title="שמירה למועדפים">
        <Bookmark size={15} />
      </button>
      <button className={btn} style={{ color: col }} onClick={onShare} title="שיתוף">
        <Share2 size={15} />
      </button>
    </div>
  );
}
