import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, GraduationCap, Loader2, Chrome, ArrowRight } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const { toast } = useToast();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Cadastro: Insere o nome completo nos metadados para o gatilho do Profile
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        toast({ title: "Quase lá!", description: "Verifique seu e-mail para confirmar a conta." });
      } else {
        // Login: Acesso rápido
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({ 
        title: isSignUp ? "Erro no cadastro" : "Erro no login", 
        description: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }

  // Função para Login Social (Standard em Apps Modernos)
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro no Google", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Efeito de iluminação de fundo (Ambiente BI) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-6 duration-1000">
        <div className="h-16 w-16 bg-primary/20 rounded-[22px] flex items-center justify-center mx-auto mb-4 shadow-2xl border border-primary/20">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter">
          EduFlow
        </h1>
        <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px] mt-2">
          Gestão Acadêmica Inteligente
        </p>
      </div>

      <Card className="w-full max-w-md border-none bg-slate-900/40 backdrop-blur-2xl shadow-2xl rounded-[40px] overflow-hidden border border-white/5 relative z-10">
        <CardHeader className="space-y-2 pt-10 text-center">
          <CardTitle className="text-3xl font-black text-white tracking-tight">
            {isSignUp ? "Nova Jornada" : "Bem-vindo de volta"}
          </CardTitle>
          <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
            {isSignUp ? "Crie sua conta para começar" : "Acesse seu painel de controle"}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-5 px-8 pb-4">
            {isSignUp && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    className="pl-12 h-14 bg-slate-950/60 border-white/5 text-white rounded-[20px] focus:ring-primary/40 focus:border-primary/40 text-base"
                    placeholder="Como devemos te chamar?"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-mail Acadêmico</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-12 h-14 bg-slate-950/60 border-white/5 text-white rounded-[20px] focus:ring-primary/40 focus:border-primary/40 text-base"
                  type="email"
                  placeholder="exemplo@universidade.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Senha de Acesso</Label>
                {!isSignUp && (
                  <button type="button" className="text-[9px] font-black text-primary uppercase tracking-tighter hover:underline">Esqueceu a senha?</button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-12 h-14 bg-slate-950/60 border-white/5 text-white rounded-[20px] focus:ring-primary/40 focus:border-primary/40 text-base"
                  type="password"
                  placeholder="Mínimo 6 dígitos"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 px-8 pb-10 pt-4">
            <Button 
              className="w-full h-14 rounded-[22px] font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all active:scale-[0.98] gap-2" 
              type="submit" 
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  {isSignUp ? "Confirmar Cadastro" : "Entrar no App"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            
            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                <span className="bg-slate-900 px-4">Ou continuar com</span>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={handleGoogleLogin}
              className="w-full h-14 rounded-[22px] border-white/5 bg-white/5 font-black uppercase tracking-widest text-[10px] gap-3 text-white hover:bg-white/10"
            >
              <Chrome className="h-4 w-4" /> Conta Google
            </Button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="mt-2 text-[10px] font-black text-slate-500 hover:text-primary transition-colors uppercase tracking-[0.2em]"
            >
              {isSignUp ? "Já possui conta? Clique aqui" : "Novo por aqui? Crie sua conta grátis"}
            </button>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-8 flex items-center gap-2 text-slate-700 animate-pulse">
        <span className="text-[9px] font-black uppercase tracking-[0.4em]">Criptografia de Ponta a Ponta v1.0</span>
      </footer>
    </div>
  );
}

