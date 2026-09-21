import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCommunities } from "@/hooks/useCommunities";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Building2, GraduationCap, MapPin, Users, Search, MessagesSquare,
  ChevronRight, Sparkles,
} from "lucide-react";

/**
 * Aba "Comunidades" (5ª aba da barra inferior).
 * Lista as comunidades em que o estudante já entrou automaticamente ao escolher
 * universidade, campus, curso e período, e dá acesso às mensagens diretas.
 */

const TYPE_INFO: Record<string, { label: string; icon: any; tint: string }> = {
  university: { label: "Universidade", icon: Building2, tint: "text-blue-500 bg-blue-500/10" },
  campus: { label: "Campus", icon: MapPin, tint: "text-emerald-500 bg-emerald-500/10" },
  course: { label: "Curso", icon: GraduationCap, tint: "text-purple-500 bg-purple-500/10" },
  period: { label: "Turma", icon: Users, tint: "text-amber-500 bg-amber-500/10" },
};

export default function Communities() {
  const navigate = useNavigate();
  const { communities, loading } = useCommunities();
  const { university } = useTenant();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q),
    );
  }, [communities, search]);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight">Comunidades</h1>
        <p className="text-sm font-medium text-muted-foreground">
          {university?.acronym
            ? `Seus espaços dentro da ${university.acronym}.`
            : "Seus espaços de convivência e estudo."}
        </p>
      </div>

      {/* Busca + atalho para mensagens */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar comunidade, turma ou grupo..."
            className="h-12 rounded-2xl border border-border/40 bg-card pl-11 text-base font-medium shadow-sm focus-visible:ring-primary"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/messages")}
          className="h-12 rounded-2xl font-bold"
        >
          <MessagesSquare className="mr-2 h-4 w-4" />
          Mensagens
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-base font-bold">
              {search ? "Nenhuma comunidade encontrada" : "Você ainda não tem comunidades"}
            </p>
            <p className="max-w-sm text-sm font-medium text-muted-foreground">
              {search
                ? "Tente buscar por outro nome."
                : "Confirme sua universidade, campus, curso e período no perfil para entrar automaticamente nas comunidades da sua turma."}
            </p>
            {!search && (
              <Button onClick={() => navigate("/profile")} className="mt-2 rounded-2xl font-bold">
                Completar meu perfil
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => {
            const info = TYPE_INFO[c.type] ?? {
              label: "Grupo",
              icon: Users,
              tint: "text-primary bg-primary/10",
            };
            const Icon = info.icon;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/community/${c.id}`)}
                className="group w-full text-left"
              >
                <Card className="rounded-3xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-xl transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]">
                  <CardContent className="flex items-center gap-4 p-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        info.tint,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black leading-tight group-hover:text-primary">
                          {c.name}
                        </p>
                        <Badge
                          variant="secondary"
                          className="shrink-0 border-0 text-[9px] font-bold uppercase tracking-wider"
                        >
                          {info.label}
                        </Badge>
                      </div>
                      {c.description && (
                        <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                          {c.description}
                        </p>
                      )}
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {c.member_count} {c.member_count === 1 ? "integrante" : "integrantes"}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
