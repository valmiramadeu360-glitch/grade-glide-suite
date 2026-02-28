import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Mail, Lock, User, Loader2 } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail("");
    setPassword("");
    setFullName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        });
        if (error) throw error;
        
        toast({ title: "Bem-vindo de volta!" });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        
        toast({
          title: "Quase lá!",
          description: "Enviamos um link de confirmação para o seu e-mail.",
        });
      }
    } catch (error: any) {
      let message = error.message;
      if (message === "Invalid login credentials") message = "E-mail ou senha incorretos.";
      if (message === "User already registered") message = "Este e-mail já está cadastrado.";

      toast({
        title: "Ops!",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white italic">EduFlow</h1>
          <p className="mt-2 text-slate-400 font-medium tracking-wide">SUA JORNADA ACADÊMICA ORGANIZADA</p>
        </div>

        <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-bold text-white">
              {isLogin ? "Acessar Conta" : "Criar sua Conta"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isLogin ? "Entre para gerenciar suas 7 disciplinas" : "Comece a organizar seu semestre agora"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Nome completo</Label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="name"
                      placeholder="Ex: João Silva"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 focus:ring-primary/20 h-12"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-mail acadêmico</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 focus:ring-primary/20 h-12"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" text-slate-300>Senha</Label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="No mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 focus:ring-primary/20 h-12"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isLogin ? "Entrar no EduFlow" : "Finalizar Cadastro"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {isLogin ? (
                  <>Ainda não tem conta? <span className="text-primary font-bold">Cadastre-se</span></>
                ) : (
                  <>Já possui uma conta? <span className="text-primary font-bold">Faça Login</span></>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
        <p className="mt-8 text-center text-xs text-slate-500 uppercase tracking-widest">
          © 2026 EduFlow - Organização de Alto Nível
        </p>
      </div>
    </div>
  );
}
