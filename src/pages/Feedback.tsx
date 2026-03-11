import { useState, useRef } from "react";
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
  ShieldCheck, Sparkles, AlertCircle, Image as ImageIcon, Video, X, Paperclip
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState("improvement");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para Mídia
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 50MB
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite de upload é de 50MB.", variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearFile() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!message.trim()) {
      toast({ title: "Mensagem vazia", description: "Por favor, descreva a situação antes de enviar.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      let mediaUrl: string | null = null;

      // 1. Upload da Mídia (Se houver)
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `feedbacks/${fileName}`; // Pasta organizada
        
        const { error: uploadError } = await supabase.storage.from('feedback_media').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('feedback_media').getPublicUrl(filePath);
        mediaUrl = publicUrlData.publicUrl;
      }

      // 2. Registro no Banco de Dados 
      const payload: any = {
        category,
        message: message.trim(),
        is_anonymous: isAnonymous,
        media_url: mediaUrl, // Novo campo
      };

      if (!isAnonymous && user) {
        payload.user_id = user.id;
        payload.email = user.email;
      }

      await supabase.from("feedbacks").insert(payload);

      // 3. Disparo de E-mail para Administração
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

          ${mediaUrl ? `\nANEXO (Print/Vídeo):\n${mediaUrl}` : '\nNenhum anexo enviado.'}
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
          title: "Recebemos sua mensagem! 🚀",
          description: "Nossa equipe já foi alertada e vai analisar o seu relato.",
        });
        // Reset Limpo
        setMessage("");
        setCategory("improvement");
        setIsAnonymous(false);
        clearFile();
      } else {
        throw new Error(result.message || "Erro no disparo do e-mail.");
      }
    } catch (error: any) {
      console.error("Erro no feedback:", error);
      toast({ 
        title: "Erro na conexão", 
        description: "Salvamos sua mensagem no servidor, mas o alerta por e-mail falhou. Nós leremos em breve.", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 px-4 sm:px-6 pb-24 sm:pb-32 overflow-x-hidden">
      
      {/* Header */}
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

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        
        {/* Painel Informativo */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[32px] border-border/40 bg-primary/5 p-8 sm:p-10 shadow-sm">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">Ajudar é construir</h3>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed mt-4">
              Encontrou um bug na tela? Quer sugerir uma funcionalidade matadora? Use este canal. Envie prints ou vídeos para facilitar o nosso trabalho de correção!
            </p>
            
            <div className="pt-8 space-y-5">
              <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border border-border/50 shadow-sm">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Anonimato Garantido</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Sua privacidade intacta</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-background p-4 rounded-2xl border border-border/50 shadow-sm">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Upload de Mídia</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">Envie fotos ou vídeos do erro</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Formulário de Envio */}
        <Card className="lg:col-span-3 rounded-[32px] border-border/40 bg-card p-6 sm:p-10 shadow-2xl">
          <div className="space-y-8">
            
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assunto do Relato</Label>
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

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Detalhes do Relato</Label>
              <Textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Ex: Quando eu tento abrir a tela de resumos, a tela fica em branco..."
                className="min-h-[160px] sm:min-h-[200px] rounded-[24px] bg-muted/30 border-border/40 font-medium text-sm sm:text-base p-6 resize-none leading-relaxed focus:ring-primary/40 focus:bg-background transition-colors"
              />
            </div>

            {/* ÁREA DE ANEXO LIMPA E MODERNA */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <Paperclip className="h-3 w-3" /> Anexo (Opcional)
              </Label>
              
              <input type="file" id="feedback-media" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} ref={fileInputRef} />
              
              {!previewUrl ? (
                <div 
                  onClick={() => document.getElementById('feedback-media')?.click()}
                  className="w-full h-24 border-2 border-dashed border-border/50 rounded-[20px] bg-muted/10 hover:bg-muted/30 flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
                  <div className="flex gap-3 text-muted-foreground mb-1">
                    <ImageIcon className="h-5 w-5" />
                    <Video className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Toque para anexar print ou vídeo</p>
                </div>
              ) : (
                <div className="relative w-full rounded-[24px] overflow-hidden border border-border/50 bg-muted/20">
                  <Button size="icon" variant="destructive" className="absolute top-3 right-3 h-10 w-10 rounded-xl z-10 shadow-lg hover:scale-105 transition-transform" onClick={clearFile}>
                    <X className="h-5 w-5" />
                  </Button>
                  {selectedFile?.type.startsWith('video/') ? (
                    <video src={previewUrl} controls className="w-full max-h-[300px] object-contain bg-black" />
                  ) : (
                    <img src={previewUrl} alt="Pré-visualização" className="w-full max-h-[300px] object-contain" />
                  )}
                  <div className="absolute bottom-0 w-full bg-background/80 backdrop-blur-md p-3 border-t border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-widest truncate">{selectedFile?.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Anonimato e Botão */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-5 bg-primary/5 rounded-2xl border border-primary/20 transition-colors hover:bg-primary/10 cursor-pointer" onClick={() => setIsAnonymous(!isAnonymous)}>
                <div className="flex items-center gap-4">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center transition-colors", isAnonymous ? 'bg-primary/20' : 'bg-muted/50')}>
                    <ShieldCheck className={cn("h-5 w-5 transition-colors", isAnonymous ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-foreground">Enviar Anonimamente</p>
                  </div>
                </div>
                <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} className="data-[state=checked]:bg-primary" />
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !message.trim()} 
                className="w-full h-16 rounded-[24px] font-black uppercase tracking-widest text-xs sm:text-sm bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:-translate-y-1 active:scale-95 transition-all"
              >
                {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Send className="mr-3 h-5 w-5" /> Despachar Relato</>}
              </Button>
            </div>

          </div>
        </Card>
      </div>
    </div>
  );
}

