
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS total_pages integer DEFAULT NULL;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS pages_read integer DEFAULT NULL;
