import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { getDailyQuote } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Sparkles, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/motivation")({
  head: () => ({ meta: [{ title: "Motivation — Scholar OS" }] }),
  component: () => <AppShell title="Motivation"><Motivation /></AppShell>,
});

function Motivation() {
  const { user } = useAuth();
  const fetchQuote = useServerFn(getDailyQuote);
  const [quote, setQuote] = useState<{ quote_text: string; author: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ daily_quote_email: false, daily_quote_sms: false });

  const load = async () => {
    setLoading(true);
    try { setQuote(await fetchQuote()); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_settings").select("daily_quote_email,daily_quote_sms").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setSettings(data));
  }, [user]);

  const updateSetting = async (key: "daily_quote_email" | "daily_quote_sms", val: boolean) => {
    setSettings((s) => ({ ...s, [key]: val }));
    const patch = key === "daily_quote_email" ? { daily_quote_email: val } : { daily_quote_sms: val };
    await supabase.from("user_settings").update(patch).eq("user_id", user!.id);
    toast.success("Saved");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="bg-surface shadow-glow p-8 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary" />
        <div className="mt-4 text-2xl font-semibold leading-snug text-balance">
          {loading ? "Generating today's quote…" : quote ? `"${quote.quote_text}"` : "—"}
        </div>
        {quote?.author && <div className="mt-3 text-sm text-muted-foreground">— {quote.author}</div>}
        <Button variant="ghost" size="sm" className="mt-6" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </Card>

      <Card className="bg-surface p-5">
        <h3 className="mb-1 font-semibold">Daily delivery</h3>
        <p className="mb-4 text-xs text-muted-foreground">Send the daily quote to you. (Channels can be wired to email/SMS in Settings once your providers are connected.)</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3">
            <Label>Email me a daily quote</Label>
            <Switch checked={settings.daily_quote_email} onCheckedChange={(v) => updateSetting("daily_quote_email", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3">
            <Label>Text (SMS) me a daily quote</Label>
            <Switch checked={settings.daily_quote_sms} onCheckedChange={(v) => updateSetting("daily_quote_sms", v)} />
          </div>
        </div>
      </Card>
    </div>
  );
}
