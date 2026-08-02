import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Loader2, Upload, Building2 } from "lucide-react";

interface Building {
  id: string;
  building_number: number;
  name: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  services: string[] | null;
  opening_hours: string | null;
}

interface CampusAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function CampusAdminModal({ isOpen, onClose, onUpdate }: CampusAdminModalProps) {
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estado do formulário de Edição/Criação
  const [editingId, setEditingId] = useState<string | null>(null);
  const [buildingNumber, setBuildingNumber] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [servicesStr, setServicesStr] = useState("");
  const [latitude, setLatitude] = useState("-9.556");
  const [longitude, setLongitude] = useState("-35.782");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) fetchBuildings();
  }, [isOpen]);

  async function fetchBuildings() {
    setLoading(true);
    const { data } = await supabase.from("campus_buildings").select("*").order("building_number", { ascending: true });
    setBuildings(data || []);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setBuildingNumber("");
    setName("");
    setCategory("");
    setDescription("");
    setOpeningHours("");
    setServicesStr("");
    setLatitude("-9.556");
    setLongitude("-35.782");
    setPhotoFile(null);
  }

  function handleSelectForEdit(b: Building) {
    setEditingId(b.id);
    setBuildingNumber(b.building_number.toString());
    setName(b.name);
    setCategory(b.category);
    setDescription(b.description || "");
    setOpeningHours(b.opening_hours || "");
    setServicesStr(b.services ? b.services.join(", ") : "");
    setLatitude(b.latitude?.toString() || "-9.556");
    setLongitude(b.longitude?.toString() || "-35.782");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!buildingNumber || !name || !category) {
      toast({ title: "Preencha os campos obrigatórios", description: "Número, Nome e Categoria são obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let photo_url = null;

      // Upload da foto para o Supabase Storage (bucket 'campus' ou 'public') caso exista arquivo novo
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `buildings/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("public").upload(filePath, photoFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from("public").getPublicUrl(filePath);
        photo_url = publicUrlData.publicUrl;
      }

      const servicesArray = servicesStr ? servicesStr.split(",").map(s => s.trim()).filter(Boolean) : [];

      const payload = {
        building_number: parseInt(buildingNumber),
        name,
        category,
        description,
        opening_hours: openingHours,
        services: servicesArray,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        ...(photo_url ? { photo_url } : {})
      };

      if (editingId) {
        const { error } = await supabase.from("campus_buildings").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Prédio atualizado com sucesso! 🏢" });
      } else {
        const { error } = await supabase.from("campus_buildings").insert([payload]);
        if (error) throw error;
        toast({ title: "Prédio cadastrado com sucesso! ✨" });
      }

      resetForm();
      fetchBuildings();
      onUpdate();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente remover este prédio do mapa?")) return;
    const { error } = await supabase.from("campus_buildings").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prédio removido." });
      fetchBuildings();
      onUpdate();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] p-6 sm:p-8 bg-background border border-border/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Painel Admin • Gerenciar Prédios da UFAL</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium">
            Cadastre os blocos, adicione fotos reais das fachadas e defina as informações que aparecerão para os estudantes no mapa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          {/* FORMULÁRIO DE CADASTRO / EDIÇÃO */}
          <form onSubmit={handleSave} className="space-y-4 bg-muted/20 p-5 rounded-[24px] border border-border/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">
              {editingId ? "Editar Prédio" : "Adicionar Novo Prédio"}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Número no Mapa *</label>
                <Input type="number" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} placeholder="Ex: 14" className="rounded-xl bg-background" required />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categoria *</label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Ciências Humanas" className="rounded-xl bg-background" required />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome do Prédio / Instituto *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Instituto de Psicologia (IP)" className="rounded-xl bg-background" required />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição / Departamentos</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Bloco de salas de aula e espaços administrativos..." className="rounded-xl bg-background text-xs resize-none h-20" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Horário de Funcionamento</label>
                <Input value={openingHours} onChange={e => setOpeningHours(e.target.value)} placeholder="Ex: 07h às 22h" className="rounded-xl bg-background" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Foto da Fachada</label>
                <Input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="rounded-xl bg-background text-xs file:bg-primary file:text-primary-foreground file:border-0 file:rounded-lg file:text-[10px] file:font-bold" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Serviços (separados por vírgula)</label>
              <Input value={servicesStr} onChange={e => setServicesStr(e.target.value)} placeholder="Coordenação, Salas de aula, Biblioteca" className="rounded-xl bg-background" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl font-black text-xs h-11">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingId ? "Salvar Alterações" : "Cadastrar Prédio"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl font-bold text-xs h-11">
                  Cancelar
                </Button>
              )}
            </div>
          </form>

          {/* LISTA DE PRÉDIOS CADASTRADOS */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Prédios no Banco ({buildings.length})</h3>
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : buildings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum prédio cadastrado ainda.</p>
              ) : (
                buildings.map(b => (
                  <div key={b.id} className="bg-card border border-border/30 p-3 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3 truncate">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                        {b.building_number}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-black truncate text-foreground">{b.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{b.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => handleSelectForEdit(b)} className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(b.id)} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

