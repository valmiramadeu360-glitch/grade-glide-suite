import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Trophy, Plus, Check, Trash2, Loader2, Minus } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  target: number;
  progress: number;
  completed: boolean;
}

function currentWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // semana começa na segunda
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export function WeeklyGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("1");
  const [saving, setSaving] = useState(false);

  const weekStart = currentWeekStart();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("weekly_goals")
      .select("id, title, target, progress, completed")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .order("created_at", { ascending: true });
    setGoals((data ?? []) as Goal[]);
    setLoading(false);
  }, [user, weekStart]);

  useEffect(() => { load(); }, [load]);

  async function addGoal() {
    if (!user || !title.trim()) return;
    setSaving(true);
    const goalTarget = Math.max(1, Number(target) || 1);
    const { error } = await supabase.from("weekly_goals").insert({
      user_id: user.id,
      title: title.trim(),
      target: goalTarget,
      week_start: weekStart,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar a meta", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setTarget("1");
    setAdding(false);
    load();
  }

  async function step(goal: Goal, delta: number) {
    const progress = Math.min(goal.target, Math.max(0, goal.progress + delta));
    const completed = progress >= goal.target;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, progress, completed } : g)));
    await supabase.from("weekly_goals").update({ progress, completed }).eq("id", goal.id);
  }

  async function remove(goal: Goal) {
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    await supabase.from("weekly_goals").delete().eq("id", goal.id);
  }

  const done = goals.filter((g) => g.completed).length;
  const overall = goals.length ? Math.round((done / goals.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" /> Objetivos da Semana
        </h3>
        <button
          onClick={() => setAdding((v) => !v)}
          className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
          aria-label="Adicionar meta da semana"
        >
          <Plus className={cn("h-4 w-4 transition-transform", adding && "rotate-45")} />
        </button>
      </div>

      <div className="rounded-[24px] border border-border/30 bg-card p-4 space-y-3 shadow-sm">
        {goals.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-muted-foreground">{done} de {goals.length} concluídas</span>
              <span className="text-primary">{overall}%</span>
            </div>
            <Progress value={overall} className="h-2 rounded-full" />
          </div>
        )}

        {adding && (
          <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGoal()}
              placeholder="Ex: Revisar Anatomia 3 vezes"
              className="h-11 rounded-xl border-0 bg-background text-sm font-semibold"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-11 w-20 rounded-xl border-0 bg-background text-sm font-bold text-center"
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">vezes na semana</span>
              <Button onClick={addGoal} disabled={saving || !title.trim()} className="h-11 rounded-xl font-black text-xs px-4">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
        ) : goals.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs font-bold text-foreground">Nenhuma meta nesta semana.</p>
            <p className="text-[10px] font-medium text-muted-foreground mt-1">
              Crie metas simples e marque cada avanço para manter o ritmo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => (
              <div key={g.id} className={cn("rounded-2xl border p-3 transition-colors", g.completed ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/30 bg-muted/25")}>
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-xs font-bold leading-snug", g.completed ? "text-emerald-700 dark:text-emerald-400 line-through" : "text-foreground")}>
                    {g.title}
                  </p>
                  <button onClick={() => remove(g)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remover meta">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={() => step(g, -1)}
                    disabled={g.progress === 0}
                    className="h-8 w-8 rounded-lg bg-background border border-border/40 flex items-center justify-center disabled:opacity-40"
                    aria-label="Diminuir progresso"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <Progress value={(g.progress / g.target) * 100} className="h-2 flex-1 rounded-full" />
                  <span className="text-[10px] font-black tabular-nums text-muted-foreground w-10 text-center">{g.progress}/{g.target}</span>
                  <button
                    onClick={() => step(g, 1)}
                    disabled={g.completed}
                    className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                    aria-label="Registrar avanço"
                  >
                    {g.completed ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
