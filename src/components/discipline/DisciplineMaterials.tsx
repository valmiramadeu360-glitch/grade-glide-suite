import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link as LinkIcon, FileIcon, ImageIcon, Trash2, ExternalLink, Loader2, CloudOff, Bell } from "lucide-react";
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
  const [openingId, setOpeningId] = useState<string | null>(null); // Novo estado para loading do botão de abrir
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadMaterials();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
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
    if (isOffline) {
      toast({ title: "Você está offline", description: "Conecte-se para enviar materiais.", variant: "destructive" });
      return;
    }

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
        
        // CORREÇÃO 1: Adicionado o contentType para o navegador reconhecer o PDF
        const { error: upErr } = await supabase.storage.from("materials").upload(path, file, {
          contentType: file.type,
          upsert: false
        });
        
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

      toast({ 
        title: "Material adicionado!", 
        description: "A equipe foi notificada sobre a atualização.",
      });
      
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

  // CORREÇÃO 2: Função segura para abrir arquivos ignorando bloqueios de buckets privados
  async function openMaterial(m: Material) {
    if (m.type === "link" && m.url) {
      window.open(m.url, "_blank");
      return;
    }

    if (m.file_path) {
      setOpeningId(m.id);
      try {
        // Tenta gerar uma URL temporária com permissão (ideal para buckets privados)
        const { data, error } = await supabase.storage.from("materials").createSignedUrl(m.file_path, 60); 
        
        if (error) throw error;
        
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
        }
      } catch (err) {
        // Fallback: se der erro na assinatura, tenta a URL pública padrão
        const { data: publicData } = supabase.storage.from("materials").getPublicUrl(m.file_path);
        if (publicData?.publicUrl) {
          window.open(publicData.publicUrl, "_blank");
        } else {
          toast({ title: "Erro ao abrir", description: "Não foi possível acessar este arquivo.", variant: "destructive" });
        }
      } finally {
        setOpeningId(null);
      }
    }
  }

  async function deleteMaterial(m: Material) {
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Não é possível excluir sem internet.", variant: "destructive" });
      return;
    }

    try {
      setDeletingId(m.id);
      if (m.file_path) {
        await supabase.storage.from("materials").remove([m.file_path]);
      }
      const { error } = await supabase.from("materials").delete().eq("id", m.id);
      if (error) throw error;
      
      setMaterials(materials.filter(item => item.id !== m.id));
      toast({ title: "Material removido com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const iconMap = { link: LinkIcon, file: FileIcon, image: ImageIcon };

  return (
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
          Materiais de Apoio
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 rounded-xl shadow-sm font-bold text-[10px] uppercase tracking-widest">
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[32px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Novo Material</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground">Compartilhe links ou arquivos importantes com a equipe.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              {isOffline && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest animate-pulse">
                  <CloudOff className="h-4 w-4" />
                  Conecte-se para enviar
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Título do Material</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: PDF da Aula 01" className="h-14 rounded-2xl bg-muted/30 border-border text-lg font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Tipo de Conteúdo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-border font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="link">Link da Web 🌐</SelectItem>
                    <SelectItem value="file">Arquivo (PDF, Doc) 📎</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "link" ? (
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Endereço (URL)</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.exemplo.com" className="h-14 rounded-2xl bg-muted/30 border-border" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Selecionar Arquivo</Label>
                  <Input ref={fileRef} type="file" className="h-14 rounded-2xl bg-muted/30 border-border cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
                </div>
              )}
              
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <Bell className="h-3 w-3 text-primary" />
                  Notificação automática ativada
                </div>
                <Button onClick={addMaterial} disabled={uploading || isOffline} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Enviando para a nuvem...
                    </>
                  ) : "Salvar e Notificar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="p-4">
        {materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <LinkIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-xs font-medium text-muted-foreground">Nenhum link ou arquivo cadastrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((m) => {
              const Icon = iconMap[m.type as keyof typeof iconMap] ?? FileIcon;
              const isDeleting = deletingId === m.id;
              const isOpening = openingId === m.id;

              return (
                <div key={m.id} className="flex items-center gap-4 rounded-2xl p-4 bg-muted/20 border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all group">
                  <div className="p-3 bg-card rounded-xl shadow-sm group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{m.title}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{m.type}</p>
                  </div>
                  
                  {/* Botão de abrir atualizado para lidar com a nova função segura */}
                  {(m.url || m.file_path) && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openMaterial(m)}
                      disabled={isOpening}
                      className="h-10 w-10 rounded-xl bg-card text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-border/50 shadow-sm"
                      title="Abrir Material"
                    >
                      {isOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    </Button>
                  )}
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDeleting || isOffline}
                    className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Excluir Material"
                    onClick={() => deleteMaterial(m)}
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-5 w-5" />}
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
