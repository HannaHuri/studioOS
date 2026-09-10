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

// "מעמיק" — a brain. Lucide's own is built from eight overlapping circles, which turns into a
// dark blob at the 14px the composer uses it at. This one is a lobed outline drawn once and
// mirrored: the mirroring gives one crisp centre line instead of two that nearly meet.
export function BrainIcon({ size = 24, strokeWidth = 1.7, style }: { size?: number; strokeWidth?: number; style?: React.CSSProperties }) {
  // Three deep lobes per side and nothing inside them: the inner curls that make a brain
  // look like a brain at 96px are what turn it into a smudge at 14px.
  const half = <path d="M12 4.4C10.2 2.9 7 3.7 6.3 5.9 3.7 6.2 2.3 9.2 3.8 11.4c-1.2 2.1.1 4.9 2.5 5.4.7 2.2 3.9 3 5.7 1.5Z" />;
  // The lobes only reach x≈4..20, y≈4..18 of the 24 box, so next to Send and Zap — which fill
  // theirs — the brain read as the small one. Scaling about its own centre fills the box and
  // thickens the stroke with it, instead of asking every call site for a different size.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <g transform="translate(12,11.2) scale(1.06) translate(-12,-11.2)">
        {half}
        <g transform="translate(24,0) scale(-1,1)">{half}</g>
      </g>
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
