// Icons that aren't in lucide as a single glyph, shared by the chat page and the prompt library.

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
