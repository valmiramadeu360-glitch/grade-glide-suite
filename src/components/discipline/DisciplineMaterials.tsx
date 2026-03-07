import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link as LinkIcon, FileIcon, ImageIcon, Trash2, ExternalLink, Loader2, CloudOff, Bell, Bookmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  
  // Form State
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("link");
  const [url, setUrl] = useState("");
  
  // Loaders
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null); 
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
    if (!title.trim() || !user) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    if (isOffline) {
      toast({ title: "Você está offline", description: "Conecte-se para enviar materiais para a nuvem.", variant: "destructive" });
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
        
        // Faz o Upload no Bucket
        const { error: upErr } = await supabase.storage.from("materials").upload(path, file, {
          contentType: file.type,
          upsert: false
        });
        
        if (upErr) throw upErr;

        // Salva a referência no Banco de Dados
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

      toast({ title: "Material arquivado! 📎", description: "O link/arquivo já está disponível para estudo." });
      
      setTitle("");
      setUrl("");
      if (fileRef.current) fileRef.current.value = ""; // Limpa o input file
      setOpen(false);
      loadMaterials();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function openMaterial(m: Material) {
    if (m.type === "link" && m.url) {
      window.open(m.url, "_blank");
      return;
    }

    if (m.file_path) {
      setOpeningId(m.id);
      try {
        // Tenta gerar uma URL temporária (Signed URL) que dura 60 segundos
        const { data, error } = await supabase.storage.from("materials").createSignedUrl(m.file_path, 60); 
        
        if (error) throw error;
        
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
        }
      } catch (err) {
        // Fallback para URL pública caso a pasta não seja privada
        const { data: publicData } = supabase.storage.from("materials").getPublicUrl(m.file_path);
        if (publicData?.publicUrl) {
          window.open(publicData.publicUrl, "_blank");
        } else {
          toast({ title: "Acesso Negado", description: "Não foi possível acessar este arquivo no servidor.", variant: "destructive" });
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
    if (!window.confirm(`Deseja remover permanentemente o material "${m.title}"?`)) return;

    try {
      setDeletingId(m.id);
      
      // 1. Deleta do Banco de Dados primeiro
      const { error } = await supabase.from("materials").delete().eq("id", m.id);
      if (error) throw error;
      
      // 2. Se for arquivo físico, remove do Bucket (Storage)
      if (m.file_path) {
        await supabase.storage.from("materials").remove([m.file_path]);
      }
      
      setMaterials(materials.filter(item => item.id !== m.id));
      toast({ title: "Material excluído" });
    } catch (error: any) {
      toast({ title: "Erro ao deletar", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const iconMap = { link: LinkIcon, file: FileIcon, image: ImageIcon };

  return (
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden animate-in fade-in duration-500">
      
      <CardHeader className="pb-5 pt-6 px-6 sm:px-8 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" /> Materiais e Mídia
          </CardTitle>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Links, PDFs e Documentos</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={isOffline} className="h-10 sm:h-12 px-5 sm:px-6 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] sm:text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[450px] rounded-[32px] bg-card border-border p-6 sm:p-8">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-black text-foreground">Novo Material</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm mt-1">
                Arquive links de Drive, Notion ou faça upload de apostilas em PDF.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 pt-6">
              {isOffline && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  <CloudOff className="h-4 w-4" /> Sem conexão com a nuvem.
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Título de Identificação</Label>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Ex: Slides da Aula 01, Drive da Turma..." 
                  className="h-14 rounded-2xl bg-background border-border text-base font-bold focus:ring-primary/20" 
                />
              </div>

              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Formato do Material</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-14 rounded-2xl bg-background border border-border font-bold text-foreground focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-popover border border-border shadow-2xl">
                    <SelectItem value="link" className="py-3 font-medium cursor-pointer">URL Externa (Web, Drive) 🌐</SelectItem>
                    <SelectItem value="file" className="py-3 font-medium cursor-pointer">Upload de Arquivo (PDF, Imagem) 📎</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === "link" ? (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Endereço Web (URL)</Label>
                  <Input 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="Ex: docs.google.com/..." 
                    className="h-14 rounded-2xl bg-background border-border font-medium focus:ring-primary/20 text-primary" 
                  />
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Selecionar do Dispositivo</Label>
                  <Input 
                    ref={fileRef} 
                    type="file" 
                    className="h-14 rounded-2xl bg-background border-border cursor-pointer file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary hover:file:text-primary-foreground transition-all pt-2.5" 
                  />
                </div>
              )}
              
              <div className="pt-4">
                <Button 
                  onClick={addMaterial} 
                  disabled={uploading || isOffline || !title.trim()} 
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-transform"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Transferindo...
                    </>
                  ) : "Salvar no Repositório"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6 bg-card/30">
        {materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-background">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Bookmark className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-black text-foreground">Repositório Vazio</h3>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[250px]">Adicione os PDFs e links vitais para o estudo desta matéria.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {materials.map((m) => {
              const Icon = iconMap[m.type as keyof typeof iconMap] ?? FileIcon;
              const isDeleting = deletingId === m.id;
              const isOpening = openingId === m.id;

              return (
                <div 
                  key={m.id} 
                  className="group flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 rounded-[24px] p-5 sm:p-6 bg-background border border-border/50 hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all"
                >
                  <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 bg-card border border-border/40 shadow-sm rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base sm:text-lg font-black text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                        {m.title}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                        Formato: {m.type === "link" ? "Link Web" : "Documento/Arquivo"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Botões de Ação */}
                  <div className="flex items-center justify-end gap-3 mt-2 sm:mt-0 w-full sm:w-auto border-t sm:border-0 border-border/50 pt-4 sm:pt-0">
                    {(m.url || m.file_path) && (
                      <Button
                        variant="outline"
                        onClick={() => openMaterial(m)}
                        disabled={isOpening || isOffline}
                        className={cn(
                          "h-12 flex-1 sm:flex-none sm:w-auto rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm",
                          m.type === "link" ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground" : "bg-card text-foreground border-border hover:bg-muted"
                        )}
                        title="Acessar Material"
                      >
                        {isOpening ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                        {m.type === "link" ? "Acessar Link" : "Visualizar Arquivo"}
                      </Button>
                    )}
                    
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={isDeleting || isOffline}
                      className="h-12 w-12 shrink-0 rounded-xl text-destructive hover:bg-destructive/10 hover:border-destructive/30 border-border bg-card transition-all sm:opacity-0 group-hover:opacity-100"
                      title="Excluir Material"
                      onClick={() => deleteMaterial(m)}
                    >
                      {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
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
