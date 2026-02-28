import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link as LinkIcon, FileIcon, ImageIcon, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Material {
  id: string;
  title: string;
  type: string;
  url: string | null;
  file_path: string | null;
}

export function DisciplineMaterials({ disciplineId }: { disciplineId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("link");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMaterials();
  }, [disciplineId]);

  async function loadMaterials() {
    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("discipline_id", disciplineId)
      .order("created_at", { ascending: false });
    setMaterials(data ?? []);
  }

  async function addMaterial() {
    if (!title.trim()) return;

    if (type === "link") {
      await supabase.from("materials").insert({
        discipline_id: disciplineId,
        user_id: user!.id,
        title: title.trim(),
        type: "link",
        url: url.trim(),
      });
    } else {
      const file = fileRef.current?.files?.[0];
      if (!file) return;
      setUploading(true);
      const path = `${user!.id}/${disciplineId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("materials").upload(path, file);
      if (upErr) {
        toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      const fileType = file.type.startsWith("image/") ? "image" : "file";
      await supabase.from("materials").insert({
        discipline_id: disciplineId,
        user_id: user!.id,
        title: title.trim(),
        type: fileType,
        file_path: path,
      });
      setUploading(false);
    }

    setTitle("");
    setUrl("");
    setOpen(false);
    loadMaterials();
  }

  async function deleteMaterial(m: Material) {
    if (m.file_path) {
      await supabase.storage.from("materials").remove([m.file_path]);
    }
    await supabase.from("materials").delete().eq("id", m.id);
    loadMaterials();
  }

  function getFileUrl(path: string) {
    const { data } = supabase.storage.from("materials").getPublicUrl(path);
    return data.publicUrl;
  }

  const iconMap = { link: LinkIcon, file: FileIcon, image: ImageIcon };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Materiais</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Material</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do material" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link externo</SelectItem>
                    <SelectItem value="file">Arquivo / Imagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "link" ? (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <Input ref={fileRef} type="file" />
                </div>
              )}
              <Button onClick={addMaterial} disabled={uploading} className="w-full">
                {uploading ? "Enviando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum material adicionado.</p>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => {
              const Icon = iconMap[m.type as keyof typeof iconMap] ?? FileIcon;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg p-3 bg-muted/50 group">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{m.type}</Badge>
                  {(m.url || m.file_path) && (
                    <a
                      href={m.url ?? getFileUrl(m.file_path!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteMaterial(m)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
