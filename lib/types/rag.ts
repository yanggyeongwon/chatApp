export type RagDocument = {
  id: string
  room_id: string
  uploaded_by: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  parsed_text: string | null
  token_count: number
  strategy: "context_stuffing" | "vectorized"
  status: "uploading" | "parsing" | "ready" | "error"
  error_message: string | null
  created_at: string
  updated_at: string
}

export type RagChunk = {
  id: string
  document_id: string
  room_id: string
  chunk_index: number
  content: string
  token_count: number
  metadata: Record<string, unknown> | null
  created_at: string
}

export type RagSource = {
  docId: string
  fileName: string
  chunkIndex?: number
  page?: number
  score?: number
  preview?: string
  matchedKeywords?: string[]
}

export type RagScores = {
  keywordMatch: number   // 키워드 일치율 (0~1)
  docCoverage: number    // 문서 활용도 (0~1)
  confidence: number     // 종합 신뢰도 (0~1)
}

export type RagRetrievalResult = {
  context: string
  sources: RagSource[]
  scores: RagScores
  topScore: number
  avgScore: number
  totalTokens: number
  strategyUsed: "context_stuffing" | "vectorized" | "mixed"
}

export type RagQueryLog = {
  id: string
  room_id: string
  message_id: string | null
  user_id: string
  query_text: string
  strategy_used: string
  retrieved_chunks: Record<string, unknown>[] | null
  top_relevance_score: number | null
  avg_relevance_score: number | null
  total_context_tokens: number | null
  response_time_ms: number | null
  user_feedback: "helpful" | "not_helpful" | null
  created_at: string
}
