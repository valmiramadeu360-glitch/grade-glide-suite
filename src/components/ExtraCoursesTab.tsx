import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Sparkles, Loader2, ExternalLink, Trash2, CheckCircle2, Clock } from "lucide-react";

interface ExtraCourse {
  id: string;
  name: string;
  institution: string | null;
  workload_hours: number | null;
  certificate_url: string | null;
  status: string;
  completed_at: string | null;
  notes: string | null;
}

export function ExtraCoursesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ExtraCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [workload, setWorkload] = useState<string>("");
  const [certUrl, setCertUrl] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [completedAt, setCompletedAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("extra_courses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data ?? []);
    } finally { setLoading(false); }
  }

  function reset() {
    setName(""); setInstitution(""); setWorkload("");
    setCertUrl(""); setStatus("in_progress"); setCompletedAt(""); setNotes("");
  }

  async function create() {
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("extra_courses").insert({
        user_id: user.id,
        name: name.trim(),
        institution: institution || null,
        workload_hours: workload ? parseInt(workload) : null,
        certificate_url: certUrl || null,
        status,
        completed_at: completedAt || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast({ title: "Curso adicionado" });
      reset();
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este curso?")) return;
    await supabase.from("extra_courses").delete().eq("id", id);
    setItems(prev => prev.filter(x => x.id !== id));
  }

  async function toggleDone(c: ExtraCourse) {
    const next = c.status === "completed" ? "in_progress" : "completed";
    await supabase.from("extra_courses").update({
      status: next,
      completed_at: next === "completed" ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", c.id);
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full font-bold gap-1">
              <Plus className="h-4 w-4" /> Novo Curso Extra
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle>Novo curso complementar</DialogTitle>
              <DialogDescription>
                Cadastre um curso extracurricular ou certificação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Nome do curso *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: React Avançado" />
              </div>
              <div className="space-y-1.5">
                <Label>Instituição</Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: Alura" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Carga horária (h)</Label>
                  <Input type="number" value={workload} onChange={(e) => setWorkload(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data conclusão</Label>
                  <Input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>URL do certificado</Label>
                <Input value={certUrl} onChange={(e) => setCertUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button onClick={create} disabled={saving || !name.trim()} className="w-full rounded-full font-bold">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">Nenhum curso extra cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
          {items.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate">{c.name}</p>
                      <Badge variant={c.status === "completed" ? "default" : "secondary"} className="rounded-full text-[10px]">
                        {c.status === "completed" ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Em andamento</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.institution ?? "—"}
                      {c.workload_hours ? ` • ${c.workload_hours}h` : ""}
                      {c.completed_at ? ` • ${new Date(c.completed_at).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.certificate_url && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(c.certificate_url!, "_blank")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => toggleDone(c)}>
                      <CheckCircle2 className={c.status === "completed" ? "h-4 w-4 text-emerald-500" : "h-4 w-4 opacity-40"} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}