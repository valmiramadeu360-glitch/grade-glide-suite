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
            redirectTo: `${window.location.origin}/auth`,
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

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 md:top-8 md:left-8 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors z-10 h-14 w-14 rounded-2xl"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>

      <div className="mb-8 text-center mt-12 md:mt-0">
        <h1 className="text-5xl md:text-6xl font-black text-foreground italic tracking-tighter flex items-center justify-center gap-2">
          EduFlow
        </h1>

        <p className="text-muted-foreground font-black uppercase tracking-[0.3em] text-[10px] mt-2">
          Sua jornada acadêmica organizada
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
