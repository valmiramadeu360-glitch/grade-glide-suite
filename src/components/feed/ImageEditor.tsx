import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RotateCw, Sparkles } from "lucide-react";

const filters = [
  { name: "Original", css: "none" },
  { name: "Vivo", css: "saturate(1.35) contrast(1.08)" },
  { name: "Quente", css: "sepia(.2) saturate(1.2)" },
  { name: "Frio", css: "hue-rotate(16deg) saturate(.85)" },
  { name: "Retrô", css: "sepia(.48) contrast(.9)" },
  { name: "P&B", css: "grayscale(1)" },
  { name: "Drama", css: "contrast(1.38) saturate(.8)" },
];

export function ImageEditor({ file, onClose, onApply }: { file: File | null; onClose: () => void; onApply: (file: File) => void }) {
  const [url, setUrl] = useState("");
  const [filter, setFilter] = useState(filters[0]);
  const [rotate, setRotate] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl); setFilter(filters[0]); setRotate(0); setBrightness(100); setText("");
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function apply() {
    if (!file || !url) return;
    setBusy(true);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const quarterTurn = rotate % 180 !== 0;
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const width = Math.round((quarterTurn ? image.height : image.width) * scale);
      const height = Math.round((quarterTurn ? image.width : image.height) * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Editor indisponível neste dispositivo");
      ctx.filter = `${filter.css} brightness(${brightness}%)`;
      ctx.translate(width / 2, height / 2);
      ctx.rotate(rotate * Math.PI / 180);
      ctx.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
      ctx.resetTransform(); ctx.filter = "none";
      if (text.trim()) {
        const lines = text.trim().split("\n").slice(0, 3);
        const fontSize = Math.max(18, Math.round(width * .055));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = Math.max(3, fontSize / 8);
        lines.forEach((line, i) => {
          const y = height * .78 + i * fontSize * 1.3;
          ctx.strokeStyle = "#18181b"; ctx.strokeText(line, width / 2, y, width * .85);
          ctx.fillStyle = "#ffffff"; ctx.fillText(line, width / 2, y, width * .85);
        });
      }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", .84));
      if (!blob) throw new Error("Não foi possível processar a imagem");
      onApply(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }));
      onClose();
    } catch (error) { console.error(error); } finally { setBusy(false); }
  }
  return <Dialog open={!!file} onOpenChange={open => !open && onClose()}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Editar foto</DialogTitle></DialogHeader>
      {url && <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden bg-muted">
        <img src={url} alt="Prévia da foto" className="max-h-full max-w-full object-contain" style={{ filter: `${filter.css} brightness(${brightness}%)`, transform: `rotate(${rotate}deg)` }} />
        {text && <span className="pointer-events-none absolute bottom-8 left-3 right-3 whitespace-pre-wrap text-center text-xl font-bold text-primary-foreground [text-shadow:0_1px_4px_hsl(var(--foreground))]">{text}</span>}
      </div>}
      <div className="flex gap-2 overflow-x-auto pb-2">{filters.map(item => <Button key={item.name} size="sm" variant={filter.name === item.name ? "default" : "outline"} onClick={() => setFilter(item)}>{item.name}</Button>)}</div>
      <div className="space-y-3"><Label>Brilho</Label><Slider min={50} max={150} step={5} value={[brightness]} onValueChange={value => setBrightness(value[0])} /></div>
      <div className="space-y-2"><Label htmlFor="overlay-text">Texto ou emoji na foto</Label><Input id="overlay-text" maxLength={80} value={text} onChange={event => setText(event.target.value)} placeholder="Uma frase, um emoji..." /></div>
      <div className="flex justify-between gap-2"><Button variant="outline" onClick={() => setRotate(value => (value + 90) % 360)}><RotateCw /> Girar</Button><Button onClick={apply} disabled={busy}><Sparkles /> {busy ? "Processando..." : "Aplicar à foto"}</Button></div>
    </DialogContent>
  </Dialog>;
}
