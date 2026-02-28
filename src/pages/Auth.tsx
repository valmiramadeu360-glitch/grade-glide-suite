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
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      if (error) {
        toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Sucesso!", description: "Verifique seu e-mail para confirmar o cadastro." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro no login", description: "E-mail ou senha incorretos.", variant: "destructive" });
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <h1 className="text-5xl font-black text-white italic tracking-tighter flex items-center justify-center gap-2">
          EduFlow
        </h1>
        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">
          Sua jornada acadêmica organizada
        </p>
      </div>

      <Card className="w-full max-w-md border-none bg-slate-900/50 backdrop-blur-xl shadow-2xl rounded-[32px] overflow-hidden">
        <div className="h-1.5 w-full bg-primary" />
        <CardHeader className="space-y-2 pt-8 text-center">
          <CardTitle className="text-3xl font-black text-white tracking-tight">
            {isSignUp ? "Criar Conta" : "Acessar Conta"}
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium">
            {isSignUp 
              ? "Cadastre-se para começar a organizar seus estudos." 
              : "Entre para gerenciar suas disciplinas e prazos."}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    className="pl-11 h-12 bg-slate-950/50 border-slate-800 text-white rounded-2xl focus:ring-primary/20"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-mail acadêmico</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-11 h-12 bg-slate-950/50 border-slate-800 text-white rounded-2xl focus:ring-primary/20"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Senha</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-11 h-12 bg-slate-950/50 border-slate-800 text-white rounded-2xl focus:ring-primary/20"
                  type="password"
                  placeholder="No mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pb-8 pt-4">
            <Button 
              className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" 
              type="submit" 
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isSignUp ? "Cadastrar no EduFlow" : "Entrar no EduFlow")}
            </Button>
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
            >
              {isSignUp ? "Já tem uma conta? Entre aqui" : "Ainda não tem conta? Cadastre-se"}
            </button>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-8 flex items-center gap-2 text-slate-600">
        <GraduationCap className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">EduFlow Academy · 2026</span>
      </footer>
    </div>
  );
}
