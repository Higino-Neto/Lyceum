-- Adicionar coluna category_id na tabela readings
ALTER TABLE public.readings 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);

-- Adicionar coluna reading_time na tabela readings (se não existir)
ALTER TABLE public.readings 
ADD COLUMN IF NOT EXISTS reading_time integer;
