import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CampusAdminModal } from "./CampusAdminModal";
import { 
  MapPin, Search, Navigation, Clock, Building2, PhoneCall, 
  Info, Loader2, Sparkles, Filter, ChevronRight, X, ExternalLink, Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Building {
  id: string;
  building_number: number;
  name: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  services: string[] | null;
  opening_hours: string | null;
}

export function CampusMap() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isListOpenMobile, setIsListOpenMobile] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Verifica se o usuário logado é o administrador oficial
  const isAdmin = user?.email === "eduflow.adm.academy@gmail.com";

  useEffect(() => {
    fetchBuildings();
  }, []);

  async function fetchBuildings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("campus_buildings")
        .select("*")
        .order("building_number", { ascending: true });

      if (error) throw error;
      setBuildings(data || []);
      if (data && data.length > 0 && !selectedBuilding) {
        setSelectedBuilding(data[0]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar prédios:", error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredBuildings = buildings.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.building_number.toString().includes(searchQuery);
    const matchesCategory = selectedCategory === "all" || b.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  function openRoute(lat: number | null, lng: number | null, name: string) {
    if (!lat || !lng) {
      toast({ title: "Localização indisponível", description: "As coordenadas GPS deste prédio ainda não foram cadastradas pelo admin.", variant: "destructive" });
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500 px-4 sm:px-6 pb-24 pt-3">
      
      {/* Header Superior da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/40 p-5 rounded-[28px] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Campus A.C. Simões • UFAL</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-1">Mapa Interativo Inteligente</h1>
          <p className="text-xs text-muted-foreground font-medium">Encontre qualquer bloco, laboratório ou setor em segundos.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão do Admin (Visível apenas para o e-mail oficial) */}
          {isAdmin && (
            <Button 
              onClick={() => setIsAdminModalOpen(true)}
              className="rounded-xl font-bold text-xs h-11 px-4 bg-primary text-primary-foreground shadow-md gap-2"
            >
              <Settings className="h-4 w-4 animate-spin-slow" /> Gerenciar Prédios
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={() => setIsListOpenMobile(!isListOpenMobile)}
            className="rounded-xl font-bold text-xs h-11 px-4 border-border/60 bg-background shadow-sm lg:hidden gap-2"
          >
            <Filter className="h-4 w-4 text-primary" /> Índice
          </Button>
        </div>
      </div>

      {/* Grid Principal: Mapa Interativo à Esquerda | Painel de Detalhes à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* MAPA VISUAL */}
        <div className="lg:col-span-8 bg-card border border-border/40 rounded-[32px] overflow-hidden shadow-sm relative flex flex-col min-h-[500px] sm:min-h-[650px]">
          <div className="relative flex-1 overflow-auto bg-muted/25 flex items-center justify-center p-4">
            <div className="relative max-w-4xl w-full select-none shadow-2xl rounded-2xl overflow-hidden border border-border/30">
              
              <img 
                src="/lovable-uploads/1000161999.jpg" 
                alt="Mapa do Campus UFAL A.C. Simões" 
                className="w-full h-auto object-contain block"
              />

              {buildings.map((b) => {
                const isSelected = selectedBuilding?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBuilding(b)}
                    title={`${b.building_number} - ${b.name}`}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 rounded-full font-black text-xs flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-125 z-10",
                      isSelected 
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/30 scale-110" 
                        : "bg-background/95 text-foreground border-2 border-primary hover:bg-primary hover:text-primary-foreground"
                    )}
                    style={{
                      top: `${30 + (b.building_number % 5) * 12}%`,
                      left: `${20 + (b.building_number * 7) % 65}%`
                    }}
                  >
                    {b.building_number}
                  </button>
                );
              })}

            </div>
          </div>

          {/* Legenda inferior de Setores */}
          <div className="p-4 bg-muted/30 border-t border-border/30 flex items-center gap-4 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">Filtros Rápidos:</span>
            {["all", "Administração", "Serviços de Apoio", "Ciências Biomédicas", "Ciências Humanas / Sociais Aplicadas", "Ciências Exatas, da Terra e Engenharias"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                  selectedCategory === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-background/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {cat === "all" ? "Todos os Setores" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* PAINEL LATERAL DE DETALHES DO PRÉDIO */}
        <div className="lg:col-span-4 space-y-4">
          
          <div className="bg-card border border-border/40 p-4 rounded-[24px] shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar prédio por nome ou número..."
                className="pl-10 h-11 rounded-xl bg-background border-border/40 text-xs font-medium shadow-inner focus-visible:ring-primary"
              />
            </div>
          </div>

          {selectedBuilding ? (
            <Card className="rounded-[32px] border border-border/40 bg-card shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="relative h-48 w-full bg-muted/40 overflow-hidden">
                {selectedBuilding.photo_url ? (
                  <img src={selectedBuilding.photo_url} alt={selectedBuilding.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center bg-primary/5">
                    <Building2 className="h-10 w-10 text-primary/40 mb-2" />
                    <p className="text-xs font-bold text-foreground">Foto Oficial em Breve</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">O administrador cadastrará a fachada real deste local.</p>
                  </div>
                )}
                <div className="absolute top-3 left-3 bg-primary text-primary-foreground font-black text-xs px-3 py-1 rounded-full shadow-md">
                  Nº {selectedBuilding.building_number}
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                    {selectedBuilding.category}
                  </span>
                  <h2 className="text-lg font-black text-foreground mt-2">{selectedBuilding.name}</h2>
                </div>

                {selectedBuilding.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    {selectedBuilding.description}
                  </p>
                )}

                {selectedBuilding.services && selectedBuilding.services.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Setores & Serviços:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBuilding.services.map((srv, idx) => (
                        <span key={idx} className="text-[10px] font-bold bg-muted/50 text-foreground px-2.5 py-1 rounded-lg border border-border/30">
                          • {srv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBuilding.opening_hours && (
                  <div className="flex items-center gap-2.5 text-xs font-medium text-muted-foreground bg-muted/30 p-3 rounded-2xl border border-border/30">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <span>{selectedBuilding.opening_hours}</span>
                  </div>
                )}

                <Button 
                  onClick={() => openRoute(selectedBuilding.latitude, selectedBuilding.longitude, selectedBuilding.name)}
                  className="w-full h-12 rounded-2xl font-black text-xs gap-2 shadow-lg transition-transform hover:scale-[1.02]"
                >
                  <Navigation className="h-4 w-4" /> Como Chegar (Google Maps)
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[32px] border-dashed border-border/50 bg-muted/10 p-8 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs font-bold text-foreground">Nenhum local selecionado</p>
              <p className="text-[10px] text-muted-foreground mt-1">Toque em um número no mapa ou busque na lista para ver os detalhes.</p>
            </Card>
          )}

          <div className="bg-card border border-border/40 p-4 rounded-[28px] shadow-sm space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Edifícios Cadastrados ({filteredBuildings.length})</h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {filteredBuildings.map((b) => (
                <div 
                  key={b.id}
                  onClick={() => setSelectedBuilding(b)}
                  className={cn(
                    "p-2.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-all",
                    selectedBuilding?.id === b.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="h-6 w-6 rounded-lg bg-muted text-foreground font-black text-[10px] flex items-center justify-center shrink-0">
                      {b.building_number}
                    </span>
                    <span className="truncate">{b.name}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Modal do Painel Administrativo */}
      <CampusAdminModal 
        isOpen={isAdminModalOpen} 
        onClose={() => setIsAdminModalOpen(false)} 
        onUpdate={fetchBuildings} 
      />
    </div>
  );
}
