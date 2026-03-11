import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, GraduationCap, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

// E-mail master definido para acesso administrativo
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

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isResetPassword) {
        // Fluxo de recuperação de senha
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        
        if (error) throw error;
        
        toast({ 
          title: "E-mail Enviado!", 
          description: "Verifique sua caixa de entrada para redefinir sua senha." 
        });
        setIsResetPassword(false); 
        
      } else if (isSignUp) {
        // Fluxo de Cadastro - CORRIGIDO PARA LIDAR COM VERIFICAÇÃO DE E-MAIL
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        
        if (error) throw error;
        
        // Verifica se a sessão foi criada imediatamente (confirmação desativada) ou não
        if (data.session) {
           toast({ title: "Conta Criada!", description: "Bem-vindo ao EduFlow." });
           // O AuthProvider cuidará do redirecionamento
        } else {
           toast({ 
             title: "Quase lá!", 
             description: "Enviamos um link de confirmação para o seu e-mail. Por favor, verifique sua caixa de entrada (ou spam) para ativar a conta.",
             duration: 6000 // Toast um pouco mais longo para o usuário ler
           });
           // Volta para a tela de login para o usuário logar após confirmar
           setIsSignUp(false);
        }
        
      } else {
        // Fluxo de Login
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // VERIFICAÇÃO DE ADMINISTRADOR: Intercepta o e-mail Master
        if (data.user?.email === ADMIN_EMAIL) {
          toast({ 
            title: "Acesso Administrativo 🛡️", 
            description: "Bem-vindo ao Painel de Comando Supremo do EduFlow.",
            className: "bg-emerald-500 text-white border-none"
          });
          navigate('/admin'); // Redireciona o admin
        } else {
          toast({ title: "Bem-vindo de volta! 📚" });
          navigate('/'); // Redireciona o aluno
        }
      }
    } catch (error: any) {
      let errorMessage = error.message;
      if (errorMessage.includes("Invalid login credentials")) errorMessage = "E-mail ou senha incorretos.";
      if (errorMessage.includes("Password should be at least")) errorMessage = "A senha deve ter no mínimo 6 caracteres.";
      if (errorMessage.includes("User already registered")) errorMessage = "Este e-mail já está cadastrado no sistema.";
      if (errorMessage.includes("Email not confirmed")) errorMessage = "Você precisa confirmar seu e-mail antes de fazer login.";

      toast({ title: "Atenção", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Reseta os campos ao trocar de aba para evitar envios acidentais
  const toggleMode = (mode: 'signup' | 'reset' | 'login') => {
    setPassword("");
    if (mode === 'signup') {
      setIsSignUp(true);
      setIsResetPassword(false);
    } else if (mode === 'reset') {
      setIsResetPassword(true);
      setIsSignUp(false);
    } else {
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
        title="Voltar"
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>

      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-1000 mt-12 md:mt-0 relative z-10">
        <h1 className="text-5xl md:text-6xl font-black text-foreground italic tracking-tighter flex items-center justify-center gap-2">
          EduFlow
        </h1>
        <p className="text-muted-foreground font-black uppercase tracking-[0.3em] text-[10px] mt-2">
          Sua jornada acadêmica organizada
        </p>
      </div>

      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-2xl shadow-2xl rounded-[32px] overflow-hidden relative z-10">
        
        {/* Detalhe de cor que muda se o usuário digitar o e-mail de admin */}
        <div className={`h-1.5 w-full transition-colors duration-500 ${email === ADMIN_EMAIL ? 'bg-emerald-500' : 'bg-primary'}`} />
        
        <CardHeader className="space-y-2 pt-8 text-center">
          <CardTitle className="text-3xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
            {isResetPassword ? "Redefinir Senha" : isSignUp ? "Criar Conta" : email === ADMIN_EMAIL ? <><ShieldCheck className="h-6 w-6 text-emerald-500" /> Acesso Restrito</> : "Acessar Conta"}
          </CardTitle>
          <CardDescription className="text-muted-foreground font-medium text-sm px-4">
            {isResetPassword 
              ? "Digite seu e-mail para receber o link de recuperação de acesso."
              : isSignUp
                ? "Cadastre-se para começar a organizar e metrificar seus estudos."
                : email === ADMIN_EMAIL 
                  ? "Insira a chave de acesso do administrador."
                  : "Entre para gerenciar sua vida acadêmica e seus prazos."}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleAuth}>
          <CardContent className="space-y-5 px-6 sm:px-8">
            {isSignUp && !isResetPassword && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                  <Input
                    className="pl-12 h-14 bg-muted/30 border-border text-foreground rounded-2xl focus:ring-primary/40 focus:bg-background transition-all font-medium text-base"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {isResetPassword ? "E-mail de Cadastro" : "E-mail de Acesso"}
              </Label>
              <div className="relative group">
                <Mail className={`absolute left-4 top-3.5 h-5 w-5 transition-colors duration-300 ${email === ADMIN_EMAIL ? 'text-emerald-500' : 'text-muted-foreground group-focus-within:text-primary'}`} />
                <Input
                  className={`pl-12 h-14 bg-muted/30 border-border text-foreground rounded-2xl transition-all font-medium text-base ${email === ADMIN_EMAIL ? 'focus:ring-emerald-500/40 focus:bg-background' : 'focus:ring-primary/40 focus:bg-background'}`}
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {!isResetPassword && (
              <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Senha Segura</Label>
                <div className="relative group">
                  <Lock className={`absolute left-4 top-3.5 h-5 w-5 transition-colors duration-300 ${email === ADMIN_EMAIL ? 'text-emerald-500' : 'text-muted-foreground group-focus-within:text-primary'}`} />
                  <Input
                    className={`pl-12 pr-12 h-14 bg-muted/30 border-border text-foreground rounded-2xl transition-all font-medium text-base ${email === ADMIN_EMAIL ? 'focus:ring-emerald-500/40 focus:bg-background' : 'focus:ring-primary/40 focus:bg-background'}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="No mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-14 w-14 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors outline-none rounded-r-2xl"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-5 pb-8 pt-4 px-6 sm:px-8">
            <Button
              className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 text-white ${email === ADMIN_EMAIL ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isResetPassword ? (
                "Enviar Link de Recuperação"
              ) : isSignUp ? (
                "Cadastrar no EduFlow"
              ) : email === ADMIN_EMAIL ? (
                "Autenticar Administrador"
              ) : (
                "Entrar no EduFlow"
              )}
            </Button>

            <div className="flex flex-col items-center gap-3 w-full mt-2">
              {!isResetPassword && !isSignUp && (
                <button
                  type="button"
                  onClick={() => toggleMode('reset')}
                  className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu sua senha?
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleMode(isResetPassword ? 'login' : isSignUp ? 'login' : 'signup')}
                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors bg-muted/50 px-6 py-3 rounded-xl w-full"
              >
                {isResetPassword 
                  ? "Voltar para o Login" 
                  : isSignUp 
                    ? "Já tem uma conta? Entre aqui" 
                    : "Criar uma nova conta"}
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>

      <footer className="mt-10 flex items-center gap-2 text-muted-foreground relative z-10 pb-8">
        <GraduationCap className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">EduFlow Academy · Sistema Acadêmico</span>
      </footer>
    </div>
  );
}
