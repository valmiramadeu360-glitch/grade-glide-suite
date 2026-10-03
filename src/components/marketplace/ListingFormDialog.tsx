import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MEDIA_BUCKET, sectionOf, type Listing, type ListingPhoto, type ShopTipo } from "@/lib/marketplace";

// A tabela "listings" e o bucket MEDIA_BUCKET ainda não estão no
// types.ts gerado pelo Supabase — cast temporário até ele ser regenerado.
const db = supabase as any;

const MAX_FOTOS = 5;

interface ExistingPhoto extends ListingPhoto {
  publicUrl: string;
}

interface ListingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string;
  /** Presente = editando; ausente = criando novo anúncio. */
  listing?: Listing | null;
  onSaved: () => void;
  shopTipo?: ShopTipo;
}

export function ListingFormDialog({ open, onOpenChange, shopId, listing, onSaved, shopTipo = "produto" }: ListingFormDialogProps) {
  const section = sectionOf(shopTipo);
  const PRODUTO_CATEGORIAS = section.categories;
  const isProduto = shopTipo === "produto";
  const { user } = useAuth();
  const { toast } = useToast();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [condicao, setCondicao] = useState<string>("usado");
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = !!listing;

  useEffect(() => {
    if (!open) return;
    setTitulo(listing?.titulo ?? "");
    setDescricao(listing?.descricao ?? "");
    setPreco(listing?.preco != null ? String(listing.preco) : "");
    setCategoria(listing?.categoria ?? PRODUTO_CATEGORIAS[0]);
    setCondicao(listing?.condicao ?? "usado");
    setNewFiles([]);
    setRemovedPhotoIds([]);

    if (listing) {
      db.from("listing_photos").select("*").eq("listing_id", listing.id).order("ordem").then(({ data }: any) => {
        setExistingPhotos((data ?? []).map((p: ListingPhoto) => ({
          ...p,
          publicUrl: supabase.storage.from(MEDIA_BUCKET).getPublicUrl(p.url).data.publicUrl,
        })));
      });
    } else {
      setExistingPhotos([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listing]);

  const totalFotos = existingPhotos.length - removedPhotoIds.length + newFiles.length;

  function handleFilesChosen(files: FileList | null) {
    if (!files) return;
    const restantes = MAX_FOTOS - totalFotos;
    if (restantes <= 0) {
      toast({ title: `Máximo de ${MAX_FOTOS} fotos por anúncio` });
      return;
    }
    setNewFiles((prev) => [...prev, ...Array.from(files).slice(0, restantes)]);
  }

  async function handleSave() {
    if (!user) return;
    if (titulo.trim().length < 2) return toast({ title: "Dê um título ao anúncio", variant: "destructive" });
    if (totalFotos === 0) return toast({ title: "Adicione pelo menos 1 foto", variant: "destructive" });

    setSaving(true);
    try {
      const payload = {
        shop_id: shopId,
        tipo: section.listingTipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        preco: preco.trim() ? Number(preco.replace(",", ".")) : null,
        categoria,
        condicao: isProduto ? condicao : null,
      };

      let listingId = listing?.id;
      if (isEditing) {
        const { error } = await db.from("listings").update(payload).eq("id", listingId);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("listings").insert(payload).select("id").single();
        if (error) throw error;
        listingId = data.id;
      }

      // Remove fotos marcadas para exclusão (storage + linha).
      for (const photoId of removedPhotoIds) {
        const photo = existingPhotos.find((p) => p.id === photoId);
        if (photo) await supabase.storage.from(MEDIA_BUCKET).remove([photo.url]);
        await db.from("listing_photos").delete().eq("id", photoId);
      }

      // Envia as fotos novas.
      const ordemBase = existingPhotos.filter((p) => !removedPhotoIds.includes(p.id)).length;
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const path = `${user.id}/listings/${listingId}/${Date.now()}-${i}.${file.name.split(".").pop() || "jpg"}`;
        const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
        if (upErr) throw upErr;
        await db.from("listing_photos").insert({ listing_id: listingId, url: path, ordem: ordemBase + i });
      }

      toast({ title: isEditing ? "Anúncio atualizado" : "Anúncio publicado" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Não foi possível salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-[28px] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
          <DialogDescription>Até {MAX_FOTOS} fotos. Capriche no título e na primeira foto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fotos */}
          <div className="flex flex-wrap gap-2">
            {existingPhotos.filter((p) => !removedPhotoIds.includes(p.id)).map((p) => (
              <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border/40">
                <img src={p.publicUrl} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setRemovedPhotoIds((r) => [...r, p.id])} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border/40">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setNewFiles((arr) => arr.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {totalFotos < MAX_FOTOS && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:bg-muted/40">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Adicionar</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFilesChosen(e.target.files)} />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Cálculo I — Guidorizzi, seminovo" maxLength={80} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhe o estado, motivo da venda, etc." maxLength={2000} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="Vazio = a combinar" />
            </div>
            {isProduto && <div className="space-y-1.5">
              <Label>Condição</Label>
              <Select value={condicao} onValueChange={setCondicao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="usado">Usado</SelectItem>
                  <SelectItem value="seminovo">Seminovo</SelectItem>
                </SelectContent>
              </Select>
            </div>}
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUTO_CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? "Salvar alterações" : "Publicar anúncio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
