import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, GraduationCap, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "eduflow.adm.academy@gmail.com";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        toast({
          title: "E-mail Enviado! 📩",
          description: "Verifique sua caixa de entrada (e o spam) para redefinir sua senha."
        });

        setIsResetPassword(false);
      } else if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });

        if (error) throw error;

        if (data?.session) {
          toast({
            title: "Conta Criada! 🎉",
            description: "Bem-vindo ao EduFlow."
          });
        } else {
          toast({
            title: "Quase lá! 🚀",
            description: "Enviamos um link de confirmação para o seu e-mail. Verifique sua caixa de entrada.",
            duration: 6000
          });
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        const loggedUser = data?.user;
        if (!loggedUser) throw new Error("Falha ao autenticar usuário.");

        if (loggedUser.email === ADMIN_EMAIL) {
          toast({
            title: "Acesso Administrativo 🛡️",
            description: "Bem-vindo ao Painel de Comando Supremo do EduFlow.",
            className: "bg-emerald-500 text-white border-none"
          });
          navigate("/admin");
        } else {
          toast({
            title: "Bem-vindo de volta! 📚"
          });
          navigate("/");
        }
      }
    } catch (error: any) {
      let errorMessage = error?.message || "Erro inesperado.";

      if (errorMessage.includes("Invalid login credentials"))
        errorMessage = "E-mail ou senha incorretos.";
      if (errorMessage.includes("Password should be at least"))
        errorMessage = "A senha deve ter no mínimo 6 caracteres.";
      if (errorMessage.includes("User already registered"))
        errorMessage = "Este e-mail já está cadastrado.";
      if (errorMessage.includes("Email not confirmed"))
        errorMessage = "Você precisa confirmar seu e-mail antes de fazer login.";

      toast({
        title: "Atenção",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row bg-background selection:bg-primary/20">
      
      {/* LADO ESQUERDO: Painel Visual (Oculto no Mobile, Visível no Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-zinc-900 to-black z-0 opacity-80" />
        
        {/* Elemento de decoração para dar um toque futurista */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative z-10 text-center flex flex-col items-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/20 backdrop-blur-xl border border-white/10 text-primary shadow-2xl">
            <GraduationCap className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight mb-4">
            EduFlow
          </h1>
          <p className="text-lg text-zinc-300 font-medium max-w-md">
            O campus digital definitivo. Transforme a desorganização em foco e conecte-se com sua universidade.
          </p>
        </div>
      </div>

      {/* LADO DIREITO: Formulário de Autenticação Edge-to-Edge no Mobile */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 lg:px-32 py-12 relative">
        
        <div className="w-full max-w-md mx-auto space-y-8">
          
          {/* Cabeçalho do Formulário (Visível principalmente no mobile para contexto) */}
          <div className="text-center lg:text-left">
            <div className="lg:hidden mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-black text-foreground tracking-tight flex items-center justify-center lg:justify-start gap-2">
              {isResetPassword
                ? "Recuperar Senha"
                : isSignUp
                ? "Criar Conta"
                : email === ADMIN_EMAIL
                ? (
                  <>
                    <ShieldCheck className="h-7 w-7 text-emerald-500" />
                    Acesso Restrito
                  </>
                )
                : "Acessar Conta"}
            </h2>
            <p className="text-muted-foreground font-medium text-sm mt-2">
              {isResetPassword
                ? "Digite seu e-mail para receber o link de recuperação."
                : isSignUp
                ? "Cadastre-se para começar a organizar seus estudos."
                : email === ADMIN_EMAIL
                ? "Insira a chave de acesso do administrador."
                : "Entre para gerenciar sua vida acadêmica."}
            </p>
          </div>

          {/* O Formulário - Sem caixas, direto na tela com campos grandes e premium */}
          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground/80 font-semibold">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-12 h-14 rounded-2xl bg-muted/30 border-border/50 focus:bg-background transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80 font-semibold">E-mail</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="aluno@universidade.edu.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-muted/30 border-border/50 focus:bg-background transition-all"
                  required
                />
              </div>
            </div>

            {!isResetPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground/80 font-semibold">Senha</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsResetPassword(true)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-14 rounded-2xl bg-muted/30 border-border/50 focus:bg-background transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading} 
              className={cn(
                "w-full h-14 rounded-2xl text-base font-bold transition-all active:scale-[0.98]",
                email === ADMIN_EMAIL && !isSignUp && !isResetPassword ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isResetPassword ? (
                "Enviar link de recuperação"
              ) : isSignUp ? (
                "Criar Conta"
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-center mt-6">
            {isResetPassword ? (
              <button
                type="button"
                onClick={() => setIsResetPassword(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignUp((v) => !v)}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {isSignUp ? "Já tem conta? Faça login" : "Ainda não tem conta? Cadastre-se"}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
