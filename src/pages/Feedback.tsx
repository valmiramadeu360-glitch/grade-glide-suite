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
      // Save to feedbacks table
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

      // Send email to admin via edge function
      // TODO: Web Push - notify admin of new feedback
      try {
        await supabase.functions.invoke("send-feedback-email", {
          body: {
            category: CATEGORIES.find(c => c.value === category)?.label ?? category,
            message: message.trim(),
            is_anonymous: isAnonymous,
            user_email: isAnonymous ? null : user?.email,
          },
        });
      } catch {
        // Email send failure is non-blocking
        console.warn("Feedback email dispatch failed, but data was saved.");
      }

      toast({
        title: "Obrigado pelo seu feedback! 💙",
        description: "Sua mensagem foi enviada à equipe do EduFlow.",
      });

      setMessage("");
      setCategory("improvement");
      setIsAnonymous(false);
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="min-h-14 min-w-14 h-14 w-14 rounded-full hover:bg-muted shrink-0"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Feedback & Suporte</h1>
          <p className="text-muted-foreground font-medium text-sm">Ajude-nos a melhorar o EduFlow</p>
        </div>
      </div>

      <Card className="glass-card border-none shadow-md overflow-hidden bg-card rounded-[32px]">
        <div className="h-1 w-full bg-primary/40" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Enviar Mensagem
          </CardTitle>
          <CardDescription className="text-xs">Escolha uma categoria e descreva sua experiência.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-border font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-popover border border-border shadow-xl">
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sua Mensagem</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Descreva sua sugestão, bug encontrado ou comentário..."
              className="min-h-[180px] bg-muted/30 focus:bg-background resize-none rounded-2xl text-base"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">Enviar Anônimo</p>
                <p className="text-[10px] text-muted-foreground uppercase">Seu nome e e-mail não serão incluídos</p>
              </div>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Enviar Feedback</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
