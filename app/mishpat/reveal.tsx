"use client";
import { useEffect, useRef, type ReactNode } from "react";

// Something a click opens (a part, the share options) is scrolled into view if it landed below the
// fold, so the person doesn't have to go looking for it. Only right after a click or a key: a part
// that is open when the window first appears stays where it is. One reveal per action, so "פתיחת
// הכל" shows the first part rather than racing to the last.
let lastAct = 0;
let revealedFor = -1;
if (typeof window !== "undefined") {
  const mark = () => { lastAct = performance.now(); };
  window.addEventListener("pointerdown", mark, true);
  window.addEventListener("keydown", mark, true);
}

export function useReveal<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active || performance.now() - lastAct > 800 || revealedFor === lastAct) return;
    revealedFor = lastAct;
    // after layout, so the element has its full height when the scroll is measured
    // with room under it, so the chat bar floating at the window's bottom doesn't cover its end
    const id = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.style.scrollMarginBottom = "88px";
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, [active]);
  return ref;
}

export function Reveal({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
