import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, CloudOff, ListTodo, CheckCircle2 } from "lucide-react";
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
    // Atualização Otimista: A interface muda na hora, mesmo sem internet
    const prev = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
    
    if (isOffline) {
      // TODO: Web Worker/Queue para sincronizar quando a rede voltar
      return; 
    }

    const { error } = await supabase.from("checklist_items").update({ completed: !item.completed }).eq("id", item.id);
    if (error) setItems(prev); // Reverte se der erro
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
    
    // Atualização Otimista UI
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
    
    // Atualização Otimista UI
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
    // Atualização Otimista UI
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
      
      {/* Header com Progresso */}
      <CardHeader className="pb-5 pt-6 px-6 sm:px-8 border-b border-border/40">
        <div className="flex flex-col gap-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" /> Checklist e Edital
          </CardTitle>
          <div className="flex items-center gap-4 bg-background border border-border/50 p-4 rounded-2xl shadow-sm">
            <Progress value={progress} className="flex-1 h-3 sm:h-4 shadow-inner bg-muted [&>div]:bg-primary" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary shrink-0 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> {completedTasks}/{allTasks}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6 sm:p-8">
        
        {isOffline && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest animate-pulse">
            <CloudOff className="h-4 w-4" /> Modo Offline. Algumas ações estão pausadas.
          </div>
        )}

        {/* Input Principal */}
        <div className="flex gap-3">
          <Input
            placeholder="Ex: Teoria Geral do Estado..."
            className="h-14 sm:h-16 rounded-2xl bg-background border-border/50 focus:ring-primary/20 text-base sm:text-lg font-bold flex-1 shadow-sm"
            value={newItem}
            disabled={isOffline}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button size="icon" onClick={addItem} disabled={isOffline || !newItem.trim()} className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl shadow-xl shadow-primary/20 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95">
            <Plus className="h-6 w-6 sm:h-7 sm:w-7" />
          </Button>
        </div>

        {/* Lista de Tarefas */}
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              
              {/* Item Principal */}
              <div className={cn(
                "flex items-center gap-3 sm:gap-4 rounded-2xl p-3 sm:p-4 transition-all border",
                item.completed ? "bg-muted/20 border-border/30 opacity-70" : "bg-background border-border/60 shadow-sm hover:border-primary/40 hover:shadow-md"
              )}>
                
                {/* Botão Expandir - Área de Toque Otimizada */}
                <Button size="icon" variant="ghost" className="h-12 w-12 shrink-0 rounded-xl hover:bg-muted/50" onClick={() => toggleExpand(item.id)}>
                  {item.expanded ? <ChevronDown className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
                </Button>
                
                <Checkbox 
                  checked={item.completed} 
                  onCheckedChange={() => toggleItem(item)} 
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg border-2 border-primary/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-inner transition-colors"
                />

                {/* Área de Texto / Edição */}
                {editingItem === item.id ? (
                  <Input
                    autoFocus
                    className="flex-1 h-12 text-base sm:text-lg font-black rounded-xl bg-background border-primary/40 focus:ring-primary/20"
                    value={editingItemText}
                    onChange={e => setEditingItemText(e.target.value)}
                    onBlur={() => saveEditItem(item.id)}
                    onKeyDown={e => e.key === "Enter" && saveEditItem(item.id)}
                  />
                ) : (
                  <span
                    className={cn("flex-1 text-base sm:text-lg font-black cursor-pointer select-none leading-tight truncate transition-colors hover:text-primary", item.completed && "line-through text-muted-foreground")}
                    onDoubleClick={() => startEditItem(item)}
                    onClick={() => startEditItem(item)} // Permite o clique simples no mobile para facilitar a edição
                  >
                    {item.title}
                  </span>
                )}

                {/* Contador de Subtópicos Mobile */}
                {item.subtopics.length > 0 && (
                  <span className="text-[10px] bg-muted/50 px-2.5 py-1.5 rounded-lg text-muted-foreground font-black tracking-widest shrink-0 hidden sm:block">
                    {item.subtopics.filter(s => s.completed).length}/{item.subtopics.length}
                  </span>
                )}
                
                {/* Ações (Editar / Excluir) */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => startEditItem(item)}>
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={isOffline} className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10 transition-colors hidden sm:flex" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Subtópicos Expandidos */}
              {item.expanded && (
                <div className="ml-6 pl-4 sm:ml-10 sm:pl-6 border-l-2 border-border/40 space-y-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {item.subtopics.map(sub => (
                    <div key={sub.id} className={cn(
                      "flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-4 transition-colors border",
                      sub.completed ? "bg-muted/10 border-transparent opacity-60" : "bg-card border-border/40 hover:border-border/80"
                    )}>
                      <Checkbox 
                        checked={sub.completed} 
                        onCheckedChange={() => toggleSubtopic(item.id, sub)} 
                        className="h-6 w-6 rounded-[6px] border-primary/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      
                      {editingSub === sub.id ? (
                        <Input
                          autoFocus
                          className="flex-1 h-10 text-sm font-bold rounded-lg bg-background border-primary/40 focus:ring-primary/20"
                          value={editingSubText}
                          onChange={e => setEditingSubText(e.target.value)}
                          onBlur={() => saveEditSub(item.id, sub.id)}
                          onKeyDown={e => e.key === "Enter" && saveEditSub(item.id, sub.id)}
                        />
                      ) : (
                        <span
                          className={cn("flex-1 text-sm sm:text-base font-bold cursor-pointer select-none truncate hover:text-primary transition-colors", sub.completed && "line-through text-muted-foreground")}
                          onDoubleClick={() => startEditSub(sub)}
                          onClick={() => startEditSub(sub)}
                        >
                          {sub.title}
                        </span>
                      )}
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => startEditSub(sub)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={isOffline} className="h-10 w-10 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteSubtopic(item.id, sub.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Input Novo Subtópico */}
                  <div className="flex gap-3 mt-3">
                    <Input
                      placeholder="Criar subtópico..."
                      className="h-12 text-sm font-bold rounded-xl bg-background border-border/50 focus:ring-primary/20 shadow-sm"
                      value={newSubtopics[item.id] ?? ""}
                      disabled={isOffline}
                      onChange={e => setNewSubtopics({ ...newSubtopics, [item.id]: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && addSubtopic(item.id)}
                    />
                    <Button size="icon" variant="secondary" disabled={isOffline || !(newSubtopics[item.id]?.trim())} className="h-12 w-12 rounded-xl shrink-0 border border-border/50 bg-card hover:bg-muted" onClick={() => addSubtopic(item.id)}>
                      <Plus className="h-5 w-5" />
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
