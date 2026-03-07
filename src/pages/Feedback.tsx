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
  ShieldCheck, Heart, AlertCircle, Sparkles,
  HelpCircle
} from "lucide-react";

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
      toast({ title: "Mensagem vazia", description: "Por favor, descreva seu feedback.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // 1. Registro no Banco (Backup de Segurança)
      const payload: any = {
        category,
        message: message.trim(),
        is_anonymous: isAnonymous,
      };

      if (!isAnonymous && user) {
        payload.user_id = user.id;
        payload.email = user.email;
      }

      const { error: dbError } = await supabase.from("feedbacks").insert(payload);
      if (dbError) throw dbError;

      // 2. Envio de E-mail via Web3Forms (Formatado para BI)
      const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
      
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: "403d59d2-6728-40be-a5a2-c35bd6fe8afd",
          subject: `EduFlow 2.0: Novo Feedback [${categoryLabel}]`,
          from_name: isAnonymous ? "Estudante Anônimo" : (user?.email?.split('@')[0] || "Usuário EduFlow"),
          // O campo 'email' aqui serve para você poder responder ao aluno se não for anônimo
          email: isAnonymous ? "noreply@eduflow.com" : user?.email,
          message: `
ID CATEGORIA: ${category}
MODO ANÔNIMO: ${isAnonymous ? "SIM" : "NÃO"}
--------------------------------------------------
CONTEÚDO DO FEEDBACK:
${message.trim()}
--------------------------------------------------
Enviado via Central de Suporte EduFlow Academy.
          `,
        }),
      });

      const result = await response.json();

      if (!result.success) throw new Error("O servidor de e-mail rejeitou o envio.");

      toast({
        title: "Mensagem entregue!",
        description: "Seu feedback foi enviado para a administração.",
      });

      setMessage("");
      setCategory("improvement");
      setIsAnonymous(false);
    } catch (error: any) {
      toast({ 
        title: "Erro no envio", 
        description: "Salvamos no banco, mas o e-mail falhou. Verifique sua chave Web3Forms.", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-safe px-4 sm:px-6">
      
      {/* Header BI-Style */}
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Contato direto com a administração</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        
        {/* Lado Esquerdo: Orientações */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[32px] border-border/40 bg-primary/5 p-8 space-y-4">
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Como ajudamos?
            </h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Sua opinião molda o futuro do <strong>EduFlow Academy</strong>. Relate falhas técnicas ou sugira funcionalidades que facilitariam sua jornada acadêmica.
            </p>
            <ul className="space-y-3 pt-2">
              {[
                { icon: AlertCircle, text: "Bugs são resolvidos em até 24h", color: "text-amber-500" },
                { icon: Heart, text: "Elogios motivam nossa equipe", color: "text-rose-500" },
                { icon: HelpCircle, text: "Dúvidas técnicas via e-mail", color: "text-primary" }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                  <item.icon className={cn("h-4 w-4", item.color)} /> {item.text}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Lado Direito: Formulário */}
        <Card className="lg:col-span-3 rounded-[32px] border-border/40 bg-card p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assunto do Feedback</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold">
                <SelectValue />
              </SelectTrigger>
              {/* BUG FIX: bg-card sólido para evitar transparência no Select */}
              <SelectContent className="bg-card border-border shadow-2xl rounded-2xl">
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="font-bold py-3 uppercase text-[10px] tracking-widest">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sua Mensagem</Label>
            <Textarea 
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva detalhadamente..."
              className="min-h-[180px] rounded-2xl bg-muted/20 border-border/40 font-medium p-5 resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between p-5 bg-primary/5 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Enviar Anonimamente</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Ocultar meu e-mail e ID</p>
              </div>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting || !message.trim()} 
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground shadow-xl shadow-primary/20 active:scale-95 transition-all"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Despachar Feedback</>}
          </Button>
        </Card>
      </div>

      {/* iOS Safe Area Bottom */}
      <div className="pb-24" />
    </div>
  );
}
