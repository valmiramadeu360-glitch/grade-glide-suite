import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, Shield, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    codename: string;
    is_anonymous: boolean;
    full_name: string;
  };
}

export function DisciplineCommunity({ disciplineCode, disciplineName }: { disciplineCode: string | null, disciplineName: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disciplineCode && user) {
      loadMessages();
      
      // Inscreve-se em tempo real para novas mensagens no canal da turma
      const channel = supabase
        .channel(`public:discipline_community_messages:code=eq.${disciplineCode}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'discipline_community_messages',
          filter: `discipline_code=eq.${disciplineCode}`
        }, async (payload) => {
          // Busca os dados do perfil de quem mandou
          const { data: profileData } = await supabase
            .from('profiles')
            .select('codename, is_anonymous, full_name')
            .eq('user_id', payload.new.user_id)
            .single();

          const incomingMsg = {
            ...payload.new,
            profiles: profileData
          } as Message;

          setMessages(prev => [...prev, incomingMsg]);
          scrollToBottom();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [disciplineCode, user]);

  async function loadMessages() {
    if (!disciplineCode) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("discipline_community_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles (
            codename,
            is_anonymous,
            full_name
          )
        `)
        .eq("discipline_code", disciplineCode)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages((data as any) || []);
      scrollToBottom();
    } catch (error: any) {
      console.error("Erro ao carregar mensagens da turma:", error.message);
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !disciplineCode || !user) return;

    const contentToSend = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      const { error } = await supabase.from("discipline_community_messages").insert({
        discipline_code: disciplineCode,
        user_id: user.id,
        content: contentToSend
      });

      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (!disciplineCode) {
    return (
      <Card className="rounded-2xl border-dashed border-border/50 bg-muted/10 p-8 text-center">
        <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs font-bold text-foreground">Código SIGA não cadastrado</p>
        <p className="text-[10px] text-muted-foreground mt-1">Adicione o código oficial desta disciplina para desbloquear o chat da turma.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-[28px] border border-border/30 bg-card shadow-sm flex flex-col h-[550px] overflow-hidden">
      
      {/* Header do Chat */}
      <div className="p-4 sm:p-5 border-b border-border/30 bg-muted/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-foreground">Comunidade da Turma ({disciplineCode})</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Conectado com todos os alunos cursando {disciplineName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
          <Sparkles className="h-3 w-3" /> Seguro por Codinome
        </div>
      </div>

      {/* Corpo das Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-bold text-foreground">Ainda não há mensagens nesta turma.</p>
            <p className="text-[10px] text-muted-foreground mt-1">Seja o primeiro calouro ou veterano a iniciar a conversa!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            const profile = msg.profiles;
            // Se modo anônimo estiver ativo, exibe o codinome. Caso contrário, exibe o nome real.
            const displayName = profile?.is_anonymous ? (profile?.codename || "Estudante Anônimo") : (profile?.full_name || "Estudante");

            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <span className="text-[9px] font-bold text-muted-foreground px-1 mb-0.5">
                  {displayName} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className={cn("p-3 rounded-2xl max-w-[80%] text-xs font-medium shadow-sm leading-relaxed", isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted/50 text-foreground border border-border/30 rounded-tl-none")}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Barra de Envio */}
      <form onSubmit={handleSendMessage} className="p-3 bg-muted/20 border-t border-border/30 flex items-center gap-2 shrink-0">
        <Input 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Envie uma dúvida ou dica para a turma..."
          className="h-11 rounded-xl bg-background border-border/40 text-xs font-medium shadow-inner focus-visible:ring-primary flex-1"
        />
        <Button type="submit" disabled={sending || !newMessage.trim()} className="h-11 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-sm shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}

