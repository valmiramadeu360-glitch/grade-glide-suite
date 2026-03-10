import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Send, Loader2, MessageSquare, 
  ShieldCheck, Sparkles, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "improvement", label: "Sugestão de Melhoria" },
  { value: "bug", label: "Relato de Problema" },
  { value: "criticism", label: "Crítica Construtiva" },
  { value: "praise", label: "Elogio à Equipe" },
];

export default function Feedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [category, setCategory] = useState("improvement");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) {
      toast({ title: "Mensagem vazia", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // 1. Registro no Banco de Dados (Backup)
      const payload: any = {
        category,
        message: message.trim(),
        is_anonymous: isAnonymous,
      };

      if (!isAnonymous && user) {
        payload.user_id = user.id;
        payload.email = user.email;
      }

      await supabase.from("feedbacks").insert(payload);

      // 2. Envio de E-mail via Web3Forms (Lógica Otimizada)
      const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
      
      // Montamos o objeto exatamente como a API do Web3Forms espera para ALTA ENTREGA
      const emailPayload = {
        access_key: "403d59d2-6728-40be-a5a2-c35bd6fe8afd",
        subject: `[EduFlow Feedback] - ${categoryLabel}`,
        from_name: "EduFlow Academy App",
        name: isAnonymous ? "Estudante Anônimo" : (user?.email?.split('@')[0] || "Usuário"),
        email: isAnonymous ? "no-reply@eduflow.com" : user?.email,
        message: `
          NOVO FEEDBACK RECEBIDO
          ------------------------------------------
          CATEGORIA: ${categoryLabel}
          ESTUDANTE: ${isAnonymous ? "Anônimo" : user?.email}
          
          MENSAGEM:
          ${message.trim()}
          ------------------------------------------
          Enviado via Central de Apoio EduFlow 2.0
        `,
      };

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(emailPayload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Feedback enviado com sucesso!",
          description: "Obrigado por nos ajudar a melhorar o EduFlow.",
        });
        setMessage("");
        setCategory("improvement");
        setIsAnonymous(false);
      } else {
        throw new Error(result.message || "Erro no servidor de e-mail");
      }
    } catch (error: any) {
      console.error("Erro no feedback:", error);
      toast({ 
        title: "Erro no envio", 
        description: "Salvamos sua mensagem no banco, mas o alerta por e-mail falhou.", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-safe px-4 sm:px-6">
      
      {/* Header com estilo iOS/BI */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-12 w-12 rounded-xl bg-card border border-border/40 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-black tracking-tighter">Central de <span className="text-primary">Apoio</span></h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Sua voz melhora nossa arquitetura</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        
        {/* Card de Informação Lateral */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[32px] border-border/40 bg-primary/5 p-8 space-y-4 shadow-sm">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="text-lg font-black tracking-tight">Como funciona?</h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Ao enviar um feedback, ele é registrado em nosso banco de dados e disparado instantaneamente para o e-mail da administração.
            </p>
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Anonimato Garantido
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Suporte em até 24h
              </div>
            </div>
          </Card>
        </div>

        {/* Formulário Principal */}
        <Card className="lg:col-span-3 rounded-[32px] border-border/40 bg-card p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assunto</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border shadow-2xl rounded-2xl">
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="font-bold py-3 uppercase text-[10px] tracking-widest cursor-pointer">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mensagem</Label>
            <Textarea 
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva sua experiência ou problema aqui..."
              className="min-h-[200px] rounded-2xl bg-muted/20 border-border/40 font-medium p-5 resize-none leading-relaxed focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between p-5 bg-primary/5 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Enviar Anonimamente</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Seu e-mail não será revelado</p>
              </div>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting || !message.trim()} 
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground shadow-xl shadow-primary/20 active:scale-95 transition-all"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Despachar Agora</>}
          </Button>
        </Card>
      </div>
      
      <div className="pb-24" />
    </div>
  );
}
