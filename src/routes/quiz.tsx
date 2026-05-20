import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { generateQuiz } from "@/lib/ai.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, ListChecks } from "lucide-react";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [{ title: "Quiz — Scholar OS" }] }),
  component: () => <AppShell title="Quiz"><Quiz /></AppShell>,
});

type Q = { question: string; options: string[]; answerIndex: number; explanation: string };

function Quiz() {
  const gen = useServerFn(generateQuiz);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [num, setNum] = useState(8);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<{ id: string; questions: Q[] } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const drop = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (f: File) => {
    if (!f) return;
    if (f.type !== "text/plain" && !f.name.endsWith(".txt") && !f.name.endsWith(".md")) {
      return toast.error("Please drop a .txt or .md file (PDFs not supported yet — paste the text instead)");
    }
    const text = await f.text();
    setSource(text.slice(0, 20000));
    if (!title) setTitle(f.name.replace(/\.\w+$/, ""));
    toast.success("File loaded");
  };

  const create = async () => {
    if (!title || source.length < 20) return toast.error("Title and at least 20 chars of source required");
    setLoading(true);
    try {
      const r = await gen({ data: { title, source, numQuestions: num } });
      setQuiz({ id: r.quizId, questions: r.questions });
      setAnswers(new Array(r.questions.length).fill(-1));
      setSubmitted(false);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const submit = async () => {
    if (!quiz) return;
    const score = quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
    setSubmitted(true);
    await supabase.from("quizzes").update({ score, completed_at: new Date().toISOString() }).eq("id", quiz.id);
    toast.success(`You scored ${score}/${quiz.questions.length}`);
  };

  if (quiz) {
    const score = quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          {submitted && <div className="text-lg font-bold">Score: {score}/{quiz.questions.length}</div>}
        </div>
        {quiz.questions.map((q, i) => (
          <Card key={i} className="bg-surface p-5">
            <div className="mb-3 font-medium">{i + 1}. {q.question}</div>
            <div className="space-y-2">
              {q.options.map((o, j) => {
                const selected = answers[i] === j;
                const correct = submitted && j === q.answerIndex;
                const wrong = submitted && selected && j !== q.answerIndex;
                return (
                  <button key={j} disabled={submitted}
                    onClick={() => { const a = [...answers]; a[i] = j; setAnswers(a); }}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      correct ? "border-success bg-success/10" :
                      wrong ? "border-destructive bg-destructive/10" :
                      selected ? "border-primary bg-primary/10" : "border-border/50 hover:bg-accent/30"}`}>
                    {String.fromCharCode(65 + j)}. {o}
                  </button>
                );
              })}
            </div>
            {submitted && <p className="mt-3 text-xs text-muted-foreground"><b>Why:</b> {q.explanation}</p>}
          </Card>
        ))}
        <div className="flex justify-end gap-2">
          {!submitted ? <Button onClick={submit} className="bg-gradient-primary">Submit</Button>
            : <Button variant="outline" onClick={() => { setQuiz(null); setAnswers([]); }}>New quiz</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="bg-surface p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold"><ListChecks className="h-4 w-4 text-primary" /> Generate a practice quiz</div>
        <div className="space-y-3">
          <div><Label>Quiz title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Biology Chapter 3" /></div>
          <div>
            <Label>Source material</Label>
            <div ref={drop} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`rounded-lg border-2 border-dashed p-4 text-center text-xs ${dragging ? "border-primary bg-primary/5" : "border-border/60"}`}>
              <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-1 text-muted-foreground">Drop a .txt/.md file or use the picker</p>
              <Input type="file" accept=".txt,.md,text/plain" className="mx-auto mt-2 max-w-xs" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
            <Textarea className="mt-3" rows={8} value={source} onChange={(e) => setSource(e.target.value)} placeholder="…or paste study material here" />
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs">Questions:</Label>
            <Input type="number" min={3} max={15} value={num} onChange={(e) => setNum(+e.target.value)} className="w-20" />
            <Button disabled={loading} onClick={create} className="ml-auto bg-gradient-primary">{loading ? "Generating…" : "Generate quiz"}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
