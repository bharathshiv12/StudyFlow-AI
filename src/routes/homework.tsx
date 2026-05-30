import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { aiChat } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Send, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/homework")({
  head: () => ({ meta: [{ title: "Homework AI — StudyFlow AI" }] }),
  component: () => <AppShell title="Homework AI"><Homework /></AppShell>,
});

function Homework() {
  const { user } = useAuth();
  const chat = useServerFn(aiChat);
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("chat_messages").select("role,content").eq("tab", "homework").order("created_at")
      .then(({ data }) => setMsgs((data as any) ?? []));
  }, [user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs.length]);

  const send = async () => {
    if (!input.trim()) return;
    const m = input.trim(); setInput("");
    setMsgs((p) => [...p, { role: "user", content: m }]);
    setLoading(true);
    try {
      const { reply } = await chat({ data: { tab: "homework", message: m } });
      setMsgs((p) => [...p, { role: "assistant", content: reply }]);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Card className="bg-surface mx-auto flex h-[78vh] max-w-3xl flex-col p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-border/50 pb-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary"><Brain className="h-4 w-4 text-primary-foreground" /></div>
        <div>
          <div className="text-sm font-semibold">Homework Assistant</div>
          <div className="text-xs text-muted-foreground">Ask doubts, get explanations, generate notes</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-2">
        {msgs.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>
              <p>Start by asking a question.</p>
              <p className="mt-1 text-xs">"Explain photosynthesis", "Solve 2x² + 3x − 5 = 0", "Make revision notes for the French Revolution"</p>
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background/40"}`}>
              <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-muted-foreground">Thinking…</div>}
      </div>
      <div className="mt-3 flex gap-2 border-t border-border/50 pt-3">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask anything…" autoFocus />
        <Button type="button" onClick={send} disabled={loading} className="bg-gradient-primary"><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
