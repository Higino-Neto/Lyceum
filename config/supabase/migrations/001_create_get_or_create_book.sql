-- Função RPC para criar ou buscar livro
-- Execute este SQL no editor SQL do Supabase para atualizar a função

-- Remove todas as versões antigas
DROP FUNCTION IF EXISTS get_or_create_book(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_or_create_book(TEXT, TEXT, TEXT, SMALLINT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_or_create_book(TEXT, TEXT, TEXT, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS get_or_create_book(TEXT, TEXT, TEXT, SMALLINT, TEXT, UUID);

-- Cria a função nova com colunas existentes
CREATE OR REPLACE FUNCTION get_or_create_book(
  p_title TEXT,
  p_author TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_total_pages INTEGER DEFAULT NULL,
  p_isbn TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_book_id TEXT;
  v_user_id UUID;
BEGIN
  -- Pegar o user_id do contexto atual
  SELECT auth.uid() INTO v_user_id;
  
  -- Busca livro existente pelo título
  IF v_user_id IS NOT NULL AND p_title IS NOT NULL THEN
    SELECT id INTO v_book_id 
    FROM books 
    WHERE LOWER(title) = LOWER(p_title) AND user_id = v_user_id 
    LIMIT 1;
  END IF;
  
  -- Se não encontrou, cria novo livro
  IF v_book_id IS NULL THEN
    INSERT INTO books (title, author, thumbnail_url, total_pages, isbn, category_id, user_id)
    VALUES (p_title, p_author, p_thumbnail_url, p_total_pages, p_isbn, p_category_id, v_user_id)
    RETURNING id INTO v_book_id;
  END IF;
  
  RETURN v_book_id;
END;
$$;
