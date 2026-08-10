"use client";

import { usePathname } from "next/navigation";
import { FlaskConical, Sparkles } from "lucide-react";
import { c, CURRENT_ADMIN } from "./ui";

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/studioOS/logo.png" alt="לוגו" className="h-[30px] w-auto" />;
}

// ── Sidebar nav config ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/studioOS/mishpat/admin",         label: "בטאות",  Icon: FlaskConical, match: "exact" as const },
  { href: "/studioOS/mishpat/admin/modules", label: "מודלים", Icon: Sparkles,     match: "prefix" as const },
];

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  // basePath (/studioOS) is stripped from usePathname(), so compare on the tail
  const tail = href.replace(/^\/studioOS/, "");
  return match === "exact" ? pathname === tail : pathname.startsWith(tail);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen flex flex-col"
      dir="rtl"
      style={{ backgroundColor: "#f8f9fb", fontFamily: "'Noto Sans Hebrew', sans-serif" }}
    >
      {/* ── Header ── */}
      <header
        dir="ltr"
        className="h-16 flex items-center justify-between px-8 sticky top-0 z-30 flex-shrink-0"
        style={{ backgroundColor: c.headerBg, borderBottom: `1px solid ${c.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-full flex items-center justify-center text-white text-[14px] flex-shrink-0 select-none"
            style={{ backgroundColor: "#6b7ea8", fontFamily: "Figtree, sans-serif" }}
          >
            {CURRENT_ADMIN.initials}
          </div>
          <div className="flex flex-col leading-tight text-right">
            <span className="text-[13px] whitespace-nowrap" style={{ color: c.darkBlue, fontFamily: "Noto Sans Hebrew, sans-serif" }}>{CURRENT_ADMIN.name}</span>
          </div>
        </div>

        <a
          href="/studioOS/mishpat"
          dir="rtl"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          style={{ textDecoration: "none" }}
        >
          <Logo />
          <span
            className="font-medium text-[20px] whitespace-nowrap"
            style={{ color: c.darkBlue, fontFamily: "Rubik, sans-serif", lineHeight: 1 }}
          >
            נט המשפט
          </span>
        </a>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar (RTL → sits on the right) */}
        <nav
          className="w-[220px] flex-shrink-0 py-4 px-3 sticky self-start"
          style={{
            top: "64px",
            height: "calc(100vh - 64px)",
            backgroundColor: "white",
            borderInlineStart: `1px solid ${c.border}`,
          }}
        >
          <div className="text-[12px] font-medium px-3 mb-2" style={{ color: c.textLight }}>
            ניהול
          </div>
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, Icon, match }) => {
              const active = isActive(pathname, href, match);
              return (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 h-10 rounded-lg text-[15px] transition-colors"
                  style={{
                    color: active ? c.primary : c.text,
                    backgroundColor: active ? "#eff4ff" : "transparent",
                    fontWeight: active ? 600 : 400,
                    textDecoration: "none",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = c.hoverBg; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <Icon size={18} color={active ? c.primary : c.iconGray} />
                  <span>{label}</span>
                </a>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
