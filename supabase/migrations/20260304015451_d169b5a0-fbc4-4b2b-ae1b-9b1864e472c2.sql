
-- Books table for bibliographic management
CREATE TABLE public.books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discipline_id UUID NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own books" ON public.books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own books" ON public.books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own books" ON public.books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own books" ON public.books FOR DELETE USING (auth.uid() = user_id);

-- Subtopics for checklist items
CREATE TABLE public.checklist_subtopics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_subtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subtopics" ON public.checklist_subtopics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subtopics" ON public.checklist_subtopics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subtopics" ON public.checklist_subtopics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subtopics" ON public.checklist_subtopics FOR DELETE USING (auth.uid() = user_id);

-- Add semester number to disciplines for archiving
ALTER TABLE public.disciplines ADD COLUMN IF NOT EXISTS semester_number INTEGER DEFAULT NULL;
ALTER TABLE public.disciplines ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
