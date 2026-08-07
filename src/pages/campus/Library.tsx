import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ROOM_STATUS_META, RoomStatus, useIsAdmin, useLibraryRooms } from "@/hooks/useCampusServices";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Plus, Plug, PencilRuler, Users, Clock } from "lucide-react";

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)} h`;
}

export default function CampusLibrary() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { rooms, latest, loading, report, reload } = useLibraryRooms();
  const [noteRoom, setNoteRoom] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", floor: "", capacity: "4", description: "" });

  async function createRoom() {
    if (!form.name.trim()) return;
    const { error } = await supabase.from("library_rooms").insert({
      name: form.name.trim(),
      floor: form.floor.trim() || null,
      capacity: Number(form.capacity) || 4,
      description: form.description.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Sala cadastrada.");
    setForm({ name: "", floor: "", capacity: "4", description: "" });
    setCreating(false);
    void reload();
  }

  async function send(roomId: string, status: RoomStatus) {
    await report(roomId, status, noteRoom === roomId ? note : undefined);
    setNoteRoom(null);
    setNote("");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28 px-4 sm:px-6 pt-4 animate-in fade-in duration-500">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campus")} className="h-11 w-11 rounded-2xl shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-11 w-11 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight truncate">Salas de estudo</h1>
          <p className="text-[11px] text-muted-foreground">Biblioteca Central • status em tempo real</p>
        </div>
        {isAdmin && (
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-11 w-11 rounded-2xl shrink-0">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Nova sala</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sala de Estudo 01" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Andar</Label>
                    <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="2º andar" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Capacidade</Label>
                    <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createRoom} className="rounded-xl font-bold">Cadastrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-[24px] bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card className="rounded-[24px] border-border/30 shadow-sm">
          <CardContent className="p-8 text-center space-y-2">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold">Nenhuma sala cadastrada ainda</p>
            <p className="text-xs text-muted-foreground">A coordenação da biblioteca precisa cadastrar as salas para os relatos começarem.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => {
            const last = latest.get(room.id);
            const meta = last ? ROOM_STATUS_META[last.status] : null;
            return (
              <Card key={room.id} className="rounded-[24px] border border-border/30 shadow-sm overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold truncate">{room.name}</h2>
                      <div className="flex items-center flex-wrap gap-2 mt-1.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {room.capacity} lugares
                        </span>
                        {room.floor && <span className="text-[11px] text-muted-foreground">{room.floor}</span>}
                        {room.has_power && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Plug className="h-3.5 w-3.5" /> tomada</span>
                        )}
                        {room.has_whiteboard && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1"><PencilRuler className="h-3.5 w-3.5" /> lousa</span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                        meta ? meta.classes : "bg-muted text-muted-foreground border-border/40",
                      )}
                    >
                      {meta ? meta.label : "sem relato"}
                    </Badge>
                  </div>

                  {last && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Atualizado há {timeAgo(last.created_at)}
                      {last.note ? ` • “${last.note}”` : ""}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {(["free", "partial", "full"] as RoomStatus[]).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        onClick={() => void send(room.id, status)}
                        className="h-11 rounded-2xl text-[11px] font-bold border-border/40"
                      >
                        {ROOM_STATUS_META[status].label}
                      </Button>
                    ))}
                  </div>

                  {noteRoom === room.id ? (
                    <Input
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Observação (opcional)"
                      className="rounded-2xl h-11"
                    />
                  ) : (
                    <button
                      onClick={() => setNoteRoom(room.id)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Adicionar observação
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}