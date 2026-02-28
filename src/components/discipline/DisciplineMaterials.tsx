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
import { Plus, Link as LinkIcon, FileIcon, ImageIcon, Trash2, ExternalLink, Loader2 } from "lucide-react";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    if (!title.trim() || !user) return;

    try {
      if (type === "link") {
        let formattedUrl = url.trim();
        if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = `https://${formattedUrl}`;
        }

        const { error } = await supabase.from("materials").insert({
          discipline_id: disciplineId,
          user_id: user.id,
          title: title.trim(),
          type: "link",
          url: formattedUrl,
        });
        if (error) throw error;
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          toast({ title: "Selecione um arquivo", variant: "destructive" });
          return;
        }
        
        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const path = `${user.id}/${disciplineId}/${Date.now()}_${fileName}`;
        
        const { error: upErr } = await supabase.storage.from("materials").upload(path, file);
        if (upErr) throw upErr;

        const isImage = file.type.startsWith("image/");
        const { error: insErr } = await supabase.from("materials").insert({
          discipline_id: disciplineId,
          user_id: user.id,
          title: title.trim(),
          type: isImage ? "image" : "file",
          file_path: path,
        });
        if (insErr) throw insErr;
      }

      toast({ title: "Material adicionado!" });
      setTitle("");
      setUrl("");
      setOpen(false);
      loadMaterials();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function deleteMaterial(m: Material) {
    try {
      setDeletingId(m.id);
      if (m.file_path) {
        await supabase.storage.from("materials").remove([m.file_path]);
      }
      const { error } = await supabase.from("materials").delete().eq("id", m.id);
      if (error) throw error;
      
      setMaterials(materials.filter(item => item.id !== m.id));
      toast({ title: "Removido com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  function getFileUrl(path: string) {
    const { data } = supabase.storage.from("materials").getPublicUrl(path);
    return data.publicUrl;
  }

  const iconMap = { link: LinkIcon, file: FileIcon, image: ImageIcon };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Materiais e Links</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Novo Material</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título do Material</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: PDF da Aula 01" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link da Web</SelectItem>
                    <SelectItem value="file">Arquivo ou Foto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "link" ? (
                <div className="space-y-2">
                  <Label>Endereço (URL)</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.exemplo.com" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Selecionar Arquivo</Label>
                  <Input ref={fileRef} type="file" className="cursor-pointer" />
                </div>
              )}
              <Button onClick={addMaterial} disabled={uploading} className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando arquivo...
                  </>
                ) : "Salvar no App"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum material cadastrado nesta disciplina.</p>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => {
              const Icon = iconMap[m.type as keyof typeof iconMap] ?? FileIcon;
              const isDeleting = deletingId === m.id;

              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg p-3 bg-muted/40 border border-transparent hover:border-border/50 transition-all group">
                  <div className="p-2 bg-background rounded-md shadow-sm">
                    <Icon className="h-4 w-4 text-accent shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.type}</p>
                  </div>
                  {(m.url || m.file_path) && (
                    <a
                      href={m.url ?? getFileUrl(m.file_path!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-muted-foreground hover:text-accent transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDeleting}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteMaterial(m)}
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
