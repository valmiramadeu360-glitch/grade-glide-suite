import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export function DisciplineChecklist({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    loadItems();
  }, [disciplineId]);

  async function loadItems() {
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("discipline_id", disciplineId)
      .order("sort_order");
    setItems(data ?? []);
  }

  async function addItem() {
    if (!newItem.trim() || !user) return;
    
    const title = newItem.trim();
    setNewItem("");

    // Adiciona o item localmente primeiro para ser instantâneo
    const { data, error } = await supabase.from("checklist_items").insert({
      discipline_id: disciplineId,
      user_id: user.id,
      title: title,
      sort_order: items.length,
    }).select().single();

    if (!error && data) {
      setItems([...items, data]);
    } else {
      loadItems(); // Recarrega em caso de erro
    }
  }

  async function toggleItem(item: ChecklistItem) {
    // Atualização Otimista: muda na tela antes de confirmar no banco
    const previousItems = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));

    const { error } = await supabase
      .from("checklist_items")
      .update({ completed: !item.completed })
      .eq("id", item.id);

    if (error) {
      setItems(previousItems); // Reverte se o banco falhar
    }
  }

  async function deleteItem(id: string) {
    // Atualização Otimista: remove da tela antes de confirmar no banco
    const previousItems = [...items];
    setItems(items.filter(i => i.id !== id));

    const { error } = await supabase
      .from("checklist_items")
      .delete()
      .eq("id", id);

    if (error) {
      setItems(previousItems); // Reverte se o banco falhar
    }
  }

  const completed = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assuntos para Estudar</CardTitle>
        <div className="flex items-center gap-3 mt-2">
          <Progress value={progress} className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground">{completed}/{items.length}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Novo assunto..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button size="icon" onClick={addItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 group">
              <Checkbox 
                checked={item.completed} 
                onCheckedChange={() => toggleItem(item)} 
              />
              <span className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.title}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => deleteItem(item.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
