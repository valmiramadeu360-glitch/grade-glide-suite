import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, Send, Loader2, User, ArrowLeft, Search
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ user_id: string; full_name: string | null; avatar_url: string | null; course: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfile, setSelectedProfile] = useState<{ full_name: string | null; avatar_url: string | null; course: string | null } | null>(null);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dm-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          if (selectedUserId && (msg.sender_id === selectedUserId || msg.receiver_id === selectedUserId)) {
            setMessages(prev => [...prev, msg]);
          }
          loadConversations();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUserId]);

  async function loadConversations() {
    if (!user) return;
    setLoading(true);
    try {
      // Get all DMs involving the user
      const { data: allMessages } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!allMessages || allMessages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Group by conversation partner
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

      // Get profiles for all partners
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

    // Find profile
    const conv = conversations.find(c => c.user_id === userId);
    if (conv) {
      setSelectedProfile({ full_name: conv.full_name, avatar_url: conv.avatar_url, course: conv.course });
    } else {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url, course").eq("user_id", userId).single();
      setSelectedProfile(data);
    }

    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user!.id})`)
      .order("created_at", { ascending: true });

    setMessages(data ?? []);
    setLoadingMessages(false);

    // Mark as read
    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", userId)
      .eq("receiver_id", user!.id)
      .is("read_at", null);
  }

  async function handleSend() {
    if (!newMessage.trim() || !selectedUserId || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        receiver_id: selectedUserId,
        content: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
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

  // Chat view
  if (selectedUserId) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)] animate-in fade-in duration-500 px-4 sm:px-0 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/40">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectedUserId(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedProfile?.avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary"><User className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground truncate">{selectedProfile?.full_name || "Estudante"}</p>
            <p className="text-[10px] font-bold text-muted-foreground">{selectedProfile?.course || "Comunidade"}</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 py-4">
          {loadingMessages ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-bold text-muted-foreground">Inicie a conversa!</p>
            </div>
          ) : (
            <div className="space-y-3 px-1">
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.sender_id === user!.id ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] px-4 py-2.5 rounded-2xl text-sm",
                    msg.sender_id === user!.id
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={cn(
                      "text-[9px] mt-1 font-bold",
                      msg.sender_id === user!.id ? "text-primary-foreground/60" : "text-muted-foreground"
                    )}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2 pt-3 pb-4 border-t border-border/40">
          <Textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="min-h-[48px] max-h-[120px] rounded-2xl text-sm resize-none flex-1"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon" className="h-12 w-12 rounded-2xl shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // Conversations list
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-700 pb-24 px-4 sm:px-0 pt-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Mensagens</h1>
          <p className="text-sm font-medium text-muted-foreground">Chat privado com outros estudantes</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar estudante para conversar..."
          className="pl-10 rounded-2xl h-12"
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardContent className="p-2 space-y-1">
            {searchResults.map(p => (
              <button
                key={p.user_id}
                onClick={() => { setSearchQuery(""); setSearchResults([]); openConversation(p.user_id); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={p.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">{p.full_name || "Estudante"}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{p.course || "Comunidade"}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conversations */}
      {conversations.length === 0 && !searchQuery ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-bold text-muted-foreground text-center">Nenhuma conversa ainda. Busque um estudante acima!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => (
            <Card key={conv.user_id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openConversation(conv.user_id)}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={conv.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-foreground truncate">{conv.full_name || "Estudante"}</p>
                    <p className="text-[9px] font-bold text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 shrink-0 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center px-1.5">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
