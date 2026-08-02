import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  UtensilsCrossed, Clock, MapPin, Megaphone, Star, BarChart3, Bot,
  Camera, Loader2, Flame, ChevronLeft, ShieldCheck, Send, History,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useRu, requestPosition, distanceMeters, LEVEL_META, CONFIDENCE_LABEL, type RuLevel,
} from "@/hooks/useRu";

const LEVELS: RuLevel[] = ["none", "small", "medium", "large"];

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function itemsOf(items: unknown): string[] {
  if (Array.isArray(items)) return items.map((i) => String(i));
  return [];
}

export default function Ru() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { restaurant, status, history, peak, menus, notices, ratingSummary, loading, reload, reloadStatus } = useRu();

  const [sending, setSending] = useState<RuLevel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [savingRating, setSavingRating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const todayMenu = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return menus.find((m) => m.service_date === today) ?? menus[0] ?? null;
  }, [menus]);

  const nutrition = (todayMenu?.nutrition ?? null) as Record<string, any> | null;
  const statusMeta = status?.level ? LEVEL_META[status.level] : null;
  const reliable = (status?.sample_size ?? 0) >= 3;

  const maxPeak = Math.max(1, ...peak.map((p) => p.avg_score));

  async function handleReport(level: RuLevel) {
    if (!user || !restaurant) return;
    setSending(level);
    try {
      const position = await requestPosition();
      const { latitude, longitude } = position.coords;
      const dist = distanceMeters(restaurant.latitude, restaurant.longitude, latitude, longitude);

      if (dist > restaurant.radius_meters) {
        toast({
          title: "Não é possível responder",
          description: `Você precisa estar próximo ao Restaurante Universitário (até ${restaurant.radius_meters} m). Distância atual: ${Math.round(dist)} m.`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("ru_queue_reports").insert({
        restaurant_id: restaurant.id,
        user_id: user.id,
        level,
        latitude,
        longitude,
        distance_meters: Math.round(dist),
      });
      if (error) throw error;

      toast({ title: "Obrigado por colaborar! 🍲", description: "A estimativa da fila foi recalculada." });
      await Promise.all([reloadStatus(restaurant.id), reload()]);
    } catch (error: any) {
      toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" });
    } finally {
      setSending(null);
    }
  }

  async function handleMenuPhoto(file: File) {
    if (!user || !restaurant) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("ru-menus").upload(path, file);
      if (upErr) throw upErr;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
        reader.readAsDataURL(file);
      });

      const { data: ai, error: aiErr } = await supabase.functions.invoke("ru-menu-ai", {
        body: { action: "ocr_menu", imageUrl: dataUrl },
      });
      if (aiErr) throw aiErr;
      if (ai?.error) throw new Error(ai.error);

      const hour = new Date().getHours();
      const { error: insErr } = await supabase.from("ru_menus").insert({
        restaurant_id: restaurant.id,
        submitted_by: user.id,
        meal: hour >= 16 ? "dinner" : "lunch",
        photo_url: path,
        raw_text: ai?.raw_text ?? null,
        items: ai?.items ?? [],
        nutrition: ai?.nutrition
          ? { ...ai.nutrition, vegetarian_option: ai.vegetarian_option ?? null, allergens: ai.allergens ?? [], tip: ai.tip ?? null }
          : null,
      });
      if (insErr) throw insErr;

      toast({ title: "Cardápio publicado! 📸", description: "A foto original fica disponível para conferência." });
      await reload();
    } catch (error: any) {
      toast({ title: "Erro ao enviar cardápio", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleAsk() {
    if (!question.trim() || !restaurant) return;
    setAsking(true);
    setAnswer(null);
    try {
      const context = [
        `Restaurante: ${restaurant.name} (${restaurant.description ?? ""})`,
        `Funcionamento: almoço ${formatTime(restaurant.lunch_start)}–${formatTime(restaurant.lunch_end)}, jantar ${formatTime(restaurant.dinner_start)}–${formatTime(restaurant.dinner_end)}`,
        `Aberto agora: ${restaurant.is_open ? "sim" : `não (${restaurant.closed_reason ?? "sem motivo informado"})`}`,
        `Fila atual: ${statusMeta ? `${statusMeta.label} (${statusMeta.minutes})` : "sem relatos recentes"} — ${CONFIDENCE_LABEL[status?.confidence ?? "none"]}, ${status?.sample_size ?? 0} relatos`,
        `Horários de pico (hora: intensidade média 0-3): ${peak.map((p) => `${p.hour}h: ${p.avg_score}`).join(", ") || "sem histórico"}`,
        `Cardápio (${todayMenu?.service_date ?? "sem data"}): ${itemsOf(todayMenu?.items).join(", ") || todayMenu?.raw_text || "não publicado"}`,
        `Nutrição estimada: ${nutrition ? JSON.stringify(nutrition) : "não estimada"}`,
        `Avisos oficiais: ${notices.map((n) => n.title).join(" | ") || "nenhum"}`,
      ].join("\n");

      const { data, error } = await supabase.functions.invoke("ru-menu-ai", {
        body: { action: "ask", question, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnswer(data?.answer ?? "");
    } catch (error: any) {
      toast({ title: "Assistente indisponível", description: error.message, variant: "destructive" });
    } finally {
      setAsking(false);
    }
  }

  async function handleSaveRating() {
    if (!user || !restaurant) return;
    setSavingRating(true);
    try {
      const { error } = await supabase.from("ru_ratings").upsert(
        {
          restaurant_id: restaurant.id,
          user_id: user.id,
          service_date: new Date().toISOString().slice(0, 10),
          food: rating.food ?? null,
          cleanliness: rating.cleanliness ?? null,
          service: rating.service ?? null,
          waiting: rating.waiting ?? null,
        },
        { onConflict: "restaurant_id,user_id,service_date" },
      );
      if (error) throw error;
      toast({ title: "Avaliação registrada ⭐", description: "Suas notas entram apenas nas médias gerais." });
      await reload();
    } catch (error: any) {
      toast({ title: "Erro ao avaliar", description: error.message, variant: "destructive" });
    } finally {
      setSavingRating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 space-y-4 pb-28">
        <Skeleton className="h-24 w-full rounded-[24px]" />
        <Skeleton className="h-48 w-full rounded-[24px]" />
        <Skeleton className="h-64 w-full rounded-[24px]" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center space-y-3">
        <UtensilsCrossed className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-bold">Restaurante Universitário</h1>
        <p className="text-sm text-muted-foreground">Nenhum restaurante configurado para o seu campus ainda.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-300 pb-28 px-4 sm:px-6 pt-4">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full shrink-0" onClick={() => navigate("/campus")}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">Restaurante Universitário</h1>
          <p className="text-[11px] text-muted-foreground truncate">{restaurant.description ?? "Painel colaborativo"}</p>
        </div>
      </header>

      {!restaurant.is_open && (
        <Card className="rounded-[24px] border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Megaphone className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-600">Restaurante fechado</p>
              <p className="text-xs text-muted-foreground mt-0.5">{restaurant.closed_reason ?? "Sem motivo informado."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STATUS DA FILA */}
      <Card className="rounded-[28px] border border-border/30 shadow-sm overflow-hidden">
        <div className={cn("h-1.5 w-full", statusMeta?.dot ?? "bg-muted")} />
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Status da fila</p>
              <p className="text-2xl font-black mt-1">{statusMeta ? `${statusMeta.emoji} ${statusMeta.label}` : "Sem dados recentes"}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Tempo estimado: {statusMeta?.minutes ?? "—"}
              </p>
            </div>
            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", statusMeta?.classes)}>
              {CONFIDENCE_LABEL[status?.confidence ?? "none"]}
            </Badge>
          </div>

          {!reliable && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/30">
              ⚠️ Estimativa com baixa confiabilidade: apenas {status?.sample_size ?? 0} relato(s) nos últimos 20 minutos.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Está no RU agora? Sua localização é validada (raio de {restaurant.radius_meters} m).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LEVELS.map((level) => {
                const meta = LEVEL_META[level];
                return (
                  <Button
                    key={level}
                    variant="outline"
                    disabled={!!sending}
                    onClick={() => handleReport(level)}
                    className={cn("h-12 rounded-xl text-[12px] font-bold border shadow-sm", meta.classes)}
                  >
                    {sending === level ? <Loader2 className="h-4 w-4 animate-spin" /> : `${meta.emoji} ${meta.label}`}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="menu" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4 rounded-2xl h-11">
          <TabsTrigger value="menu" className="text-[11px] font-bold rounded-xl">Cardápio</TabsTrigger>
          <TabsTrigger value="stats" className="text-[11px] font-bold rounded-xl">Movimento</TabsTrigger>
          <TabsTrigger value="info" className="text-[11px] font-bold rounded-xl">Informações</TabsTrigger>
          <TabsTrigger value="ai" className="text-[11px] font-bold rounded-xl">Assistente</TabsTrigger>
        </TabsList>

        {/* CARDÁPIO */}
        <TabsContent value="menu" className="space-y-4 m-0">
          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-primary" /> Cardápio do dia</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {todayMenu ? `${todayMenu.meal === "dinner" ? "Jantar" : "Almoço"} • ${todayMenu.service_date}` : "Ainda não publicado hoje"}
                  </p>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleMenuPhoto(e.target.files[0])}
                />
                <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()} className="rounded-xl text-[11px] font-bold">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4 mr-1.5" /> Fotografar</>}
                </Button>
              </div>

              {todayMenu ? (
                <div className="space-y-3">
                  {itemsOf(todayMenu.items).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {itemsOf(todayMenu.items).map((item, i) => (
                        <Badge key={i} variant="secondary" className="rounded-full text-[11px] font-semibold">{item}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs whitespace-pre-line text-muted-foreground">{todayMenu.raw_text ?? "Texto não reconhecido."}</p>
                  )}

                  {todayMenu.signedPhoto && (
                    <a href={todayMenu.signedPhoto} target="_blank" rel="noreferrer" className="block">
                      <img src={todayMenu.signedPhoto} alt="Foto original do cardápio do Restaurante Universitário" className="w-full max-h-64 object-cover rounded-2xl border border-border/40" loading="lazy" />
                      <p className="text-[10px] text-muted-foreground mt-1.5">Foto original enviada por um estudante — toque para conferir.</p>
                    </a>
                  )}

                  {nutrition && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5" /> Estimativa nutricional
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: "🔥 Calorias", value: nutrition.calories, unit: "kcal" },
                          { label: "🥩 Proteínas", value: nutrition.protein_g, unit: "g" },
                          { label: "🍞 Carboidratos", value: nutrition.carbs_g, unit: "g" },
                          { label: "🥗 Fibras", value: nutrition.fiber_g, unit: "g" },
                          { label: "🧈 Gorduras", value: nutrition.fat_g, unit: "g" },
                        ].map((n) => (
                          <div key={n.label} className="bg-muted/40 rounded-xl p-2.5 border border-border/30">
                            <p className="text-[9px] font-bold uppercase text-muted-foreground">{n.label}</p>
                            <p className="text-sm font-black">{n.value ?? "—"} <span className="text-[10px] font-medium text-muted-foreground">{n.unit}</span></p>
                          </div>
                        ))}
                      </div>
                      {nutrition.vegetarian_option && (
                        <p className="text-[11px] text-emerald-600 font-semibold">🥬 Opção vegetariana: {String(nutrition.vegetarian_option)}</p>
                      )}
                      {Array.isArray(nutrition.allergens) && nutrition.allergens.length > 0 && (
                        <p className="text-[11px] text-amber-600 font-semibold">⚠️ Possíveis alergênicos: {nutrition.allergens.join(", ")}</p>
                      )}
                      {nutrition.tip && <p className="text-[11px] text-muted-foreground">💡 {String(nutrition.tip)}</p>}
                      <p className="text-[10px] text-muted-foreground">⚠️ Valores aproximados — variam conforme preparo e porção servida.</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum cardápio publicado. Fotografe o monitor oficial do RU para colaborar.</p>
              )}
            </CardContent>
          </Card>

          {menus.length > 1 && (
            <Card className="rounded-[24px] border border-border/30">
              <CardContent className="p-5 space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Cardápios anteriores</h3>
                {menus.slice(1).map((menu) => (
                  <div key={menu.id} className="flex items-center justify-between gap-3 bg-muted/30 rounded-xl p-3 border border-border/30">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{menu.meal === "dinner" ? "Jantar" : "Almoço"} • {menu.service_date}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{itemsOf(menu.items).join(", ") || menu.raw_text || "—"}</p>
                    </div>
                    {menu.signedPhoto && (
                      <a href={menu.signedPhoto} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-primary shrink-0">Ver foto</a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MOVIMENTO */}
        <TabsContent value="stats" className="space-y-4 m-0">
          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Horários de pico (30 dias)</h2>
              {peak.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ainda sem histórico suficiente de relatos.</p>
              ) : (
                <div className="space-y-2">
                  {peak.map((p) => (
                    <div key={p.hour} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold w-10 shrink-0">{String(p.hour).padStart(2, "0")}h</span>
                      <Progress value={(p.avg_score / maxPeak) * 100} className="h-2.5" />
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">{p.reports} relatos</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Intensidade média da fila por hora — escolha horários com barras menores.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-2">
              <h2 className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Histórico recente</h2>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum relato registrado ainda.</p>
              ) : (
                history.slice(0, 12).map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded-xl px-3 py-2 border border-border/30">
                    <span className="font-semibold">{new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="font-bold">{LEVEL_META[h.level].emoji} {LEVEL_META[h.level].label}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INFORMAÇÕES */}
        <TabsContent value="info" className="space-y-4 m-0">
          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Funcionamento</h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Almoço</p>
                  <p className="text-sm font-black">{formatTime(restaurant.lunch_start)} – {formatTime(restaurant.lunch_end)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Jantar</p>
                  <p className="text-sm font-black">{formatTime(restaurant.dinner_start)} – {formatTime(restaurant.dinner_end)}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Horários gerenciados exclusivamente pela administração da universidade.</p>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-2">
              <h2 className="text-sm font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Avisos oficiais</h2>
              {notices.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum aviso ativo no momento.</p>
              ) : (
                notices.map((n) => (
                  <div key={n.id} className="bg-muted/30 rounded-xl p-3 border border-border/30">
                    <p className="text-xs font-bold">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground mt-0.5">{n.body}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Avaliações</h2>
              {ratingSummary ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: "food", label: "🍛 Refeição" },
                    { key: "cleanliness", label: "🧹 Limpeza" },
                    { key: "service", label: "😊 Atendimento" },
                    { key: "waiting", label: "⏱ Espera" },
                  ].map((f) => (
                    <div key={f.key} className="bg-muted/40 rounded-xl p-3 border border-border/30">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-black">{ratingSummary[f.key] ? ratingSummary[f.key].toFixed(1) : "—"} / 5</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem avaliações nos últimos 30 dias.</p>
              )}

              <div className="space-y-2 pt-1">
                {[
                  { key: "food", label: "🍛 Qualidade da refeição" },
                  { key: "cleanliness", label: "🧹 Limpeza" },
                  { key: "service", label: "😊 Atendimento" },
                  { key: "waiting", label: "⏱ Tempo de espera" },
                ].map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold">{f.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating((prev) => ({ ...prev, [f.key]: n }))}
                          aria-label={`${f.label}: ${n} estrelas`}
                          className="p-0.5"
                        >
                          <Star className={cn("h-4 w-4", (rating[f.key] ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <Button disabled={savingRating || Object.keys(rating).length === 0} onClick={handleSaveRating} className="w-full rounded-xl h-10 text-xs font-bold">
                  {savingRating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
                </Button>
                <p className="text-[10px] text-muted-foreground">As notas geram apenas médias gerais — nenhum usuário é exposto.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-2">
              <h2 className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Localização</h2>
              <p className="text-xs text-muted-foreground">{restaurant.description ?? "Campus"} • {restaurant.latitude.toFixed(6)}, {restaurant.longitude.toFixed(6)}</p>
              <Button
                variant="outline"
                className="rounded-xl h-10 text-xs font-bold w-full"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`, "_blank")}
              >
                Abrir rota até o RU
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSISTENTE IA */}
        <TabsContent value="ai" className="m-0">
          <Card className="rounded-[24px] border border-border/30">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> EduFlow AI — RU</h2>
              <div className="flex flex-wrap gap-2">
                {["Como está a fila agora?", "Qual o melhor horário para almoçar?", "Qual o cardápio de hoje?", "Existe opção vegetariana hoje?"].map((q) => (
                  <Button key={q} variant="secondary" size="sm" className="rounded-full text-[11px] font-semibold" onClick={() => setQuestion(q)}>
                    {q}
                  </Button>
                ))}
              </div>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Pergunte algo sobre o Restaurante Universitário..."
                className="rounded-2xl text-sm min-h-[80px]"
              />
              <Button onClick={handleAsk} disabled={asking || !question.trim()} className="w-full rounded-xl h-11 font-bold text-xs">
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Perguntar</>}
              </Button>
              {answer && (
                <div className="bg-muted/40 rounded-2xl p-4 border border-border/30 text-sm whitespace-pre-line">{answer}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}