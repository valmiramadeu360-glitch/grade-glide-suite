import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MEDIA_BUCKET, sectionOf, type Shop, type ShopTipo } from "@/lib/marketplace";

// Tabela "shops" ainda não está no types.ts gerado — cast temporário.
const db = supabase as any;

interface ShopFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: Shop | null;
  onSaved: (shop: Shop) => void;
  tipo?: ShopTipo;
}

export function ShopFormDialog({ open, onOpenChange, shop, onSaved, tipo = "produto" }: ShopFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(shop?.nome ?? "");
    setBio(shop?.bio ?? "");
    setLogoFile(null);
    setLogoPreview(shop?.logo_url ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(shop.logo_url).data.publicUrl : null);
  }, [open, shop]);

  async function handleSave() {
    if (!user) return;
    if (nome.trim().length < 2) return toast({ title: "Dê um nome à sua loja", variant: "destructive" });

    setSaving(true);
    try {
      let logoPath = shop?.logo_url ?? null;
      if (logoFile) {
        const path = `${user.id}/shops/logo-${Date.now()}.${logoFile.name.split(".").pop() || "jpg"}`;
        const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, logoFile);
        if (upErr) throw upErr;
        logoPath = path;
      }

      const payload = { owner_user_id: user.id, tipo: shop?.tipo ?? tipo, nome: nome.trim(), bio: bio.trim() || null, logo_url: logoPath };

      const { data, error } = shop
        ? await db.from("shops").update(payload).eq("id", shop.id).select("*").single()
        : await db.from("shops").insert(payload).select("*").single();

      if (error) throw error;
      toast({ title: shop ? "Loja atualizada" : "Loja criada! Agora publique seu primeiro anúncio." });
      onSaved(data as Shop);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Não foi possível salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shop ? "Editar loja" : `Criar loja de ${sectionOf(tipo).label.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Visível para estudantes da sua universidade.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-border/40">
              <AvatarImage src={logoPreview ?? undefined} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary"><Store className="h-6 w-6" /></AvatarFallback>
            </Avatar>
            <label className="cursor-pointer text-sm font-bold text-primary">
              Escolher logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
              }} />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da loja</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Livraria do Pedro" maxLength={60} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="O que você vende, horário que costuma responder, etc." maxLength={500} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
