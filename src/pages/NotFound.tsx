import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Log para monitoramento de rotas quebradas
    console.error(
      "404 Error: Rota inexistente acessada ->", 
      location.pathname
    );
  }, [location.pathname]);

  const handleBack = () => {
    // Se não houver histórico (ex: abriu link direto), vai para a home
    if (window.history.length <= 1) {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center animate-in fade-in duration-700">
      {/* Elemento Visual de Alerta */}
      <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[32px] bg-rose-500/10 ring-1 ring-rose-500/20 shadow-2xl shadow-rose-500/5">
        <AlertCircle className="h-14 w-14 text-rose-500 animate-pulse" />
      </div>

      <div className="max-w-md space-y-4">
        <h1 className="text-8xl font-black text-white tracking-tighter leading-none">404</h1>
        <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Conteúdo Indisponível</h2>
        <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">
          A rota <span className="text-primary font-mono">{location.pathname}</span> não foi localizada em nossa base acadêmica.
        </p>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none justify-center">
        <Button 
          variant="outline" 
          onClick={handleBack}
          className="border-white/5 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white px-8 h-14 rounded-[20px] gap-2 font-black uppercase text-[10px] tracking-widest transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <Button 
          onClick={() => navigate("/")}
          className="bg-primary text-white shadow-xl shadow-primary/20 px-8 h-14 rounded-[20px] font-black uppercase text-[10px] tracking-widest gap-2 transition-all hover:scale-[1.02]"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </Button>
      </div>

      <footer className="mt-20">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-800">
          EduFlow Academy · 2026
        </p>
      </footer>
    </div>
  );
};

export default NotFound;
