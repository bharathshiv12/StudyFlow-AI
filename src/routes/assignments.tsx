import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Download, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/assignments")({
  head: () => ({ meta: [{ title: "Assignments — StudyFlow AI" }] }),
  component: () => <AppShell title="Assignments"><Assignments /></AppShell>,
});

type A = { id: string; name: string; file_path: string | null; file_name: string | null; due_date: string; notes: string | null; completed: boolean };

function Assignments() {
  const { user } = useAuth();
  const [list, setList] = useState<A[]>([]);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("assignments").select("*").order("due_date");
    if (error) return toast.error(error.message);
    setList((data as A[]) ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  // Reminder for assignments due soon
  useEffect(() => {
    const soon = list.filter((a) => !a.completed && new Date(a.due_date).getTime() - Date.now() < 2 * 86400000 && new Date(a.due_date).getTime() > Date.now() - 86400000);
    if (soon.length && "Notification" in window && Notification.permission === "granted") {
      soon.forEach((a) => new Notification("Assignment due soon", { body: `${a.name} — ${a.due_date}` }));
    }
  }, [list.length]);

  const submit = async () => {
    if (!name || !due) return toast.error("Name and due date required");
    setUploading(true);
    let file_path: string | null = null; let file_name: string | null = null;
    if (file) {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("assignments").upload(path, file);
      if (error) { setUploading(false); return toast.error(error.message); }
      file_path = path; file_name = file.name;
    }
    const { error } = await supabase
      .from("assignments")
      .insert({ user_id: user!.id, name, due_date: due, notes: notes || null, file_path, file_name });
    setUploading(false);
    if (error) return toast.error(error.message ?? "Failed to save assignment");
    setName(""); setDue(""); setNotes(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
    toast.success("Assignment added"); load();
  };

  const open = async (a: A) => {
    if (!a.file_path) return;
    const { data, error } = await supabase.storage.from("assignments").createSignedUrl(a.file_path, 600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };
  const toggle = async (a: A) => { await supabase.from("assignments").update({ completed: !a.completed }).eq("id", a.id); load(); };
  const remove = async (a: A) => {
    if (a.file_path) await supabase.storage.from("assignments").remove([a.file_path]);
    await supabase.from("assignments").delete().eq("id", a.id); load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="bg-surface p-5">
        <h3 className="mb-3 font-semibold">Upload assignment</h3>
        <div className="space-y-3">
          <div><Label>Assignment name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="History Essay" /></div>
          <div><Label>Submission date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <div><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div>
            <Label>Attachment (optional)</Label>
            <Input ref={fileRef} type="file" accept="application/pdf,.pdf,image/*,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="button" onClick={submit} disabled={uploading} className="w-full bg-gradient-primary">
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Add assignment"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3 lg:col-span-2">
        {list.length === 0 && <Card className="bg-surface p-8 text-center text-sm text-muted-foreground">No assignments yet.</Card>}
        {list.map((a) => {
          const days = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000);
          const overdue = days < 0 && !a.completed;
          return (
            <Card key={a.id} className="bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/30"><FileText className="h-5 w-5 text-primary" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`font-semibold ${a.completed ? "line-through text-muted-foreground" : ""}`}>{a.name}</div>
                    {a.completed && <Badge variant="secondary">Done</Badge>}
                    {!a.completed && overdue && <Badge variant="destructive">Overdue</Badge>}
                    {!a.completed && !overdue && days <= 2 && <Badge className="bg-warning text-background">Due in {days}d</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">Due {a.due_date}{a.notes ? ` · ${a.notes}` : ""}</div>
                </div>
                <div className="flex items-center gap-1">
                  {a.file_path && <Button type="button" size="sm" variant="ghost" onClick={() => open(a)}><Download className="h-4 w-4" /></Button>}
                  <Button type="button" size="sm" variant="ghost" onClick={() => toggle(a)}><Check className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
