import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, GraduationCap, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false); // Estado para recuperação de senha
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Estado para o Olho da senha
  const { toast } = useToast();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (isResetPassword) {
      // Fluxo de recuperação de senha
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast({ title: "Erro no envio", description: error.message, variant: "destructive" });
      } else {
        toast({ 
          title: "E-mail Enviado!", 
          description: "Verifique sua caixa de entrada para redefinir sua senha." 
        });
        setIsResetPassword(false); // Voltar para tela de login
      }
    } else if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative">
      {/* Botão de voltar melhorado para usabilidade mobile */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-4 left-4 md:top-8 md:left-8 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors z-10 h-12 w-12"
        onClick={() => window.history.back()}
        title="Voltar"
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>

      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-1000 mt-12 md:mt-0">
        <h1 className="text-5xl font-black text-foreground italic tracking-tighter flex items-center justify-center gap-2">
          EduFlow
        </h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.3em] text-[10px] mt-2">
          Sua jornada acadêmica organizada
        </p>
      </div>

      <Card className="w-full max-w-md border-border bg-card backdrop-blur-xl shadow-2xl rounded-[32px] overflow-hidden">
        {/* Esta barra superior usará a cor principal do tema (rosa, azul, etc) */}
        <div className="h-1.5 w-full bg-primary transition-colors duration-300" />
        <CardHeader className="space-y-2 pt-8 text-center">
          <CardTitle className="text-3xl font-black text-foreground tracking-tight">
            {isResetPassword ? "Redefinir Senha" : isSignUp ? "Criar Conta" : "Acessar Conta"}
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium">
            {isResetPassword 
              ? "Digite seu e-mail para receber o link de recuperação."
              : isSignUp
                ? "Cadastre-se para começar a organizar seus estudos."
                : "Entre para gerenciar sua vida acadêmica."}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleAuth}>
          <CardContent className="space-y-5">
            {isSignUp && !isResetPassword && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                  <Input
                    className="pl-11 h-12 bg-muted/30 border-border text-foreground rounded-2xl focus:ring-primary/20 transition-all"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {isResetPassword ? "E-mail para recuperação" : "E-mail acadêmico"}
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                <Input
                  className="pl-11 h-12 bg-muted/30 border-border text-foreground rounded-2xl focus:ring-primary/20 transition-all"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {!isResetPassword && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                  <Input
                    className="pl-11 pr-12 h-12 bg-muted/30 border-border text-foreground rounded-2xl focus:ring-primary/20 transition-all"
                    type={showPassword ? "text" : "password"}
                    placeholder="No mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pb-8 pt-4">
            <Button
              className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isResetPassword ? (
                "Enviar Link de Recuperação"
              ) : isSignUp ? (
                "Cadastrar no EduFlow"
              ) : (
                "Entrar no EduFlow"
              )}
            </Button>

            {/* Links de navegação */}
            {!isResetPassword && !isSignUp && (
              <button
                type="button"
                onClick={() => setIsResetPassword(true)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Esqueceu sua senha?
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setIsResetPassword(false);
              }}
              className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              {isResetPassword 
                ? "Voltar para o Login" 
                : isSignUp 
                  ? "Já tem uma conta? Entre aqui" 
                  : "Ainda não tem conta? Cadastre-se"}
            </button>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-8 flex items-center gap-2 text-muted-foreground">
        <GraduationCap className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">EduFlow Academy · 2026</span>
      </footer>
    </div>
  );
}
