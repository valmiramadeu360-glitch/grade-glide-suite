import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link as LinkIcon, FileIcon, ImageIcon, Trash2, ExternalLink, Loader2, CloudUpload } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("link");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (disciplineId) {
      loadMaterials();
    }
  }, [disciplineId]);

  async function loadMaterials() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("discipline_id", disciplineId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setMaterials(data ?? []);
    } catch (err) {
      console.error("Erro ao carregar materiais:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addMaterial() {
    if (!title.trim() || !user || !disciplineId) return;

    try {
      setUploading(true);
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
        
        const fileExt = file.name.split('.').pop();
        const safeFileName = `${Math.random().toString(36).substring(7)}.${fileExt}`;
        const path = `${user.id}/${disciplineId}/${Date.now()}_${safeFileName}`;
        
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
    if (!confirm("Excluir este material permanentemente?")) return;
    try {
      setDeletingId(m.id);
      if (m.file_path) {
        await supabase.storage.from("materials").remove([m.file_path]);
      }
      const { error } = await supabase.from("materials").delete().eq("id", m.id);
      if (error) throw error;
      
      setMaterials(prev => prev.filter(item => item.id !== m.id));
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

  const iconMap: Record<string, any> = { link: LinkIcon, file: FileIcon, image: ImageIcon };

  return (
    <Card className="glass-card border-none shadow-xl bg-card/60 rounded-[40px] overflow-hidden">
      <CardHeader className="pb-4 pt-8 px-8 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">
          Repositório de Mídia
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl h-9 px-4 gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">Adicionar Material</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60">Título</Label>
                <Input className="rounded-xl bg-muted/30 border-none" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Notas de Microeconomia" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="rounded-xl bg-muted/30 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="link">Link da Web</SelectItem>
                    <SelectItem value="file">Arquivo ou Foto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "link" ? (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60">URL</Label>
                  <Input className="rounded-xl bg-muted/30 border-none" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.github.com" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60">Arquivo</Label>
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer relative">
                    <CloudUpload className="h-8 w-8 text-primary opacity-40 mb-2" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Clique para selecionar</span>
                    <Input ref={fileRef} type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              )}
              <Button onClick={addMaterial} disabled={uploading} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {uploading ? "Enviando..." : "Salvar no EduFlow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="px-8 pb-8">
        {loading ? (
          <div className="py-12 flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
          </div>
        ) : materials.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-border/40 rounded-[32px] bg-muted/5 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-30">Nenhum arquivo anexado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {materials.map((m) => {
              const Icon = iconMap[m.type] || FileIcon;
              const isDeleting = deletingId === m.id;

              return (
                <div key={m.id} className="flex items-center gap-4 p-4 rounded-3xl bg-muted/10 border border-border/20 group hover:border-primary/20 transition-all">
                  <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center shadow-sm">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate leading-none mb-1">{m.title}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{m.type}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(m.url || m.file_path) && (
                      <a
                        href={m.url ?? getFileUrl(m.file_path!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-primary transition-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isDeleting}
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                      onClick={() => deleteMaterial(m)}
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
