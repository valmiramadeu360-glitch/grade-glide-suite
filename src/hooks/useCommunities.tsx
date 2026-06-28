import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Community {
  id: string;
  type: "university" | "campus" | "course" | "period";
  name: string;
  description: string | null;
  member_count: number;
}

export function useCommunities() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setCommunities([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("community_members")
      .select("community:communities(id,type,name,description,member_count)")
      .eq("user_id", user.id);

    const list = (data ?? [])
      .map((r: any) => r.community)
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const order = { university: 0, campus: 1, course: 2, period: 3 } as any;
        return order[a.type] - order[b.type];
      });

    setCommunities(list);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { communities, loading, reload: load };
}