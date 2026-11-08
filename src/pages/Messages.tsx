import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Send, Loader2, ArrowLeft, Search, MoreVertical, Users, Phone, Paperclip, Mic, Trash2, Lock, ShoppingBag, ShieldAlert
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VoiceNote } from "@/components/chat/VoiceNote";
import { useCommunities } from "@/hooks/useCommunities";
import { Link, useSearchParams } from "react-router-dom";
import { checkCanMessageUser, DMPermissionCheck } from "@/lib/messagePrivacy";

// Supabase ainda não gerou os tipos da view public_profiles nem das tabelas
// novas do Marketplace — o cast evita erro de build até o types.ts ser atualizado.
const db = supabase as any;

/**
 * Busca nome/foto/curso de um grupo de usuários respeitando a privacidade
 * (usa a view public_profiles, não a tabela profiles — ver EduFlow BUG-02).
 * Quem está com o perfil marcado como privado não aparece aqui.
 */
async function fetchPublicProfiles(
  userIds: string[],
): Promise<Map<string, { full_name: string | null; avatar_url: string | null; course: string | null }>> {
  const map = new Map<string, { full_name: string | null; avatar_url: string | null; course: string | null }>();
  if (userIds.length === 0) return map;

  const { data: profiles } = await db
    .from("public_profiles")
    .select("user_id, display_name, avatar_url, course_id")
    .in("user_id", userIds);

  const courseIds = [...new Set((profiles ?? []).map((p: any) => p.course_id).filter(Boolean))];
  const courseNames = new Map<string, string>();
  if (courseIds.length > 0) {
    const { data: courses } = await db.from("courses").select("id, name").in("id", courseIds);
    for (const c of courses ?? []) courseNames.set(c.id, c.name);
  }

  for (const p of profiles ?? []) {
    map.set(p.user_id, {
      full_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      course: p.course_id ? courseNames.get(p.course_id) ?? null : null,
    });
  }
  return map;
}

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
  audio_url?: string | null;
  audio_duration?: number | null;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"private" | "communities">("private");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  // Controle de privacidade e contexto Marketplace
  const [permissionCheck, setPermissionCheck] = useState<DMPermissionCheck | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(false);
  const [isMarketplaceContext, setIsMarketplaceContext] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ user_id: string; full_name: string | null; avatar_url: string | null; course: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfile, setSelectedProfile] = useState<{ full_name: string | null; avatar_url: string | null; course: string | null } | null>(null);

  // Nota de voz
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const secondsRef = useRef(0);

  const { communities, loading: loadingCommunities } = useCommunities();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Chegada vinda do Marketplace ("Falar com o vendedor"):
  useEffect(() => {
    const to = searchParams.get("to");
    if (!to || !user || to === user.id) return;
    const text = searchParams.get("text");
    const listingTitle = searchParams.get("listing");
    const prefill = text ?? (listingTitle ? `Olá! Vi seu anúncio "${listingTitle}" no Marketplace e queria saber mais.` : undefined);
    
    // Marca contexto de marketplace para liberar envio mesmo com privacidade restrita
    openConversation(to, prefill, true);
    setSearchParams({}, { replace: true });
  }, [searchParams, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket em tempo real
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dm-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new as Message;
        
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          if (selectedUserId && (msg.sender_id === selectedUserId || msg.receiver_id === selectedUserId)) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (msg.receiver_id === user.id) {
              supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id).then();
            }
          }
          loadConversations();
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
      const profileMap = await fetchPublicProfiles(partnerIds);

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

  async function openConversation(userId: string, prefill?: string, isMarketplace = false) {
    if (!user) return;
    setSelectedUserId(userId);
    setLoadingMessages(true);
    setCheckingPermission(true);
    setIsMarketplaceContext(isMarketplace);
    setSearchQuery("");
    setSearchResults([]);
    if (prefill) setNewMessage(prefill);

    // Validação da privacidade (Instagram rules + Marketplace exception)
    const check = await checkCanMessageUser(user.id, userId, isMarketplace);
    setPermissionCheck(check);
    setCheckingPermission(false);

    const conv = conversations.find(c => c.user_id === userId);
    if (conv) {
      setSelectedProfile({ full_name: conv.full_name, avatar_url: conv.avatar_url, course: conv.course });
    } else {
      const profile = (await fetchPublicProfiles([userId])).get(userId);
      if (profile) setSelectedProfile(profile);
    }

    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    setMessages(data ?? []);
    setLoadingMessages(false);

    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", userId)
      .eq("receiver_id", user.id)
      .is("read_at", null);
      
    setConversations(prev => prev.map(c => c.user_id === userId ? { ...c, unread_count: 0 } : c));
  }

  async function handleSend() {
    const text = newMessage.trim();
    if (!text || !selectedUserId || !user) return;

    // Bloqueia caso as regras de privacidade não permitam
    if (permissionCheck && !permissionCheck.allowed) {
      toast({
        title: "Mensagem não permitida",
        description: permissionCheck.message || "Este perfil possui restrições para recebimento de mensagens.",
        variant: "destructive"
      });
      return;
    }
    
    setNewMessage("");

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: text,
    });

    if (error) {
      toast({ title: "Falha na conexão", description: "A mensagem não foi enviada.", variant: "destructive" });
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    
    const { data } = await db
      .from("public_profiles")
      .select("user_id, display_name, avatar_url, course_id")
      .neq("user_id", user!.id)
      .ilike("display_name", `%${query}%`)
      .limit(10);

    const rows = data ?? [];
    const courseIds = [...new Set(rows.map((p: any) => p.course_id).filter(Boolean))];
    const courseNames = new Map<string, string>();
    if (courseIds.length > 0) {
      const { data: courses } = await db.from("courses").select("id, name").in("id", courseIds);
      for (const c of courses ?? []) courseNames.set(c.id, c.name);
    }

    setSearchResults(
      rows.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        course: p.course_id ? courseNames.get(p.course_id) ?? null : null,
      })),
    );
    setSearching(false);
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    if (permissionCheck && !permissionCheck.allowed) {
      toast({
        title: "Envio bloqueado",
        description: permissionCheck.message || "Restrição de privacidade para este destinatário.",
        variant: "destructive"
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: "Microfone indisponível", description: "Seu dispositivo não permite gravação de áudio.", variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        stopTimer();
        const seconds = secondsRef.current;
        setRecording(false);
        setRecordSeconds(0);
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        await uploadVoiceNote(blob, seconds);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      secondsRef.current = 0;
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setRecordSeconds(secondsRef.current);
      }, 1000);
    } catch {
      toast({ title: "Permissão negada", description: "Autorize o acesso ao microfone para enviar notas de voz.", variant: "destructive" });
    }
  }

  function stopRecording(cancel = false) {
    cancelledRef.current = cancel;
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  async function uploadVoiceNote(blob: Blob, seconds: number) {
    if (!user || !selectedUserId) return;
    setSendingAudio(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("chat-audio")
        .upload(path, blob, { contentType: blob.type || "audio/webm" });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        receiver_id: selectedUserId,
        content: "🎤 Nota de voz",
        audio_url: path,
        audio_duration: seconds,
      });
      if (error) throw error;
    } catch {
      toast({ title: "Falha ao enviar", description: "A nota de voz não foi enviada.", variant: "destructive" });
    } finally {
      setSendingAudio(false);
    }
  }

  function formatRecordTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ================== TELA DE CONVERSA ABERTA ==================
  if (selectedUserId) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100dvh-6rem)] animate-in fade-in slide-in-from-right-8 duration-300 bg-background sm:rounded-[32px] sm:border sm:border-border/40 sm:shadow-2xl sm:mt-6 overflow-hidden relative">
        
        {/* Header Elegante */}
        <header className="flex items-center justify-between p-4 sm:px-6 bg-card/90 backdrop-blur-2xl border-b border-border/50 z-20 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 bg-muted/40 hover:bg-muted transition-colors shrink-0" onClick={() => setSelectedUserId(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3 cursor-pointer group rounded-2xl p-1.5 pr-4 hover:bg-muted/40 transition-colors">
              <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                <AvatarImage src={selectedProfile?.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-black">{selectedProfile?.full_name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-base font-black text-foreground truncate group-hover:text-primary transition-colors leading-none">
                  {selectedProfile?.full_name || "Estudante"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate mt-1">
                  {selectedProfile?.course || "Comunidade"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:bg-muted/50 hidden sm:flex" title="Chamada de Áudio (Em breve)">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:bg-muted/50">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Banner Informativo de Exceção do Marketplace */}
        {isMarketplaceContext && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-primary animate-in fade-in">
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span className="truncate">Negociação do Marketplace · Conversa liberada diretamente com o vendedor.</span>
          </div>
        )}

        {/* Área de Mensagens (WhatsApp Style) */}
        <ScrollArea className="flex-1 px-4 sm:px-6 py-6 bg-muted/10 relative" id="chat-container">
          {loadingMessages ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50 absolute inset-0">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center"><MessageSquare className="h-8 w-8 text-muted-foreground" /></div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center">A conversa está vazia</p>
            </div>
          ) : (
            <div className="space-y-4 pb-2 flex flex-col justify-end min-h-full">
              {messages.map((msg, index) => {
                const isMe = msg.sender_id === user!.id;
                const showTime = index === 0 || new Date(msg.created_at).getMinutes() !== new Date(messages[index - 1].created_at).getMinutes();

                return (
                  <div key={msg.id} className={cn("flex flex-col animate-in slide-in-from-bottom-2", isMe ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[85%] sm:max-w-[70%] px-5 py-3 text-[15px] font-medium leading-relaxed relative shadow-[0_2px_10px_rgb(0,0,0,0.04)]",
                      isMe 
                        ? "bg-primary text-primary-foreground rounded-[24px] rounded-br-[8px]" 
                        : "bg-card border border-border/40 text-foreground rounded-[24px] rounded-bl-[8px]"
                    )}>
                      {msg.audio_url ? (
                        <VoiceNote path={msg.audio_url} duration={msg.audio_duration} mine={isMe} />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                    </div>
                    {showTime && (
                      <span className="text-[9px] font-bold text-muted-foreground/60 mt-1 mx-2 uppercase tracking-widest">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </ScrollArea>

        {/* Input Area ou Card de Restrição de Privacidade */}
        {checkingPermission ? (
          <div className="p-4 bg-card/90 border-t border-border/50 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Verificando permissões de contato...
          </div>
        ) : permissionCheck && !permissionCheck.allowed ? (
          /* Bloqueio por Privacidade (estilo Instagram) */
          <div className="p-5 bg-card/95 backdrop-blur-2xl border-t border-border/50 shrink-0 text-center flex flex-col items-center gap-2 animate-in fade-in">
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-1">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-foreground max-w-md">
              {permissionCheck.message}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Para interagir com este perfil, passe a segui-lo ou aguarde que ele inicie uma conversa com você.
            </p>
          </div>
        ) : (
          /* Barra de Input Padrão Liberada */
          <div className="p-3 sm:p-5 bg-card/90 backdrop-blur-2xl border-t border-border/50 shrink-0">
            {recording ? (
              <div className="flex items-center gap-3 bg-destructive/10 p-2 pl-5 rounded-[28px] border border-destructive/30 animate-in fade-in">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
                <p className="flex-1 text-sm font-black text-destructive tabular-nums">
                  Gravando… {formatRecordTime(recordSeconds)}
                </p>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive" onClick={() => stopRecording(true)} title="Descartar">
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button size="icon" className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-md" onClick={() => stopRecording(false)} title="Enviar nota de voz">
                  <Send className="h-5 w-5 ml-0.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2 bg-muted/40 p-1.5 rounded-[28px] border border-border/50 focus-within:border-primary/40 focus-within:bg-background transition-all shadow-sm">
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full shrink-0 mb-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors" title="Anexar arquivo">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="min-h-[44px] max-h-[120px] bg-transparent border-none shadow-none focus-visible:ring-0 text-base resize-none py-3 px-2 font-medium"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                {newMessage.trim() ? (
                  <Button 
                    onClick={handleSend} 
                    size="icon" 
                    className="h-12 w-12 rounded-full shrink-0 mb-0.5 mr-0.5 transition-all duration-300 shadow-md bg-primary text-primary-foreground hover:scale-105"
                  >
                    <Send className="h-5 w-5 ml-0.5" />
                  </Button>
                ) : (
                  <Button
                    onClick={startRecording}
                    disabled={sendingAudio}
                    size="icon"
                    title="Gravar nota de voz"
                    className="h-12 w-12 rounded-full shrink-0 mb-0.5 mr-0.5 transition-all duration-300 shadow-md bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {sendingAudio ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ================== TELA DE LISTA DE CONTATOS E COMUNIDADES ==================
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 pt-4 sm:pt-8">
      
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Chat</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Networking & Grupos</p>
        </div>
      </header>

      {/* Navegação: Conversas vs Comunidades */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="w-full rounded-[24px] bg-muted/40 p-1.5 flex shadow-inner">
          <TabsTrigger value="private" className="flex-1 rounded-[20px] font-bold text-sm h-11 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all">
            <MessageSquare className="h-4 w-4 hidden sm:block" /> Conversas
          </TabsTrigger>
          <TabsTrigger value="communities" className="flex-1 rounded-[20px] font-bold text-sm h-11 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all">
            <Users className="h-4 w-4 hidden sm:block" /> Comunidades
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "private" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Barra de Busca */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Pesquisar estudantes ou professores..."
              className="pl-14 h-14 rounded-[24px] bg-card border-border/40 shadow-sm text-base font-medium focus-visible:ring-primary transition-all"
            />
          </div>

          {/* Resultados da Busca */}
          {searchResults.length > 0 && (
            <Card className="rounded-[28px] border-border/30 shadow-xl overflow-hidden animate-in slide-in-from-top-2 bg-card">
              <div className="bg-muted/20 px-5 py-3 border-b border-border/20 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultados da Busca</p>
                <Badge variant="secondary" className="rounded-lg">{searchResults.length}</Badge>
              </div>
              <CardContent className="p-3 space-y-1 max-h-[350px] overflow-y-auto custom-scrollbar">
                {searchResults.map(p => (
                  <button
                    key={p.user_id}
                    onClick={() => openConversation(p.user_id)}
                    className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 transition-colors text-left group"
                  >
                    <Avatar className="h-12 w-12 border border-border/40 shadow-sm group-hover:scale-105 transition-transform">
                      <AvatarImage src={p.avatar_url || ""} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary font-black">{p.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-foreground truncate group-hover:text-primary transition-colors">{p.full_name || "Estudante"}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate mt-0.5">{p.course || "Usuário da Rede"}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Histórico Recente */}
          {!searchQuery && (
            <div className="space-y-4 pt-2">
              {conversations.length > 0 && (
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-3">Histórico Recente</p>
              )}
              
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/10 rounded-[32px] border-2 border-dashed border-border/40 shadow-sm">
                  <div className="h-16 w-16 bg-card rounded-full flex items-center justify-center shadow-sm"><Search className="h-8 w-8 text-muted-foreground/50" /></div>
                  <div className="text-center px-6">
                    <p className="text-base font-black text-foreground">Sua caixa de entrada está limpa.</p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Pesquise por alguém acima para iniciar uma conversa ou tirar uma dúvida.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map(conv => (
                    <Card 
                      key={conv.user_id} 
                      className={cn("rounded-[28px] border-0 shadow-sm transition-all cursor-pointer overflow-hidden group", conv.unread_count > 0 ? "bg-primary/5 hover:bg-primary/10 border border-primary/20" : "bg-card hover:shadow-md hover:border-border/50")}
                      onClick={() => openConversation(conv.user_id)}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                        <div className="relative shrink-0">
                          <Avatar className="h-14 w-14 border border-border/40 shadow-sm group-hover:scale-105 transition-transform">
                            <AvatarImage src={conv.avatar_url || ""} className="object-cover" />
                            <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">{(conv.full_name || "U").charAt(0)}</AvatarFallback>
                          </Avatar>
                          {conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center px-1.5 shadow-md border-2 border-background">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center justify-between mb-1">
                            <p className={cn("text-base truncate transition-colors", conv.unread_count > 0 ? "font-black text-foreground" : "font-bold text-foreground")}>
                              {conv.full_name || "Estudante"}
                            </p>
                            <p className={cn("text-[10px] font-bold uppercase tracking-widest shrink-0 ml-3", conv.unread_count > 0 ? "text-primary" : "text-muted-foreground")}>
                              {formatDistanceToNow(new Date(conv.last_message_at), { locale: ptBR }).replace("aproximadamente ", "")}
                            </p>
                          </div>
                          <p className={cn("text-sm truncate", conv.unread_count > 0 ? "font-bold text-foreground" : "font-medium text-muted-foreground/80")}>
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
      )}

      {/* Aba de Comunidades */}
      {activeTab === "communities" && (
        <div className="space-y-2 animate-in fade-in">
          {loadingCommunities ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : communities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 bg-muted/10 rounded-[32px] border-2 border-dashed border-border/40 shadow-sm">
              <div className="h-16 w-16 bg-card rounded-full flex items-center justify-center shadow-sm"><Users className="h-8 w-8 text-muted-foreground/50" /></div>
              <div className="text-center px-6">
                <p className="text-base font-black text-foreground">Nenhuma comunidade ainda.</p>
                <p className="text-sm font-medium text-muted-foreground mt-1 max-w-sm">Complete seu perfil acadêmico para entrar automaticamente nos grupos da sua universidade, campus, curso e período.</p>
              </div>
            </div>
          ) : (
            communities.map(c => (
              <Link key={c.id} to={`/community/${c.id}`} className="block">
                <Card className="rounded-[28px] border-0 shadow-sm bg-card hover:shadow-md transition-all group">
                  <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
                        {c.member_count} integrantes · {c.description || "Comunidade acadêmica"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
