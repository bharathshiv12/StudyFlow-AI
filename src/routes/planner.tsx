import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { aiChat, generatePlan } from "@/lib/ai.functions";
import { toast } from "sonner";
import { Sparkles, Send, Bell } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Study Planner — StudyFlow AI" }] }),
  component: () => <AppShell title="Study Planner"><Planner /></AppShell>,
});

type Task = { id: string; subject: string; title: string; scheduled_date: string; scheduled_time: string | null; duration_minutes: number | null; completed: boolean; task_type: string };

function Planner() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({ subject: "", title: "", date: new Date().toISOString().slice(0, 10), time: "", duration: 30, type: "study" });
  const load = async () => {
    const { data } = await supabase.from("study_tasks").select("*").order("scheduled_date").order("scheduled_time");
    setTasks((data as Task[]) ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  // Notification reminders for tasks today
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const upcoming = tasks.filter((t) => !t.completed && t.scheduled_date === today && t.scheduled_time);
    const timers = upcoming.map((t) => {
      const [h, m] = t.scheduled_time!.split(":").map(Number);
      const when = new Date(); when.setHours(h, m, 0, 0);
      const delay = when.getTime() - now.getTime();
      if (delay < 0 || delay > 86400000) return null;
      return window.setTimeout(() => {
        if (Notification.permission === "granted") new Notification("Study reminder", { body: `${t.subject}: ${t.title}` });
        toast(`Time for ${t.subject}`, { description: t.title });
      }, delay);
    });
    return () => { timers.forEach((id) => id && clearTimeout(id)); };
  }, [tasks]);

  const add = async () => {
    if (!form.subject || !form.title) return toast.error("Subject and title required");
    const { error } = await supabase.from("study_tasks").insert({
      user_id: user!.id, subject: form.subject, title: form.title, scheduled_date: form.date,
      scheduled_time: form.time ? form.time + ":00" : null, duration_minutes: form.duration, task_type: form.type,
    });
    if (error) return toast.error(error.message);
    setForm({ ...form, subject: "", title: "" });
    load();
  };
  const toggle = async (t: Task) => {
    await supabase.from("study_tasks").update({ completed: !t.completed }).eq("id", t.id);
    load();
  };
  const remove = async (id: string) => { await supabase.from("study_tasks").delete().eq("id", id); load(); };

  const grouped: Record<string, Task[]> = {};
  tasks.forEach((t) => { (grouped[t.scheduled_date] ??= []).push(t); });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="bg-surface p-5">
          <h3 className="mb-3 font-semibold">Add a study block</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Math" /></div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Chapter 4 — Trigonometry" /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            <div><Label>Duration (min)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} /></div>
            <div><Label>Type</Label>
              <select className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="study">Study</option><option value="homework">Homework</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button type="button" onClick={add} className="bg-gradient-primary">Add to timetable</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => "Notification" in window && Notification.requestPermission()}>
              <Bell className="h-4 w-4" /> Enable reminders
            </Button>
          </div>
        </Card>

        {Object.keys(grouped).length === 0 && <Card className="bg-surface p-8 text-center text-sm text-muted-foreground">No tasks yet. Add one above or ask the AI assistant to plan for you.</Card>}
        {Object.entries(grouped).map(([date, list]) => (
          <Card key={date} className="bg-surface p-5">
            <div className="mb-3 text-sm font-semibold text-muted-foreground">{new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
                  <Checkbox checked={t.completed} onCheckedChange={() => toggle(t)} />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${t.completed ? "text-muted-foreground line-through" : ""}`}>{t.subject} — {t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.scheduled_time?.slice(0, 5) ?? "Anytime"} · {t.duration_minutes}m · {t.task_type}</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(t.id)}>Delete</Button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <PlannerAI onPlanned={load} />
    </div>
  );
}

function PlannerAI({ onPlanned }: { onPlanned: () => void }) {
  const chat = useServerFn(aiChat);
  const planFn = useServerFn(generatePlan);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState("");

  const send = async () => {
    if (!input.trim()) return;
    const m = input.trim(); setInput("");
    setMsgs((p) => [...p, { role: "user", content: m }]);
    setLoading(true);
    try {
      const { reply } = await chat({ data: { tab: "planner", message: m } });
      setMsgs((p) => [...p, { role: "assistant", content: reply }]);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const generate = async () => {
    if (!goal.trim()) return toast.error("Describe what you want to study");
    setLoading(true);
    try {
      const r = await planFn({ data: { goal, daysAhead: 7 } });
      toast.success(`Added ${r.inserted} study blocks`); setGoal(""); onPlanned();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Card className="bg-surface p-5 lg:sticky lg:top-20 h-fit">
      <div className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI Planner</div>
      <div className="mb-4 space-y-2 rounded-lg border border-border/50 bg-background/30 p-3">
        <Label className="text-xs">Auto-generate a 7-day plan</Label>
        <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Prepare for Physics midterm next Friday: kinematics, optics, thermodynamics" />
        <Button type="button" size="sm" disabled={loading} onClick={generate} className="w-full bg-gradient-primary">Generate plan</Button>
      </div>
      <div className="mb-3 h-64 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-background/30 p-3 text-sm">
        {msgs.length === 0 && <div className="text-xs text-muted-foreground">Ask anything: "How should I split 2h tonight between math and chemistry?"</div>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "rounded-md bg-primary/15 p-2 text-foreground" : "text-foreground/90"}>
            <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
          </div>
        ))}
        {loading && <div className="text-xs text-muted-foreground">Thinking…</div>}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask the planner…" />
        <Button type="button" size="icon" onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
