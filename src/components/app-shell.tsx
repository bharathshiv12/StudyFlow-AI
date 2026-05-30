import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { user, loading } = useRequireAuth();
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    const check = () => setLocalMode(Boolean((window as { __SUPABASE_OFFLINE__?: boolean }).__SUPABASE_OFFLINE__));
    check();
    window.addEventListener("supabase-offline-changed", check);
    return () => window.removeEventListener("supabase-offline-changed", check);
  }, []);
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-white/10 bg-[rgba(15,23,42,0.72)] px-4 backdrop-blur-xl">
            <SidebarTrigger className="rounded-2xl border border-white/10 bg-[rgba(7,19,35,0.85)] text-primary-foreground shadow-glow transition hover:border-[#06B6D4]/30 hover:bg-[rgba(7,19,35,0.95)]" />
            <h1 className="text-sm font-semibold tracking-tight text-foreground/90">{title}</h1>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            {localMode ? (
              <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                Local storage mode is active — your tasks, assignments, and focus sessions are saved in this browser until Supabase is connected.
              </p>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
