import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, Check } from "lucide-react";
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
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newSubtopics, setNewSubtopics] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editingSubText, setEditingSubText] = useState("");

  useEffect(() => {
    loadItems();
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
    const prev = [...items];
    setItems(items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
    const { error } = await supabase.from("checklist_items").update({ completed: !item.completed }).eq("id", item.id);
    if (error) setItems(prev);
  }

  async function deleteItem(id: string) {
    if (!window.confirm("Deseja excluir este assunto e seus subtópicos?")) return;
    const prev = [...items];
    setItems(items.filter(i => i.id !== id));
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) setItems(prev);
  }

  function toggleExpand(id: string) {
    setItems(items.map(i => i.id === id ? { ...i, expanded: !i.expanded } : i));
  }

  // Edit item
  function startEditItem(item: ChecklistItem) {
    setEditingItem(item.id);
    setEditingItemText(item.title);
  }

  async function saveEditItem(id: string) {
    const text = editingItemText.trim();
    if (!text) return;
    setEditingItem(null);
    setItems(items.map(i => i.id === id ? { ...i, title: text } : i));
    await supabase.from("checklist_items").update({ title: text }).eq("id", id);
  }

  // Edit subtopic
  function startEditSub(sub: Subtopic) {
    setEditingSub(sub.id);
    setEditingSubText(sub.title);
  }

  async function saveEditSub(parentId: string, subId: string) {
    const text = editingSubText.trim();
    if (!text) return;
    setEditingSub(null);
    setItems(items.map(i => i.id === parentId
      ? { ...i, subtopics: i.subtopics.map(s => s.id === subId ? { ...s, title: text } : s) }
      : i
    ));
    await supabase.from("checklist_subtopics").update({ title: text }).eq("id", subId);
  }

  async function addSubtopic(parentId: string) {
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
    await supabase.from("checklist_subtopics").update({ completed: !sub.completed }).eq("id", sub.id);
  }

  async function deleteSubtopic(parentId: string, subId: string) {
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
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assuntos para Estudar</CardTitle>
        <div className="flex items-center gap-3 mt-2">
          <Progress value={progress} className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground">{completedTasks}/{allTasks}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Novo assunto principal..."
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
            <div key={item.id}>
              <div className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50 group">
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => toggleExpand(item.id)}>
                  {item.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
                <Checkbox checked={item.completed} onCheckedChange={() => toggleItem(item)} />

                {editingItem === item.id ? (
                  <Input
                    autoFocus
                    className="flex-1 h-7 text-sm"
                    value={editingItemText}
                    onChange={e => setEditingItemText(e.target.value)}
                    onBlur={() => saveEditItem(item.id)}
                    onKeyDown={e => e.key === "Enter" && saveEditItem(item.id)}
                  />
                ) : (
                  <span
                    className={cn("flex-1 text-sm cursor-pointer", item.completed && "line-through text-muted-foreground")}
                    onDoubleClick={() => startEditItem(item)}
                  >
                    {item.title}
                  </span>
                )}

                {item.subtopics.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-bold">
                    {item.subtopics.filter(s => s.completed).length}/{item.subtopics.length}
                  </span>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary" onClick={() => startEditItem(item)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteItem(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {item.expanded && (
                <div className="ml-10 space-y-1 mt-1 mb-2">
                  {item.subtopics.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted/30 group/sub">
                      <Checkbox checked={sub.completed} onCheckedChange={() => toggleSubtopic(item.id, sub)} className="h-3.5 w-3.5" />
                      {editingSub === sub.id ? (
                        <Input
                          autoFocus
                          className="flex-1 h-6 text-xs"
                          value={editingSubText}
                          onChange={e => setEditingSubText(e.target.value)}
                          onBlur={() => saveEditSub(item.id, sub.id)}
                          onKeyDown={e => e.key === "Enter" && saveEditSub(item.id, sub.id)}
                        />
                      ) : (
                        <span
                          className={cn("flex-1 text-xs cursor-pointer", sub.completed && "line-through text-muted-foreground")}
                          onDoubleClick={() => startEditSub(sub)}
                        >
                          {sub.title}
                        </span>
                      )}
                      <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-primary" onClick={() => startEditSub(sub)}>
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover/sub:opacity-100 text-destructive" onClick={() => deleteSubtopic(item.id, sub.id)}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      placeholder="Subtópico..."
                      className="h-7 text-xs"
                      value={newSubtopics[item.id] ?? ""}
                      onChange={e => setNewSubtopics({ ...newSubtopics, [item.id]: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && addSubtopic(item.id)}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => addSubtopic(item.id)}>
                      <Plus className="h-3 w-3" />
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
