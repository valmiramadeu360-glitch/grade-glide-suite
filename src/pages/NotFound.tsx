import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Log do erro para ajudar você a debugar se houver links quebrados no futuro
    console.error(
      "404 Error: Rota acadêmica inexistente acessada ->", 
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center pb-24 relative overflow-hidden">
      
      {/* Elemento de design de fundo sutil */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] sm:w-[50vw] sm:h-[50vw] bg-destructive/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Círculo de Alerta Visual com animação suave */}
      <div className="mb-8 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-[32px] bg-destructive/10 shadow-inner border border-destructive/20 animate-in zoom-in duration-700">
        <AlertCircle className="h-12 w-12 sm:h-14 sm:w-14 text-destructive animate-pulse" />
      </div>

      <div className="max-w-md space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        <h1 className="text-7xl sm:text-8xl font-black text-foreground tracking-tighter">404</h1>
        <h2 className="text-2xl sm:text-3xl font-black text-foreground">Página não encontrada</h2>
        <p className="text-muted-foreground text-sm sm:text-base font-medium leading-relaxed px-4">
          Parece que você tentou acessar um conteúdo que não existe, foi movido ou arquivado. 
          Verifique se o link do material ou disciplina está correto.
        </p>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4 sm:px-0 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="border-border bg-card text-foreground hover:bg-muted/50 w-full sm:w-auto px-8 h-14 rounded-2xl font-bold gap-3 shadow-sm active:scale-[0.98] transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar a página anterior
        </Button>
        
        <Button 
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 w-full sm:w-auto px-8 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs gap-3 active:scale-[0.98] transition-all"
        >
          <Home className="h-5 w-5" />
          Ir para o Dashboard
        </Button>
      </div>

      <p className="mt-16 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 animate-in fade-in duration-1000 delay-500">
        EduFlow Academy · Sistema de Gestão
      </p>
    </div>
  );
};

export default NotFound;
