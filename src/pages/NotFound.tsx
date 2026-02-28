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
      "404 Error: Rota inexistente acessada ->", 
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center">
      {/* Círculo de Alerta Visual */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-rose-500/10 animate-pulse">
        <AlertCircle className="h-12 w-12 text-rose-500" />
      </div>

      <div className="max-w-md space-y-4">
        <h1 className="text-7xl font-black text-white tracking-tighter">404</h1>
        <h2 className="text-2xl font-bold text-slate-200">Página não encontrada</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Parece que você tentou acessar um conteúdo que não existe ou foi movido. 
          Verifique se o link da disciplina está correto.
        </p>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900 hover:text-white px-8 h-12 rounded-2xl gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <Button 
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 px-8 h-12 rounded-2xl font-bold gap-2"
        >
          <Home className="h-4 w-4" />
          Ir para o Dashboard
        </Button>
      </div>

      <p className="mt-12 text-[10px] font-bold uppercase tracking-widest text-slate-600">
        EduFlow Academy · Sistema de Gestão
      </p>
    </div>
  );
};

export default NotFound;

