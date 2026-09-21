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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  UtensilsCrossed, Clock, MapPin, Megaphone, Star, BarChart3, Bot,
  Camera, Loader2, Flame, ChevronLeft, ShieldCheck, Send, History,
  Image as ImageIcon, CheckCircle2, Timer, CalendarClock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useRu, requestPosition, distanceMeters, hashFile, currentMeal, MEAL_LABEL,
  LEVEL_META, CONFIDENCE_LABEL, REPORT_COOLDOWN_SECONDS, formatServiceDate,
  type RuLevel, type RuMenu,
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

/** Um card fechado (Almoço/Jantar + data) e sua foto original, cada um representa
 * uma única refeição — nunca mistura almoço com jantar nem dias diferentes. */
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
  const { toast } = useToast();
  const {
    restaurant, status, history, peak, menus, notices, ratingSummary, myLastReport,
    loading, reload, reloadStatus,
  } = useRu();

  const [sending, setSending] = useState<RuLevel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [savingRating, setSavingRating] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; label: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Relógio de 1 em 1 segundo só para o contador de "aguarde Xmin" da fila.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeMeal = currentMeal(restaurant);
  const todayISO = new Date().toISOString().slice(0, 10);

  // Agrupa as fotos por refeição+dia (uma foto igual só soma "confirmações";
  // uma foto diferente da mesma refeição vira variação dentro do mesmo grupo).
  const groupedMenus = useMemo<MenuGroup[]>(() => {
    const map = new Map<string, MenuGroup>();
    for (const m of menus) {
      const key = `${m.service_date}__${m.meal}`;
      const g = map.get(key);
      if (!g) {
        map.set(key, { key, service_date: m.service_date, meal: m.meal, primary: m, photoCount: 1 });
      } else {
        g.photoCount += 1;
        // A entrada canônica (sem duplicate_of) é sempre a preferida como "capa" do grupo.
        if (!m.duplicate_of && g.primary.duplicate_of) g.primary = m;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.service_date !== b.service_date) return a.service_date < b.service_date ? 1 : -1;
      if (a.meal === b.meal) return 0;
      return a.meal === "dinner" ? -1 : 1; // no mesmo dia, o jantar é "mais recente" que o almoço
    });
  }, [menus]);

  // A refeição corrente (decidida pelo horário local do restaurante, nunca pela
  // leitura da foto) é a que fica aberta. Todo o resto vira histórico fechado.
  const currentGroup = useMemo(
    () =>
      groupedMenus.find((g) => g.service_date === todayISO && g.meal === activeMeal) ??
      groupedMenus.find((g) => g.service_date === todayISO) ??
      groupedMenus[0] ??
      null,
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

  const maxPeak = Math.max(1, ...peak.map((p) => p.avg_score));

  // Fila reinicia todo dia — misturar relatos de ontem com os de hoje só confunde.
  const historyToday = useMemo(() => {
    const today = new Date().toDateString();
    return history.filter((h) => new Date(h.created_at).toDateString() === today);
  }, [history]);

  // Cooldown de 3 min entre relatos (o mesmo limite que o servidor já valida) —
  // mostrado ao vivo em vez de deixar o estudante descobrir só quando dá erro.
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
      const photoHash = await hashFile(file);

      // 1) A mesma foto já foi enviada? Confirma o registro existente e reaproveita
      // a MESMA estimativa nutricional (nada de calorias diferentes p/ a mesma refeição).
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

      // 2) A refeição e a data são decididas pelo HORÁRIO LOCAL do restaurante —
      // é o dado confiável. A leitura da foto pela IA (detectedMeal) é só uma
      // informação de apoio: se ela discordar do horário, o horário vence, e o
      // estudante é avisado no toast abaixo (em vez de o app aceitar cegamente
      // o que a foto "parece" dizer).
      const detectedMeal = ai?.meal === "lunch" || ai?.meal === "dinner" ? ai.meal : null;
      const meal = currentMeal(restaurant);
      const serviceDate = new Date().toISOString().slice(0, 10);

      const { data: submitted, error: insErr } = await supabase.rpc("ru_submit_menu", {
        _restaurant_id: restaurant.id,
        _service_date: serviceDate,
        _meal: meal,
        _photo_url: path,
        _photo_hash: photoHash,
        _raw_text: ai?.raw_text ?? null,
        _items: ai?.items ?? [],
        _nutrition: ai?.nutrition
          ? { ...ai.nutrition, vegetarian_option: ai.vegetarian_option ?? null, allergens: ai.allergens ?? [], tip: ai.tip ?? null }
          : null,
        _detected_meal: detectedMeal,
        _detected_date: ai?.service_date ?? null,
      });
      if (insErr) throw insErr;

      const variation = Array.isArray(submitted) ? submitted[0]?.was_duplicate : false;
      const mealMismatch = detectedMeal && detectedMeal !== meal;
      toast({
        title: `${MEAL_LABEL[meal as "lunch" | "dinner"]} publicado! 📸`,
        description: mealMismatch
          ? `A foto parecia ser do ${MEAL_LABEL[detectedMeal as "lunch" | "dinner"]}, mas o horário local confirma ${MEAL_LABEL[meal as "lunch" | "dinner"]} — usamos o horário.`
          : variation
          ? "Já havia um envio para esta refeição — o seu ficou registrado como conferência adicional."
          : "A foto original fica disponível, em miniatura, para os colegas conferirem.",
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
                    {sending === level ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {isMyLast && <CheckCircle2 className="h-3.5 w-3.5 absolute left-2 text-primary" />}
                        {meta.emoji} {meta.label}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Cooldown ao vivo — evita descobrir só quando o servidor recusa o envio */}
            {onCooldown ? (
              <p className="text-[11px] font-semibold text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/30 flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 shrink-0" />
                Você relatou {myLastReport ? LEVEL_META[myLastReport.level].label.toLowerCase() : ""} há pouco.
                Pode relatar de novo em <span className="font-black text-foreground">{formatCooldown(cooldownRemaining)}</span>.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">Seu relato vale por 3 minutos e ajuda a manter a estimativa atualizada.</p>
            )}
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
                    {todayMenu
                      ? `${MEAL_LABEL[todayMenu.meal]} • ${formatServiceDate(todayMenu.service_date)}`
                      : `${MEAL_LABEL[activeMeal]} de hoje ainda não publicado`}
                  </p>
                  {todayMenu && (todayMenu.confirmations ?? 1) > 1 && (
                    <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                      ✅ Confirmado por {todayMenu.confirmations} estudantes
                    </p>
                  )}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleMenuPhoto(e.target.files[0])}
                />
                <Button
                  size="sm"
                  disabled={uploading}
                  onClick={async () => {
                    // App nativo: câmera do sistema. Web/PWA: input de arquivo.
                    try {
                      const { takeNativePhoto } = await import("@/lib/native");
                      const photo = await takeNativePhoto("cardapio-ru.jpg");
                      if (photo) {
                        await handleMenuPhoto(photo);
                        return;
                      }
                    } catch (err) {
                      console.warn("RU: câmera nativa indisponível", err);
                    }
                    fileInput.current?.click();
                  }}
                  className="rounded-xl text-[11px] font-bold"
                >
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

                    {/* Só um ícone pequeno da foto — é para conferir, o cardápio já foi
                        organizado em texto acima. Toque para ver em tamanho real. */}
                    {todayMenu.signedPhoto && (
                      <button
                        type="button"
                        onClick={() => setLightboxPhoto({ url: todayMenu.signedPhoto!, label: `${MEAL_LABEL[todayMenu.meal]} • ${formatServiceDate(todayMenu.service_date)}` })}
                        className="shrink-0 h-11 w-11 rounded-xl overflow-hidden border border-border/40 shadow-sm relative group"
                        title="Conferir foto original"
                      >
                        <img src={todayMenu.signedPhoto} alt="Miniatura da foto original do cardápio" className="h-full w-full object-cover" loading="lazy" />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ImageIcon className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100" />
                        </span>
                      </button>
                    )}
                  </div>

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

          {pastGroups.length > 0 && (
            <Card className="rounded-[24px] border border-border/30">
              <CardContent className="p-5 space-y-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" /> Refeições anteriores
                </h3>
                <p className="text-[10px] text-muted-foreground pb-2">Fica disponível por 3 dias — depois o app apaga automaticamente.</p>

                <Accordion type="single" collapsible className="space-y-0">
                  {pastGroups.map((g) => {
                    const menu = g.primary;
                    const n = (menu.nutrition ?? null) as Record<string, any> | null;
                    return (
                      <AccordionItem key={g.key} value={g.key} className="!mb-2 !rounded-2xl">
                        <AccordionTrigger className="!py-3 !px-1 text-xs !normal-case !tracking-normal !font-bold text-foreground">
                          <span className="flex items-center gap-2">
                            {MEAL_LABEL[g.meal]} · {formatServiceDate(g.service_date)}
                            {(menu.confirmations ?? 1) > 1 && (
                              <Badge variant="secondary" className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 border-0">
                                ✅ {menu.confirmations}
                              </Badge>
                            )}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-1 pb-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            {itemsOf(menu.items).length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {itemsOf(menu.items).map((item, i) => (
                                  <Badge key={i} variant="secondary" className="rounded-full text-[10px] font-semibold">{item}</Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] whitespace-pre-line text-muted-foreground">{menu.raw_text ?? "Texto não reconhecido."}</p>
                            )}
                            {menu.signedPhoto && (
                              <button
                                type="button"
                                onClick={() => setLightboxPhoto({ url: menu.signedPhoto!, label: `${MEAL_LABEL[g.meal]} • ${formatServiceDate(g.service_date)}` })}
                                className="shrink-0 h-10 w-10 rounded-lg overflow-hidden border border-border/40"
                                title="Conferir foto original"
                              >
                                <img src={menu.signedPhoto} alt="Miniatura da foto original do cardápio" className="h-full w-full object-cover" loading="lazy" />
                              </button>
                            )}
                          </div>
                          {n && (
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                              {[
                                { label: "🔥", value: n.calories, unit: "kcal" },
                                { label: "🥩", value: n.protein_g, unit: "g" },
                                { label: "🍞", value: n.carbs_g, unit: "g" },
                              ].map((it, i) => (
                                <div key={i} className="bg-muted/40 rounded-lg p-1.5 border border-border/30 text-center">
                                  <p className="text-[10px] font-black">{it.label} {it.value ?? "—"}<span className="text-[8px] font-medium text-muted-foreground">{it.unit}</span></p>
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lightbox — a única foto grande do módulo, e só quando o estudante pede para conferir */}
        <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
          <DialogContent className="max-w-lg p-2 rounded-[28px] border border-border/30 bg-background/95 backdrop-blur-xl">
            <DialogTitle className="sr-only">{lightboxPhoto?.label ?? "Foto do cardápio"}</DialogTitle>
            {lightboxPhoto && (
              <div className="space-y-2">
                <img src={lightboxPhoto.url} alt={lightboxPhoto.label} className="w-full max-h-[75vh] object-contain rounded-2xl" />
                <p className="text-[11px] text-center text-muted-foreground font-semibold pb-1">{lightboxPhoto.label} — foto original enviada por um estudante.</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Relatos de hoje</h2>
                {historyToday.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-bold">{historyToday.length}</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">A fila reinicia todos os dias — relatos de outros dias não entram aqui.</p>
              {historyToday.length === 0 ? (
                <p className="text-xs text-muted-foreground pt-1">Nenhum relato hoje ainda. Seja o primeiro a colaborar 🍲</p>
              ) : (
                historyToday.slice(0, 12).map((h, i) => (
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
