import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Play, Pause, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/focus")({
  head: () => ({ meta: [{ title: "Focus Mode — StudyFlow AI" }] }),
  component: () => (
    <AppShell title="Focus Mode">
      <Focus />
    </AppShell>
  ),
});

function Focus() {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const sessionId = useRef<string | null>(null);
  const startMs = useRef<number>(0);
  const minutesRef = useRef(minutes);

  useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const finish = useCallback(async (completed: boolean) => {
    setRunning(false);
    if (sessionId.current) {
      const elapsed = Math.round((Date.now() - startMs.current) / 60000);
      const { error } = await supabase
        .from("focus_sessions")
        .update({
          completed_minutes: Math.min(elapsed, minutesRef.current),
          finished: completed,
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId.current);
      if (error) toast.error(error.message);
      sessionId.current = null;
    }
    if (completed) {
      toast.success(`Session complete — ${minutesRef.current} minutes logged`);
    }
  }, []);

  useEffect(() => {
    if (running && remaining === 0) {
      void finish(true);
    }
  }, [remaining, running, finish]);

  const start = async () => {
    if (!user) {
      toast.error("Please sign in to start a focus session.");
      return;
    }
    if (running || starting) return;

    setStarting(true);
    try {
      setRemaining(minutes * 60);
      startMs.current = Date.now();
      const { data, error } = await supabase
        .from("focus_sessions")
        .insert({ user_id: user.id, duration_minutes: minutes })
        .select("id")
        .single();

      if (error || !data?.id) {
        toast.error(error?.message ?? "Could not start focus session.");
        return;
      }

      sessionId.current = data.id as string;
      setRunning(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start focus session.");
    } finally {
      setStarting(false);
    }
  };

  const stop = () => {
    void finish(false);
  };

  const reset = () => {
    void finish(false);
    setRemaining(minutes * 60);
  };

  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  const pct = minutes * 60 > 0 ? ((minutes * 60 - remaining) / (minutes * 60)) * 100 : 0;

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Card className="bg-surface shadow-glow w-full max-w-md p-10 text-center">
        {!running && remaining === minutes * 60 && (
          <div className="mb-6 flex justify-center gap-2">
            {[15, 25, 45, 60].map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={minutes === v ? "default" : "outline"}
                onClick={() => {
                  setMinutes(v);
                  setRemaining(v * 60);
                }}
              >
                {v}m
              </Button>
            ))}
          </div>
        )}
        <div className="relative mx-auto h-56 w-56">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="oklch(0.26 0.05 270)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="oklch(0.62 0.21 275)"
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${2 * Math.PI * 46 * (1 - pct / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-5xl font-bold tabular-nums tracking-tight">
              {m}:{s}
            </div>
          </div>
        </div>
        <div className="mt-8 flex justify-center gap-3">
          {!running ? (
            <Button
              type="button"
              size="lg"
              onClick={start}
              disabled={starting}
              className="bg-gradient-primary"
            >
              <Play className="h-4 w-4" /> {starting ? "Starting…" : "Start"}
            </Button>
          ) : (
            <Button type="button" size="lg" variant="secondary" onClick={stop}>
              <Pause className="h-4 w-4" /> Stop
            </Button>
          )}
          <Button type="button" size="lg" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Stay here. No distractions. Just focused study.
        </p>
      </Card>
    </div>
  );
}
