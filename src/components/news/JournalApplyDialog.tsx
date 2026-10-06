import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, ImagePlus, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDITORIAL_TERMS, JOURNAL_CATEGORIES, normalizeHandle, uploadNewsImage } from "@/lib/news";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}

export function JournalApplyDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [category, setCategory] = useState<string>("curso");
  const [description, setDescription] = useState("");
  const [editorial, setEditorial] = useState("");
  const [purpose, setPurpose] = useState("");
  const [team, setTeam] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const step1Ok = name.trim().length >= 3 && handle.length >= 3 && description.trim().length >= 10;
  const step2Ok = editorial.trim().length >= 20 && purpose.trim().length >= 20 && team.trim().length >= 3;

  function reset() {
    setStep(1); setName(""); setHandle(""); setDescription(""); setEditorial("");
    setPurpose(""); setTeam(""); setLogo(null); setAccepted(false);
  }

  async function submit() {
    if (!user || !accepted) return;
    setSaving(true);
    try {
      const logo_url = logo ? await uploadNewsImage(user.id, logo) : null;
      const { error } = await supabase.from("news_channels").insert({
        name: name.trim(), handle, category, description: description.trim(),
        editorial_line: editorial.trim(), purpose: purpose.trim(), team_note: team.trim(),
        logo_url, terms_accepted_at: new Date().toISOString(), scope: "university",
      });
      if (error) throw error;
      toast({ title: "Solicitação enviada!", description: "A equipe do EduConect vai analisar sua redação." });
      reset(); onOpenChange(false); onCreated();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast({
        title: "Não foi possível enviar",
        description: msg.includes("handle") || msg.includes("duplicate") ? "Esse @ já está em uso." : msg,
        variant: "destructive",
      });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest">
            <Newspaper className="h-3.5 w-3.5" /> Etapa {step} de 3
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">
            {step === 1 ? "Funde seu jornal" : step === 2 ? "Linha editorial" : "Termo editorial"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Dê identidade à sua redação. Você pode personalizar tudo depois."}
            {step === 2 && "Conte para a moderação o que o jornal vai publicar e quem faz parte."}
            {step === 3 && "Jornalismo estudantil com responsabilidade. Leia e aceite para enviar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <label className="flex items-center gap-4 cursor-pointer">
              <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border border-dashed">
                {logo ? <img src={URL.createObjectURL(logo)} className="h-full w-full object-cover" alt="" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="text-sm"><p className="font-bold">Logotipo</p><p className="text-muted-foreground text-xs">Opcional, quadrado</p></div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
            </label>
            <div className="space-y-1.5">
              <Label>Nome do jornal</Label>
              <Input value={name} maxLength={60} placeholder="Ex.: Redação UFAL" onChange={(e) => {
                setName(e.target.value);
                if (!handle || handle === normalizeHandle(name)) setHandle(normalizeHandle(e.target.value));
              }} />
            </div>
            <div className="space-y-1.5">
              <Label>Endereço (@)</Label>
              <div className="flex items-center rounded-md border px-3 bg-background">
                <span className="text-muted-foreground text-sm">@</span>
                <input className="flex-1 h-10 bg-transparent outline-none text-sm pl-1" value={handle} onChange={(e) => setHandle(normalizeHandle(e.target.value))} placeholder="redacao.ufal" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de veículo</Label>
              <div className="flex flex-wrap gap-2">
                {JOURNAL_CATEGORIES.map((c) => (
                  <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                    className={cn("px-3 py-1.5 rounded-full border text-xs font-bold transition",
                      category === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary/40")}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição curta (bio)</Label>
              <Textarea value={description} maxLength={200} rows={2} placeholder="O jornal dos estudantes de Economia da UFAL." onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>O que o jornal vai publicar?</Label>
              <Textarea rows={3} value={editorial} onChange={(e) => setEditorial(e.target.value)} placeholder="Notícias do curso, entrevistas com professores, análises de conjuntura econômica..." />
            </div>
            <div className="space-y-1.5">
              <Label>Qual o intuito do jornal?</Label>
              <Textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Aproximar os estudantes das pesquisas do curso e divulgar oportunidades..." />
            </div>
            <div className="space-y-1.5">
              <Label>Quem são os integrantes?</Label>
              <Textarea rows={3} value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Ana Lima (editora-chefe, 5º período), Pedro Souza (repórter)..." />
              <p className="text-[11px] text-muted-foreground">Depois da aprovação você convida os colegas pelo app.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/50 p-4 space-y-2.5">
              {EDITORIAL_TERMS.map((t) => (
                <div key={t} className="flex gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{t}</span></div>
              ))}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} className="mt-0.5" />
              <span className="text-sm font-semibold">Li e aceito o Termo Editorial do EduConect, e entendo que o perfil pode ser derrubado em caso de descumprimento.</span>
            </label>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 1 && <Button variant="outline" className="rounded-full" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step < 3 ? (
            <Button className="flex-1 rounded-full font-bold" disabled={step === 1 ? !step1Ok : !step2Ok} onClick={() => setStep(step + 1)}>Continuar</Button>
          ) : (
            <Button className="flex-1 rounded-full font-bold" disabled={!accepted || saving} onClick={submit}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar para aprovação
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
