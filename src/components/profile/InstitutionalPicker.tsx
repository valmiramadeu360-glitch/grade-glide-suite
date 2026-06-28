import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, GraduationCap, Building2, BookOpen, Hash, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; acronym?: string; state?: string; degree?: string };

export interface InstitutionalSelection {
  university_id: string | null;
  campus_id: string | null;
  course_id: string | null;
  current_period: number | null;
  university_name?: string;
  course_name?: string;
}

interface Props {
  value: InstitutionalSelection;
  onChange: (next: InstitutionalSelection) => void;
}

export function InstitutionalPicker({ value, onChange }: Props) {
  const [universities, setUniversities] = useState<Row[]>([]);
  const [campuses, setCampuses] = useState<Row[]>([]);
  const [courses, setCourses] = useState<Row[]>([]);
  const [loading, setLoading] = useState<"u" | "c" | "co" | null>(null);

  useEffect(() => {
    (async () => {
      setLoading("u");
      const { data } = await supabase.from("universities").select("id,name,acronym,state").order("name");
      setUniversities(data ?? []);
      setLoading(null);
    })();
  }, []);

  useEffect(() => {
    if (!value.university_id) { setCampuses([]); return; }
    (async () => {
      setLoading("c");
      const { data } = await supabase.from("campuses").select("id,name,state").eq("university_id", value.university_id!).order("name");
      setCampuses(data ?? []);
      setLoading(null);
    })();
  }, [value.university_id]);

  useEffect(() => {
    if (!value.campus_id) { setCourses([]); return; }
    (async () => {
      setLoading("co");
      const { data } = await supabase.from("courses").select("id,name,degree").eq("campus_id", value.campus_id!).order("name");
      setCourses(data ?? []);
      setLoading(null);
    })();
  }, [value.campus_id]);

  const universityLabel = universities.find(u => u.id === value.university_id);
  const campusLabel = campuses.find(c => c.id === value.campus_id);
  const courseLabel = courses.find(c => c.id === value.course_id);

  return (
    <div className="space-y-5">
      {/* Universidade */}
      <PickerRow
        icon={<GraduationCap className="h-4 w-4 text-primary" />}
        label="Universidade"
        placeholder="Selecione sua universidade"
        loading={loading === "u"}
        display={universityLabel ? `${universityLabel.acronym} — ${universityLabel.name}` : ""}
      >
        <Command>
          <CommandInput placeholder="Buscar universidade..." />
          <CommandList>
            <CommandEmpty>Nenhuma universidade encontrada.</CommandEmpty>
            <CommandGroup>
              {universities.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.acronym} ${u.name} ${u.state}`}
                  onSelect={() => onChange({
                    ...value,
                    university_id: u.id,
                    campus_id: null,
                    course_id: null,
                    university_name: `${u.acronym} — ${u.name}`,
                    course_name: "",
                  })}
                >
                  <Check className={cn("mr-2 h-4 w-4", value.university_id === u.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-bold">{u.acronym}</span>
                  <span className="ml-2 text-muted-foreground">{u.name}</span>
                  <span className="ml-auto text-xs">{u.state}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PickerRow>

      {/* Campus */}
      <PickerRow
        icon={<Building2 className="h-4 w-4 text-primary" />}
        label="Campus"
        placeholder={value.university_id ? "Selecione o campus" : "Escolha uma universidade primeiro"}
        disabled={!value.university_id}
        loading={loading === "c"}
        display={campusLabel?.name ?? ""}
      >
        <Command>
          <CommandInput placeholder="Buscar campus..." />
          <CommandList>
            <CommandEmpty>Nenhum campus cadastrado. Solicite via Feedback.</CommandEmpty>
            <CommandGroup>
              {campuses.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => onChange({ ...value, campus_id: c.id, course_id: null })}>
                  <Check className={cn("mr-2 h-4 w-4", value.campus_id === c.id ? "opacity-100" : "opacity-0")} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PickerRow>

      {/* Curso */}
      <PickerRow
        icon={<BookOpen className="h-4 w-4 text-primary" />}
        label="Curso"
        placeholder={value.campus_id ? "Selecione o curso" : "Escolha um campus primeiro"}
        disabled={!value.campus_id}
        loading={loading === "co"}
        display={courseLabel?.name ?? ""}
      >
        <Command>
          <CommandInput placeholder="Buscar curso..." />
          <CommandList>
            <CommandEmpty>Nenhum curso cadastrado. Solicite via Feedback.</CommandEmpty>
            <CommandGroup>
              {courses.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => onChange({ ...value, course_id: c.id, course_name: c.name })}>
                  <Check className={cn("mr-2 h-4 w-4", value.course_id === c.id ? "opacity-100" : "opacity-0")} />
                  {c.name}
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{c.degree}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PickerRow>

      {/* Período atual */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
          <Hash className="h-3 w-3" /> Período atual
        </Label>
        <Input
          type="number"
          min={1}
          max={20}
          placeholder="Ex: 5"
          value={value.current_period ?? ""}
          onChange={(e) => onChange({ ...value, current_period: e.target.value ? Number(e.target.value) : null })}
          className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold"
        />
      </div>
    </div>
  );
}

function PickerRow({
  icon, label, placeholder, display, disabled, loading, children,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  display: string;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
        {icon} {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full h-14 rounded-2xl bg-muted/20 border-border/40 justify-between font-bold tracking-normal text-sm normal-case",
              !display && "text-muted-foreground"
            )}
          >
            <span className="truncate">{display || placeholder}</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div onClick={() => setOpen(false)}>{children}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
