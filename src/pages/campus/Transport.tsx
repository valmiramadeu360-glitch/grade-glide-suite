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
import { TRANSPORT_STATUS_META, TransportStatus, nextDepartures, useIsAdmin, useTransport } from "@/hooks/useCampusServices";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Bus, Plus, MapPin, Clock } from "lucide-react";

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)} h`;
}

export default function CampusTransport() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { routes, stops, departures, latest, loading, report, reload } = useTransport();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", stops: "", times: "" });
  const [delayFor, setDelayFor] = useState<string | null>(null);
  const [delay, setDelay] = useState("10");

  async function createRoute() {
    if (!form.name.trim()) return;
    const { data, error } = await supabase
      .from("transport_routes")
      .insert({ name: form.name.trim(), description: form.description.trim() || null })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message ?? "Falha ao criar rota");

    const stopNames = form.stops.split(",").map((s) => s.trim()).filter(Boolean);
    if (stopNames.length) {
      await supabase.from("transport_stops").insert(
        stopNames.map((name, i) => ({ route_id: data.id, name, position: i + 1 })),
      );
    }

    const times = form.times.split(",").map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t));
    if (times.length) {
      await supabase.from("transport_departures").insert(
        times.map((t) => ({ route_id: data.id, departure_time: t.length === 4 ? `0${t}` : t })),
      );
    }

    toast.success("Rota cadastrada.");
    setForm({ name: "", description: "", stops: "", times: "" });
    setCreating(false);
    void reload();
  }

  async function send(routeId: string, status: TransportStatus) {
    await report(routeId, status, status === "delayed" ? Number(delay) || 10 : undefined);
    setDelayFor(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-28 px-4 sm:px-6 pt-4 animate-in fade-in duration-500">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campus")} className="h-11 w-11 rounded-2xl shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
          <Bus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight truncate">Transporte circular</h1>
          <p className="text-[11px] text-muted-foreground">Horários oficiais • status reportado pelos alunos</p>
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
                <DialogTitle>Nova rota</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome da rota</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Circular Interno" />
                </div>
                <div className="space-y-1.5">
                  <Label>Paradas (separadas por vírgula)</Label>
                  <Input value={form.stops} onChange={(e) => setForm({ ...form, stops: e.target.value })} placeholder="Portaria, Biblioteca, RU" />
                </div>
                <div className="space-y-1.5">
                  <Label>Horários de saída (separados por vírgula)</Label>
                  <Input value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} placeholder="07:00, 07:30, 08:00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createRoute} className="rounded-xl font-bold">Cadastrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-[24px] bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : routes.length === 0 ? (
        <Card className="rounded-[24px] border-border/30 shadow-sm">
          <CardContent className="p-8 text-center space-y-2">
            <Bus className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold">Nenhuma rota cadastrada</p>
            <p className="text-xs text-muted-foreground">A administração precisa cadastrar as rotas e horários do circular.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const last = latest.get(route.id);
            const meta = last ? TRANSPORT_STATUS_META[last.status] : null;
            const routeStops = stops.filter((s) => s.route_id === route.id);
            const next = nextDepartures(departures, route.id);
            return (
              <Card key={route.id} className="rounded-[24px] border border-border/30 shadow-sm overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold truncate">{route.name}</h2>
                      {route.description && <p className="text-[11px] text-muted-foreground mt-0.5">{route.description}</p>}
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
                      <Clock className="h-3.5 w-3.5" /> Há {timeAgo(last.created_at)}
                      {last.delay_minutes ? ` • ~${last.delay_minutes} min de atraso` : ""}
                    </p>
                  )}

                  <div className="bg-muted/30 rounded-2xl border border-border/30 p-3.5 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximas saídas de hoje</p>
                    {next.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem saídas restantes hoje.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {next.map((d) => (
                          <span key={d.id} className="px-2.5 py-1 rounded-full bg-background border border-border/40 text-[11px] font-bold">
                            {d.departure_time.slice(0, 5)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {routeStops.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {routeStops.map((s, i) => (
                        <span key={s.id} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          {i === 0 && <MapPin className="h-3.5 w-3.5" />}
                          {s.name}
                          {i < routeStops.length - 1 && <span className="text-muted-foreground/40">→</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["on_time", "delayed", "crowded", "no_show"] as TransportStatus[]).map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        onClick={() => (status === "delayed" ? setDelayFor(route.id) : void send(route.id, status))}
                        className="h-11 rounded-2xl text-[11px] font-bold border-border/40"
                      >
                        {TRANSPORT_STATUS_META[status].label}
                      </Button>
                    ))}
                  </div>

                  {delayFor === route.id && (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        type="number"
                        value={delay}
                        onChange={(e) => setDelay(e.target.value)}
                        className="rounded-2xl h-11"
                        placeholder="Minutos de atraso"
                      />
                      <Button onClick={() => void send(route.id, "delayed")} className="h-11 rounded-2xl font-bold shrink-0">
                        Enviar
                      </Button>
                    </div>
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