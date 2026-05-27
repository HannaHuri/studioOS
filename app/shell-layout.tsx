"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

// Pages that should render WITHOUT the app shell (sidebar + header)
const NO_SHELL_ROUTES = ["/mishpat", "/mishpat/admin"];

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isShellless = NO_SHELL_ROUTES.some(route => pathname.startsWith(route));

  if (isShellless) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex-1 p-4 md:p-6 max-w-screen-xl mx-auto w-full">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
