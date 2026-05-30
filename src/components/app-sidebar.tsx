import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, CalendarClock, FileText, Timer, Brain, ListChecks, Sparkles, Settings, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Study Planner", url: "/planner", icon: CalendarClock },
  { title: "Assignments", url: "/assignments", icon: FileText },
  { title: "Focus Mode", url: "/focus", icon: Timer },
  { title: "Homework AI", url: "/homework", icon: Brain },
  { title: "Quiz", url: "/quiz", icon: ListChecks },
  { title: "Motivation", url: "/motivation", icon: Sparkles },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-white/10 bg-[rgba(15,23,42,0.7)] px-3 py-4 backdrop-blur-xl">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="bg-[rgba(15,23,42,0.6)] backdrop-blur-xl">
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url}>
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/settings")}>
                  <Link to="/settings"><Settings className="h-4 w-4" /><span>Settings</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 bg-[rgba(15,23,42,0.7)] border-t border-white/10 backdrop-blur-xl">
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
