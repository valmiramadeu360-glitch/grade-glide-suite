
DROP VIEW IF EXISTS public.trending_posts;
CREATE OR REPLACE VIEW public.trending_posts WITH (security_invoker = true) AS
SELECT 
  p.*,
  (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id) as likes_count,
  (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id) as comments_count,
  ((SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id) * 1) + 
  ((SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id) * 2) as engagement_score
FROM public.posts p
ORDER BY engagement_score DESC, p.created_at DESC;
