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
import { ArrowLeft, Bus, Plus, MapPin, Clock, Map as MapIcon } from "lucide-react";

// Imports cruciais para o Mapa funcionar
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)} h`;
}

// Coordenada central da UFAL (Maceió)
const UFAL_CENTER: [number, number] = [-9.5539, -35.7772];

export default function CampusTransport() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { routes, stops, departures, latest, loading, report, reload } = useTransport();
  
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", stops: "", times: "" });
  const [delayFor, setDelayFor] = useState<string | null>(null);
  const [delay, setDelay] = useState("10");
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null); // Rota selecionada no mapa

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
          <p className="text-[11px] text-muted-foreground">Mapa ao vivo e horários de Maceió</p>
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
                  <Label>Nome da rota (ex: 046 - Village)</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="046 - Village / Centro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Paradas (separadas por vírgula)</Label>
                  <Input value={form.stops} onChange={(e) => setForm({ ...form, stops: e.target.value })} placeholder="Portaria UFAL, HU, Shopping" />
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

      {/* ÁREA DO MAPA - O "Cittamobi" do Campus */}
      <Card className="rounded-[24px] border border-border/30 shadow-sm overflow-hidden relative z-0">
        <div className="h-[35vh] w-full min-h-[250px] bg-muted/20 relative">
          <MapContainer 
            center={UFAL_CENTER} 
            zoom={14} 
            className="h-full w-full absolute inset-0 z-0"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {/* Renderizar as Rotas no Mapa */}
            {routes.map(route => {
              // Se a rota tem o traçado salvo em JSON (route_path)
              const pathData = (route as any).route_path; 
              const isSelected = activeRouteId === route.id || activeRouteId === null;
              
              if (!pathData || !isSelected) return null;
              
              return (
                <Polyline 
                  key={`path-${route.id}`} 
                  positions={pathData as [number, number][]} 
                  pathOptions={{ 
                    color: (route as any).route_color || '#3b82f6', 
                    weight: 4,
                    opacity: 0.8
                  }} 
                />
              );
            })}

            {/* Renderizar as Paradas (Pinos) no Mapa */}
            {stops.filter(s => s.latitude && s.longitude).map(stop => {
              const isSelected = activeRouteId === stop.route_id || activeRouteId === null;
              if (!isSelected) return null;

              return (
                <CircleMarker 
                  key={`stop-${stop.id}`}
                  center={[stop.latitude!, stop.longitude!]}
                  radius={6}
                  pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
                >
                  <Popup className="rounded-xl font-sans">
                    <p className="text-xs font-bold">{stop.name}</p>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
          
          {/* Badge Informativa sobre o Mapa */}
          <div className="absolute top-3 left-3 z-[1000]">
            <Badge className="bg-background/90 text-foreground backdrop-blur-md border-border/50 shadow-sm font-bold shadow-black/10">
              <MapIcon className="h-3 w-3 mr-1.5 text-primary" /> Maceió - AL
            </Badge>
          </div>
        </div>
      </Card>

      {/* LISTA DE ROTAS E PAINEL DE CONTROLE */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-black tracking-tight">Linhas e Circulares</h2>
        {activeRouteId && (
          <Button variant="link" size="sm" onClick={() => setActiveRouteId(null)} className="h-auto p-0 text-[11px]">
            Ver todas no mapa
          </Button>
        )}
      </div>

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
            <p className="text-xs text-muted-foreground">A administração precisa cadastrar as rotas e horários.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const last = latest.get(route.id);
            const meta = last ? TRANSPORT_STATUS_META[last.status] : null;
            const routeStops = stops.filter((s) => s.route_id === route.id);
            const next = nextDepartures(departures, route.id);
            const isActive = activeRouteId === route.id;

            return (
              <Card 
                key={route.id} 
                className={cn(
                  "rounded-[24px] border shadow-sm overflow-hidden transition-colors",
                  isActive ? "border-primary/50 ring-1 ring-primary/20" : "border-border/30 hover:border-border/60"
                )}
              >
                <CardContent className="p-5 space-y-4">
                  {/* Cabeçalho da Rota clicável para focar no mapa */}
                  <div 
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setActiveRouteId(isActive ? null : route.id)}
                  >
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold truncate flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (route as any).route_color || '#3b82f6' }} />
                        {route.name}
                      </h2>
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
                          <span key={d.id} className="px-2.5 py-1 rounded-full bg-background border border-border/40 text-[11px] font-bold shadow-sm">
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
                        className="h-11 rounded-2xl text-[11px] font-bold border-border/40 hover:bg-muted/50 transition-colors"
                      >
                        {TRANSPORT_STATUS_META[status].label}
                      </Button>
                    ))}
                  </div>

                  {delayFor === route.id && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <Input
                        autoFocus
                        type="number"
                        value={delay}
                        onChange={(e) => setDelay(e.target.value)}
                        className="rounded-2xl h-11 border-border/50"
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
