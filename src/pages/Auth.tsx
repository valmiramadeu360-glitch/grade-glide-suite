import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, GraduationCap, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

        const { error } =
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });

        if (error) throw error;

        toast({
          title: "E-mail Enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha."
        });

        setIsResetPassword(false);
      }

      else if (isSignUp) {

        const { data, error } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName }
            }
          });

        if (error) throw error;

        if (data?.session) {

          toast({
            title: "Conta Criada!",
            description: "Bem-vindo ao EduFlow."
          });

        } else {

          toast({
            title: "Quase lá!",
            description:
              "Enviamos um link de confirmação para o seu e-mail. Verifique sua caixa de entrada.",
            duration: 6000
          });

          setIsSignUp(false);
        }

      }

      else {

        const { data, error } =
          await supabase.auth.signInWithPassword({
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

  const toggleMode = (mode: "signup" | "reset" | "login") => {

    setPassword("");

    if (mode === "signup") {

      setIsSignUp(true);
      setIsResetPassword(false);

    }

    else if (mode === "reset") {

      setIsResetPassword(true);
      setIsSignUp(false);

    }

    else {

      setIsSignUp(false);
      setIsResetPassword(false);

    }

  };

return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">

      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">
          EduFlow
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.25em] text-[10px] mt-1.5">
          Sua jornada acadêmica
        </p>
      </div>

      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-2xl shadow-2xl rounded-[32px] overflow-hidden">

        <div className={`h-1.5 w-full transition-colors duration-500 ${
          email === ADMIN_EMAIL ? "bg-emerald-500" : "bg-primary"
        }`} />

        <CardHeader className="space-y-2 pt-8 text-center">

          <CardTitle className="text-3xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">

            {isResetPassword
              ? "Redefinir Senha"
              : isSignUp
              ? "Criar Conta"
              : email === ADMIN_EMAIL
              ? (
                <>
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                  Acesso Restrito
                </>
              )
              : "Acessar Conta"}

          </CardTitle>

          <CardDescription className="text-muted-foreground font-medium text-sm px-4">

            {isResetPassword
              ? "Digite seu e-mail para receber o link de recuperação."
              : isSignUp
              ? "Cadastre-se para começar a organizar seus estudos."
              : email === ADMIN_EMAIL
              ? "Insira a chave de acesso do administrador."
              : "Entre para gerenciar sua vida acadêmica."}

          </CardDescription>

        </CardHeader>

        <CardContent className="px-6 pb-6 pt-2">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {!isResetPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsResetPassword(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isResetPassword ? (
                "Enviar link de recuperação"
              ) : isSignUp ? (
                "Criar Conta"
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pb-8">
          {isResetPassword ? (
            <button
              type="button"
              onClick={() => setIsResetPassword(false)}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar ao login
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSignUp((v) => !v)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Cadastre-se"}
            </button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
