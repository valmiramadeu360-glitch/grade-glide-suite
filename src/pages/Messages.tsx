import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, Send, Loader2, User, ArrowLeft, Search, MoreVertical
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface Conversation {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  course: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ user_id: string; full_name: string | null; avatar_url: string | null; course: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfile, setSelectedProfile] = useState<{ full_name: string | null; avatar_url: string | null; course: string | null } | null>(null);

  // Carrega contatos na inicialização
  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket (Ouvido em Tempo Real para novas mensagens)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dm-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new as Message;
        
        // Se a mensagem for pra mim ou de mim
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          
          // Se eu estiver com a conversa aberta, adiciono a mensagem na tela e marco como lida
          if (selectedUserId && (msg.sender_id === selectedUserId || msg.receiver_id === selectedUserId)) {
            // Evita duplicação por causa da atualização otimista
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            
            // Marca como lida silenciosamente se eu recebi
            if (msg.receiver_id === user.id) {
              supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
            }
          }
          
          loadConversations(); // Atualiza a lista por trás
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUserId]);

  async function loadConversations() {
    if (!user) return;
    try {
      const { data: allMessages } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!allMessages || allMessages.length === 0) {
        setConversations([]);
        return;
      }

      const convMap = new Map<string, { last_message: string; last_message_at: string; unread_count: number }>();
      for (const msg of allMessages) {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            last_message: msg.content,
            last_message_at: msg.created_at,
            unread_count: 0,
          });
        }
        if (msg.receiver_id === user.id && !msg.read_at) {
          const entry = convMap.get(partnerId)!;
          entry.unread_count++;
        }
      }

      const partnerIds = Array.from(convMap.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, course")
        .in("user_id", partnerIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      const convs: Conversation[] = partnerIds.map(pid => {
        const conv = convMap.get(pid)!;
        const profile = profileMap.get(pid);
        return {
          user_id: pid,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          course: profile?.course ?? null,
          ...conv,
        };
      });

      convs.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      setConversations(convs);
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(userId: string) {
    setSelectedUserId(userId);
    setLoadingMessages(true);
    setSearchQuery(""); // Limpa a busca ao abrir
    setSearchResults([]);

    // Busca o perfil da pessoa
    const conv = conversations.find(c => c.user_id === userId);
    if (conv) {
      setSelectedProfile({ full_name: conv.full_name, avatar_url: conv.avatar_url, course: conv.course });
    } else {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url, course").eq("user_id", userId).single();
      if (data) setSelectedProfile(data as any);
    }

    // Carrega Histórico
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user!.id})`)
      .order("created_at", { ascending: true });

    setMessages(data ?? []);
    setLoadingMessages(false);

    // CORE BUG FIX: Zera as mensagens não lidas
    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", userId)
      .eq("receiver_id", user!.id)
      .is("read_at", null);
      
    // Remove o balãozinho da lista lateral na hora
    setConversations(prev => prev.map(c => c.user_id === userId ? { ...c, unread_count: 0 } : c));
  }

  // CORE BUG FIX: Atualização Otimista (Zero Delay)
  async function handleSend() {
    const text = newMessage.trim();
    if (!text || !selectedUserId || !user) return;
    
    setNewMessage(""); // Limpa o input na hora pra não dar tela branca

    // 1. Cria a mensagem falsa na tela (Atualização Otimista)
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    // 2. Envia pro banco em Background (sem travar a tela)
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: text,
    });

    if (error) {
      // Se falhar, avisa e tira a mensagem falsa da tela
      toast({ title: "Falha na conexão", description: "A mensagem não foi enviada.", variant: "destructive" });
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, course")
      .neq("user_id", user!.id)
      .ilike("full_name", `%${query}%`)
      .limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // ================== TELA DE CONVERSA ABERTA ==================
  if (selectedUserId) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-6rem)] animate-in fade-in slide-in-from-right-4 duration-300 bg-background sm:rounded-[32px] sm:border sm:border-border/40 sm:shadow-2xl sm:mt-6 overflow-hidden">
        
        {/* Header Elegante */}
        <header className="flex items-center justify-between p-4 bg-card/80 backdrop-blur-xl border-b border-border/50 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-muted" onClick={() => setSelectedUserId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {/* Clicar aqui poderia abrir o Perfil do usuário depois */}
            <div className="flex items-center gap-3 cursor-pointer group rounded-xl p-1 pr-3 hover:bg-muted/50 transition-colors">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={selectedProfile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-black">{selectedProfile?.full_name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">
                  {selectedProfile?.full_name || "Estudante"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{selectedProfile?.course || "Comunidade"}</p>
              </div>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </header>

        {/* Área de Mensagens (WhatsApp Style) */}
        <ScrollArea className="flex-1 p-4 bg-muted/10" id="chat-container">
          {loadingMessages ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center">Inicie uma nova conversa</p>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((msg, index) => {
                const isMe = msg.sender_id === user!.id;
                // Lógica simples para não repetir a data toda hora se for no mesmo minuto
                const showTime = index === 0 || new Date(msg.created_at).getMinutes() !== new Date(messages[index - 1].created_at).getMinutes();

                return (
                  <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[80%] sm:max-w-[70%] px-4 py-2.5 shadow-sm text-[15px] font-medium leading-relaxed relative",
                      isMe 
                        ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-sm" 
                        : "bg-card border border-border/50 text-foreground rounded-[20px] rounded-bl-sm"
                    )}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    {showTime && (
                      <span className="text-[9px] font-bold text-muted-foreground mt-1 mx-1">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 sm:p-4 bg-card border-t border-border/50">
          <div className="flex items-end gap-2 bg-muted/30 p-1.5 rounded-[24px] border border-border/40 focus-within:border-primary/30 transition-colors">
            <Textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="min-h-[44px] max-h-[120px] bg-transparent border-none shadow-none focus-visible:ring-0 text-base resize-none py-3 px-4"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button 
              onClick={handleSend} 
              disabled={!newMessage.trim()} 
              size="icon" 
              className={cn("h-12 w-12 rounded-full shrink-0 mb-0.5 mr-0.5 transition-transform", newMessage.trim() ? "bg-primary text-primary-foreground shadow-md hover:scale-105" : "bg-muted text-muted-foreground")}
            >
              <Send className="h-5 w-5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ================== TELA DE LISTA DE CONTATOS ==================
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 px-4 sm:px-6 pt-6">
      
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Direct</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Networking Acadêmico</p>
            </div>
          </div>
        </div>
      </header>

      {/* Barra de Busca Premium */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Pesquisar contatos..."
          className="pl-12 h-14 rounded-[20px] bg-card border-border/50 shadow-sm text-base font-medium focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Resultados da Busca (Overlay) */}
      {searchResults.length > 0 && (
        <Card className="rounded-[24px] border-border/50 shadow-xl overflow-hidden animate-in slide-in-from-top-2">
          <div className="bg-muted/30 px-4 py-2 border-b border-border/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultados da Busca</p>
          </div>
          <CardContent className="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
            {searchResults.map(p => (
              <button
                key={p.user_id}
                onClick={() => openConversation(p.user_id)}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={p.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black">{p.full_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">{p.full_name || "Estudante"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{p.course || "Comunidade"}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lista de Conversas Recentes */}
      {!searchQuery && (
        <div className="space-y-4 pt-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Mensagens Recentes</p>
          
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 bg-card/30 rounded-[32px] border-2 border-dashed border-border/40">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-xs font-bold text-muted-foreground text-center px-4">Busque por um nome acima para iniciar um chat.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {conversations.map(conv => (
                <Card 
                  key={conv.user_id} 
                  className="rounded-[24px] border-none bg-transparent hover:bg-card hover:shadow-md transition-all cursor-pointer overflow-hidden group" 
                  onClick={() => openConversation(conv.user_id)}
                >
                  <CardContent className="p-3 sm:p-4 flex items-center gap-4">
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border border-border/50 group-hover:scale-105 transition-transform">
                        <AvatarImage src={conv.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black">{(conv.full_name || "U").charAt(0)}</AvatarFallback>
                      </Avatar>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center px-1.5 shadow-sm border-2 border-background">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 border-b border-border/40 pb-4 pt-2 group-hover:border-transparent transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn("text-[15px] truncate transition-colors", conv.unread_count > 0 ? "font-black text-foreground" : "font-bold text-foreground/80")}>
                          {conv.full_name || "Estudante"}
                        </p>
                        <p className={cn("text-[10px] font-bold shrink-0 ml-2", conv.unread_count > 0 ? "text-primary" : "text-muted-foreground")}>
                          {formatDistanceToNow(new Date(conv.last_message_at), { locale: ptBR }).replace("aproximadamente ", "")}
                        </p>
                      </div>
                      <p className={cn("text-sm truncate", conv.unread_count > 0 ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                        {conv.last_message}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
