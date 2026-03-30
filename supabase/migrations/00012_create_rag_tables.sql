-- RAG Documents: 업로드된 문서 메타데이터
CREATE TABLE rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  parsed_text TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  strategy TEXT NOT NULL CHECK (strategy IN ('context_stuffing', 'vectorized')) DEFAULT 'context_stuffing',
  status TEXT NOT NULL CHECK (status IN ('uploading', 'parsing', 'ready', 'error')) DEFAULT 'uploading',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_documents_room ON rag_documents(room_id);
CREATE INDEX idx_rag_documents_status ON rag_documents(room_id, status);

-- RAG Chunks: 벡터화된 문서 청크
CREATE TABLE rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  embedding vector(1024),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_chunks_document ON rag_chunks(document_id);
CREATE INDEX idx_rag_chunks_room ON rag_chunks(room_id);
CREATE INDEX idx_rag_chunks_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- RAG Query Logs: 분석/모델링용 로그
CREATE TABLE rag_query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  strategy_used TEXT NOT NULL CHECK (strategy_used IN ('context_stuffing', 'vectorized', 'mixed')),
  retrieved_chunks JSONB,
  top_relevance_score FLOAT,
  avg_relevance_score FLOAT,
  total_context_tokens INTEGER,
  response_time_ms INTEGER,
  user_feedback TEXT CHECK (user_feedback IN ('helpful', 'not_helpful')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_query_logs_room ON rag_query_logs(room_id);
CREATE INDEX idx_rag_query_logs_user ON rag_query_logs(user_id);

-- RLS
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_query_logs ENABLE ROW LEVEL SECURITY;

-- rag_documents policies
CREATE POLICY "RAG documents visible to room members"
  ON rag_documents FOR SELECT TO authenticated
  USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Room members can upload RAG documents"
  ON rag_documents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Uploader can update RAG documents"
  ON rag_documents FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Uploader can delete RAG documents"
  ON rag_documents FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);

-- rag_chunks policies
CREATE POLICY "RAG chunks visible to room members"
  ON rag_chunks FOR SELECT TO authenticated
  USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated can insert RAG chunks"
  ON rag_chunks FOR INSERT TO authenticated
  WITH CHECK (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

-- rag_query_logs policies
CREATE POLICY "Users can view own RAG query logs"
  ON rag_query_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert RAG query logs"
  ON rag_query_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RAG query feedback"
  ON rag_query_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
