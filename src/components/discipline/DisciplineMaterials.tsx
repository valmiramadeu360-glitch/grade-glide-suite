import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { 
  Plus, Link as LinkIcon, FileText, ImageIcon, Trash2, 
  ExternalLink, Loader2, CloudOff, Bookmark, Video, 
  Mic, Music, PlayCircle, Eye, X
} from "lucide-react";
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
  
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string | null>(null); // Inicia vazio para forçar a escolha
  const [url, setUrl] = useState("");
  
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

  const handleTypeSelect = (selectedType: string) => {
    setType(selectedType);
    if (selectedType !== 'link') {
      setTimeout(() => fileRef.current?.click(), 100);
    }
  };

  async function addMaterial() {
    if (!title.trim() || !user || !type) {
      toast({ title: "Campos obrigatórios", description: "Defina um título e escolha o formato.", variant: "destructive" });
      return;
    }
    if (isOffline) {
      toast({ title: "Modo Offline", description: "Conecte-se para sincronizar arquivos.", variant: "destructive" });
      return;
    }

    try {
      setUploading(true);

      if (type === "link") {
        let formattedUrl = url.trim();
        if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;

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
        if (!file) throw new Error("Nenhum arquivo selecionado.");
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const path = `${user.id}/${disciplineId}/${Date.now()}_${fileName}`;
        
        const { error: upErr } = await supabase.storage.from("materials").upload(path, file);
        if (upErr) throw upErr;

        // Detecção de tipo refinada
        let detectedType = "file";
        if (file.type.startsWith("image/")) detectedType = "image";
        else if (file.type.startsWith("video/")) detectedType = "video";
        else if (file.type.startsWith("audio/")) detectedType = "audio";

        const { error: insErr } = await supabase.from("materials").insert({
          discipline_id: disciplineId,
          user_id: user.id,
          title: title.trim(),
          type: detectedType,
          file_path: path,
        });
        if (insErr) throw insErr;
      }

      toast({ title: "Material arquivado! 📎" });
      resetForm();
      loadMaterials();
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setType(null);
    setOpen(false);
  };

  async function openMaterial(m: Material) {
    if (m.type === "link" && m.url) {
      window.open(m.url, "_blank");
      return;
    }

    if (m.file_path) {
      setOpeningId(m.id);
      try {
        const { data, error } = await supabase.storage.from("materials").createSignedUrl(m.file_path, 3600); 
        if (error) throw error;
        window.open(data.signedUrl, "_blank");
      } catch (err) {
        toast({ title: "Erro ao abrir", description: "Não foi possível gerar o link de acesso.", variant: "destructive" });
      } finally {
        setOpeningId(null);
      }
    }
  }

  async function deleteMaterial(m: Material) {
    if (isOffline) return;
    if (!window.confirm(`Excluir permanentemente "${m.title}"?`)) return;

    try {
      setDeletingId(m.id);
      await supabase.from("materials").delete().eq("id", m.id);
      if (m.file_path) await supabase.storage.from("materials").remove([m.file_path]);
      setMaterials(materials.filter(item => item.id !== m.id));
      toast({ title: "Removido com sucesso" });
    } catch (error: any) {
      toast({ title: "Erro na exclusão", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const iconMap: Record<string, any> = { 
    link: LinkIcon, 
    file: FileText, 
    image: ImageIcon, 
    video: Video, 
    audio: Music 
  };

  const getActionLabel = (type: string) => {
    if (type === "video") return "Assistir";
    if (type === "audio") return "Ouvir";
    if (type === "image") return "Ver Foto";
    if (type === "link") return "Abrir Link";
    return "Ver Arquivo";
  };

  return (
    <Card className="glass-card border-none shadow-sm bg-card rounded-[32px] overflow-hidden animate-in fade-in duration-500">
      
      <CardHeader className="pb-5 pt-6 px-6 sm:px-8 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" /> Repositório Multimídia
          </CardTitle>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Aulas, Gravações e PDFs</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={isOffline} className="h-10 sm:h-12 px-5 sm:px-6 rounded-xl shadow-lg shadow-primary/20 font-black text-[10px] sm:text-xs uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all">
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[480px] rounded-[32px] bg-card border-border p-6 sm:p-8 shadow-2xl">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-black text-foreground tracking-tight">Novo Material</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm">Escolha o formato do conteúdo que deseja arquivar.</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Título do Material</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Gravação da Revisão..." className="h-14 rounded-2xl bg-muted/20 border-border/50 text-base font-bold focus:ring-primary/30" />
              </div>

              <div className="space-y-3">
                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Selecione o Formato</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'link', icon: Globe, label: 'Link', color: 'text-blue-500' },
                    { id: 'file', icon: FileText, label: 'PDF', color: 'text-red-500' },
                    { id: 'image', icon: ImageIcon, label: 'Foto', color: 'text-emerald-500' },
                    { id: 'video', icon: Video, label: 'Vídeo', color: 'text-purple-500' },
                    { id: 'audio', icon: Mic, label: 'Áudio', color: 'text-orange-500' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleTypeSelect(option.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 active:scale-95",
                        type === option.id ? "border-primary bg-primary/5 shadow-inner" : "border-border/50 bg-muted/10 hover:bg-muted/30"
                      )}
                    >
                      <option.icon className={cn("h-6 w-6", option.color)} />
                      <span className="text-[9px] font-black uppercase tracking-tighter">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {type === "link" && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground ml-1">URL (Drive, YouTube, Notion)</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="h-14 rounded-2xl bg-muted/20 border-border/50 text-primary font-medium" />
                </div>
              )}

              {type && type !== "link" && (
                <div className="p-4 bg-primary/5 rounded-2xl border border-dashed border-primary/30 flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-primary/40" />
                  <p className="text-[10px] font-black uppercase text-primary">Arquivo Selecionado para Upload</p>
                  <input ref={fileRef} type="file" className="hidden" onChange={(e) => setTitle(title || e.target.files?.[0]?.name.split('.')[0] || "")} />
                  <Button variant="ghost" size="sm" className="h-8 text-[9px] uppercase font-black" onClick={() => fileRef.current?.click()}>Trocar Arquivo</Button>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={resetForm} className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px]">Cancelar</Button>
                <Button onClick={addMaterial} disabled={uploading || !type || !title.trim()} className="flex-[2] h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 bg-primary">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar e Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6 bg-card/30">
        {materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-background">
            <PlayCircle className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-black text-foreground">Sem mídias</h3>
            <p className="text-sm font-medium text-muted-foreground mt-2">Centralize aqui seus links e gravações de aula.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {materials.map((m) => {
              const Icon = iconMap[m.type] ?? FileText;
              const isOpening = openingId === m.id;

              return (
                <div key={m.id} className="group flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-[28px] bg-card border border-border/50 hover:border-primary/40 shadow-sm transition-all hover:shadow-lg">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-14 w-14 bg-muted/30 border border-border shadow-inner rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base sm:text-lg font-black text-foreground truncate group-hover:text-primary transition-colors">{m.title}</p>
                      <Badge variant="outline" className="mt-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md opacity-70">
                        {m.type}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-3 shrink-0 border-t sm:border-0 border-border/50 pt-4 sm:pt-0">
                    <Button
                      variant="outline"
                      onClick={() => openMaterial(m)}
                      disabled={isOpening}
                      className="h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest bg-background border-border/50 hover:bg-primary hover:text-white transition-all shadow-sm"
                    >
                      {isOpening ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                      {getActionLabel(m.type)}
                    </Button>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-12 w-12 rounded-xl text-destructive hover:bg-destructive/10 transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
                      onClick={() => deleteMaterial(m)}
                    >
                      <Trash2 className="h-5 w-5" />
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
