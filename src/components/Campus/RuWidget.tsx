import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed, Clock, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface RuReport {
  status_level: 'fast' | 'moderate' | 'slow';
  estimated_minutes: number;
  created_at: string;
}

export function RuWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [latestReport, setLatestReport] = useState<RuReport | null>(null);

  useEffect(() => {
    if (user) fetchLatestRuStatus();
  }, [user]);

  async function fetchLatestRuStatus() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ru_status_reports")
        .select("status_level, estimated_minutes, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestReport(data);
    } catch (error: any) {
      console.error("Erro ao buscar status do RU:", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReportStatus(level: 'fast' | 'moderate' | 'slow', minutes: number) {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("ru_status_reports").insert({
        user_id: user.id,
        status_level: level,
        estimated_minutes: minutes
      });

      if (error) throw error;

      toast({
        title: "Obrigado por colaborar! 🍲",
        description: "O status da fila do RU foi atualizado para os outros alunos."
      });
      fetchLatestRuStatus();
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusConfig = (level?: string) => {
    switch (level) {
      case 'fast':
        return { label: "Fila Rápida / Fluida", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500" };
      case 'moderate':
        return { label: "Fila Moderada", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500" };
      case 'slow':
        return { label: "Fila Gigante / Lenta", color: "bg-rose-500/10 text-rose-600 border-rose-500/20", dot: "bg-rose-500" };
      default:
        return { label: "Sem dados recentes", color: "bg-muted text-muted-foreground border-border/40", dot: "bg-muted-foreground" };
    }
  };

  const currentConfig = getStatusConfig(latestReport?.status_level);

  return (
    <Card className="rounded-[24px] border border-border/30 bg-card shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
      
      {/* Header do Widget */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-foreground">Restaurante Universitário (RU)</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Estimativa Colaborativa</p>
          </div>
        </div>

        <div className={cn("px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm", currentConfig.color)}>
          <div className={cn("h-2 w-2 rounded-full animate-pulse", currentConfig.dot)} />
          {loading ? "Carregando..." : latestReport ? `${latestReport.estimated_minutes} min` : "Indefinido"}
        </div>
      </div>

      {/* Status Atual */}
      <div className="bg-muted/30 p-3.5 rounded-2xl border border-border/30 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-foreground">{currentConfig.label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Baseado em relatos recentes de estudantes no local.</p>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
      </div>

      {/* Ações de Crowdsourcing */}
      <div className="space-y-2 pt-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Você está no RU agora? Atualize a fila:</p>
        <div className="grid grid-cols-3 gap-2">
          <Button 
            variant="outline" 
            disabled={submitting}
            onClick={() => handleReportStatus('fast', 5)}
            className="h-10 rounded-xl text-[11px] font-bold border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 transition-all shadow-sm"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Rápida (~5m)"}
          </Button>
          
          <Button 
            variant="outline" 
            disabled={submitting}
            onClick={() => handleReportStatus('moderate', 15)}
            className="h-10 rounded-xl text-[11px] font-bold border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 transition-all shadow-sm"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Média (~15m)"}
          </Button>

          <Button 
            variant="outline" 
            disabled={submitting}
            onClick={() => handleReportStatus('slow', 30)}
            className="h-10 rounded-xl text-[11px] font-bold border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 transition-all shadow-sm"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cheia (30m+)"}
          </Button>
        </div>
      </div>

    </Card>
  );
}
