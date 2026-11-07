import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Vídeo do feed: toca sozinho (mudo, em loop) quando visível e pausa fora da tela. */
export function FeedVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="relative -mx-4 sm:mx-0 mt-3 overflow-hidden sm:rounded-xl bg-muted">
      <video
        ref={ref}
        src={src}
        muted={muted}
        loop
        playsInline
        autoPlay
        preload="metadata"
        onClick={() => setMuted((m) => !m)}
        className="w-full max-h-[80vh] object-contain"
      />
      <button
        type="button"
        aria-label={muted ? "Ativar som" : "Desativar som"}
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-background/80 text-foreground backdrop-blur flex items-center justify-center"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
