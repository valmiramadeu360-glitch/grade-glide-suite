import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  UtensilsCrossed, Clock, MapPin, Megaphone, Star, BarChart3, Bot,
  Camera, Loader2, Flame, ChevronLeft, ShieldCheck, Send, History,
  Image as ImageIcon, CheckCircle2, Timer, CalendarClock, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useRu, requestPosition, distanceMeters, hashFile, currentMeal, MEAL_LABEL,
  LEVEL_META, CONFIDENCE_LABEL, REPORT_COOLDOWN_SECONDS, formatServiceDate,
  getBrasiliaTime, type RuLevel, type RuMenu, type ReportedStatus
} from "@/hooks/useRu";

const LEVELS: RuLevel[] = ["none", "small", "medium", "large"];

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function itemsOf(items: unknown): string[] {
  if (Array.isArray(items)) return items.map((i) => String(i));
  return [];
}

function formatCooldown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface MenuGroup {
  key: string;
  service_date: string;
  meal: "lunch" | "dinner";
  primary: RuMenu;
  photoCount: number;
}

export default function Ru() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useTenant();
  const { toast } = useToast();
  
  const isResident = Boolean(profile?.is_resident);
  
  const {
    restaurant, status, history, peak, menus, notices, ratingSummary, myLastReport,
    activeException, loading, reload, reloadStatus, reportRuStatus
  } = useRu(profile?.campus_id, isResident);

  const [sending, setSending] = useState<RuLevel | null>(null);
  const [reportingConsensus, setReportingConsensus] = useState<ReportedStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [savingRating, setSavingRating] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; label: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const brTime = getBrasiliaTime();
  const todayISO = brTime.dateStr;
  
  // Como agora não passamos schedules aqui diretamente, baseamos o activeMeal na lógica da foto ou assumimos almoço/jantar.
  const latestMenu = menus[0];
  const activeMeal = latestMenu ? latestMenu.meal : "lunch"; 

  const groupedMenus = useMemo<MenuGroup[]>(() => {
    const map = new Map<string, MenuGroup>();
    for (const m of menus) {
      const key = `${m.service_date}__${m.meal}`;
      const g = map.get(key);
      if (!g) {
        map.set(key, { key, service_date: m.service_date, meal: m.meal, primary: m, photoCount: 1 });
      } else {
        g.photoCount += 1;
        if (!m.duplicate_of && g.primary.duplicate_of) g.primary = m;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.service_date !== b.service_date) return a.service_date < b.service_date ? 1 : -1;
      if (a.meal === b.meal) return 0;
      return a.meal === "dinner" ? -1 : 1; 
    });
  }, [menus]);

  const currentGroup = useMemo(
    () => groupedMenus.find((g) => g.service_date === todayISO && g.meal === activeMeal) ??
          groupedMenus.find((g) => g.service_date === todayISO) ??
          groupedMenus[0] ?? null,
    [groupedMenus, todayISO, activeMeal],
  );

  const pastGroups = useMemo(
    () => groupedMenus.filter((g) => g.key !== currentGroup?.key),
    [groupedMenus, currentGroup],
  );

  const todayMenu = currentGroup?.primary ?? null;
  const nutrition = (todayMenu?.nutrition ?? null) as Record<string, any> | null;
  const statusMeta = status?.level ? LEVEL_META[status.level] : null;
  const reliable = (status?.sample_size ?? 0) >= 3;
  const maxPeak = peak.length > 0 ? Math.max(1, ...peak.map((p) => p.avg_score)) : 1;

  const historyToday = useMemo(() => {
    const today = new Date().toDateString();
    return history.filter((h) => new Date(h.created_at).toDateString() === today);
  }, [history]);

  const cooldownRemaining = useMemo(() => {
    if (!myLastReport) return 0;
    const elapsed = (nowTick - new Date(myLastReport.created_at).getTime()) / 1000;
    return Math.max(0, Math.ceil(REPORT_COOLDOWN_SECONDS - elapsed));
  }, [myLastReport, nowTick]);
  const onCooldown = cooldownRemaining > 0;

  async function handleReport(level: RuLevel) {
    if (!user || !restaurant || onCooldown) return;
    setSending(level);
    try {
      const position = await requestPosition();
      const { latitude, longitude } = position.coords;
      const dist = distanceMeters(restaurant.latitude, restaurant.longitude, latitude, longitude);

      if (dist > (restaurant.radius_meters || 150)) {
        toast({
          title: "Não é possível responder",
          description: `Você precisa estar próximo ao RU (até ${restaurant.radius_meters || 150}m). Distância atual: ${Math.round(dist)}m.`,
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

  // Novo Handle de Consenso Colaborativo (Aberto/Fechado)
  async function handleConsensus(reportedStatus: ReportedStatus) {
    setReportingConsensus(reportedStatus);
    const { success, message } = await reportRuStatus(reportedStatus);
    
    if (success) {
      toast({ title: "Relato enviado com sucesso! 📡", description: message });
    } else {
      toast({ title: "Falha na validação", description: message, variant: "destructive" });
    }
    setReportingConsensus(null);
  }

  async function handleMenuPhoto(file: File) {
    if (!user || !restaurant) return;
    setUploading(true);
    try {
      const photoHash = await hashFile(file);
      const { data: existing } = await supabase.rpc("ru_find_menu_by_hash", {
        _restaurant_id: restaurant.id,
        _photo_hash: photoHash,
      });
      const known = Array.isArray(existing) ? existing[0] : null;

      if (known) {
        const { error: confirmErr } = await supabase.rpc("ru_submit_menu", {
          _restaurant_id: restaurant.id,
          _service_date: known.service_date,
          _meal: known.meal,
          _photo_url: null,
          _photo_hash: photoHash,
          _raw_text: known.raw_text,
          _items: known.items,
          _nutrition: known.nutrition,
        });
        if (confirmErr) throw confirmErr;

        toast({
          title: "Cardápio já registrado ✅",
          description: `Esta foto do ${MEAL_LABEL[known.meal as "lunch" | "dinner"]} já estava publicada — seu envio confirmou a informação e a estimativa nutricional foi mantida.`,
        });
        await reload();
        return;
      }

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

      const detectedMeal = ai?.meal === "lunch" || ai?.meal === "dinner" ? ai.meal : null;
      
      const { data: submitted, error: insErr } = await supabase.rpc("ru_submit_menu", {
        _restaurant_id: restaurant.id,
        _service_date: todayISO,
        _meal: activeMeal, // Usamos o meal do frontend para manter sincronia
        _photo_url: path,
        _photo_hash: photoHash,
        _raw_text: ai?.raw_text ?? null,
        _items: ai?.items ?? [],
        _nutrition: ai?.nutrition ? { ...ai.nutrition, vegetarian_option: ai.vegetarian_option ?? null, allergens: ai.allergens ?? [], tip: ai.tip ?? null } : null,
        _detected_meal: detectedMeal,
        _detected_date: ai?.service_date ?? null,
      });
      if (insErr) throw insErr;

      const variation = Array.isArray(submitted) ? submitted[0]?.was_duplicate : false;
      const mealMismatch = detectedMeal && detectedMeal !== activeMeal;
      toast({
        title: `${MEAL_LABEL[activeMeal as "lunch" | "dinner"]} publicado! 📸`,
        description: mealMismatch
          ? `A foto parecia ser do ${MEAL_LABEL[detectedMeal as "lunch" | "dinner"]}, mas o horário confirmou ${MEAL_LABEL[activeMeal as "lunch" | "dinner"]}.`
          : variation
          ? "Já havia um envio para esta refeição — o seu ficou registrado como conferência adicional."
          : "A foto original fica disponível para os colegas conferirem.",
      });
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
        `Aberto agora: ${restaurant.is_open ? "sim" : `não (${restaurant.closed_reason ?? "sem motivo informado"})`}`,
        `Fila atual: ${statusMeta ? `${statusMeta.label} (${statusMeta.minutes})` : "sem relatos recentes"} — ${CONFIDENCE_LABEL[status?.confidence ?? "none"]}, ${status?.sample_size ?? 0} relatos`,
        `Horários de pico: ${peak.map((p) => `${p.hour}h: ${p.avg_score}`).join(", ") || "sem histórico"}`,
        `Cardápio (${todayMenu?.service_date ?? "sem data"}): ${itemsOf(todayMenu?.items).join(", ") || todayMenu?.raw_text || "não publicado"}`,
        `Nutrição estimada: ${nutrition ? JSON.stringify(nutrition) : "não estimada"}`,
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
          service_date: todayISO,
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

      {/* Banner de Exceções do Admin */}
      {activeException && (
        <Card className="rounded-[24px] border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-500">Aviso Administrativo</p>
              <p className="text-xs text-amber-600/90 dark:text-amber-400 mt-0.5 font-medium">{activeException.reason ?? "Horário de funcionamento alterado hoje."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!restaurant.is_open && !activeException && restaurant.closed_reason && (
        <Card className="rounded-[24px] border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Megaphone className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-600">Restaurante fechado</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{restaurant.closed_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STATUS DA FILA & CONSENSO */}
      <Card className="rounded-[28px] border border-border/30 shadow-sm overflow-hidden">
        <div className={cn("h-1.5 w-full", restaurant.is_open ? (statusMeta?.dot ?? "bg-primary") : "bg-muted")} />
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Status da fila</p>
              {restaurant.is_open ? (
                <>
                  <p className="text-2xl font-black mt-1">{statusMeta ? `${statusMeta.emoji} ${statusMeta.label}` : "Sem dados recentes"}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Tempo estimado: {statusMeta?.minutes ?? "—"}
                  </p>
                </>
              ) : (
                <p className="text-xl font-black mt-1 text-muted-foreground/80">Fechado agora</p>
              )}
            </div>
            {restaurant.is_open && (
              <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", statusMeta?.classes)}>
                {CONFIDENCE_LABEL[status?.confidence ?? "none"]}
              </Badge>
            )}
          </div>

          {restaurant.is_open && !reliable && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/30">
              ⚠️ Estimativa com baixa confiabilidade: apenas {status?.sample_size ?? 0} relato(s) recentes.
            </p>
          )}

          {/* Botões de Fila (Só mostra se estiver aberto) */}
          {restaurant.is_open && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Validação por GPS ativa (raio de {restaurant.radius_meters || 150}m).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LEVELS.map((level) => {
                  const meta = LEVEL_META[level];
                  const isMyLast = myLastReport?.level === level && onCooldown;
                  return (
                    <Button
                      key={level}
                      variant="outline"
                      disabled={!!sending || onCooldown}
                      onClick={() => handleReport(level)}
                      className={cn(
                        "h-12 rounded-xl text-[12px] font-bold border shadow-sm relative",
                        meta.classes,
                        isMyLast && "ring-2 ring-primary ring-offset-1",
                        onCooldown && !isMyLast && "opacity-40",
                      )}
                    >
                      {sending === level ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>{isMyLast && <CheckCircle2 className="h-3.5 w-3.5 absolute left-2 text-primary" />} {meta.emoji} {meta.label}</>
                      )}
                    </Button>
                  );
                })}
              </div>

              {onCooldown && (
                <p className="text-[11px] font-semibold text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/30 flex items-center gap-1.5 mt-2">
                  <Timer className="h-3.5 w-3.5 shrink-0" />
                  Novo relato liberado em <span className="font-black text-foreground">{formatCooldown(cooldownRemaining)}</span>.
                </p>
              )}
            </div>
          )}

          {/* Área de Consenso (Crowdsourcing de Abertura/Fechamento) */}
          <div className="pt-3 mt-3 border-t border-border/30">
            {restaurant.is_open ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[11px] text-muted-foreground hover:text-rose-500"
                disabled={reportingConsensus !== null}
                onClick={() => handleConsensus("closed")}
              >
                {reportingConsensus === "closed" ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <AlertTriangle className="h-3 w-3 mr-2" />}
                O app diz que está aberto, mas o RU fechou? Relatar
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs font-bold text-foreground bg-primary/10 hover:bg-primary/20"
                disabled={reportingConsensus !== null}
                onClick={() => handleConsensus("open")}
              >
                {reportingConsensus === "open" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UtensilsCrossed className="h-4 w-4 mr-2" />}
                O RU já abriu? Confirmar abertura
              </Button>
            )}
          </div>

        </CardContent>
      </Card>

      <Tabs defaultValue="menu" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4 rounded-2xl h-11">
          <TabsTrigger value="menu" className="text-[11px] font-bold rounded-xl">Cardápio</TabsTrigger>
          <TabsTrigger value="stats" className="text-[11px] font-bold rounded-xl">Movimento</TabsTrigger>
          <TabsTrigger value="info" className="text-[11px] font-bold rounded-xl">Info</TabsTrigger>
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
                    {todayMenu
                      ? `${MEAL_LABEL[todayMenu.meal]} • ${formatServiceDate(todayMenu.service_date)}`
                      : `${MEAL_LABEL[activeMeal as "lunch" | "dinner"]} de hoje ainda não publicado`}
                  </p>
                </div>
                <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleMenuPhoto(e.target.files[0])} />
                <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()} className="rounded-xl text-[11px] font-bold">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4 mr-1.5" /> Fotografar</>}
                </Button>
              </div>

              {todayMenu ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
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
                      <button type="button" onClick={() => setLightboxPhoto({ url: todayMenu.signedPhoto!, label: `${MEAL_LABEL[todayMenu.meal]} • ${formatServiceDate(todayMenu.service_date)}` })} className="shrink-0 h-11 w-11 rounded-xl overflow-hidden border border-border/40 relative group">
                        <img src={todayMenu.signedPhoto} alt="Miniatura" className="h-full w-full object-cover" loading="lazy" />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ImageIcon className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100" />
                        </span>
                      </button>
                    )}
                  </div>
                  {nutrition && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" /> Nutrição Estimada</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: "🔥 Calorias", value: nutrition.calories, unit: "kcal" },
                          { label: "🥩 Proteínas", value: nutrition.protein_g, unit: "g" },
                          { label: "🍞 Carbos", value: nutrition.carbs_g, unit: "g" },
                          { label: "🥗 Fibras", value: nutrition.fiber_g, unit: "g" },
                          { label: "🧈 Gorduras", value: nutrition.fat_g, unit: "g" },
                        ].map((n) => (
                          <div key={n.label} className="bg-muted/40 rounded-xl p-2.5 border border-border/30">
                            <p className="text-[9px] font-bold uppercase text-muted-foreground">{n.label}</p>
                            <p className="text-sm font-black">{n.value ?? "—"} <span className="text-[10px] font-medium text-muted-foreground">{n.unit}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Fotografe o monitor oficial do RU para colaborar.</p>
              )}
            </CardContent>
          </Card>

          {pastGroups.length > 0 && (
            <Card className="rounded-[24px] border border-border/30">
              <CardContent className="p-5 space-y-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" /> Refeições anteriores
                </h3>
                <Accordion type="single" collapsible className="space-y-0">
                  {pastGroups.map((g) => (
                    <AccordionItem key={g.key} value={g.key} className="!mb-2 !rounded-2xl">
                      <AccordionTrigger className="!py-3 !px-1 text-xs !font-bold text-foreground">
                        {MEAL_LABEL[g.meal]} · {formatServiceDate(g.service_date)}
                      </AccordionTrigger>
                      <AccordionContent className="px-1 pb-4">
                        <div className="flex flex-wrap gap-1.5">
                          {itemsOf(g.primary.items).map((item, i) => <Badge key={i} variant="secondary" className="rounded-full text-[10px] font-semibold">{item}</Badge>)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Demais Tabs reduzidas para legibilidade (stats, info, ai mantêm o layout padrão) */}
        <TabsContent value="stats" className="m-0">
           <Card className="rounded-[24px] border border-border/30 p-5"><h2 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-primary" /> Horários de pico</h2>
             {peak.length === 0 ? <p className="text-xs text-muted-foreground">Ainda sem histórico suficiente.</p> : peak.map((p) => (
                <div key={p.hour} className="flex items-center gap-3 mb-2">
                  <span className="text-[11px] font-bold w-10 shrink-0">{String(p.hour).padStart(2, "0")}h</span>
                  <Progress value={(p.avg_score / maxPeak) * 100} className="h-2.5" />
                </div>
              ))}
           </Card>
        </TabsContent>

        <TabsContent value="info" className="m-0">
          <Card className="rounded-[24px] border border-border/30 p-5">
             <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><MapPin className="h-4 w-4 text-primary" /> Localização</h2>
             <p className="text-xs text-muted-foreground mb-3">{restaurant.description} • {restaurant.latitude.toFixed(6)}, {restaurant.longitude.toFixed(6)}</p>
             <Button variant="outline" className="w-full rounded-xl text-xs font-bold" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`, "_blank")}>Abrir no GPS</Button>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="m-0">
          <Card className="rounded-[24px] border border-border/30 p-5">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Bot className="h-4 w-4 text-primary" /> EduFlow AI — RU</h2>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pergunte algo..." className="rounded-2xl text-sm min-h-[80px] mb-3" />
            <Button onClick={handleAsk} disabled={asking || !question.trim()} className="w-full rounded-xl font-bold text-xs">
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Perguntar"}
            </Button>
            {answer && <div className="mt-4 bg-muted/40 rounded-2xl p-4 border border-border/30 text-sm whitespace-pre-line">{answer}</div>}
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Lightbox para Imagens */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
        <DialogContent className="max-w-lg p-2 rounded-[28px] bg-background/95 backdrop-blur-xl">
          <DialogTitle className="sr-only">Foto do cardápio</DialogTitle>
          {lightboxPhoto && <img src={lightboxPhoto.url} alt={lightboxPhoto.label} className="w-full max-h-[75vh] object-contain rounded-2xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
