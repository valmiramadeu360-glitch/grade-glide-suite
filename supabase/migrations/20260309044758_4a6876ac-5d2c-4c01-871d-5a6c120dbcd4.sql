
-- 1. Direct Messages table
CREATE TABLE public.direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see messages they sent or received
CREATE POLICY "Users can view own messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- RLS: Users can send messages (as sender)
CREATE POLICY "Users can send messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- RLS: Users can delete own sent messages
CREATE POLICY "Users can delete own sent messages"
  ON public.direct_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- Enable realtime for DMs
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- 2. Trending Posts View (Engagement Algorithm)
CREATE OR REPLACE VIEW public.trending_posts AS
SELECT 
  p.*,
  (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id) as likes_count,
  (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id) as comments_count,
  ((SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id) * 1) + 
  ((SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id) * 2) as engagement_score
FROM public.posts p
ORDER BY engagement_score DESC, p.created_at DESC;
