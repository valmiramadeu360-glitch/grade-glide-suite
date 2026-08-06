import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceNoteProps {
  path: string;
  duration?: number | null;
  mine?: boolean;
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceNote({ path, duration, mine }: VoiceNoteProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  async function toggle() {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    let src = url;
    if (!src) {
      setLoading(true);
      const { data } = await supabase.storage.from("chat-audio").createSignedUrl(path, 3600);
      setLoading(false);
      if (!data?.signedUrl) return;
      src = data.signedUrl;
      setUrl(src);
    }

    if (!audioRef.current) {
      const audio = new Audio(src);
      audio.addEventListener("timeupdate", () => {
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      });
      audio.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
      audioRef.current = audio;
    }

    await audioRef.current.play();
    setPlaying(true);
  }

  return (
    <div className="flex items-center gap-3 min-w-[190px]">
      <Button
        size="icon"
        variant="ghost"
        onClick={toggle}
        className={cn(
          "h-10 w-10 rounded-full shrink-0",
          mine ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25" : "bg-primary/10 text-primary hover:bg-primary/20",
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>

      <div className="flex-1 space-y-1.5">
        <div className={cn("h-1.5 rounded-full overflow-hidden", mine ? "bg-primary-foreground/25" : "bg-muted")}>
          <div
            className={cn("h-full rounded-full transition-all", mine ? "bg-primary-foreground" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={cn("text-[10px] font-bold uppercase tracking-widest flex items-center gap-1", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
          <Mic className="h-3 w-3" /> {formatDuration(duration ?? 0)}
        </p>
      </div>
    </div>
  );
}
