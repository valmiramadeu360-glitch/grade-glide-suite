import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark, BookOpen, CalendarClock, ChevronRight, FileText, GraduationCap, HelpCircle,
  LayoutDashboard, LogOut, Moon, Newspaper, Settings, ShieldCheck, Sparkles, Store, User, Users,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useTheme } from "@/hooks/useTheme";

interface DrawerItem {
  label: string;
  hint?: string;
  icon: LucideIcon;
  to: string;
}

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppDrawer({ open, onOpenChange }: AppDrawerProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, university, campusName, courseName } = useTenant();
  const { mode, setMode } = useTheme();
  const [roles, setRoles] = useState<string[]>([]);

  // Papéis do usuário (admin, admin de canal…) definem quais atalhos aparecem.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => setRoles((data ?? []).map((r: any) => r.role)));
  }, [user]);

  const isAdmin = roles.includes("admin");
  const canManageChannels = isAdmin || roles.includes("channel_admin");

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const name = profile?.display_name || profile?.full_name || "Estudante";
  const subtitle = [courseName, profile?.current_period ? `${profile.current_period}º período` : null]
    .filter(Boolean)
    .join(" • ");

  const academic: DrawerItem[] = [
    { label: "Painel acadêmico", hint: "Resumo da sua semana", icon: LayoutDashboard, to: "/academico" },
    { label: "Disciplinas", icon: BookOpen, to: "/disciplines" },
    { label: "Cronograma", hint: "Provas e entregas", icon: CalendarClock, to: "/reminders" },
    { label: "Cursos extras", icon: GraduationCap, to: "/disciplines?tab=extra" },
    { label: "Editais e bolsas", icon: FileText, to: "/campus/scholarships" },
    { label: "Ferramentas de estudo com IA", hint: "Resumos, flashcards e planos", icon: Sparkles, to: "/assistant" },
  ];

  const spaces: DrawerItem[] = [
    { label: "Minha loja", hint: "Anúncios que você publicou", icon: Store, to: "/my-shop" },
    { label: "Meus grupos e comunidades", icon: Users, to: "/communities" },
    ...(canManageChannels
      ? [{ label: "Minha Redação", hint: "O jornal que você administra", icon: Newspaper, to: "/news" }]
      : []),
    { label: "Itens salvos", hint: "Publicações guardadas", icon: Bookmark, to: "/connect?saved=1" },
  ];

  const account: DrawerItem[] = [
    { label: "Configurações", hint: "Privacidade, notificações e conta", icon: Settings, to: "/settings" },
    { label: "Ajuda e feedback", icon: HelpCircle, to: "/feedback" },
    ...(isAdmin ? [{ label: "Painel administrativo", icon: ShieldCheck, to: "/admin" }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[88vw] max-w-sm flex-col gap-0 border-r border-border/40 bg-background/90 p-0 backdrop-blur-2xl sm:max-w-sm"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Perfil, vida acadêmica, seus espaços e configurações</SheetDescription>

        {/* Perfil */}
        <button
          type="button"
          onClick={() => go("/profile")}
          className="flex items-center gap-4 px-5 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] pr-14 text-left active:opacity-80"
        >
          <Avatar className="h-14 w-14 border-2 border-primary/20">
            <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary"><User className="h-6 w-6" /></AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-base font-extrabold leading-tight">{name}</span>
            {subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
            {university && (
              <span className="mt-1.5 inline-flex max-w-full items-center truncate rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                {university.acronym}{campusName ? ` · ${campusName}` : ""}
              </span>
            )}
          </span>
        </button>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <Group title="Vida acadêmica">
            {academic.map((item) => <Row key={item.label} item={item} onGo={go} />)}
          </Group>
          <Group title="Meus espaços">
            {spaces.map((item) => <Row key={item.label} item={item} onGo={go} />)}
          </Group>
          <Group title="Conta">
            {account.map((item) => <Row key={item.label} item={item} onGo={go} />)}
          </Group>
        </div>

        {/* Rodapé */}
        <div className="space-y-1 border-t border-border/40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3">
            <Moon className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-semibold">Tema escuro</span>
            <Switch
              checked={mode === "dark"}
              onCheckedChange={(checked) => setMode(checked ? "dark" : "light")}
              aria-label="Alternar tema escuro"
            />
          </div>
          <button
            type="button"
            onClick={() => { onOpenChange(false); signOut(); }}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 active:scale-[0.99]"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-2">
      <p className="px-3 pb-1 pt-3 text-xs font-bold text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ item, onGo }: { item: DrawerItem; onGo: (to: string) => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onGo(item.to)}
      className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted/50 active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">{item.label}</span>
        {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </button>
  );
}
