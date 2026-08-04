import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CampusAdminModal } from "./CampusAdminModal";
import {
  MapPin, Search, Navigation, Building2, Loader2, ChevronRight,
  Settings, ZoomIn, ZoomOut, Maximize, X, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CampusRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  map_image_url: string | null;
}

interface Block {
  id: string;
  campus_id: string;
  name: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  x_percent: number;
  y_percent: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function CampusMap() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const [campuses, setCampuses] = useState<CampusRow[]>([]);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Block | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // --- viewport (zoom / pan) ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  const campus = useMemo(() => campuses.find((c) => c.id === campusId) ?? null, [campuses, campusId]);

  useEffect(() => {
    (async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data, error } = await supabase.rpc("is_admin");
      setIsAdmin(!error && !!data);
    })();
  }, [user]);

  const loadCampuses = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profile }, { data: list }] = await Promise.all([
        user
          ? supabase.from("profiles").select("campus_id").eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("campuses").select("id, name, city, state, map_image_url").order("name"),
      ]);

      const rows = (list ?? []) as CampusRow[];
      setCampuses(rows);

      const preferred =
        rows.find((c) => c.id === (profile as any)?.campus_id) ??
        rows.find((c) => !!c.map_image_url) ??
        rows[0] ??
        null;
      setCampusId(preferred?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadCampuses(); }, [loadCampuses]);

  const loadBlocks = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("campus_blocks")
      .select("id, campus_id, name, category, description, photo_url, x_percent, y_percent")
      .eq("campus_id", id)
      .order("name");
    const rows = ((data ?? []) as any[]).map((b) => ({
      ...b,
      x_percent: Number(b.x_percent),
      y_percent: Number(b.y_percent),
    })) as Block[];
    setBlocks(rows);
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!campusId) return;
    loadBlocks(campusId);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [campusId, loadBlocks]);

  // Bucket privado: resolve URL assinada da imagem do mapa
  useEffect(() => {
    const raw = campus?.map_image_url;
    if (!raw) { setMapUrl(null); return; }
    let active = true;
    (async () => {
      const path = raw.includes("/campus-media/") ? raw.split("/campus-media/")[1].split("?")[0] : raw;
      const { data } = await supabase.storage.from("campus-media").createSignedUrl(decodeURIComponent(path), 3600);
      if (active) setMapUrl(data?.signedUrl ?? null);
    })();
    return () => { active = false; };
  }, [campus?.map_image_url]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(blocks.map((b) => b.category))).filter(Boolean)],
    [blocks],
  );

  const filteredBlocks = useMemo(
    () =>
      blocks.filter((b) => {
        const q = searchQuery.trim().toLowerCase();
        const matchSearch = !q || b.name.toLowerCase().includes(q) || (b.description ?? "").toLowerCase().includes(q);
        const matchCategory = category === "all" || b.category === category;
        return matchSearch && matchCategory;
      }),
    [blocks, searchQuery, category],
  );

  // --- zoom helpers ---
  const zoomAt = useCallback((nextZoomRaw: number, px: number, py: number) => {
    setZoom((prevZoom) => {
      const next = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
      const k = next / prevZoom;
      setOffset((prev) => ({ x: px - (px - prev.x) * k, y: py - (py - prev.y) * k }));
      return next;
    });
  }, []);

  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(zoom * Math.exp(-dy * 0.0018), e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomByButton(factor: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    zoomAt(zoom * factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
  }

  function resetView() { setZoom(1); setOffset({ x: 0, y: 0 }); }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = Array.from(pinch.current.values());
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { id: e.pointerId, x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pinch.current.has(e.pointerId)) return;
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pinch.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      zoomAt(pinchStart.current.zoom * (dist / pinchStart.current.dist), cx, cy);
      return;
    }

    if (drag.current && drag.current.id === e.pointerId && zoom > 1) {
      setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pinch.current.delete(e.pointerId);
    if (pinch.current.size < 2) pinchStart.current = null;
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function selectBlock(b: Block) {
    setSelected(b);
    setDetailsOpen(true);
  }

  function openRoute(b: Block) {
    const query = `${b.name} ${campus?.name ?? ""}`.trim();
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
  }

  const details = selected && (
    <Card className="rounded-[28px] border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="relative h-40 sm:h-44 w-full bg-muted/40 overflow-hidden">
        {selected.photo_url ? (
          <img src={selected.photo_url} alt={selected.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center bg-primary/5">
            <Building2 className="h-9 w-9 text-primary/40 mb-2" />
            <p className="text-xs font-bold text-foreground">Foto em breve</p>
          </div>
        )}
      </div>
      <CardContent className="p-5 space-y-3">
        <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-md">
          {selected.category}
        </span>
        <h2 className="text-lg font-black text-foreground">{selected.name}</h2>
        {selected.description && (
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">{selected.description}</p>
        )}
        <Button onClick={() => openRoute(selected)} className="w-full h-12 rounded-2xl font-black text-xs gap-2 shadow-lg">
          <Navigation className="h-4 w-4" /> Como chegar (Google Maps)
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500 px-3 sm:px-6 pb-24 pt-3">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/40 p-4 sm:p-5 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate">
              {campus ? `${campus.name}${campus.city ? ` • ${campus.city}` : ""}` : "Campus"}
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground mt-1">Mapa do Campus</h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
            Arraste para mover, use os botões ou o gesto de pinça para ampliar.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {campuses.length > 1 && (
            <select
              value={campusId ?? ""}
              onChange={(e) => setCampusId(e.target.value)}
              className="h-11 rounded-xl border border-border/60 bg-background px-3 text-xs font-bold text-foreground shadow-sm max-w-[190px]"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <Button onClick={() => setIsAdminModalOpen(true)} className="rounded-xl font-bold text-xs h-11 px-4 gap-2 shadow-md">
              <Settings className="h-4 w-4" /> Gerenciar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">

        {/* MAPA */}
        <div className="lg:col-span-8 bg-card border border-border/40 rounded-[24px] overflow-hidden shadow-sm">
          <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn(
              "relative w-full overflow-hidden bg-muted/25 touch-none select-none",
              "h-[52vh] min-h-[300px] sm:h-[60vh] lg:h-[640px]",
              zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default",
            )}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : mapUrl ? (
              <div
                className="absolute inset-0 origin-top-left will-change-transform"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
              >
                <div className="relative w-full h-full">
                  <img
                    src={mapUrl}
                    alt={`Mapa do ${campus?.name ?? "campus"}`}
                    className="w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                  {filteredBlocks.map((b) => {
                    const isSelected = selected?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={(e) => { e.stopPropagation(); selectBlock(b); }}
                        title={b.name}
                        aria-label={b.name}
                        className={cn(
                          "absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg transition-colors flex items-center justify-center border-2 z-10",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/25"
                            : "bg-background/95 text-primary border-primary hover:bg-primary hover:text-primary-foreground",
                        )}
                        style={{
                          top: `${b.y_percent}%`,
                          left: `${b.x_percent}%`,
                          height: `${28 / zoom}px`,
                          width: `${28 / zoom}px`,
                        }}
                      >
                        <MapPin style={{ height: `${14 / zoom}px`, width: `${14 / zoom}px` }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-2">
                <ImageIcon className="h-9 w-9 text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">Mapa ainda não publicado</p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  O administrador do campus precisa enviar a imagem do mapa no painel administrativo.
                </p>
              </div>
            )}

            {/* Controles de zoom */}
            {mapUrl && (
              <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-20">
                <Button size="icon" variant="secondary" onClick={() => zoomByButton(1.4)} className="h-10 w-10 rounded-xl shadow-md" aria-label="Ampliar">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => zoomByButton(1 / 1.4)} className="h-10 w-10 rounded-xl shadow-md" aria-label="Reduzir">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={resetView} className="h-10 w-10 rounded-xl shadow-md" aria-label="Redefinir zoom">
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Filtros por categoria */}
          {categories.length > 1 && (
            <div className="p-3 bg-muted/30 border-t border-border/30 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                    category === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-background/60 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {cat === "all" ? "Todos" : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LISTA / DETALHES */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-border/40 p-3 rounded-[20px] shadow-sm">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar bloco, setor ou serviço..."
                className="pl-10 h-11 rounded-xl bg-background border-border/40 text-xs font-medium"
              />
            </div>
          </div>

          <div className="hidden lg:block">{details}</div>

          <div className="bg-card border border-border/40 p-3 rounded-[20px] shadow-sm space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
              Locais mapeados ({filteredBlocks.length})
            </h3>
            <div className="max-h-[38vh] lg:max-h-72 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {filteredBlocks.length === 0 && (
                <p className="text-[11px] text-muted-foreground px-1 py-3">Nenhum local encontrado.</p>
              )}
              {filteredBlocks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBlock(b)}
                  className={cn(
                    "w-full p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all text-left",
                    selected?.id === b.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="h-6 w-6 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
                      <MapPin className="h-3 w-3" />
                    </span>
                    <span className="truncate">{b.name}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detalhes em telas pequenas */}
      <Sheet open={detailsOpen && !!selected} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-[28px] p-4 pb-8 max-h-[85vh] overflow-y-auto">
          {details}
        </SheetContent>
      </Sheet>

      {isAdmin && (
        <CampusAdminModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onUpdate={() => { loadCampuses(); if (campusId) loadBlocks(campusId); }}
        />
      )}
    </div>
  );
}
