import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCommunities, Community } from "@/hooks/useCommunities";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2,
  GraduationCap,
  MapPin,
  Users,
  Search,
  MessagesSquare,
  ChevronRight,
  Sparkles,
  Plus,
  BookOpen,
  Lock,
  Globe,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const TYPE_INFO: Record<string, { label: string; icon: any; tint: string }> = {
  university: { label: "Institucional", icon: Building2, tint: "text-blue-500 bg-blue-500/10" },
  campus: { label: "Campus", icon: MapPin, tint: "text-emerald-500 bg-emerald-500/10" },
  course: { label: "Curso", icon: GraduationCap, tint: "text-purple-500 bg-purple-500/10" },
  period: { label: "Turma", icon: Users, tint: "text-amber-500 bg-amber-500/10" },
  discipline: { label: "Disciplina", icon: BookOpen, tint: "text-rose-500 bg-rose-500/10" },
  class: { label: "Grupo de Estudo", icon: Users, tint: "text-primary bg-primary/10" },
};

export default function Communities() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { communities, loading, reload } = useCommunities();
  const { university } = useTenant();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "official" | "groups">("all");

  // Modal de Criação de Grupo Estudantil
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState<"class" | "discipline">("class");

  const filtered = useMemo(() => {
    let list = communities;

    if (filterType === "official") {
      list = list.filter((c) => ["university", "campus", "course", "period"].includes(c.type));
    } else if (filterType === "groups") {
      list = list.filter((c) => !["university", "campus", "course", "period"].includes(c.type));
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q),
    );
  }, [communities, search, filterType]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || !user) return;

    setCreating(true);
    try {
      // Criação da comunidade vinculada à universidade atual do estudante
      const { data: newCommunity, error: commError } = await supabase
        .from("communities")
        .insert({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          type: groupType,
          university_id: university?.id || null,
          member_count: 1,
          status: "active",
          is_official: false,
          is_verified: false,
          allow_member_posts: true,
          allow_member_discussions: true,
        })
        .select()
        .single();

      if (commError) throw commError;

      // Inclusão do criador como membro
      if (newCommunity) {
        await supabase.from("community_members").insert({
          community_id: newCommunity.id,
          user_id: user.id,
          role: "member",
        });

        toast({
          title: "Grupo criado com sucesso!",
          description: "Você já pode convidar colegas e compartilhar materiais.",
        });

        setGroupName("");
        setGroupDescription("");
        setIsCreateOpen(false);
        reload?.();
        navigate(`/community/${newCommunity.id}`);
      }
    } catch (err: any) {
      toast({
        title: "Não foi possível criar o grupo",
        description: err.message || "Verifique sua conexão ou tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-28 px-4 sm:px-6 pt-4 sm:pt-8 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Comunidades</h1>
            {university?.acronym && (
              <Badge variant="outline" className="rounded-xl border-primary/30 text-primary font-bold text-[10px]">
                {university.acronym}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            Espaços colaborativos do seu curso, turmas e grupos de estudos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Criação de Grupo de Estudos */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 rounded-2xl font-bold shadow-md bg-primary text-primary-foreground hover:scale-[1.02] transition-transform gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Criar Grupo</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[28px] max-w-md bg-card border-border/40">
              <form onSubmit={handleCreateGroup}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-black">Criar Grupo Estudantil</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Crie um espaço para sua turma, grupo de pesquisa ou estudos colaborativos.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Nome do Grupo *
                    </label>
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Ex: Grupo de Estudos Direito Civil, TCC 2026..."
                      className="rounded-xl h-11 bg-muted/30 border-border/40 font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Finalidade
                    </label>
                    <Select value={groupType} onValueChange={(v: any) => setGroupType(v)}>
                      <SelectTrigger className="rounded-xl h-11 bg-muted/30 border-border/40 font-medium">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="class">Grupo de Estudo Geral</SelectItem>
                        <SelectItem value="discipline">Apoio a Disciplina Específica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Descrição & Objetivos
                    </label>
                    <Textarea
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder="Descreva sobre o que é o grupo e o que será compartilhado..."
                      className="rounded-xl bg-muted/30 border-border/40 font-medium resize-none min-h-[90px]"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-xl font-bold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating || !groupName.trim()}
                    className="rounded-xl font-bold bg-primary text-primary-foreground"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Comunidade"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/messages")}
            className="h-11 rounded-2xl font-bold border-border/40 hover:bg-muted/40"
          >
            <MessagesSquare className="mr-2 h-4 w-4 text-primary" />
            Mensagens
          </Button>
        </div>
      </header>

      {/* Barra de Busca e Filtros Rápidos */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por disciplina, turma ou grupo..."
            className="h-12 rounded-[22px] border border-border/40 bg-card pl-11 text-base font-medium shadow-sm focus-visible:ring-primary"
          />
        </div>

        {/* Chips de Categorias */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Button
            type="button"
            size="sm"
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
            className="rounded-full text-xs font-bold h-8 px-4"
          >
            Todas ({communities.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === "official" ? "default" : "outline"}
            onClick={() => setFilterType("official")}
            className="rounded-full text-xs font-bold h-8 px-4"
          >
            Oficiais do Campus
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterType === "groups" ? "default" : "outline"}
            onClick={() => setFilterType("groups")}
            className="rounded-full text-xs font-bold h-8 px-4"
          >
            Grupos de Estudos
          </Button>
        </div>
      </div>

      {/* Listagem */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[32px] border border-border/40 bg-card/60 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-base font-bold text-foreground">
              {search ? "Nenhuma comunidade encontrada" : "Você ainda não participa de comunidades"}
            </p>
            <p className="max-w-sm text-xs sm:text-sm font-medium text-muted-foreground">
              {search
                ? "Tente buscar por outro termo ou limpe os filtros."
                : "Complete seu perfil acadêmico para entrar automaticamente nas comunidades oficiais ou crie seu próprio grupo no botão acima."}
            </p>
            {!search && (
              <div className="flex gap-2 mt-2">
                <Button onClick={() => setIsCreateOpen(true)} className="rounded-2xl font-bold text-xs h-10">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Criar Primeiro Grupo
                </Button>
                <Button variant="outline" onClick={() => navigate("/profile")} className="rounded-2xl font-bold text-xs h-10">
                  Completar Perfil
                </Button>
              </div>
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
            const isOfficial = ["university", "campus", "course", "period"].includes(c.type);

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/community/${c.id}`)}
                className="group w-full text-left"
              >
                <Card className="rounded-[28px] border border-border/40 bg-card/80 shadow-sm backdrop-blur-xl transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99] overflow-hidden">
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner",
                        info.tint,
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-black leading-tight text-foreground group-hover:text-primary transition-colors">
                          {c.name}
                        </p>
                        {isOfficial && (
                          <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" title="Comunidade Oficial" />
                        )}
                      </div>
                      
                      <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                        {c.description || "Espaço de discussões e arquivos"}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="border-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg"
                        >
                          {info.label}
                        </Badge>
                        <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {c.member_count} {c.member_count === 1 ? "membro" : "membros"}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
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
