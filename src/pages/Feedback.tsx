import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Loader2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Image as ImageIcon,
  Video,
  X,
  Paperclip
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "improvement", label: "Sugestão de Melhoria" },
  { value: "bug", label: "Relato de Problema" },
  { value: "criticism", label: "Crítica Construtiva" },
  { value: "praise", label: "Elogio à Equipe" },
];

export default function Feedback() {

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState("improvement");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);


  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/", "video/"];

    const valid = allowedTypes.some(type => file.type.startsWith(type));

    if (!valid) {
      toast({
        title: "Arquivo inválido",
        description: "Envie apenas imagens ou vídeos.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O limite é 50MB.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }


  function clearFile() {

    setSelectedFile(null);
    setPreviewUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }


  async function handleSubmit() {

    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Descreva o problema.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {

      let mediaUrl: string | null = null;

      if (selectedFile) {

        const ext = selectedFile.name.split(".").pop();

        const filePath = `feedback/${Date.now()}-${Math.random()}.${ext}`;

        const { error } = await supabase
          .storage
          .from("feedback_media")
          .upload(filePath, selectedFile);

        if (error) throw error;

        const { data } = supabase
          .storage
          .from("feedback_media")
          .getPublicUrl(filePath);

        mediaUrl = data.publicUrl;
      }


      const payload: any = {
        category,
        message: message.trim(),
        is_anonymous: isAnonymous,
        media_url: mediaUrl
      };

      if (!isAnonymous && user) {
        payload.user_id = user.id;
        payload.email = user.email;
      }


      const { error } = await supabase
        .from("feedbacks")
        .insert(payload);

      if (error) throw error;


      toast({
        title: "Feedback enviado 🚀",
        description: "Nossa equipe recebeu seu relato."
      });


      setMessage("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsAnonymous(false);

    } catch (error) {

      console.error(error);

      toast({
        title: "Erro ao enviar",
        variant: "destructive"
      });

    } finally {

      setSubmitting(false);

    }
  }


  return (

    <div className="max-w-3xl mx-auto p-4 space-y-6">

      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2"/>
        Voltar
      </Button>


      <Card className="p-6 space-y-6 rounded-3xl">

        <div className="space-y-2">

          <Label>Categoria</Label>

          <Select
            value={category}
            onValueChange={setCategory}
          >

            <SelectTrigger>
              <SelectValue/>
            </SelectTrigger>

            <SelectContent>

              {CATEGORIES.map(c => (

                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>


        <div className="space-y-2">

          <Label>Mensagem</Label>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva o problema ou sugestão..."
          />

        </div>


        {/* UPLOAD */}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="mr-2 h-4 w-4"/>
          Anexar foto ou vídeo
        </Button>


        {/* PREVIEW */}

        {previewUrl && (

          <div className="relative">

            <Button
              size="icon"
              variant="destructive"
              className="absolute right-2 top-2"
              onClick={clearFile}
            >
              <X/>
            </Button>

            {selectedFile?.type.startsWith("video") ? (

              <video
                src={previewUrl}
                controls
                className="rounded-xl w-full"
              />

            ) : (

              <img
                src={previewUrl}
                className="rounded-xl w-full"
              />

            )}

          </div>

        )}


        {/* ANONIMO */}

        <div className="flex justify-between items-center">

          <span>Enviar anonimamente</span>

          <Switch
            checked={isAnonymous}
            onCheckedChange={setIsAnonymous}
          />

        </div>


        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
        >

          {submitting
            ? <Loader2 className="animate-spin"/>
            : <>
                <Send className="mr-2"/>
                Enviar feedback
              </>
          }

        </Button>

      </Card>

    </div>
  );
}
