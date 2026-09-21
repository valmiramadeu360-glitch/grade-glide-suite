import { useCallback, useEffect, useState } from "react";
import { Bell, Inbox, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  title: string | null;
  content: string | null;
  type: string | null;
  created_at: string;
  is_read: boolean;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadUnread = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnread(count ?? 0);
  }, [userId]);

  useEffect(() => {
    loadUnread();
    if (!userId) return;
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setUnread((n) => n + 1);
          setItems((prev) => [payload.new as Notif, ...prev].slice(0, 20));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadUnread]);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next || !userId) return;

    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,title,content,type,created_at,is_read")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) ?? []);
    setLoading(false);

    if (unread > 0) {
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
      setUnread(0);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notificações (${unread} novas)` : "Notificações"}
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-all hover:bg-muted/50 active:scale-95"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-2 top-2 flex h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-[28px] border-border/50 bg-background/90 p-0 shadow-2xl backdrop-blur-xl"
      >
        <div className="border-b border-border/40 px-5 py-4">
          <p className="text-sm font-bold">Notificações</p>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Inbox className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-bold">Nada por aqui ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">Curtidas, comentários e avisos da sua universidade aparecem aqui.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {items.map((n) => (
                <li key={n.id} className={cn("px-5 py-3.5", !n.is_read && "bg-primary/5")}>
                  {n.title && <p className="text-sm font-bold leading-snug">{n.title}</p>}
                  {n.content && <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{n.content}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
