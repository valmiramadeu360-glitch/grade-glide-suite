import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export function DisciplineChecklist({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (disciplineId) {
      loadItems();
    }
  }, [disciplineId]);

  async function loadItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("discipline_id", disciplineId)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error("Erro ao carregar checklist:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addItem() {
    if (!newItem.trim() || !user || !disciplineId) return;
    
    const title = newItem.trim();
    setNewItem("");

    const { data, error } = await supabase
      .from("checklist_items")
      .insert({
        discipline_id: disciplineId,
        user_id: user.id,
        title: title,
        sort_order: items.length,
        completed: false
      })
      .select()
      .single();

    if (!error && data) {
      setItems(prev => [...prev, data]);
    } else {
      console.error("Erro ao adicionar:", error);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    const previousItems = [...items];
    const newStatus = !item.completed;
    
    // Atualização otimista
    setItems(items.map(i => i.id === item.id ? { ...i, completed: newStatus } : i));

    const { error } = await supabase
      .from("checklist_items")
      .update({ completed: newStatus })
      .eq("id", item.id);

    if (error) {
      setItems(previousItems);
    }
  }

  async function deleteItem(id: string) {
    const previousItems = [...items];
    setItems(items.filter(i => i.id !== id));

    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", id);

    if (error) {
      setItems(previousItems);
    }
  }

  const completed = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[32px] bg-muted/5">
        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">Sincronizando tarefas...</p>
      </div>
    );
  }

  return (
    <Card className="glass-card border-none shadow-xl bg-card/60 rounded-[40px] overflow-hidden">
      <CardHeader className="pb-4 pt-8 px-8">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">
            Checklist de Estudos
          </CardTitle>
          <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full tracking-tighter">
            {progress}% CONCLUÍDO
          </span>
        </div>
        <Progress value={progress} className="h-2 bg-muted/30" />
      </CardHeader>
      
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="flex gap-2 p-1 bg-muted/20 rounded-2xl border border-border/40">
          <Input
            placeholder="O que você precisa estudar?"
            className="border-none bg-transparent focus-visible:ring-0 shadow-none text-sm font-medium"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button size="icon" onClick={addItem} className="rounded-xl h-10 w-10 shrink-0 shadow-lg shadow-primary/20">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-2 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
          {items.length === 0 ? (
            <p className="text-center py-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-30">
              Nenhum tópico cadastrado
            </p>
          ) : (
            items.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-4 rounded-2xl p-4 transition-all duration-300 border ${
                  item.completed ? "bg-muted/10 border-transparent opacity-60" : "bg-card border-border/30 hover:border-primary/20 shadow-sm"
                } group`}
              >
                <Checkbox 
                  checked={item.completed} 
                  onCheckedChange={() => toggleItem(item)}
                  className="h-5 w-5 rounded-md border-2 border-primary/30 data-[state=checked]:bg-primary transition-colors"
                />
                <span className={`flex-1 text-sm font-bold tracking-tight transition-all ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.title}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                  onClick={() => deleteItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
