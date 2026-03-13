-- Criar tabela books
CREATE TABLE IF NOT EXISTS public.books (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text NOT NULL,
  author text,
  thumbnail_url text,
  total_pages smallint,
  isbn text,
  description text,
  published_date text,
  external_id text,
  CONSTRAINT books_pkey PRIMARY KEY (id)
);

-- Adicionar coluna book_id na tabela readings (aceita null para artigos/PDFs)
ALTER TABLE public.readings 
ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id);

-- Criar índice para buscas por título
CREATE INDEX IF NOT EXISTS idx_books_title ON public.books USING gin(to_tsvector('portuguese', title));
