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
import { ArrowLeft, Send, Loader2, MessageSquare, ShieldCheck } from "lucide-react";

const CATEGORIES = [
  { value: "improvement", label: "Sugestão de Melhoria" },
  { value: "bug", label: "Relato de Bug" },
  { value: "criticism", label: "Crítica" },
  { value: "praise", label: "Elogio" },
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
      toast({ title: "Escreva sua mensagem", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // 1. Salva no banco de dados do Supabase (Histórico)
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

      // 2. Dispara o E-mail real via Web3Forms para o Administrador
      const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
      const userName = isAnonymous ? "Aluno Anônimo" : (user?.email || "Aluno EduFlow");
      
      const emailResponse = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          // IMPORTANTE: Cole a sua chave do Web3Forms aqui dentro das aspas!
          access_key: "COLE_SUA_CHAVE_AQUI", 
          subject: `EduFlow App - Novo Feedback: ${categoryLabel}`,
          from_name: "Sistema EduFlow",
          to: "eduflow.adm.academy@gmail.com",
          message: `
Você recebeu uma nova mensagem através do aplicativo EduFlow:

📝 Categoria: ${categoryLabel}
👤 Estudante: ${userName}
🔒 Anônimo: ${isAnonymous ? "Sim" : "Não"}

Mensagem:
-------------------------------------------
${message.trim()}
-------------------------------------------
          `,
        }),
      });

      const emailResult = await emailResponse.json();

      if (!emailResult.success) {
        throw new Error("Falha ao entregar o e-mail no servidor.");
      }

      toast({
        title: "Obrigado pelo seu feedback! 💙",
        description: "Sua mensagem foi entregue diretamente à administração do EduFlow.",
      });

      setMessage("");
      setCategory("improvement");
      setIsAnonymous(false);
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: "Sua mensagem foi salva, mas o e-mail falhou. Verifique a configuração.", variant: "destructive" });
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-4 sm:px-6">
      
      {/* Header Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted shrink-0 transition-all"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight truncate">
              Central de Apoio
            </h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm mt-1 uppercase tracking-wider">
              Feedback & Suporte EduFlow
            </p>
          </div>
        </div>
      </div>

      <Card className="glass-card border-none shadow-2xl overflow-hidden bg-card rounded-[32px]">
        <div className="h-2 w-full bg-primary/80" />
        <CardHeader className="pb-4 pt-8 px-6 sm:px-8">
          <CardTitle className="text-xl font-black flex items-center gap-3 text-foreground">
            <MessageSquare className="h-6 w-6 text-primary" /> Fale com a Administração
          </CardTitle>
          <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Escolha uma categoria e descreva sua experiência ou problema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2 px-6 sm:px-8 pb-8">
          
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assunto do Contato</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-14 rounded-2xl bg-background border border-border/50 font-bold text-foreground focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              {/* bg-popover sólido para corrigir o bug de transparência */}
              <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl">
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="font-medium cursor-pointer py-3">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sua Mensagem</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva sua sugestão, informe um erro que encontrou ou deixe seu comentário para a equipe..."
              className="min-h-[200px] bg-background border border-border/50 focus:ring-primary/20 resize-none rounded-2xl text-base p-4"
            />
          </div>

          <div className="flex items-center justify-between p-5 bg-background border border-border/50 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Modo Anônimo</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Seu e-mail será ocultado do envio</p>
              </div>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} className="data-[state=checked]:bg-primary" />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 mt-4 transition-all active:scale-[0.98]"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Enviar para a Equipe</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

