import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Search,
} from "lucide-react";

// Algumas funções/colunas novas podem ainda não estar presentes
// no types.ts gerado pelo Supabase.
// O cast mantém compatibilidade até a regeneração dos tipos.
const db = supabase as any;

interface Uni {
  id: string;
  name: string;
  acronym: string;
  state: string;
  city?: string | null;
}

interface Campus {
  id: string;
  name: string;
  city?: string | null;
}

interface AcademicUnit {
  id: string;
  name: string;
  acronym?: string | null;
  campus_id: string;
}

interface Course {
  id: string;
  name: string;
  degree: string;
  academic_unit_id?: string | null;
  campus_id?: string | null;
}

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const DEGREES: { value: string; label: string }[] = [
  { value: "graduacao", label: "Graduação" },
  { value: "tecnico", label: "Técnico" },
  { value: "especializacao", label: "Especialização" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
];

const TITLES = [
  {
    title: "Qual é a sua universidade?",
    sub: "Vamos usar sua universidade para organizar seu Feed, notícias, comunidades, eventos e oportunidades.",
  },
  {
    title: "Em qual campus você estuda?",
    sub: "O campus ajuda o EduConect a mostrar informações mais relevantes para o lugar onde você estuda.",
  },
  {
    title: "Qual é a sua unidade?",
    sub: "Faculdade, instituto ou centro acadêmico. Você pode informar agora ou deixar para depois.",
  },
  {
    title: "Qual é o seu curso?",
    sub: "Seu curso será usado para aproximar você de estudantes, conteúdos e comunidades acadêmicas relacionadas.",
  },
  {
    title: "Conte um pouco mais sobre sua trajetória",
    sub: "Essas informações ajudam o EduConect a organizar sua comunidade e personalizar sua experiência. Você poderá alterá-las depois.",
  },
];

const normalize = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function UniversityOnboarding() {
  const { user, signOut } = useAuth();
  const { refresh } = useTenant();
  const { toast } = useToast();

  // 0 = universidade
  // 1 = campus
  // 2 = unidade
  // 3 = curso
  // 4 = trajetória
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);

  const [uni, setUni] = useState<Uni | null>(null);
  const [campus, setCampus] = useState<Campus | null>(null);
  const [academicUnit, setAcademicUnit] = useState<AcademicUnit | null>(
    null,
  );
  const [course, setCourse] = useState<Course | null>(null);

  const [period, setPeriod] = useState(1);

  // Novo: semestre de entrada.
  const [entrySemester, setEntrySemester] = useState("");

  // Novo: turma/seção opcional.
  const [classSection, setClassSection] = useState("");

  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------
  // ETAPA 1 — UNIVERSIDADE
  // -------------------------------------------------------------

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Uni[]>([]);
  const [searching, setSearching] = useState(false);

  const [showCreateUni, setShowCreateUni] = useState(false);
  const [newUniName, setNewUniName] = useState("");
  const [newUniAcr, setNewUniAcr] = useState("");
  const [newUniState, setNewUniState] = useState("");
  const [newUniCity, setNewUniCity] = useState("");

  const [creating, setCreating] = useState(false);

  // -------------------------------------------------------------
  // ETAPA 2 — CAMPUS
  // -------------------------------------------------------------

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(false);

  const [showCreateCampus, setShowCreateCampus] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");

  // -------------------------------------------------------------
  // ETAPA 3 — UNIDADE ACADÊMICA
  // -------------------------------------------------------------

  const [academicUnits, setAcademicUnits] = useState<AcademicUnit[]>([]);
  const [loadingAcademicUnits, setLoadingAcademicUnits] = useState(false);

  const [showCreateAcademicUnit, setShowCreateAcademicUnit] =
    useState(false);

  const [newAcademicUnitName, setNewAcademicUnitName] = useState("");
  const [newAcademicUnitAcronym, setNewAcademicUnitAcronym] = useState("");

  // -------------------------------------------------------------
  // ETAPA 4 — CURSO
  // -------------------------------------------------------------

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [courseQuery, setCourseQuery] = useState("");
  const [showCreateCourse, setShowCreateCourse] = useState(false);

  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDegree, setNewCourseDegree] = useState("graduacao");

  // -------------------------------------------------------------
  // ERROS
  // -------------------------------------------------------------

  const fail = (title: string, e: any) =>
    toast({
      title,
      description:
        e?.message ?? "Tente novamente em instantes.",
      variant: "destructive",
    });

  // =============================================================
  // BUSCA DE UNIVERSIDADES
  // =============================================================

  useEffect(() => {
    if (step !== 0) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearching(true);

      const term = query.trim();

      const cols = "id,name,acronym,state,city";

      let rows: Uni[] = [];

      if (term.length < 2) {
        const { data } = await db
          .from("universities")
          .select(cols)
          .order("name")
          .limit(8);

        rows = data ?? [];
      } else {
        const safe = term
          .replace(/[%,()]/g, " ")
          .trim();

        let byName = db
          .from("universities")
          .select(cols)
          .limit(10);

        for (const token of normalize(term)
          .split(" ")
          .filter(Boolean)) {
          byName = byName.ilike(
            "name_key",
            `%${token}%`,
          );
        }

        const [nameRes, acrRes] = await Promise.all([
          byName,
          db
            .from("universities")
            .select(cols)
            .ilike(
              "acronym",
              `%${safe}%`,
            )
            .limit(6),
        ]);

        let merged: Uni[] = [
          ...(nameRes.data ?? []),
          ...(acrRes.data ?? []),
        ];

        if (nameRes.error) {
          const fallback = await db
            .from("universities")
            .select(cols)
            .ilike(
              "name",
              `%${safe}%`,
            )
            .limit(10);

          merged = [
            ...(fallback.data ?? []),
            ...(acrRes.data ?? []),
          ];
        }

        const seen = new Set<string>();

        rows = merged.filter(
          (u) =>
            !seen.has(u.id) &&
            !!seen.add(u.id),
        );
      }

      if (!cancelled) {
        setResults(rows);
        setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, step]);

  // =============================================================
  // CAMPUS DA UNIVERSIDADE
  // =============================================================

  useEffect(() => {
    if (step !== 1 || !uni) return;

    let cancelled = false;

    (async () => {
      setLoadingCampuses(true);

      const { data } = await db
        .from("campuses")
        .select("id,name,city")
        .eq("university_id", uni.id)
        .order("name");

      if (cancelled) return;

      const list: Campus[] = data ?? [];

      setCampuses(list);
      setShowCreateCampus(list.length === 0);
      setLoadingCampuses(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [step, uni]);

  // =============================================================
  // UNIDADES ACADÊMICAS DO CAMPUS
  // =============================================================

  useEffect(() => {
    if (step !== 2 || !campus) return;

    let cancelled = false;

    (async () => {
      setLoadingAcademicUnits(true);

      const { data, error } = await db
        .from("academic_units")
        .select(
          "id,name,acronym,campus_id",
        )
        .eq("campus_id", campus.id)
        .order("name");

      if (cancelled) return;

      if (error) {
        // A migration ainda não está disponível.
        // Não bloqueamos o onboarding antigo.
        setAcademicUnits([]);
        setLoadingAcademicUnits(false);
        return;
      }

      const list: AcademicUnit[] = data ?? [];

      setAcademicUnits(list);
      setShowCreateAcademicUnit(false);
      setLoadingAcademicUnits(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [step, campus]);

  // =============================================================
  // CURSOS DO CAMPUS
  // =============================================================

  useEffect(() => {
    if (step !== 3 || !campus) return;

    let cancelled = false;

    (async () => {
      setLoadingCourses(true);

      let queryBuilder = db
        .from("courses")
        .select(
          "id,name,degree,academic_unit_id,campus_id",
        )
        .eq("campus_id", campus.id)
        .order("name");

      // Se uma unidade foi escolhida, damos preferência
      // aos cursos daquela unidade.
      //
      // Não filtramos exclusivamente pela unidade para
      // preservar cursos antigos que ainda não foram
      // vinculados a uma academic_unit.
      const { data, error } = await queryBuilder;

      if (cancelled) return;

      if (error) {
        setCourses([]);
        setLoadingCourses(false);
        return;
      }

      const list: Course[] = data ?? [];

      setCourses(list);
      setShowCreateCourse(list.length === 0);
      setLoadingCourses(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [step, campus]);

  // =============================================================
  // FILTRO DE CURSOS
  // =============================================================

  const filteredCourses = useMemo(() => {
    const q = normalize(courseQuery);

    let list = courses;

    // Quando a unidade foi informada, mostramos primeiro
    // os cursos vinculados a ela.
    if (academicUnit) {
      const unitCourses = courses.filter(
        (c) =>
          c.academic_unit_id ===
          academicUnit.id,
      );

      const otherCourses = courses.filter(
        (c) =>
          c.academic_unit_id !==
          academicUnit.id,
      );

      list = [
        ...unitCourses,
        ...otherCourses,
      ];
    }

    if (!q) return list;

    return list.filter((c) =>
      normalize(c.name).includes(q),
    );
  }, [
    courses,
    courseQuery,
    academicUnit,
  ]);

  // =============================================================
  // ESCOLHER UNIVERSIDADE
  // =============================================================

  function pickUniversity(u: Uni) {
    if (uni?.id !== u.id) {
      setCampus(null);
      setAcademicUnit(null);
      setCourse(null);
    }

    setUni(u);
    setStep(1);
  }

  // =============================================================
  // ESCOLHER CAMPUS
  // =============================================================

  function pickCampus(c: Campus) {
    if (campus?.id !== c.id) {
      setAcademicUnit(null);
      setCourse(null);
    }

    setCampus(c);
    setStep(2);
  }

  // =============================================================
  // ESCOLHER UNIDADE
  // =============================================================

  function pickAcademicUnit(
    unit: AcademicUnit,
  ) {
    setAcademicUnit(unit);
    setCourse(null);
    setStep(3);
  }

  // Permite continuar sem unidade.
  function skipAcademicUnit() {
    setAcademicUnit(null);
    setCourse(null);
    setStep(3);
  }

  // =============================================================
  // ESCOLHER CURSO
  // =============================================================

  function pickCourse(c: Course) {
    setCourse(c);
  }

  // =============================================================
  // CRIAR UNIVERSIDADE
  // =============================================================

  async function createUniversity() {
    if (newUniName.trim().length < 3) {
      return fail(
        "Informe o nome da universidade",
        {
          message:
            "Use o nome completo, por exemplo: Universidade Federal de Alagoas.",
        },
      );
    }

    if (!newUniState) {
      return fail(
        "Escolha o estado",
        {
          message:
            "Selecione a UF onde fica a universidade.",
        },
      );
    }

    setCreating(true);

    try {
      const {
        data: id,
        error,
      } = await db.rpc(
        "find_or_create_university",
        {
          _name: newUniName,
          _acronym:
            newUniAcr || null,
          _state: newUniState,
          _city:
            newUniCity || null,
        },
      );

      if (error) throw error;

      const {
        data: row,
      } = await db
        .from("universities")
        .select(
          "id,name,acronym,state,city",
        )
        .eq("id", id)
        .maybeSingle();

      if (row) {
        pickUniversity(
          row as Uni,
        );
      }
    } catch (e) {
      fail(
        "Não foi possível cadastrar a universidade",
        e,
      );
    } finally {
      setCreating(false);
    }
  }

  // =============================================================
  // CRIAR CAMPUS
  // =============================================================

  async function createCampus() {
    if (!uni) return;

    if (
      newCampusName.trim().length <
      2
    ) {
      return fail(
        "Informe o nome do campus",
        {
          message:
            "Por exemplo: Campus A. C. Simões.",
        },
      );
    }

    setCreating(true);

    try {
      const {
        data: id,
        error,
      } = await db.rpc(
        "find_or_create_campus",
        {
          _university_id:
            uni.id,
          _name:
            newCampusName,
          _city: null,
        },
      );

      if (error) throw error;

      const {
        data: row,
      } = await db
        .from("campuses")
        .select(
          "id,name,city",
        )
        .eq("id", id)
        .maybeSingle();

      if (row) {
        pickCampus(
          row as Campus,
        );
      }
    } catch (e) {
      fail(
        "Não foi possível cadastrar o campus",
        e,
      );
    } finally {
      setCreating(false);
    }
  }

  // =============================================================
  // CRIAR UNIDADE ACADÊMICA
  // =============================================================

  async function createAcademicUnit() {
    if (!campus) return;

    if (
      newAcademicUnitName.trim()
        .length < 2
    ) {
      return fail(
        "Informe o nome da unidade",
        {
          message:
            "Por exemplo: Faculdade de Economia, Administração e Contabilidade.",
        },
      );
    }

    setCreating(true);

    try {
      const {
        data: id,
        error,
      } = await db.rpc(
        "find_or_create_academic_unit",
        {
          _campus_id:
            campus.id,
          _name:
            newAcademicUnitName,
          _acronym:
            newAcademicUnitAcronym ||
            null,
          _description: null,
        },
      );

      if (error) throw error;

      const {
        data: row,
      } = await db
        .from("academic_units")
        .select(
          "id,name,acronym,campus_id",
        )
        .eq("id", id)
        .maybeSingle();

      if (row) {
        const unit =
          row as AcademicUnit;

        setAcademicUnits(
          (prev) =>
            prev.some(
              (u) =>
                u.id ===
                unit.id,
            )
              ? prev
              : [
                  ...prev,
                  unit,
                ],
        );

        pickAcademicUnit(
          unit,
        );
      }
    } catch (e) {
      fail(
        "Não foi possível cadastrar a unidade",
        e,
      );
    } finally {
      setCreating(false);
    }
  }

  // =============================================================
  // CRIAR CURSO
  // =============================================================

  async function createCourse() {
    if (!campus) return;

    if (
      newCourseName.trim().length <
      2
    ) {
      return fail(
        "Informe o nome do curso",
        {
          message:
            "Por exemplo: Ciência da Computação.",
        },
      );
    }

    setCreating(true);

    try {
      const {
        data: id,
        error,
      } = await db.rpc(
        "find_or_create_course",
        {
          _campus_id:
            campus.id,
          _name:
            newCourseName,
          _degree:
            newCourseDegree,
          _total_periods:
            null,
        },
      );

      if (error) throw error;

      const {
        data: row,
      } = await db
        .from("courses")
        .select(
          "id,name,degree,academic_unit_id,campus_id",
        )
        .eq("id", id)
        .maybeSingle();

      if (row) {
        const newCourse =
          row as Course;

        setCourse(
          newCourse,
        );

        setShowCreateCourse(
          false,
        );

        setCourses(
          (prev) =>
            prev.some(
              (c) =>
                c.id ===
                newCourse.id,
            )
              ? prev
              : [
                  ...prev,
                  newCourse,
                ],
        );
      }
    } catch (e) {
      fail(
        "Não foi possível cadastrar o curso",
        e,
      );
    } finally {
      setCreating(false);
    }
  }

  // =============================================================
  // FINALIZAR ONBOARDING
  // =============================================================

  async function finish() {
    if (
      !user ||
      !uni ||
      !campus ||
      !course
    ) {
      return;
    }

    setSaving(true);

    try {
      const {
        error,
      } = await db
        .from("profiles")
        .upsert(
          {
            user_id:
              user.id,

            university_id:
              uni.id,

            campus_id:
              campus.id,

            // Nova informação.
            academic_unit_id:
              academicUnit?.id ??
              null,

            course_id:
              course.id,

            // Nova informação.
            entry_semester:
              entrySemester.trim() ||
              null,

            // Nova informação.
            class_section:
              classSection.trim() ||
              null,

            current_period:
              period,

            // Mantemos os campos antigos
            // para não quebrar o restante
            // do aplicativo.
            university:
              uni.acronym,

            course:
              course.name,
          },
          {
            onConflict:
              "user_id",
          },
        );

      if (error) throw error;

      toast({
        title: `Bem-vindo à rede ${uni.acronym}!`,
        description:
          "Seu perfil acadêmico foi configurado.",
      });

      await refresh();
    } catch (e) {
      fail(
        "Não foi possível salvar",
        e,
      );
    } finally {
      setSaving(false);
    }
  }

  // =============================================================
  // NAVEGAÇÃO
  // =============================================================

  function goBack() {
    if (step === 1) {
      setStep(0);
      return;
    }

    if (step === 2) {
      setStep(1);
      return;
    }

    if (step === 3) {
      setStep(2);
      return;
    }

    if (step === 4) {
      setStep(3);
    }
  }

  function continueFromUnit() {
    setStep(3);
  }

  function continueFromCourse() {
    if (!course) {
      return fail(
        "Escolha seu curso",
        {
          message:
            "Selecione seu curso para continuar.",
        },
      );
    }

    setStep(4);
  }

  const copy = TITLES[step];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-primary/10 via-background to-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 py-6 sm:py-10">

        {/* =====================================================
            CABEÇALHO
        ===================================================== */}

        <header className="flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight text-primary">
            EduConect
          </span>

          <button
            type="button"
            onClick={() =>
              signOut()
            }
            className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </header>

        {/* =====================================================
            TRILHA ACADÊMICA
        ===================================================== */}

        <nav
          aria-label="Sua rede acadêmica"
          className="mt-6 flex flex-wrap items-center gap-1.5 text-xs font-semibold"
        >
          <TrailChip
            filled={!!uni}
            active={
              step === 0
            }
            label={
              uni
                ? uni.acronym
                : "Universidade"
            }
          />

          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground/60"
            aria-hidden
          />

          <TrailChip
            filled={!!campus}
            active={
              step === 1
            }
            label={
              campus
                ? campus.name
                : "Campus"
            }
          />

          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground/60"
            aria-hidden
          />

          <TrailChip
            filled={
              !!academicUnit
            }
            active={
              step === 2
            }
            label={
              academicUnit
                ? academicUnit.acronym ||
                  academicUnit.name
                : "Unidade"
            }
          />

          <ChevronRight
            className="h-3.5 w-3.5 text-muted-foreground/60"
            aria-hidden
          />

          <TrailChip
            filled={!!course}
            active={
              step === 3 ||
              step === 4
            }
            label={
              course
                ? course.name
                : "Curso"
            }
          />
        </nav>

        {/* =====================================================
            TÍTULO
        ===================================================== */}

        <div className="mt-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
            Etapa {step + 1} de 5
          </div>

          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            {copy.title}
          </h1>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {copy.sub}
          </p>
        </div>

        {/* =====================================================
            CONTEÚDO
        ===================================================== */}

        <section className="mt-6 flex-1 rounded-[28px] border border-border/40 bg-card/80 p-4 shadow-sm backdrop-blur-xl sm:p-5">

          {/* ===================================================
              ETAPA 1 — UNIVERSIDADE
          =================================================== */}

          {step === 0 &&
            !showCreateUni && (
              <div className="space-y-4">

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    value={
                      query
                    }
                    onChange={(e) =>
                      setQuery(
                        e.target
                          .value,
                      )
                    }
                    placeholder="Nome ou sigla (ex.: UFAL)"
                    autoComplete="off"
                    className="h-14 rounded-2xl border-border/40 bg-muted/20 pl-11 text-base font-semibold"
                  />

                  {searching && (
                    <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>

                <div
                  className="space-y-2"
                  role="listbox"
                  aria-label="Universidades encontradas"
                >
                  {results.map(
                    (u) => (
                      <OptionRow
                        key={
                          u.id
                        }
                        selected={
                          uni?.id ===
                          u.id
                        }
                        title={`${u.acronym} — ${u.name}`}
                        subtitle={[
                          u.city,
                          u.state,
                        ]
                          .filter(
                            Boolean,
                          )
                          .join(
                            ", ",
                          )}
                        onClick={() =>
                          pickUniversity(
                            u,
                          )
                        }
                      />
                    ),
                  )}

                  {!searching &&
                    results.length ===
                      0 && (
                      <p className="px-1 py-4 text-sm text-muted-foreground">
                        Nenhuma universidade com esse nome ainda. Você pode cadastrar a sua abaixo.
                      </p>
                    )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewUniName(
                      query.trim(),
                    );
                    setShowCreateUni(
                      true,
                    );
                  }}
                  className="h-12 w-full rounded-2xl font-bold"
                >
                  Não encontrei a minha universidade
                </Button>
              </div>
            )}

          {/* ===================================================
              CADASTRAR UNIVERSIDADE
          =================================================== */}

          {step === 0 &&
            showCreateUni && (
              <div className="space-y-4">

                <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm leading-relaxed text-foreground/80">
                  Confira a busca antes: se ela já existir, você entra na mesma rede dos seus colegas. Cadastros repetidos são unificados automaticamente.
                </p>

                <Field label="Nome completo">
                  <Input
                    value={
                      newUniName
                    }
                    onChange={(e) =>
                      setNewUniName(
                        e.target
                          .value,
                      )
                    }
                    placeholder="Universidade Federal de Alagoas"
                    className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">

                  <Field label="Sigla (opcional)">
                    <Input
                      value={
                        newUniAcr
                      }
                      onChange={(e) =>
                        setNewUniAcr(
                          e.target.value.toUpperCase(),
                        )
                      }
                      placeholder="UFAL"
                      maxLength={
                        10
                      }
                      className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                    />
                  </Field>

                  <Field label="Estado">
                    <select
                      value={
                        newUniState
                      }
                      onChange={(e) =>
                        setNewUniState(
                          e.target.value,
                        )
                      }
                      className="h-14 w-full rounded-2xl border border-input bg-muted/20 px-3 text-base font-semibold focus-visible:outline-none"
                    >
                      <option value="">
                        UF
                      </option>

                      {UFS.map(
                        (
                          uf,
                        ) => (
                          <option
                            key={
                              uf
                            }
                            value={
                              uf
                            }
                          >
                            {
                              uf
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                </div>

                <Field label="Cidade (opcional)">
                  <Input
                    value={
                      newUniCity
                    }
                    onChange={(e) =>
                      setNewUniCity(
                        e.target
                          .value,
                      )
                    }
                    placeholder="Maceió"
                    className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                  />
                </Field>

                <div className="flex gap-3">

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setShowCreateUni(
                        false,
                      )
                    }
                    className="h-14 rounded-2xl font-bold"
                  >
                    Voltar
                  </Button>

                  <Button
                    type="button"
                    onClick={
                      createUniversity
                    }
                    disabled={
                      creating
                    }
                    className="h-14 flex-1 rounded-2xl font-bold"
                  >
                    {creating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Cadastrar e continuar"
                    )}
                  </Button>
                </div>
              </div>
            )}

          {/* ===================================================
              ETAPA 2 — CAMPUS
          =================================================== */}

          {step === 1 && (
            <div className="space-y-4">

              {loadingCampuses ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {campuses.length >
                    0 && (
                    <div
                      className="space-y-2"
                      role="listbox"
                      aria-label="Campus"
                    >
                      {campuses.map(
                        (
                          c,
                        ) => (
                          <OptionRow
                            key={
                              c.id
                            }
                            selected={
                              campus?.id ===
                              c.id
                            }
                            title={
                              c.name
                            }
                            subtitle={
                              c.city ??
                              undefined
                            }
                            onClick={() =>
                              pickCampus(
                                c,
                              )
                            }
                          />
                        ),
                      )}
                    </div>
                  )}

                  {!showCreateCampus ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setShowCreateCampus(
                          true,
                        )
                      }
                      className="h-12 w-full rounded-2xl font-bold"
                    >
                      Meu campus não está na lista
                    </Button>
                  ) : (
                    <div className="space-y-3">

                      <Field label="Nome do campus">
                        <Input
                          value={
                            newCampusName
                          }
                          onChange={(e) =>
                            setNewCampusName(
                              e.target
                                .value,
                            )
                          }
                          placeholder="Campus A. C. Simões"
                          className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                        />
                      </Field>

                      <Button
                        type="button"
                        onClick={
                          createCampus
                        }
                        disabled={
                          creating
                        }
                        className="h-14 w-full rounded-2xl font-bold"
                      >
                        {creating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "Cadastrar e continuar"
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}

              <BackButton
                onClick={() =>
                  setStep(0)
                }
              />
            </div>
          )}

          {/* ===================================================
              ETAPA 3 — UNIDADE ACADÊMICA
          =================================================== */}

          {step === 2 && (
            <div className="space-y-4">

              {loadingAcademicUnits ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {academicUnits.length >
                    0 && (
                    <div
                      className="space-y-2"
                      role="listbox"
                      aria-label="Unidades acadêmicas"
                    >
                      {academicUnits.map(
                        (
                          unit,
                        ) => (
                          <OptionRow
                            key={
                              unit.id
                            }
                            selected={
                              academicUnit?.id ===
                              unit.id
                            }
                            title={
                              unit.name
                            }
                            subtitle={
                              unit.acronym
                                ? unit.acronym
                                : "Unidade acadêmica"
                            }
                            onClick={() =>
                              pickAcademicUnit(
                                unit,
                              )
                            }
                          />
                        ),
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={
                      skipAcademicUnit
                    }
                    className={cn(
                      "flex min-h-[58px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                      !academicUnit
                        ? "border-primary bg-primary/10"
                        : "border-border/50 bg-background hover:bg-muted/40",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">
                        Não quero informar agora
                      </span>

                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Você poderá completar seu perfil depois.
                      </span>
                    </span>

                    {!academicUnit && (
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                    )}
                  </button>

                  {!showCreateAcademicUnit ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setShowCreateAcademicUnit(
                          true,
                        )
                      }
                      className="h-12 w-full rounded-2xl font-bold"
                    >
                      Minha unidade não está na lista
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-dashed border-border/60 p-3">

                      <Field label="Nome da unidade acadêmica">
                        <Input
                          value={
                            newAcademicUnitName
                          }
                          onChange={(e) =>
                            setNewAcademicUnitName(
                              e.target
                                .value,
                            )
                          }
                          placeholder="Faculdade de Economia, Administração e Contabilidade"
                          className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                        />
                      </Field>

                      <Field label="Sigla (opcional)">
                        <Input
                          value={
                            newAcademicUnitAcronym
                          }
                          onChange={(e) =>
                            setNewAcademicUnitAcronym(
                              e.target.value.toUpperCase(),
                            )
                          }
                          placeholder="FEAC"
                          maxLength={
                            20
                          }
                          className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                        />
                      </Field>

                      <Button
                        type="button"
                        onClick={
                          createAcademicUnit
                        }
                        disabled={
                          creating
                        }
                        className="h-12 w-full rounded-2xl font-bold"
                      >
                        {creating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "Cadastrar unidade"
                        )}
                      </Button>
                    </div>
                  )}

                  {academicUnit && (
                    <Button
                      type="button"
                      onClick={
                        continueFromUnit
                      }
                      className="h-14 w-full rounded-2xl text-base font-bold"
                    >
                      Continuar
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </>
              )}

              <BackButton
                onClick={() =>
                  setStep(1)
                }
              />
            </div>
          )}

          {/* ===================================================
              ETAPA 4 — CURSO
          =================================================== */}

          {step === 3 && (
            <div className="space-y-5">

              {loadingCourses ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {courses.length >
                    6 && (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                      <Input
                        value={
                          courseQuery
                        }
                        onChange={(e) =>
                          setCourseQuery(
                            e.target
                              .value,
                          )
                        }
                        placeholder="Buscar curso"
                        className="h-12 rounded-2xl bg-muted/20 pl-11 text-base font-semibold"
                      />
                    </div>
                  )}

                  {courses.length >
                    0 && (
                    <div
                      className="max-h-[38dvh] space-y-2 overflow-y-auto pr-1"
                      role="listbox"
                      aria-label="Cursos"
                    >
                      {filteredCourses.map(
                        (
                          c,
                        ) => (
                          <OptionRow
                            key={
                              c.id
                            }
                            selected={
                              course?.id ===
                              c.id
                            }
                            title={
                              c.name
                            }
                            subtitle={
                              [
                                DEGREES.find(
                                  (
                                    d,
                                  ) =>
                                    d.value ===
                                    c.degree,
                                )?.label,
                                c.academic_unit_id ===
                                academicUnit?.id
                                  ? academicUnit?.acronym ||
                                    academicUnit?.name
                                  : undefined,
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  " · ",
                                )
                            }
                            onClick={() =>
                              pickCourse(
                                c,
                              )
                            }
                          />
                        ),
                      )}

                      {filteredCourses.length ===
                        0 && (
                        <p className="px-1 py-3 text-sm text-muted-foreground">
                          Nenhum curso com esse nome.
                        </p>
                      )}
                    </div>
                  )}

                  {!showCreateCourse ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setShowCreateCourse(
                          true,
                        )
                      }
                      className="h-12 w-full rounded-2xl font-bold"
                    >
                      Meu curso não está na lista
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-dashed border-border/60 p-3">

                      <Field label="Nome do curso">
                        <Input
                          value={
                            newCourseName
                          }
                          onChange={(e) =>
                            setNewCourseName(
                              e.target
                                .value,
                            )
                          }
                          placeholder="Ciência da Computação"
                          className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                        />
                      </Field>

                      <Field label="Tipo">
                        <select
                          value={
                            newCourseDegree
                          }
                          onChange={(e) =>
                            setNewCourseDegree(
                              e.target
                                .value,
                            )
                          }
                          className="h-14 w-full rounded-2xl border border-input bg-muted/20 px-3 text-base font-semibold focus-visible:outline-none"
                        >
                          {DEGREES.map(
                            (
                              d,
                            ) => (
                              <option
                                key={
                                  d.value
                                }
                                value={
                                  d.value
                                }
                              >
                                {
                                  d.label
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </Field>

                      <Button
                        type="button"
                        onClick={
                          createCourse
                        }
                        disabled={
                          creating
                        }
                        className="h-12 w-full rounded-2xl font-bold"
                      >
                        {creating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          "Cadastrar curso"
                        )}
                      </Button>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={
                      continueFromCourse
                    }
                    disabled={
                      !course
                    }
                    className="h-14 w-full rounded-2xl text-base font-bold"
                  >
                    Continuar
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}

              <BackButton
                onClick={() =>
                  setStep(2)
                }
              />
            </div>
          )}

          {/* ===================================================
              ETAPA 5 — TRAJETÓRIA ACADÊMICA
          =================================================== */}

          {step === 4 && (
            <div className="space-y-5">

              {/* -------------------------------------------------
                  SEMESTRE DE ENTRADA
              ------------------------------------------------- */}

              <Field label="Em qual semestre você entrou?">
                <Input
                  value={
                    entrySemester
                  }
                  onChange={(e) =>
                    setEntrySemester(
                      e.target.value,
                    )
                  }
                  placeholder="Ex.: 2025.1"
                  maxLength={
                    10
                  }
                  className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                />

                <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                  Essa informação ajuda a organizar estudantes que entraram no mesmo período. Se não souber, pode deixar em branco.
                </p>
              </Field>

              {/* -------------------------------------------------
                  PERÍODO ATUAL
              ------------------------------------------------- */}

              <div className="rounded-2xl bg-muted/30 px-4 py-4">

                <div>
                  <p className="text-sm font-bold">
                    Em qual período você está atualmente?
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Você poderá atualizar essa informação posteriormente.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-center gap-5">

                  <button
                    type="button"
                    aria-label="Diminuir período"
                    onClick={() =>
                      setPeriod(
                        (p) =>
                          Math.max(
                            1,
                            p - 1,
                          ),
                      )
                    }
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background active:scale-95"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <div className="text-center">
                    <span
                      className="block text-3xl font-extrabold tabular-nums"
                      aria-live="polite"
                    >
                      {period}º
                    </span>

                    <span className="text-xs font-medium text-muted-foreground">
                      período
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label="Aumentar período"
                    onClick={() =>
                      setPeriod(
                        (p) =>
                          Math.min(
                            20,
                            p + 1,
                          ),
                      )
                    }
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                </div>
              </div>

              {/* -------------------------------------------------
                  TURMA
              ------------------------------------------------- */}

              <Field label="Turma ou seção (opcional)">
                <Input
                  value={
                    classSection
                  }
                  onChange={(e) =>
                    setClassSection(
                      e.target.value,
                    )
                  }
                  placeholder="Ex.: A, B, Noturno..."
                  maxLength={
                    50
                  }
                  className="h-14 rounded-2xl bg-muted/20 text-base font-semibold"
                />

                <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                  Não sabe ou não possui uma identificação de turma? Sem problema. Deixe em branco.
                </p>
              </Field>

              {/* -------------------------------------------------
                  RESUMO
              ------------------------------------------------- */}

              <div className="rounded-2xl border border-border/50 bg-background/70 p-4">

                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Seu vínculo acadêmico
                </p>

                <div className="space-y-2 text-sm">

                  <SummaryRow
                    label="Universidade"
                    value={
                      uni?.acronym ||
                      uni?.name ||
                      "Não informado"
                    }
                  />

                  <SummaryRow
                    label="Campus"
                    value={
                      campus?.name ||
                      "Não informado"
                    }
                  />

                  <SummaryRow
                    label="Unidade"
                    value={
                      academicUnit?.acronym ||
                      academicUnit?.name ||
                      "Não informado"
                    }
                  />

                  <SummaryRow
                    label="Curso"
                    value={
                      course?.name ||
                      "Não informado"
                    }
                  />

                  <SummaryRow
                    label="Entrada"
                    value={
                      entrySemester.trim() ||
                      "Não informado"
                    }
                  />

                  <SummaryRow
                    label="Período atual"
                    value={`${period}º período`}
                  />

                  <SummaryRow
                    label="Turma"
                    value={
                      classSection.trim() ||
                      "Não informado"
                    }
                  />

                </div>
              </div>

              {/* -------------------------------------------------
                  FINALIZAR
              ------------------------------------------------- */}

              <Button
                type="button"
                onClick={
                  finish
                }
                disabled={
                  !course ||
                  saving
                }
                className="h-14 w-full rounded-2xl text-base font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando seu perfil...
                  </>
                ) : (
                  "Entrar no EduConect"
                )}
              </Button>

              <BackButton
                onClick={() =>
                  setStep(3)
                }
              />

            </div>
          )}

        </section>
      </div>
    </div>
  );
}

/* =============================================================
   COMPONENTES DE INTERFACE
============================================================= */

function TrailChip({
  label,
  filled,
  active,
}: {
  label: string;
  filled: boolean;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "max-w-[11rem] truncate rounded-full px-3 py-1.5 transition-colors",
        filled
          ? "bg-primary/15 text-primary"
          : "border border-dashed border-border text-muted-foreground",
        active &&
          "ring-2 ring-primary/40",
      )}
    >
      {label}
    </span>
  );
}

function OptionRow({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={
        selected
      }
      onClick={
        onClick
      }
      className={cn(
        "flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/10"
          : "border-border/50 bg-background hover:bg-muted/40",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold leading-tight">
          {title}
        </span>

        {subtitle && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>

      {selected ? (
        <Check className="h-5 w-5 shrink-0 text-primary" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
      )}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="ml-1 text-xs font-bold text-muted-foreground">
        {label}
      </Label>

      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">
        {label}
      </span>

      <span className="text-right font-semibold">
        {value}
      </span>
    </div>
  );
}

function BackButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="flex min-h-[44px] items-center gap-2 rounded-xl px-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar
    </button>
  );
              }
