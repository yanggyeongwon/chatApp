-- RAG 문서 스토리지 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('rag-documents', 'rag-documents', false);

CREATE POLICY "Authenticated users can upload RAG documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rag-documents');

CREATE POLICY "Authenticated users can view RAG documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rag-documents');

CREATE POLICY "Users can delete own RAG documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rag-documents');

-- 벡터 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(1024),
  match_room_id UUID,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_index INTEGER,
  token_count INTEGER,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    rc.chunk_index,
    rc.token_count,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rag_chunks rc
  WHERE rc.room_id = match_room_id
    AND rc.embedding IS NOT NULL
    AND 1 - (rc.embedding <=> query_embedding) > match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
