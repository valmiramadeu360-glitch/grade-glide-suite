import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, GraduationCap, Loader2 } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const { toast } = useToast();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    
    // Validação básica de segurança
    if (password.length < 6) {
      toast({ 
        title: "Senha muito curta", 
        description: "A senha deve ter pelo menos 6 caracteres.", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            // Garante que o link de confirmação retorne para o app
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;
        
        toast({ 
          title: "Quase lá!", 
          description: "Enviamos um link de confirmação para o seu e-mail.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        });
        
        if (error) throw error;
      }
    } catch (error: any) {
      const errorMessage = error.message === "Invalid login credentials" 
        ? "E-mail ou senha incorretos." 
        : error.message;

      toast({ 
        title: isSignUp ? "Erro no cadastro" : "Erro no acesso", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 selection:bg-primary/30">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-6 duration-1000">
        <h1 className="text-5xl font-black text-white italic tracking-tighter flex items-center justify-center gap-2">
          EduFlow
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-3">
          Sua jornada acadêmica organizada
        </p>
      </div>

      <Card className="w-full max-w-md border-none bg-slate-900/40 backdrop-blur-2xl shadow-2xl rounded-[40px] overflow-hidden ring-1 ring-white/5">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        <CardHeader className="space-y-2 pt-10 text-center px-8">
          <CardTitle className="text-3xl font-black text-white tracking-tight">
            {isSignUp ? "Criar Conta" : "Acessar Conta"}
          </CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            {isSignUp 
              ? "Cadastre-se para centralizar seus estudos hoje." 
              : "Bem-vindo de volta ao seu painel acadêmico."}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-5 px-8">
            {isSignUp && (
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    className="pl-12 h-12 bg-slate-950/40 border-slate-800/50 text-white rounded-2xl focus:ring-primary/20 transition-all placeholder:text-slate-700"
                    placeholder="Como devemos te chamar?"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">E-mail Acadêmico</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-12 h-12 bg-slate-950/40 border-slate-800/50 text-white rounded-2xl focus:ring-primary/20 transition-all placeholder:text-slate-700"
                  type="email"
                  placeholder="estudante@instituicao.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">Senha</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-12 h-12 bg-slate-950/40 border-slate-800/50 text-white rounded-2xl focus:ring-primary/20 transition-all placeholder:text-slate-700"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-5 pb-10 pt-6 px-8">
            <Button 
              className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/10 transition-all active:scale-95" 
              type="submit" 
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isSignUp ? "Cadastrar Agora" : "Entrar no Painel")}
            </Button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-colors"
            >
              {isSignUp ? "Já possui acesso? Clique aqui" : "Criar nova conta acadêmica"}
            </button>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-10 flex items-center gap-3 text-slate-700">
        <GraduationCap className="h-4 w-4" />
        <span className="text-[9px] font-black uppercase tracking-[0.3em]">EduFlow Academy · Versão 2026.1</span>
      </footer>
    </div>
  );
}

