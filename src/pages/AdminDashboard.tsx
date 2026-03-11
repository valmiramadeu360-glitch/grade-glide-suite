import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ShieldCheck, Users, MessageSquare, AlertTriangle, 
  Loader2, ArrowLeft, CheckCircle2, Trash2, Ban,
  Megaphone, Send, Search
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [usersCount, setUsersCount] = useState(0);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  
  // Megafone
  const [promoTitle, setPromoTitle] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [sendingPromo, setSendingPromo] = useState(false);

  // Search
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    if (user && user.email !== "eduflow.adm.academy@gmail.com") {
      toast({ title: "Acesso Negado", description: "Área restrita.", variant: "destructive" });
      navigate("/");
    } else if (user) {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    setLoading(true);
    try {
      // 1. Contagem Total
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      setUsersCount(count || 0);

      // 2. Feedbacks
      const { data: feedData } = await supabase.from('feedbacks').select('*').order('created_at', { ascending: false });
      setFeedbacks(feedData || []);

      // 3. Denúncias
      const { data: repData } = await supabase.from('post_reports').select('*, posts(*)').eq('status', 'pending');
      setReports(repData || []);

      // 4. Lista de Usuários
      const { data: profilesData } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
      setUsersList(profilesData || []);

    } catch (error) {
      console.error("Erro Adm:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- AÇÕES DO TRIBUNAL ---
  async function handleDeletePost(reportId: string, postId: string) {
    if (!window.confirm("Isso apagará a publicação da rede. Confirmar?")) return;
    
    // Apaga o post
    await supabase.from('posts').delete().eq('id', postId);
    // Marca a denúncia como resolvida
    await supabase.from('post_reports').update({ status: 'resolved' }).eq('id', reportId);
    
    setReports(reports.filter(r => r.id !== reportId));
    toast({ title: "Publicação Excluída", description: "A rede foi higienizada." });
  }

  async function handleIgnoreReport(reportId: string) {
    await supabase.from('post_reports').update({ status: 'ignored' }).eq('id', reportId);
    setReports(reports.filter(r => r.id !== reportId));
    toast({ title: "Denúncia Ignorada", description: "O post foi mantido na rede." });
  }

  // --- AÇÕES DE FEEDBACK ---
  async function deleteFeedback(id: string) {
    await supabase.from('feedbacks').delete().eq('id', id);
    setFeedbacks(feedbacks.filter(f => f.id !== id));
    toast({ title: "Feedback resolvido." });
  }

  // --- AÇÕES DE USUÁRIO ---
  async function handleBanUser(userId: string, currentStatus: boolean) {
    const action = currentStatus ? "Desbanir" : "Banir";
    if (!window.confirm(`Deseja realmente ${action} este usuário?`)) return;

    await supabase.from('profiles').update({ is_banned: !currentStatus }).eq('user_id', userId);
    
    setUsersList(usersList.map(u => u.user_id === userId ? { ...u, is_banned: !currentStatus } : u));
    toast({ 
      title: currentStatus ? "Usuário Restaurado" : "Usuário Banido", 
      variant: currentStatus ? "default" : "destructive" 
    });
  }

  // --- MEGAFONE (Notificação Global) ---
  async function sendGlobalNotification() {
    if (!promoTitle.trim() || !promoMessage.trim()) return;
    setSendingPromo(true);

    try {
      // Pega todos os IDs de usuários para notificar
      const { data: users } = await supabase.from('profiles').select('user_id');
      if (!users) throw new Error("Nenhum usuário encontrado");

      const notifications = users.map(u => ({
        user_id: u.user_id,
        title: `📢 AVISO OFICIAL: ${promoTitle}`,
        message: promoMessage,
        type: 'system',
        is_read: false
      }));

      // Insere as notificações em lote
      await supabase.from('notifications').insert(notifications);

      toast({ title: "Megafone Disparado! 🚀", description: "Aviso enviado para toda a base de alunos." });
      setPromoTitle("");
      setPromoMessage("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSendingPromo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <ShieldCheck className="h-16 w-16 animate-pulse text-emerald-500" />
        <p className="font-black uppercase tracking-widest text-emerald-500">Acessando Central de Comando...</p>
      </div>
    );
  }

  const filteredUsers = usersList.filter(u => u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) || u.email?.toLowerCase().includes(searchUser.toLowerCase()));

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 pb-24 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-6 pt-8">
        
        {/* Header do Admin */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-5">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="h-14 w-14 rounded-2xl bg-slate-900 border-slate-800 text-white hover:bg-slate-800 hover:text-white transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-emerald-500" /> Painel Central
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-1">Acesso Supremo · EduFlow Academy</p>
            </div>
          </div>
        </header>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
            <CardContent className="p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comunidade Ativa</p>
                <p className="text-4xl font-black text-white">{usersCount}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
            <CardContent className="p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caixa de Entrada</p>
                <p className="text-4xl font-black text-white">{feedbacks.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
            <CardContent className="p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fila de Moderação</p>
                <p className="text-4xl font-black text-white">{reports.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas Dinâmicas de Gestão */}
        <Tabs defaultValue="moderation" className="w-full mt-8">
          <TabsList className="bg-slate-900 border border-slate-800 p-1.5 rounded-[20px] flex flex-wrap h-auto gap-1">
            <TabsTrigger value="moderation" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest py-3 data-[state=active]:bg-red-500 data-[state=active]:text-white">Tribunal</TabsTrigger>
            <TabsTrigger value="users" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest py-3 data-[state=active]:bg-blue-500 data-[state=active]:text-white">Usuários</TabsTrigger>
            <TabsTrigger value="megaphone" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest py-3 data-[state=active]:bg-amber-500 data-[state=active]:text-white">Megafone</TabsTrigger>
            <TabsTrigger value="feedbacks" className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Feedbacks</TabsTrigger>
          </TabsList>

          {/* ABA 1: MODERAÇÃO (TRIBUNAL) */}
          <TabsContent value="moderation" className="mt-6 space-y-4">
            {reports.length === 0 ? (
               <div className="p-16 text-center bg-slate-900 rounded-[24px] border border-slate-800">
               <ShieldCheck className="h-12 w-12 text-slate-600 mx-auto mb-4" />
               <p className="text-lg font-black text-slate-300">A rede está pacífica.</p>
               <p className="text-sm font-medium text-slate-500 mt-1">Nenhuma denúncia pendente de avaliação.</p>
             </div>
            ) : (
              reports.map(r => (
                <div key={r.id} className="bg-slate-900 border border-red-500/30 p-6 rounded-[24px] flex flex-col gap-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
                    <div>
                      <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">Denunciado por quebra de regra</p>
                      <p className="text-white font-bold">{r.reason}</p>
                    </div>
                  </div>
                  
                  {r.posts ? (
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <p className="text-sm text-slate-300 leading-relaxed">"{r.posts.content}"</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-sm">Post original já foi deletado.</p>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <Button onClick={() => handleDeletePost(r.id, r.post_id)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-12 text-[10px] font-black uppercase tracking-widest flex-1 shadow-lg shadow-red-500/20">
                      <Trash2 className="h-4 w-4 mr-2" /> Deletar Publicação
                    </Button>
                    <Button onClick={() => handleIgnoreReport(r.id)} variant="outline" className="border-slate-700 hover:bg-slate-800 hover:text-white text-slate-300 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Falso Alarme (Ignorar)
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ABA 2: GESTÃO DE USUÁRIOS */}
          <TabsContent value="users" className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <Input 
                placeholder="Buscar por nome ou email..." 
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                className="h-14 pl-12 rounded-[20px] bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:ring-blue-500/50"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map(u => (
                <div key={u.user_id} className={`p-4 rounded-[24px] border flex items-center justify-between gap-4 transition-colors ${u.is_banned ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900 border-slate-800'}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-12 w-12 border border-slate-700 shrink-0">
                      <AvatarImage src={u.avatar_url} />
                      <AvatarFallback className="bg-slate-800 text-slate-300">{u.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{u.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{u.course || "Sem curso"}</p>
                      {u.is_banned && <span className="text-[9px] font-black uppercase tracking-widest text-red-500 mt-1 inline-block bg-red-500/10 px-2 py-0.5 rounded-md">Conta Suspensa</span>}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleBanUser(u.user_id, u.is_banned)}
                    className={`shrink-0 rounded-xl ${u.is_banned ? 'text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400' : 'text-slate-500 hover:bg-red-500/10 hover:text-red-500'}`}
                    title={u.is_banned ? "Restaurar Acesso" : "Banir Usuário"}
                  >
                    {u.is_banned ? <CheckCircle2 className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ABA 3: MEGAFONE (Avisos Globais) */}
          <TabsContent value="megaphone" className="mt-6">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0"><Megaphone className="h-7 w-7 text-amber-500" /></div>
                  <div>
                    <h3 className="text-xl font-black text-white">Transmissão em Massa</h3>
                    <p className="text-sm text-slate-400 mt-1">Dispare uma notificação no sininho de todos os usuários do app.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Título do Aviso</label>
                    <Input 
                      value={promoTitle} onChange={e => setPromoTitle(e.target.value)}
                      placeholder="Ex: Atualização do Sistema" 
                      className="h-14 rounded-2xl bg-slate-950 border-slate-800 text-white focus:ring-amber-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Mensagem (Detalhes)</label>
                    <Textarea 
                      value={promoMessage} onChange={e => setPromoMessage(e.target.value)}
                      placeholder="Escreva a mensagem que todos os alunos irão ler..." 
                      className="min-h-[120px] rounded-2xl bg-slate-950 border-slate-800 text-white focus:ring-amber-500/50 resize-none"
                    />
                  </div>
                  <Button 
                    onClick={sendGlobalNotification} disabled={!promoTitle.trim() || !promoMessage.trim() || sendingPromo}
                    className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    {sendingPromo ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Disparar para {usersCount} Alunos</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 4: FEEDBACKS */}
          <TabsContent value="feedbacks" className="mt-6 space-y-4">
            {feedbacks.length === 0 ? (
              <div className="p-16 text-center bg-slate-900 rounded-[24px] border border-slate-800">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-300">Caixa de entrada limpa.</p>
              </div>
            ) : (
              feedbacks.map(f => (
                <div key={f.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[24px] flex flex-col md:flex-row gap-6 shadow-md">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">{f.category}</span>
                      <span className="text-xs text-slate-400 font-bold">{f.email || "Estudante Anônimo"}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 leading-relaxed">{f.message}</p>
                    {f.media_url && (
                      <Button variant="link" className="mt-2 text-emerald-500 p-0 h-auto text-xs" onClick={() => window.open(f.media_url, '_blank')}>
                        Ver anexo (Print/Vídeo)
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => deleteFeedback(f.id)} className="shrink-0 h-12 rounded-xl font-black text-[10px] border-slate-700 hover:bg-slate-800 hover:text-white text-slate-300 uppercase tracking-widest">
                    <Trash2 className="h-4 w-4 mr-2" /> Arquivar
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
