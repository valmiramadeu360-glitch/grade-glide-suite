// 2. Puxa as mensagens de Feedback { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ShieldCheck, Users, MessageSquare, AlertTriangle, 
  Loader2, ArrowLeft, CheckCircle2, Trash2, Ban
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [usersCount, setUsersCount] = useState(0);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // TRAVA DE SEGURANÇA: Só o CEO entra
  useEffect(() => {
    if (user && user.email !== "eduflow.adm.academy@gmail.com") {
      toast({ title: "Acesso Negado", description: "Área restrita à administração.", variant: "destructive" });
      navigate("/");
    } else if (user) {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    setLoading(true);
    try {
      // 1. Conta quantos usuários tem no app
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      setUsersCount(count || 0);

      // 2. Puxa as mensagens de Feedback
      const { data: feedData } = await supabase.from('feedbacks').select('*').order('created_at', { ascending: false });
      setFeedbacks(feedData || []);

      // 3. Puxa as Denúncias (Mockado por enquanto caso não tenha posts ainda)
      const { data: repData } = await supabase.from('post_reports').select('*, posts(content, user_id)').eq('status', 'pending');
      setReports(repData || []);

    } catch (error) {
      console.error("Erro ao carregar painel adm:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteFeedback(id: string) {
    await supabase.from('feedbacks').delete().eq('id', id);
    setFeedbacks(feedbacks.filter(f => f.id !== id));
    toast({ title: "Feedback resolvido/apagado." });
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <ShieldCheck className="h-16 w-16 animate-pulse text-emerald-500" />
        <p className="font-black uppercase tracking-widest text-emerald-500">Autenticando Criptografia...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 pb-24 font-sans">
      <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-6 pt-8">
        
        {/* Header do Admin */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-5">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="h-14 w-14 rounded-2xl bg-slate-900 border-slate-800 text-white hover:bg-slate-800">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-emerald-500" /> Painel de Comando
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-1">EduFlow · Nível Máximo de Acesso</p>
            </div>
          </div>
        </header>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
            <CardContent className="p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Usuários</p>
                <p className="text-4xl font-black text-white">{usersCount}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
            <CardContent className="p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Feedbacks Recebidos</p>
                <p className="text-4xl font-black text-white">{feedbacks.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[24px]">
            <CardContent className="p-6 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Denúncias Pendentes</p>
                <p className="text-4xl font-black text-white">{reports.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Áreas de Gestão */}
        <Tabs defaultValue="feedbacks" className="w-full mt-8">
          <TabsList className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
            <TabsTrigger value="feedbacks" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Central de Ajuda</TabsTrigger>
            <TabsTrigger value="moderation" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8 py-3 data-[state=active]:bg-red-500 data-[state=active]:text-white">Tribunal (Moderação)</TabsTrigger>
          </TabsList>

          <TabsContent value="feedbacks" className="mt-6 space-y-4">
            {feedbacks.length === 0 ? (
              <div className="p-10 text-center bg-slate-900 rounded-[24px] border border-slate-800">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-4" />
                <p className="font-bold text-slate-400">Nenhum feedback pendente.</p>
              </div>
            ) : (
              feedbacks.map(f => (
                <div key={f.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md">{f.category}</span>
                      <span className="text-xs text-slate-500 font-medium">{f.email || "Anônimo"}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">{f.message}</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => deleteFeedback(f.id)} className="shrink-0 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest">
                    <Trash2 className="h-4 w-4 mr-2" /> Marcar como Resolvido
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="moderation" className="mt-6 space-y-4">
            {reports.length === 0 ? (
               <div className="p-10 text-center bg-slate-900 rounded-[24px] border border-slate-800">
               <ShieldCheck className="h-10 w-10 text-slate-600 mx-auto mb-4" />
               <p className="font-bold text-slate-400">A rede está segura. Nenhuma denúncia.</p>
             </div>
            ) : (
              reports.map(r => (
                <div key={r.id} className="bg-slate-900 border border-red-500/30 p-6 rounded-[24px]">
                   <p className="text-red-400 text-xs font-black uppercase tracking-widest mb-2"> Motivo da Denúncia:   {r.reason}</p> <p className="text-red-400 text-xs font-black uppercase tracking-widest mb-2"> Motivo da Denúncia:   {r.reason}</p> <p className="text-red-400 text-xs font-black uppercase tracking-widest mb-2"> Motivo da Denúncia:   {r.reason}</p> <p className="text-red-400 text-xs font-black uppercase tracking-widest mb-2"> Motivo da Denúncia:   {r.reason}</p>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
                    <p className="text-sm text-slate-300 italic">"{r.posts?.content}"</p>
                  </div>
                  <div className="flex gap-3">
                    <Button className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-10 text-[10px] font-black uppercase tracking-widest flex-1">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir Post
                    </Button>
                    <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white rounded-xl h-10 text-[10px] font-black uppercase tracking-widest flex-1">
                       <CheckCircle2 className="h-4 w-4 mr-2" />   Ignorar (Falso Alarme)   <CheckCircle2 className="h-4 w-4 mr-2" />   Ignorar (Falso Alarme)   <CheckCircle2 className="h-4 w-4 mr-2" />   Ignorar (Falso Alarme)   <CheckCircle2 className="h-4 w-4 mr-2" />   Ignorar (Falso Alarme) 
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

