import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, CloudOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Subtopic {
  id: string;
  title: string;
  completed: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  subtopics: Subtopic[];
  expanded: boolean;
}

export function DisciplineChecklist({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newSubtopics, setNewSubtopics] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editingSubText, setEditingSubText] = useState("");

  // Controle do Modo Offline
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadItems();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [disciplineId]);

  async function loadItems() {
    const { data: checklistData } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("discipline_id", disciplineId)
      .order("sort_order");

    const { data: subtopicData } = await supabase
      .from("checklist_subtopics")
      .select("*")
      .in("parent_item_id", (checklistData ?? []).map(i => i.id))
      .order("sort_order");

    const subtopicMap: Record<string, Subtopic[]> = {};
    (subtopicData ?? []).forEach(s => {
      if (!subtopicMap[s.parent_item_id]) subtopicMap[s.parent_item_id] = [];
      subtopicMap[s.parent_item_id].push({ id: s.id, title: s.title, completed: s.completed ?? false });
    });

    setItems((checklistData ?? []).map(i => ({
      id: i.id,
      title: i.title,
      completed: i.completed ?? false,
      subtopics: subtopicMap[i.id] ?? [],
      expanded: false,
    })));
  }

  async function addItem() {
    if (!newItem.trim() || !user) return;
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se para adicionar itens.", variant: "destructive" });
      return;
    }

    const title = newItem.trim();
    setNewItem("");

    const { data, error } = await supabase.from("checklist_items").insert({
      discipline_id: disciplineId,
      user_id: user.id,
      title,
      sort_order: items.length,
    }).select().single();

    if (!error && data) {
      setItems([...items, { id: data.id, title: data.title, completed: false, subtopics: [], expanded: false }]);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Sincronização pausada.", variant: "destructive" });
      return;
    }

    const prev = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
    const { error } = await supabase.from("checklist_items").update({ completed: !item.completed }).eq("id", item.id);
    if (error) setItems(prev);
  }

  async function deleteItem(id: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Não é possível excluir agora.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Deseja excluir este assunto e seus subtópicos?")) return;
    const prev = [...items];
    setItems(items.filter(i => i.id !== id));
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) setItems(prev);
  }

  function toggleExpand(id: string) {
    setItems(items.map(i => i.id === id ? { ...i, expanded: !i.expanded } : i));
  }

  function startEditItem(item: ChecklistItem) {
    setEditingItem(item.id);
    setEditingItemText(item.title);
  }

  async function saveEditItem(id: string) {
    const text = editingItemText.trim();
    if (!text) return;
    setEditingItem(null);
    if (isOffline) return;

    setItems(items.map(i => i.id === id ? { ...i, title: text } : i));
    await supabase.from("checklist_items").update({ title: text }).eq("id", id);
  }

  function startEditSub(sub: Subtopic) {
    setEditingSub(sub.id);
    setEditingSubText(sub.title);
  }

  async function saveEditSub(parentId: string, subId: string) {
    const text = editingSubText.trim();
    if (!text) return;
    setEditingSub(null);
    if (isOffline) return;

    setItems(items.map(i => i.id === parentId
      ? { ...i, subtopics: i.subtopics.map(s => s.id === subId ? { ...s, title: text } : s) }
      : i
    ));
    await supabase.from("checklist_subtopics").update({ title: text }).eq("id", subId);
  }

  async function addSubtopic(parentId: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se para adicionar.", variant: "destructive" });
      return;
    }
    const text = newSubtopics[parentId]?.trim();
    if (!text || !user) return;
    setNewSubtopics({ ...newSubtopics, [parentId]: "" });

    const { data, error } = await supabase.from("checklist_subtopics").insert({
      parent_item_id: parentId,
      user_id: user.id,
      title: text,
      sort_order: items.find(i => i.id === parentId)?.subtopics.length ?? 0,
    }).select().single();

    if (!error && data) {
      setItems(items.map(i =>
        i.id === parentId
          ? { ...i, subtopics: [...i.subtopics, { id: data.id, title: data.title, completed: false }], expanded: true }
          : i
      ));
    }
  }

  async function toggleSubtopic(parentId: string, sub: Subtopic) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Sincronização pausada.", variant: "destructive" });
      return;
    }
    setItems(items.map(i =>
      i.id === parentId
        ? { ...i, subtopics: i.subtopics.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s) }
        : i
    ));
    await supabase.from("checklist_subtopics").update({ completed: !sub.completed }).eq("id", sub.id);
  }

  async function deleteSubtopic(parentId: string, subId: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Não é possível excluir agora.", variant: "destructive" });
      return;
    }
    setItems(items.map(i =>
      i.id === parentId
        ? { ...i, subtopics: i.subtopics.filter(s => s.id !== subId) }
        : i
    ));
    await supabase.from("checklist_subtopics").delete().eq("id", subId);
  }

  const allTasks = items.reduce((sum, i) => sum + 1 + i.subtopics.length, 0);
  const completedTasks = items.reduce((sum, i) => sum + (i.completed ? 1 : 0) + i.subtopics.filter(s => s.completed).length, 0);
  const progress = allTasks > 0 ? Math.round((completedTasks / allTasks) * 100) : 0;

  return (
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4 pt-6 px-6 border-b border-border/40">
        <div className="flex flex-col gap-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">
            Checklist de Estudos
          </CardTitle>
          <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-2xl">
            <Progress value={progress} className="flex-1 h-3 shadow-inner bg-background/50 [&>div]:bg-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary shrink-0">
              {completedTasks}/{allTasks} OK
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {isOffline && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest animate-pulse">
            <CloudOff className="h-4 w-4" />
            Modo offline - Edições bloqueadas
          </div>
        )}

        <div className="flex gap-3">
          <Input
            placeholder="Novo assunto principal..."
            className="h-14 rounded-2xl bg-muted/30 border-border text-base font-medium flex-1"
            value={newItem}
            disabled={isOffline}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button size="icon" onClick={addItem} disabled={isOffline} className="h-14 w-14 rounded-2xl shadow-sm shrink-0">
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className={cn(
                "flex items-center gap-3 rounded-2xl p-3 transition-all border",
                item.completed ? "bg-muted/30 border-transparent opacity-80" : "bg-card border-border/50 shadow-sm hover:border-primary/30"
              )}>
                <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 rounded-xl hover:bg-muted" onClick={() => toggleExpand(item.id)}>
                  {item.expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </Button>
                
                <Checkbox 
                  checked={item.completed} 
                  onCheckedChange={() => toggleItem(item)} 
                  disabled={isOffline}
                  className="h-6 w-6 rounded-md border-primary/30"
                />

                {editingItem === item.id ? (
                  <Input
                    autoFocus
                    className="flex-1 h-10 text-base font-bold rounded-xl"
                    value={editingItemText}
                    onChange={e => setEditingItemText(e.target.value)}
                    onBlur={() => saveEditItem(item.id)}
                    onKeyDown={e => e.key === "Enter" && saveEditItem(item.id)}
                  />
                ) : (
                  <span
                    className={cn("flex-1 text-base font-bold cursor-pointer select-none", item.completed && "line-through text-muted-foreground")}
                    onDoubleClick={() => startEditItem(item)}
                  >
                    {item.title}
                  </span>
                )}

                {item.subtopics.length > 0 && (
                  <span className="text-[10px] bg-muted px-2 py-1 rounded-md text-muted-foreground font-black tracking-widest shrink-0 hidden sm:block">
                    {item.subtopics.filter(s => s.completed).length}/{item.subtopics.length}
                  </span>
                )}
                
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" disabled={isOffline} className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => startEditItem(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={isOffline} className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {item.expanded && (
                <div className="ml-10 sm:ml-14 space-y-2 mb-4 animate-in slide-in-from-top-2 duration-200">
                  {item.subtopics.map(sub => (
                    <div key={sub.id} className={cn(
                      "flex items-center gap-3 rounded-xl p-2.5 transition-colors border",
                      sub.completed ? "bg-muted/20 border-transparent opacity-70" : "bg-card border-border/40 hover:border-border"
                    )}>
                      <Checkbox 
                        checked={sub.completed} 
                        onCheckedChange={() => toggleSubtopic(item.id, sub)} 
                        disabled={isOffline}
                        className="h-5 w-5 rounded-md border-primary/30"
                      />
                      
                      {editingSub === sub.id ? (
                        <Input
                          autoFocus
                          className="flex-1 h-8 text-sm font-medium rounded-lg"
                          value={editingSubText}
                          onChange={e => setEditingSubText(e.target.value)}
                          onBlur={() => saveEditSub(item.id, sub.id)}
                          onKeyDown={e => e.key === "Enter" && saveEditSub(item.id, sub.id)}
                        />
                      ) : (
                        <span
                          className={cn("flex-1 text-sm font-medium cursor-pointer select-none", sub.completed && "line-through text-muted-foreground")}
                          onDoubleClick={() => startEditSub(sub)}
                        >
                          {sub.title}
                        </span>
                      )}
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" disabled={isOffline} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary transition-colors" onClick={() => startEditSub(sub)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={isOffline} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteSubtopic(item.id, sub.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Adicionar subtópico..."
                      className="h-10 text-sm rounded-xl bg-muted/20 border-border"
                      value={newSubtopics[item.id] ?? ""}
                      disabled={isOffline}
                      onChange={e => setNewSubtopics({ ...newSubtopics, [item.id]: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && addSubtopic(item.id)}
                    />
                    <Button size="icon" variant="secondary" disabled={isOffline} className="h-10 w-10 rounded-xl shrink-0" onClick={() => addSubtopic(item.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
