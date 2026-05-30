import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BookOpen, Timer, FileText, ListChecks, CheckCircle2, Flame } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — StudyFlow AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  return <AppShell title="Dashboard"><DashboardInner /></AppShell>;
}

function DashboardInner() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ tasksToday: 0, tasksDone: 0, assignmentsDue: 0, quizzes: 0, focusMin: 0, streak: 0 });
  const [chart, setChart] = useState<{ day: string; minutes: number; tasks: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      const [tasks, assigns, qz, focus] = await Promise.all([
        supabase.from("study_tasks").select("*").eq("scheduled_date", today),
        supabase.from("assignments").select("*").eq("completed", false),
        supabase.from("quizzes").select("score,total,completed_at").not("completed_at", "is", null),
        supabase.from("focus_sessions").select("completed_minutes,started_at").gte("started_at", weekAgo + "T00:00:00Z"),
      ]);
      const focusByDay: Record<string, number> = {};
      (focus.data ?? []).forEach((f) => {
        if (!f.started_at) return;
        const d = (f.started_at as string).slice(0, 10);
        focusByDay[d] = (focusByDay[d] ?? 0) + (f.completed_minutes ?? 0);
      });
      const tasksByDay: Record<string, number> = {};
      const { data: weekTasks } = await supabase.from("study_tasks").select("scheduled_date,completed").gte("scheduled_date", weekAgo).eq("completed", true);
      (weekTasks ?? []).forEach((t) => { tasksByDay[t.scheduled_date] = (tasksByDay[t.scheduled_date] ?? 0) + 1; });
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
        return { day: new Date(d).toLocaleDateString(undefined, { weekday: "short" }), minutes: focusByDay[d] ?? 0, tasks: tasksByDay[d] ?? 0 };
      });
      let streak = 0;
      for (let i = 6; i >= 0; i--) { if (days[i].minutes > 0 || days[i].tasks > 0) streak++; else break; }
      setChart(days);
      setStats({
        tasksToday: tasks.data?.length ?? 0,
        tasksDone: tasks.data?.filter((t) => t.completed).length ?? 0,
        assignmentsDue: assigns.data?.length ?? 0,
        quizzes: qz.data?.length ?? 0,
        focusMin: Object.values(focusByDay).reduce((a, b) => a + b, 0),
        streak,
      });
    })();
  }, [user]);

  const todayProgress = stats.tasksToday ? Math.round((stats.tasksDone / stats.tasksToday) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome back 👋</h2>
        <p className="text-sm text-muted-foreground">Here's how your studies are going.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<BookOpen className="h-4 w-4" />} label="Tasks today" value={`${stats.tasksDone}/${stats.tasksToday}`} />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Assignments due" value={stats.assignmentsDue} />
        <StatCard icon={<Timer className="h-4 w-4" />} label="Focus (7d)" value={`${stats.focusMin}m`} />
        <StatCard icon={<ListChecks className="h-4 w-4" />} label="Quizzes taken" value={stats.quizzes} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" value={`${stats.streak}d`} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Today" value={`${todayProgress}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-surface p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Focus minutes (last 7 days)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.04 270 / 0.3)" />
                <XAxis dataKey="day" stroke="oklch(0.68 0.03 265)" fontSize={12} />
                <YAxis stroke="oklch(0.68 0.03 265)" fontSize={12} />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.035 270)", border: "1px solid oklch(0.28 0.04 270)", borderRadius: 8 }} />
                <Bar dataKey="minutes" fill="oklch(0.62 0.21 275)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-surface p-5">
          <h3 className="mb-3 font-semibold">Today's progress</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Tasks completed</span><span>{stats.tasksDone}/{stats.tasksToday}</span></div>
              <Progress value={todayProgress} />
            </div>
            <p className="text-xs text-muted-foreground">Keep going! Consistency beats intensity. Open the Planner to see your schedule, or start a Focus session.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="bg-surface shadow-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}
