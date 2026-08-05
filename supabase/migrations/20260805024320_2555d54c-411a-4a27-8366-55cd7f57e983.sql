CREATE TABLE public.community_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX community_messages_community_idx ON public.community_messages (community_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_messages_select_members"
ON public.community_messages FOR SELECT TO authenticated
USING (public.is_community_member(community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "community_messages_insert_members"
ON public.community_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_community_member(community_id, auth.uid())
  AND NOT public.is_user_banned(auth.uid())
);

CREATE POLICY "community_messages_delete_own_or_admin"
ON public.community_messages FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;