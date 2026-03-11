import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, CloudOff, ListTodo, CheckCircle2, GripVertical } from "lucide-react";
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
  
  // Estados de Edição Inline
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editingSubText, setEditingSubText] = useState("");

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
      toast({ title: "Modo Offline", description: "Conecte-se para adicionar novos tópicos.", variant: "destructive" });
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
      setItems([...items, { id: data.id, title: data.title, completed: false, subtopics: [], expanded: true }]);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    const prev = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
    
    if (isOffline) return; 

    const { error } = await supabase.from("checklist_items").update({ completed: !item.completed }).eq("id", item.id);
    if (error) setItems(prev);
  }

  async function deleteItem(id: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Não é possível excluir sem conexão.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Deseja excluir permanentemente este assunto e todos os seus subtópicos?")) return;
    
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
    if (!text) {
      setEditingItem(null);
      return;
    }
    
    setItems(items.map(i => i.id === id ? { ...i, title: text } : i));
    setEditingItem(null);
    
    if (!isOffline) {
      await supabase.from("checklist_items").update({ title: text }).eq("id", id);
    }
  }

  function startEditSub(sub: Subtopic) {
    setEditingSub(sub.id);
    setEditingSubText(sub.title);
  }

  async function saveEditSub(parentId: string, subId: string) {
    const text = editingSubText.trim();
    if (!text) {
      setEditingSub(null);
      return;
    }
    
    setItems(items.map(i => i.id === parentId
      ? { ...i, subtopics: i.subtopics.map(s => s.id === subId ? { ...s, title: text } : s) }
      : i
    ));
    setEditingSub(null);
    
    if (!isOffline) {
      await supabase.from("checklist_subtopics").update({ title: text }).eq("id", subId);
    }
  }

  async function addSubtopic(parentId: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se para adicionar subtópicos.", variant: "destructive" });
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
    setItems(items.map(i =>
      i.id === parentId
        ? { ...i, subtopics: i.subtopics.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s) }
        : i
    ));
    
    if (!isOffline) {
      await supabase.from("checklist_subtopics").update({ completed: !sub.completed }).eq("id", sub.id);
    }
  }

  async function deleteSubtopic(parentId: string, subId: string) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se para excluir.", variant: "destructive" });
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
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="pb-5 pt-6 px-6 sm:px-8 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2 shrink-0">
            <ListTodo className="h-4 w-4 text-primary" /> Edital de Estudos
          </CardTitle>
          <div className="flex items-center gap-4 bg-background border border-border/50 p-3 sm:p-4 rounded-[20px] shadow-sm w-full sm:w-[350px]">
            <Progress value={progress} className="flex-1 h-3 sm:h-4 shadow-inner bg-muted [&>div]:bg-primary transition-all duration-1000 ease-out" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary shrink-0 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> {completedTasks}/{allTasks}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-4 sm:p-8 bg-card/30">
        
        {isOffline && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest animate-pulse shadow-inner mb-6">
            <CloudOff className="h-4 w-4 shrink-0" /> Operando Offline. Sincronização suspensa temporariamente.
          </div>
        )}

        <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-[24px] border border-border/50 shadow-sm focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Input
            placeholder="Adicionar novo tópico ao edital..."
            className="h-14 sm:h-16 border-none bg-transparent shadow-none focus-visible:ring-0 text-base font-bold px-4"
            value={newItem}
            disabled={isOffline}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button 
            size="icon" 
            onClick={addItem} 
            disabled={isOffline || !newItem.trim()} 
            className={cn(
              "h-12 w-12 sm:h-14 sm:w-14 rounded-[20px] shrink-0 transition-all",
              newItem.trim() ? "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95" : "bg-muted text-muted-foreground"
            )}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>

        <div className="space-y-4 pt-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-background">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-5 shadow-inner">
                <ListTodo className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-black text-foreground">Edital Vazio</h3>
              <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[250px]">Adicione os tópicos de estudo para começar a progredir.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                <div className={cn(
                  "group flex items-center gap-3 sm:gap-4 rounded-[24px] p-3 sm:p-4 transition-all duration-300 border",
                  item.completed 
                    ? "bg-muted/10 border-border/20 opacity-60 hover:opacity-100" 
                    : "bg-card border-border/50 shadow-sm hover:border-primary/40 hover:shadow-md"
                )}>
                  
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-12 w-12 shrink-0 rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground group-hover:text-foreground" 
                    onClick={() => toggleExpand(item.id)}
                  >
                    {item.expanded ? <ChevronDown className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
                  </Button>
                  
                  <Checkbox 
                    checked={item.completed} 
                    onCheckedChange={() => toggleItem(item)} 
                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-[10px] border-2 border-primary/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-inner transition-transform hover:scale-105"
                  />

                  {editingItem === item.id ? (
                    <Input
                      autoFocus
                      className="flex-1 h-12 text-base sm:text-lg font-black rounded-xl bg-background border-primary/40 focus:ring-primary/30 px-4"
                      value={editingItemText}
                      onChange={e => setEditingItemText(e.target.value)}
                      onBlur={() => saveEditItem(item.id)}
                      onKeyDown={e => e.key === "Enter" && saveEditItem(item.id)}
                    />
                  ) : (
                    <span
                      className={cn("flex-1 text-base sm:text-lg font-black cursor-text select-none leading-tight truncate transition-colors hover:text-primary px-2", item.completed && "line-through text-muted-foreground/70 decoration-2")}
                      onClick={() => startEditItem(item)}
                      title="Clique para editar"
                    >
                      {item.title}
                    </span>
                  )}

                  {item.subtopics.length > 0 && (
                    <span className="text-[10px] bg-muted/50 border border-border/50 px-3 py-1.5 rounded-lg text-muted-foreground font-black tracking-widest shrink-0 hidden sm:block">
                      {item.subtopics.filter(s => s.completed).length}/{item.subtopics.length}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => startEditItem(item)}>
                      <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={isOffline} className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>
                </div>

                {item.expanded && (
                  <div className="ml-7 pl-4 sm:ml-11 sm:pl-6 border-l-2 border-border/40 space-y-3 mb-8 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    {item.subtopics.map(sub => (
                      <div key={sub.id} className={cn(
                        "group/sub flex items-center gap-3 sm:gap-4 rounded-[16px] p-2.5 sm:p-3 transition-colors border",
                        sub.completed 
                          ? "bg-transparent border-transparent opacity-50 hover:opacity-100" 
                          : "bg-muted/10 border-border/30 hover:border-border/60 hover:bg-muted/30 shadow-sm"
                      )}>
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 hidden sm:block" />
                        
                        <Checkbox 
                          checked={sub.completed} 
                          onCheckedChange={() => toggleSubtopic(item.id, sub)} 
                          className="h-5 w-5 sm:h-6 sm:w-6 rounded-md border-primary/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 hover:scale-105 transition-transform shrink-0"
                        />
                        
                        {editingSub === sub.id ? (
                          <Input
                            autoFocus
                            className="flex-1 h-10 text-sm font-bold rounded-lg bg-background border-primary/40 focus:ring-primary/30 px-3"
                            value={editingSubText}
                            onChange={e => setEditingSubText(e.target.value)}
                            onBlur={() => saveEditSub(item.id, sub.id)}
                            onKeyDown={e => e.key === "Enter" && saveEditSub(item.id, sub.id)}
                          />
                        ) : (
                          <span
                            className={cn("flex-1 text-sm sm:text-[15px] font-bold cursor-text select-none truncate hover:text-primary transition-colors px-1", sub.completed && "line-through text-muted-foreground")}
                            onClick={() => startEditSub(sub)}
                          >
                            {sub.title}
                          </span>
                        )}
                        
                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover/sub:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => startEditSub(sub)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" disabled={isOffline} className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteSubtopic(item.id, sub.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex items-center gap-3 mt-4 pt-2 bg-background border border-border/50 p-1.5 rounded-[16px] shadow-sm focus-within:border-primary/30 transition-all">
                      <Input
                        placeholder="Adicionar subtópico..."
                        className="h-10 sm:h-12 text-sm font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-3"
                        value={newSubtopics[item.id] ?? ""}
                        disabled={isOffline}
                        onChange={e => setNewSubtopics({ ...newSubtopics, [item.id]: e.target.value })}
                        onKeyDown={e => e.key === "Enter" && addSubtopic(item.id)}
                      />
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        disabled={isOffline || !(newSubtopics[item.id]?.trim())} 
                        className={cn(
                          "h-10 w-10 sm:h-12 sm:w-12 rounded-[12px] shrink-0 transition-transform active:scale-95",
                          newSubtopics[item.id]?.trim() ? "bg-primary text-white hover:bg-primary/90" : "bg-muted text-muted-foreground"
                        )} 
                        onClick={() => addSubtopic(item.id)}
                      >
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
