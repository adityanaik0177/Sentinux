-- ================================================================
-- Nexus-Sentinel Supabase Schema — Vector Extension
-- Run this in your Supabase SQL Editor.
-- ================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the embeddings table
CREATE TABLE IF NOT EXISTS function_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  function_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini uses 768 dimensions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(file_path, function_name)
);

-- 3. Enable RLS
ALTER TABLE function_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write for now (in production, lock down by user_id)
CREATE POLICY "Public full access"
  ON function_embeddings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Create the match RPC function for cosine similarity
CREATE OR REPLACE FUNCTION match_function_embeddings (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  file_path TEXT,
  function_name TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    file_path,
    function_name,
    content,
    1 - (function_embeddings.embedding <=> query_embedding) AS similarity
  FROM function_embeddings
  WHERE 1 - (function_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY function_embeddings.embedding <=> query_embedding
  LIMIT match_count;
$$;
