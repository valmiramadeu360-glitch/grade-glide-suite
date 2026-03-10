import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Send, Loader2, 
  ShieldCheck, Sparkles, AlertCircle
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
      toast({ title: "Mensagem vazia", description: "Por favor, digite seu feedback antes de enviar.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // 1. Registro no Banco de Dados (Backup local do Supabase)
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

      // 2. Envio de E-mail via Web3Forms (A chave já está configurada para seu e-mail)
      const categoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? category;
      
      const emailPayload = {
        access_key: "403d59d2-6728-40be-a5a2-c35bd6fe8afd",
        subject: `[EduFlow] Novo Feedback: ${categoryLabel}`,
        from_name: "EduFlow Academy App",
        name: isAnonymous ? "Estudante Anônimo" : (user?.email?.split('@')[0] || "Usuário Identificado"),
        email: isAnonymous ? "no-reply@eduflow.com" : user?.email,
        message: `
          NOVO FEEDBACK RECEBIDO VIA APP
          ------------------------------------------
          CATEGORIA: ${categoryLabel}
          ESTUDANTE: ${isAnonymous ? "Anônimo (Ocultou Identidade)" : user?.email}
          DATA/HORA: ${new Date().toLocaleString("pt-BR")}
          
          MENSAGEM DO USUÁRIO:
          ${message.trim()}
          ------------------------------------------
          Enviado através da Central de Apoio EduFlow 2.0
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
          title: "Feedback Enviado!",
          description: "Sua mensagem foi entregue à administração do EduFlow. Obrigado!",
        });
        // Limpa o formulário após o sucesso
        setMessage("");
        setCategory("improvement");
        setIsAnonymous(false);
      } else {
        throw new Error(result.message || "Erro de conexão com o servidor de e-mail.");
      }
    } catch (error: any) {
      console.error("Erro no feedback:", error);
      toast({ 
        title: "Erro no envio", 
        description: "Salvamos sua mensagem no banco local, mas o envio do alerta por e-mail falhou. Tente novamente mais tarde.", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 px-4 sm:px-6 pb-24 sm:pb-32 overflow-x-hidden">
      
      {/* Header Mobile-First */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-6">
        <div className="flex items-center gap-5 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-muted/30 hover:bg-muted border border-border/40 shrink-0 transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter truncate">
              Central de <span className="text-primary">Apoio</span>
            </h1>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1 truncate">
              SUA VOZ MELHORA NOSSA ARQUITETURA
            </p>
          </div>
        </div>
      </header>

      {/* Grid de Conteúdo Responsivo */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        
        {/* Painel Informativo Lateral */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[32px] border-border/40 bg-primary/5 p-8 sm:p-10 shadow-sm transition-all hover:shadow-md">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">Como Funciona?</h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed mt-4">
              Ao enviar um relato de problema ou sugestão, sua mensagem é registrada de forma segura em nosso banco de dados e um alerta imediato é disparado para o e-mail da nossa equipe de administração.
            </p>
            
            <div className="pt-8 space-y-5">
              <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border border-border/50">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Anonimato Garantido</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Oculte seus dados se preferir</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border border-border/50">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Análise Ágil</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Bugs são lidos em até 24h</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Formulário Principal de Envio */}
        <Card className="lg:col-span-3 rounded-[32px] border-border/40 bg-card p-6 sm:p-10 shadow-2xl">
          <div className="space-y-8">
            
            {/* Seletor de Categoria */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assunto do Contato</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-14 sm:h-16 rounded-2xl bg-muted/30 border-border/40 font-bold text-sm sm:text-base px-5 hover:bg-background transition-colors focus:ring-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border shadow-2xl rounded-2xl p-2">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="font-bold py-3 uppercase text-[10px] tracking-widest cursor-pointer rounded-xl hover:bg-muted">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Caixa de Texto da Mensagem */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Detalhes do Feedback</Label>
              <Textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Descreva detalhadamente sua experiência, sugestão de melhoria ou o bug que você encontrou..."
                className="min-h-[200px] sm:min-h-[250px] rounded-[24px] bg-muted/30 border-border/40 font-medium text-sm sm:text-base p-6 resize-none leading-relaxed focus:ring-primary/40 focus:bg-background transition-colors"
              />
              <p className="text-right text-[10px] font-bold text-muted-foreground/50">
                {message.length} caracteres
              </p>
            </div>

            {/* Controle de Anonimato */}
            <div className="flex items-center justify-between p-5 sm:p-6 bg-primary/5 rounded-2xl border border-primary/20 transition-colors hover:bg-primary/10 cursor-pointer" onClick={() => setIsAnonymous(!isAnonymous)}>
              <div className="flex items-center gap-4 sm:gap-5">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${isAnonymous ? 'bg-primary/20' : 'bg-muted/50'}`}>
                  <ShieldCheck className={`h-6 w-6 transition-colors ${isAnonymous ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Enviar Anonimamente</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1">
                    {isAnonymous ? "Sua identidade está protegida." : "Seu e-mail será enviado à equipe."}
                  </p>
                </div>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} className="data-[state=checked]:bg-primary" />
            </div>

            {/* Botão de Disparo */}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !message.trim()} 
              className="w-full h-16 sm:h-18 rounded-[24px] font-black uppercase tracking-widest text-xs sm:text-sm bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all mt-4"
            >
              {submitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Send className="mr-3 h-5 w-5" /> 
                  Despachar Feedback
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
