// Icons that aren't in lucide as a single glyph, shared by the chat page and the prompt library.

// "מעמיק" — a brain. Lucide's own is built from eight overlapping circles, which turns into a
// dark blob at the 14px the composer uses it at; this one is a single lobed outline per side,
// drawn once and mirrored, so the centre line stays crisp and the lobes stay open when small.
export function BrainIcon({ size = 24, strokeWidth = 1.7, style }: { size?: number; strokeWidth?: number; style?: React.CSSProperties }) {
  const half = (
    <>
      <path d="M12 5C10.6 3.6 8 4 7 5.8 4.8 6 3.5 8.4 4.5 10.3 3.4 11.9 4 14.2 5.9 15.1c.3 2.1 2.7 3.4 4.7 2.5.8-.3 1.4-1.1 1.4-2Z" />
      <path d="M8.4 9c1.5.3 2.6 1.6 2.6 3.1" />
    </>
  );
  // The lobes only reach x≈4..20, y≈4..18 of the 24 box, so next to Send and Zap — which fill
  // theirs — the brain read as the small one. Scaling about its own centre fills the box and
  // thickens the stroke with it, instead of asking every call site for a different size.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <g transform="translate(12,11.2) scale(1.22) translate(-12,-11.2)">
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
