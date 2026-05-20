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
  head: () => ({ meta: [{ title: "Settings — Scholar OS" }] }),
  component: () => <AppShell title="Settings"><SettingsPage /></AppShell>,
});

function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", phone: "", email: "" });
  const [settings, setSettings] = useState({ notify_email: true, notify_sms: false, reminder_lead_minutes: 30 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,phone,email").eq("id", user.id).maybeSingle()
      .then(({ data }) => data && setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "", email: data.email ?? user.email ?? "" }));
    supabase.from("user_settings").select("notify_email,notify_sms,reminder_lead_minutes").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setSettings(data));
  }, [user]);

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

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-gradient-primary">{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
