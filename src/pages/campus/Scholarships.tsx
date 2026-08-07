import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SCHOLARSHIP_KIND_LABEL, useIsAdmin, useScholarships } from "@/hooks/useCampusServices";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Bookmark, BookmarkCheck, ExternalLink, CalendarClock } from "lucide-react";

export default function CampusScholarships() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { calls, savedIds, loading, toggleSave, reload } = useScholarships();
  const [courseFilter, setCourseFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "", organization: "", kind: "bolsa", description: "",
    courses: "", stipend: "", workload_hours: "", deadline: "", official_url: "",
  });

  const filtered = useMemo(() => {
    const q = courseFilter.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter(
      (c) =>
        c.courses.some((course) => course.toLowerCase().includes(q)) ||
        c.title.toLowerCase().includes(q) ||
        (c.organization ?? "").toLowerCase().includes(q),
    );
  }, [calls, courseFilter]);

  async function createCall() {
    if (!form.title.trim()) return;
    const { error } = await supabase.from("scholarship_calls").insert({
      title: form.title.trim(),
      organization: form.organization.trim() || null,
      kind: form.kind,
      description: form.description.trim() || null,
      courses: form.courses.split(",").map((c) => c.trim()).filter(Boolean),
      stipend: form.stipend ? Number(form.stipend) : null,
      workload_hours: form.workload_hours ? Number(form.workload_hours) : null,
      deadline: form.deadline || null,
      official_url: form.official_url.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Edital publicado.");
    setForm({ title: "", organization: "", kind: "bolsa", description: "", courses: "", stipend: "", workload_hours: "", deadline: "", official_url: "" });
    setCreating(false);
    void reload();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28 px-4 sm:px-6 pt-4 animate-in fade-in duration-500">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campus")} className="h-11 w-11 rounded-2xl shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-11 w-11 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight truncate">Editais</h1>
          <p className="text-[11px] text-muted-foreground">Bolsas, monitorias e oportunidades</p>
        </div>
        {isAdmin && (
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-11 w-11 rounded-2xl shrink-0">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo edital</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Monitoria de Anatomia 2026.2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Órgão</Label>
                    <Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="PROGRAD" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <select
                      value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(SCHOLARSHIP_KIND_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Cursos (separados por vírgula)</Label>
                  <Input value={form.courses} onChange={(e) => setForm({ ...form, courses: e.target.value })} placeholder="Medicina, Enfermagem" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Valor</Label>
                    <Input type="number" value={form.stipend} onChange={(e) => setForm({ ...form, stipend: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Horas</Label>
                    <Input type="number" value={form.workload_hours} onChange={(e) => setForm({ ...form, workload_hours: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prazo</Label>
                    <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Link oficial</Label>
                  <Input value={form.official_url} onChange={(e) => setForm({ ...form, official_url: e.target.value })} placeholder="https://" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createCall} className="rounded-xl font-bold">Publicar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <Input
        value={courseFilter}
        onChange={(e) => setCourseFilter(e.target.value)}
        placeholder="Filtrar por curso, título ou órgão"
        className="h-11 rounded-2xl"
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-[24px] bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[24px] border-border/30 shadow-sm">
          <CardContent className="p-8 text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold">Nenhum edital encontrado</p>
            <p className="text-xs text-muted-foreground">Assim que a administração publicar oportunidades, elas aparecem aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((call) => {
            const saved = savedIds.includes(call.id);
            const daysLeft = call.deadline
              ? Math.ceil((new Date(call.deadline).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <Card key={call.id} className="rounded-[24px] border border-border/30 shadow-sm overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold leading-snug">{call.title}</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {SCHOLARSHIP_KIND_LABEL[call.kind] ?? call.kind}
                        {call.organization ? ` • ${call.organization}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void toggleSave(call.id)}
                      className={cn("h-10 w-10 rounded-2xl shrink-0", saved && "text-primary")}
                      aria-label={saved ? "Remover dos salvos" : "Salvar edital"}
                    >
                      {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                    </Button>
                  </div>

                  {call.description && <p className="text-xs text-muted-foreground leading-relaxed">{call.description}</p>}

                  <div className="flex flex-wrap items-center gap-2">
                    {call.courses.map((course) => (
                      <Badge key={course} variant="secondary" className="rounded-full text-[10px] font-bold border-0">{course}</Badge>
                    ))}
                    {call.stipend != null && (
                      <Badge variant="outline" className="rounded-full text-[10px] font-bold border-border/40">
                        R$ {Number(call.stipend).toLocaleString("pt-BR")}
                      </Badge>
                    )}
                    {call.workload_hours != null && (
                      <Badge variant="outline" className="rounded-full text-[10px] font-bold border-border/40">{call.workload_hours}h</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    {call.deadline ? (
                      <span
                        className={cn(
                          "text-[11px] font-bold flex items-center gap-1.5",
                          daysLeft != null && daysLeft <= 3 ? "text-rose-600" : "text-muted-foreground",
                        )}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        {daysLeft != null && daysLeft >= 0 ? `Faltam ${daysLeft} dia(s)` : "Prazo encerrado"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sem prazo informado</span>
                    )}
                    {call.official_url && (
                      <a
                        href={call.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1.5"
                      >
                        Edital oficial <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}