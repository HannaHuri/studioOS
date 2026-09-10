// Icons and small marks that aren't lucide glyphs, shared by the chat page, the prompt
// library and the proofreading answer.
import { c } from "./theme";

// ── Citation badge ─────────────────────────────────────────────────────────
// The number that follows a sentence and points at the document it came from. `title` names
// that document on hover, so a citation can say what it is without spending a line on it.
export function Badge({ num, title }: { num: number; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center rounded-full size-5 text-[12px] leading-none flex-shrink-0 mx-0.5 cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: c.badgeBg, color: c.text, fontFamily: "Figtree, sans-serif" }}
    >
      {num}
    </span>
  );
}

// "מעמיק" — hand-copied from Material Symbols (Apache 2.0), the way the sort icon below is.
// Every brain we tried was drawn front-facing and mirror-symmetric, which is what kept reading
// as mechanical; this one is a head in profile, so it has a side to it, and its silhouette
// survives 14px where a brain's lobes turn to mush.
export function DeepModeIcon({ size = 24, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" style={style}>
      <path d="M240-80v-172q-57-52-88.5-121.5T120-520q0-150 105-255t255-105q125 0 221.5 73.5T827-615l55 218q4 14-5 25.5T853-360h-93v140q0 24.75-17.62 42.37Q724.75-160 700-160H600v80h-60v-140h160v-200h114l-45-180q-24-97-105-158.5T480-820q-125 0-212.5 86.5T180-522.46q0 64.42 26.32 122.39Q232.65-342.09 281-297l19 18v199h-60Zm257-370Zm-48 76h60l3-44q12-2 22.47-8.46Q544.94-432.92 553-441l42 14 28-48-30-24q5-14 5-29t-5-29l30-24-28-48-42 14q-8.33-7.69-19.17-13.85Q523-635 512-638l-3-44h-60l-3 44q-11 3-21.83 9.15Q413.33-622.69 405-615l-42-14-28 48 30 24q-5 14-5 29t5 29l-30 24 28 48 42-14q8.06 8.08 18.53 14.54Q434-420 446-418l3 44Zm30.12-84q-29.12 0-49.62-20.38-20.5-20.38-20.5-49.5t20.38-49.62q20.38-20.5 49.5-20.5t49.62 20.38q20.5 20.38 20.5 49.5t-20.38 49.62q-20.38 20.5-49.5 20.5Z" />
    </svg>
  );
}

// "שימוש בדוגמה" / "שימוש בפרומפט" — a boxed return arrow (apply/insert). The same glyph is
// used for both, because from the user's side both actions are the same gesture: take this
// saved thing and put it to work in the conversation.
export function UseExampleIcon({ size = 24, style, className }: { size?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3.5" />
      <path d="M16 8.5v3a1.5 1.5 0 0 1-1.5 1.5H9" />
      <path d="m11 11-2 2 2 2" />
    </svg>
  );
}
