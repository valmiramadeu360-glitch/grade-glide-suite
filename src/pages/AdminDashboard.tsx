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
  ShieldCheck,
  Users,
  MessageSquare,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Ban,
  Megaphone,
  Send,
  Search
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

  const [promoTitle, setPromoTitle] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [sendingPromo, setSendingPromo] = useState(false);

  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {

    if (!user) return;

    if (user.email !== "eduflow.adm.academy@gmail.com") {

      toast({
        title: "Acesso Negado",
        description: "Área restrita.",
        variant: "destructive"
      });

      navigate("/");
      return;

    }

    loadAdminData();

  }, [user]);

  async function loadAdminData() {

    setLoading(true);

    try {

      const { count, error: countError } =
        await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

      if (countError) throw countError;

      setUsersCount(count || 0);

      const { data: feedData, error: feedError } =
        await supabase
          .from("feedbacks")
          .select("*")
          .order("created_at", { ascending: false });

      if (feedError) throw feedError;

      setFeedbacks(feedData || []);

      const { data: repData, error: repError } =
        await supabase
          .from("post_reports")
          .select("*, posts(*)")
          .eq("status", "pending");

      if (repError) throw repError;

      setReports(repData || []);

      const { data: profilesData, error: usersError } =
        await supabase
          .from("profiles")
          .select("*")
          .order("full_name", { ascending: true });

      if (usersError) throw usersError;

      setUsersList(profilesData || []);

    } catch (error) {

      console.error("Erro Adm:", error);

      toast({
        title: "Erro ao carregar painel",
        description: "Não foi possível buscar os dados.",
        variant: "destructive"
      });

    } finally {

      setLoading(false);

    }

  }

async function handleDeletePost(reportId: string, postId: string) {

    if (!window.confirm("Isso apagará a publicação da rede. Confirmar?"))
      return;

    try {

      const { error } =
        await supabase
          .from("posts")
          .delete()
          .eq("id", postId);

      if (error) throw error;

      await supabase
        .from("post_reports")
        .update({ status: "resolved" })
        .eq("id", reportId);

      setReports(reports.filter(r => r.id !== reportId));

      toast({
        title: "Publicação Excluída",
        description: "A rede foi higienizada."
      });

    } catch (error) {

      toast({
        title: "Erro",
        description: "Não foi possível deletar o post.",
        variant: "destructive"
      });

    }

  }

  async function handleIgnoreReport(reportId: string) {

    try {

      await supabase
        .from("post_reports")
        .update({ status: "ignored" })
        .eq("id", reportId);

      setReports(reports.filter(r => r.id !== reportId));

      toast({
        title: "Denúncia Ignorada"
      });

    } catch {

      toast({
        title: "Erro ao ignorar denúncia",
        variant: "destructive"
      });

    }

  }

  async function deleteFeedback(id: string) {

    try {

      await supabase
        .from("feedbacks")
        .delete()
        .eq("id", id);

      setFeedbacks(feedbacks.filter(f => f.id !== id));

      toast({
        title: "Feedback arquivado."
      });

    } catch {

      toast({
        title: "Erro ao remover feedback",
        variant: "destructive"
      });

    }

  }

  async function handleBanUser(userId: string, currentStatus: boolean) {

    if (userId === user?.id) {

      toast({
        title: "Ação bloqueada",
        description: "Você não pode banir sua própria conta.",
        variant: "destructive"
      });

      return;

    }

    const action = currentStatus ? "Desbanir" : "Banir";

    if (!window.confirm(`Deseja realmente ${action} este usuário?`))
      return;

    try {

      await supabase
        .from("profiles")
        .update({ is_banned: !currentStatus })
        .eq("user_id", userId);

      setUsersList(
        usersList.map(u =>
          u.user_id === userId
            ? { ...u, is_banned: !currentStatus }
            : u
        )
      );

      toast({
        title: currentStatus
          ? "Usuário Restaurado"
          : "Usuário Banido",
        variant: currentStatus ? "default" : "destructive"
      });

    } catch {

      toast({
        title: "Erro ao atualizar usuário",
        variant: "destructive"
      });

    }

  }

async function sendGlobalNotification() {

    if (!promoTitle.trim() || !promoMessage.trim())
      return;

    setSendingPromo(true);

    try {

      const { data: users, error } =
        await supabase
          .from("profiles")
          .select("user_id");

      if (error) throw error;

      if (!users || users.length === 0)
        throw new Error("Nenhum usuário encontrado");

      const notifications = users.map(u => ({
        user_id: u.user_id,
        title: `📢 AVISO OFICIAL: ${promoTitle}`,
        message: promoMessage,
        type: "system",
        is_read: false
      }));

      const chunkSize = 100;

      for (let i = 0; i < notifications.length; i += chunkSize) {

        const chunk = notifications.slice(i, i + chunkSize);

        const { error } =
          await supabase
            .from("notifications")
            .insert(chunk);

        if (error) throw error;

      }

      toast({
        title: "Megafone Disparado 🚀",
        description: "Aviso enviado para todos os alunos."
      });

      setPromoTitle("");
      setPromoMessage("");

    } catch (e: any) {

      toast({
        title: "Erro ao enviar",
        description: e.message,
        variant: "destructive"
      });

    } finally {

      setSendingPromo(false);

    }

  }

  return (
    <div className="p-6 text-center text-muted-foreground">
      <p>Painel Admin temporariamente indisponível — restaure esta página pelo histórico.</p>
      <p className="text-xs mt-2">Usuários: {usersCount} · Feedbacks: {feedbacks.length} · Reports: {reports.length}</p>
    </div>
  );
}
