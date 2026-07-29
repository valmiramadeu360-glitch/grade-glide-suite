import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Building2, Utensils, BookOpen, Bus, Calendar, 
  FlaskConical, Trophy, Map, FileText, Users, 
  ChevronRight, Clock, AlertCircle, ArrowUpRight
} from "lucide-react";

export default function Campus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCampus, setActiveCampus] = useState("Campus A. C. Simões (Maceió)");

  // Mocks estruturais baseados na sua Arquitetura
  const ruStatus = { status: "open", queueTime: "15 min", menu: "Feijoada e Frango Assado" };
  const libraryStatus = { status: "open", availableRooms: 3 };
  
  const campusServices = [
    { title: "Transporte", icon: Bus, desc: "Horários e rotas do circular", color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Laboratórios", icon: FlaskConical, desc: "Reserva de equipamentos", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Mapa do Campus", icon: Map, desc: "Localize blocos e salas", color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Editais", icon: FileText, desc: "Bolsas e monitorias", color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Esportes", icon: Trophy, desc: "Atléticas e quadras", color: "text-rose-500", bg: "bg-rose-500/10" },
    { title: "Coordenações", icon: Users, desc: "Contatos e horários", color: "text-indigo-500", bg: "bg-indigo-500/10" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 pt-4 sm:pt-6">
      
      {/* HEADER PREMIUM DO CAMPUS */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Campus</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-0">
                {activeCampus}
              </Badge>
            </div>
          </div>
        </div>
        
        <Button variant="outline" className="rounded-full h-10 px-4 text-xs font-bold border-border/40 shadow-sm bg-card hover:bg-muted/50">
          Trocar Campus
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA PRINCIPAL: STATUS AO VIVO (RU E BIBLIOTECA) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* PAINEL DO RESTAURANTE UNIVERSITÁRIO (RU) */}
          <Card className="rounded-[32px] border-0 shadow-sm bg-card overflow-hidden group cursor-pointer hover:shadow-md transition-all">
            <div className="h-2 w-full bg-gradient-to-r from-orange-400 to-rose-500" />
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <Utensils className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground">Restaurante Universitário</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Aberto Agora</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground group-hover:bg-orange-500/10 group-hover:text-orange-600 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-muted/30 p-4 rounded-[20px] border border-border/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Clock className="h-3.5 w-3.5" /> Fila Estimada
                  </p>
                  <p className="text-2xl font-black text-foreground">{ruStatus.queueTime}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-[20px] border border-border/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Utensils className="h-3.5 w-3.5" /> Cardápio
                  </p>
                  <p className="text-sm font-bold text-foreground leading-tight line-clamp-2">{ruStatus.menu}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PAINEL DA BIBLIOTECA */}
          <Card className="rounded-[32px] border-0 shadow-sm bg-card overflow-hidden group cursor-pointer hover:shadow-md transition-all">
            <div className="h-2 w-full bg-gradient-to-r from-blue-400 to-indigo-500" />
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground">Biblioteca Central</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Acervo e Estudo</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground group-hover:bg-blue-500/10 group-hover:text-blue-600 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="flex-1 bg-muted/30 p-3 rounded-[20px] flex items-center justify-between border border-border/40">
                  <span className="text-xs font-bold text-muted-foreground ml-2">Salas de estudo disponíveis</span>
                  <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-sm font-black border-0 px-3 py-1">
                    {libraryStatus.availableRooms} Livres
                  </Badge>
                </div>
                <Button variant="outline" className="h-[52px] rounded-[20px] font-bold text-xs sm:w-auto w-full bg-background border-border/50 shadow-sm">
                  <AlertCircle className="h-4 w-4 mr-2" /> Meu Acervo
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* COLUNA LATERAL: CALENDÁRIO E SERVIÇOS */}
        <div className="space-y-6">
          
          {/* EVENTOS E CALENDÁRIO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Eventos do Campus
              </h3>
              <span className="text-[9px] font-bold text-primary cursor-pointer hover:underline uppercase tracking-widest">Ver Todos</span>
            </div>
            
            <div className="space-y-2">
              <div className="bg-card border border-border/20 p-4 rounded-[24px] flex gap-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl w-14 h-14 shrink-0 text-primary">
                  <span className="text-[10px] font-black uppercase leading-none">Nov</span>
                  <span className="text-xl font-black leading-none mt-1">12</span>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-black leading-tight">Semana de Engenharia</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">Auditório Principal</p>
                </div>
              </div>

              <div className="bg-card border border-border/20 p-4 rounded-[24px] flex gap-4 shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex flex-col items-center justify-center bg-muted rounded-xl w-14 h-14 shrink-0 text-muted-foreground">
                  <span className="text-[10px] font-black uppercase leading-none">Nov</span>
                  <span className="text-xl font-black leading-none mt-1">20</span>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-black leading-tight">Feira de Estágios</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">Praça Central</p>
                </div>
              </div>
            </div>
          </div>

          {/* GRID DE SERVIÇOS */}
          <div className="pt-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5 ml-2 mb-3">
              <Building2 className="h-3.5 w-3.5" /> Mais Serviços
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {campusServices.map((service, i) => (
                <div key={i} className="bg-card border border-border/30 p-4 rounded-[24px] shadow-sm hover:shadow-md hover:border-border/60 transition-all cursor-pointer group flex flex-col items-start gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", service.bg, service.color)}>
                    <service.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-foreground group-hover:text-primary transition-colors">{service.title}</p>
                    <p className="text-[9px] font-bold text-muted-foreground mt-0.5 leading-tight">{service.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
