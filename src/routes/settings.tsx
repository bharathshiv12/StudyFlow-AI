import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — StudyFlow AI" }] }),
  component: () => <AppShell title="Settings"><SettingsPage /></AppShell>,
});

function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", phone: "", email: "" });
  const [settings, setSettings] = useState({ notify_email: true, notify_sms: false, reminder_lead_minutes: 30 });
  const [saving, setSaving] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState("cyan-future");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,phone,email").eq("id", user.id).maybeSingle()
      .then(({ data }) => data && setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "", email: data.email ?? user.email ?? "" }));
    supabase.from("user_settings").select("notify_email,notify_sms,reminder_lead_minutes").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setSettings(data));
  }, [user]);

  useEffect(() => {
    const saved = window.localStorage.getItem("studyflow-theme");
    if (!saved) return;
    const theme = themes.find((item) => item.id === saved);
    if (theme) {
      setActiveThemeId(theme.id);
      applyTheme(theme);
    }
  }, []);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const [a, b] = await Promise.all([
      supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone, email: profile.email, updated_at: new Date().toISOString() }).eq("id", user.id),
      supabase.from("user_settings").update(settings).eq("user_id", user.id),
    ]);
    setSaving(false);
    if (a.error || b.error) return toast.error(a.error?.message || b.error?.message);
    toast.success("Settings saved");
  };

  const requestPush = async () => {
    if (!("Notification" in window)) return toast.error("Browser doesn't support notifications");
    const p = await Notification.requestPermission();
    if (p === "granted") toast.success("Browser notifications enabled");
  };

  const selectTheme = (themeId: string) => {
    const theme = themes.find((item) => item.id === themeId);
    if (!theme) return;
    setActiveThemeId(theme.id);
    applyTheme(theme);
    window.localStorage.setItem("studyflow-theme", theme.id);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="bg-surface p-5">
        <h3 className="mb-4 font-semibold">Profile</h3>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
          <div><Label>Phone number (with country code)</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+15551234567" /></div>
        </div>
      </Card>

      <Card className="bg-surface p-5">
        <h3 className="mb-4 font-semibold">Notifications</h3>
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={requestPush}><Bell className="h-4 w-4" /> Enable browser notifications</Button>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3">
            <Label>Email reminders</Label>
            <Switch checked={settings.notify_email} onCheckedChange={(v) => setSettings({ ...settings, notify_email: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3">
            <Label>SMS reminders</Label>
            <Switch checked={settings.notify_sms} onCheckedChange={(v) => setSettings({ ...settings, notify_sms: v })} />
          </div>
          <div><Label>Reminder lead time (minutes)</Label><Input type="number" value={settings.reminder_lead_minutes} onChange={(e) => setSettings({ ...settings, reminder_lead_minutes: +e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Email/SMS delivery requires connecting Resend (email) and Twilio (SMS). Browser & in-app reminders work right away.</p>
        </div>
      </Card>

      <Card className="bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Dashboard Themes</h3>
            <p className="text-sm text-muted-foreground">Choose a futuristic dashboard theme to update colors, gradients, glows, and accents instantly.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-background/40 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">Appearance</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => {
            const isActive = theme.id === activeThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                className={`group flex w-full flex-col gap-4 rounded-[22px] border p-4 text-left transition-all duration-300 ${
                  isActive
                    ? "border-[rgba(255,255,255,0.2)] shadow-[0_0_0_2px_rgba(255,255,255,0.16)] shadow-glow"
                    : "border-white/10 bg-[rgba(15,23,42,0.45)] hover:-translate-y-0.5 hover:border-white/20 hover:shadow-glow"
                }`}
                aria-pressed={isActive}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{theme.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{theme.subtitle}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {theme.short}
                  </div>
                </div>
                <div className="grid gap-2 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-2.5 w-16 rounded-full" style={{ backgroundColor: theme.primary }} />
                    <div className="h-2.5 w-12 rounded-full" style={{ backgroundColor: theme.secondary }} />
                  </div>
                  <div className="grid gap-2">
                    <div className="h-10 rounded-2xl bg-white/5" style={{ background: `linear-gradient(135deg, ${theme.primary}25, ${theme.secondary}15)` }} />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-6 rounded-xl bg-white/5" style={{ backgroundColor: theme.sidebar }} />
                      <div className="h-6 rounded-xl bg-white/5" style={{ backgroundColor: theme.background }} />
                      <div className="h-6 rounded-xl bg-white/5" style={{ backgroundColor: theme.background }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{theme.style}</span>
                  {isActive && <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">Selected</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary">{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

const themes = [
  {
    id: "purple-cyber",
    label: "Purple Cyber",
    subtitle: "Dark futuristic cyberpunk",
    style: "Neon purple glow",
    short: "P",
    background: "#060B1A",
    sidebar: "#0F172A",
    primary: "#7C3AED",
    secondary: "#8B5CF6",
    glow: "rgba(124,58,237,0.35)",
    foreground: "#F8FAFC",
    accent: "#A855F7",
    ring: "#7C3AED",
    card: "rgba(15, 23, 42, 0.72)",
    gradientPrimary: "linear-gradient(135deg, rgba(124,58,237,0.95), rgba(139,92,246,0.82))",
    gradientSurface: "linear-gradient(180deg, rgba(8, 10, 24, 0.96), rgba(12, 15, 32, 0.94))",
    gradientGlow: "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.22), transparent 25%), radial-gradient(circle at 80% 10%, rgba(139,92,246,0.14), transparent 20%)",
    shadowGlow: "0 24px 80px -32px rgba(124,58,237,0.35)",
    shadowCard: "0 20px 60px -20px rgba(0, 0, 0, 0.55)",
    chart1: "#7C3AED",
    chart2: "#A78BFA",
    chart3: "#8B5CF6",
    chart4: "#E0AAFF",
    chart5: "#C084FC",
  },
  {
    id: "cyan-future",
    label: "Cyan Future",
    subtitle: "Minimal cyan-blue UI",
    style: "Clean productivity aesthetic",
    short: "C",
    background: "#060B1A",
    sidebar: "#0F172A",
    primary: "#06B6D4",
    secondary: "#3B82F6",
    glow: "rgba(6,182,212,0.35)",
    foreground: "#F8FAFC",
    accent: "#38BDF8",
    ring: "#06B6D4",
    card: "rgba(15, 23, 42, 0.72)",
    gradientPrimary: "linear-gradient(135deg, rgba(6,182,212,0.95), rgba(59,130,246,0.82))",
    gradientSurface: "linear-gradient(180deg, rgba(8, 12, 26, 0.96), rgba(11, 18, 32, 0.95))",
    gradientGlow: "radial-gradient(circle at 20% 20%, rgba(6,182,212,0.22), transparent 25%), radial-gradient(circle at 80% 10%, rgba(59,130,246,0.12), transparent 20%)",
    shadowGlow: "0 24px 80px -32px rgba(6,182,212,0.35)",
    shadowCard: "0 20px 60px -20px rgba(0, 0, 0, 0.55)",
    chart1: "#06B6D4",
    chart2: "#3B82F6",
    chart3: "#22C55E",
    chart4: "#F59E0B",
    chart5: "#EF4444",
  },
  {
    id: "neon-green",
    label: "Neon Green",
    subtitle: "Hacker-inspired productivity",
    style: "Green neon analytics",
    short: "G",
    background: "#07130D",
    sidebar: "#0D1F17",
    primary: "#22C55E",
    secondary: "#4ADE80",
    glow: "rgba(34,197,94,0.35)",
    foreground: "#F8FAFC",
    accent: "#86EFAC",
    ring: "#22C55E",
    card: "rgba(9, 20, 14, 0.72)",
    gradientPrimary: "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(74,222,128,0.82))",
    gradientSurface: "linear-gradient(180deg, rgba(7,19,13,0.96), rgba(11,25,17,0.95))",
    gradientGlow: "radial-gradient(circle at 20% 20%, rgba(34,197,94,0.22), transparent 25%), radial-gradient(circle at 80% 10%, rgba(74,222,128,0.12), transparent 20%)",
    shadowGlow: "0 24px 80px -32px rgba(34,197,94,0.35)",
    shadowCard: "0 20px 60px -20px rgba(0, 0, 0, 0.55)",
    chart1: "#22C55E",
    chart2: "#4ADE80",
    chart3: "#86EFAC",
    chart4: "#bef264",
    chart5: "#22c55e",
  },
  {
    id: "orange-energy",
    label: "Orange Energy",
    subtitle: "Warm futuristic workspace",
    style: "Amber/orange neon glow",
    short: "O",
    background: "#120B07",
    sidebar: "#1E140D",
    primary: "#F59E0B",
    secondary: "#FB923C",
    glow: "rgba(245,158,11,0.35)",
    foreground: "#F8FAFC",
    accent: "#FDBA74",
    ring: "#F59E0B",
    card: "rgba(24, 12, 7, 0.72)",
    gradientPrimary: "linear-gradient(135deg, rgba(245,158,11,0.95), rgba(251,146,60,0.82))",
    gradientSurface: "linear-gradient(180deg, rgba(18, 11, 7, 0.96), rgba(29, 18, 12, 0.95))",
    gradientGlow: "radial-gradient(circle at 20% 20%, rgba(245,158,11,0.22), transparent 25%), radial-gradient(circle at 80% 10%, rgba(251,146,60,0.12), transparent 20%)",
    shadowGlow: "0 24px 80px -32px rgba(245,158,11,0.35)",
    shadowCard: "0 20px 60px -20px rgba(0, 0, 0, 0.55)",
    chart1: "#F59E0B",
    chart2: "#FB923C",
    chart3: "#FDE68A",
    chart4: "#f97316",
    chart5: "#ea580c",
  },
  {
    id: "pink-neon",
    label: "Pink Neon",
    subtitle: "Vibrant neon cyber aesthetic",
    style: "Modern magenta glow",
    short: "P",
    background: "#100712",
    sidebar: "#1A0D1F",
    primary: "#EC4899",
    secondary: "#F472B6",
    glow: "rgba(236,72,153,0.35)",
    foreground: "#F8FAFC",
    accent: "#F9A8D4",
    ring: "#EC4899",
    card: "rgba(18, 7, 18, 0.72)",
    gradientPrimary: "linear-gradient(135deg, rgba(236,72,153,0.95), rgba(244,114,182,0.82))",
    gradientSurface: "linear-gradient(180deg, rgba(16, 7, 18, 0.96), rgba(22, 10, 27, 0.95))",
    gradientGlow: "radial-gradient(circle at 20% 20%, rgba(236,72,153,0.22), transparent 25%), radial-gradient(circle at 80% 10%, rgba(244,114,182,0.12), transparent 20%)",
    shadowGlow: "0 24px 80px -32px rgba(236,72,153,0.35)",
    shadowCard: "0 20px 60px -20px rgba(0, 0, 0, 0.55)",
    chart1: "#EC4899",
    chart2: "#F472B6",
    chart3: "#FB7185",
    chart4: "#f9a8d4",
    chart5: "#f472b6",
  },
  {
    id: "light-minimal",
    label: "Light Minimal",
    subtitle: "Premium modern workspace",
    style: "Clean futuristic light dashboard",
    short: "L",
    background: "#F8FAFC",
    sidebar: "#E2E8F0",
    primary: "#14B8A6",
    secondary: "#8B5CF6",
    glow: "rgba(20,184,166,0.20)",
    foreground: "#0F172A",
    accent: "#0EA5E9",
    ring: "#14B8A6",
    card: "rgba(248, 250, 252, 0.9)",
    gradientPrimary: "linear-gradient(135deg, rgba(20,184,166,0.95), rgba(139,92,246,0.82))",
    gradientSurface: "linear-gradient(180deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.9))",
    gradientGlow: "radial-gradient(circle at 20% 20%, rgba(20,184,166,0.15), transparent 25%), radial-gradient(circle at 80% 10%, rgba(139,92,246,0.1), transparent 20%)",
    shadowGlow: "0 24px 80px -32px rgba(20,184,166,0.25)",
    shadowCard: "0 20px 60px -20px rgba(15, 23, 42, 0.15)",
    chart1: "#14B8A6",
    chart2: "#8B5CF6",
    chart3: "#22C55E",
    chart4: "#F59E0B",
    chart5: "#EC4899",
  },
];

function applyTheme(theme: (typeof themes)[number]) {
  const root = document.documentElement;
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--foreground", theme.foreground);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--popover", theme.card);
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-foreground", theme.foreground);
  root.style.setProperty("--secondary", theme.secondary);
  root.style.setProperty("--secondary-foreground", theme.foreground);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-foreground", theme.foreground);
  root.style.setProperty("--border", "rgba(255, 255, 255, 0.1)");
  root.style.setProperty("--input", theme.card);
  root.style.setProperty("--ring", theme.ring);
  root.style.setProperty("--chart-1", theme.chart1);
  root.style.setProperty("--chart-2", theme.chart2);
  root.style.setProperty("--chart-3", theme.chart3);
  root.style.setProperty("--chart-4", theme.chart4);
  root.style.setProperty("--chart-5", theme.chart5);
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--sidebar-foreground", theme.foreground);
  root.style.setProperty("--sidebar-primary", theme.primary);
  root.style.setProperty("--sidebar-primary-foreground", theme.foreground);
  root.style.setProperty("--sidebar-accent", theme.glow);
  root.style.setProperty("--sidebar-accent-foreground", theme.foreground);
  root.style.setProperty("--sidebar-border", theme.glow);
  root.style.setProperty("--sidebar-ring", theme.ring);
  root.style.setProperty("--gradient-primary", theme.gradientPrimary);
  root.style.setProperty("--gradient-surface", theme.gradientSurface);
  root.style.setProperty("--gradient-glow", theme.gradientGlow);
  root.style.setProperty("--shadow-glow", theme.shadowGlow);
  root.style.setProperty("--shadow-card", theme.shadowCard);
}
