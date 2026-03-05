
ALTER TABLE public.books 
ADD COLUMN reading_status text NOT NULL DEFAULT 'unread',
ADD COLUMN material_format text NOT NULL DEFAULT 'physical';
