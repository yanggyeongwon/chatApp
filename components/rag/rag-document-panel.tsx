"use client"

import { useRagContext } from "@/lib/hooks/use-rag-context"
import { RagDocumentItem } from "@/components/rag/rag-document-item"

export function RagDocumentPanel() {
  const { ragDocuments, refreshDocuments, setShowRagPanel, isSearching, uploadingFileName } = useRagContext()

  const handleDelete = (docId: string) => {
    refreshDocuments()
  }

  return (
    <aside className="w-64 border-r flex-shrink-0 hidden md:flex flex-col bg-background">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-sm font-medium">RAG 문서</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded-full">
            {ragDocuments.length}
          </span>
        </div>
        <button
          onClick={() => setShowRagPanel(false)}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          title="패널 닫기"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* RAG 파일 등록 중 */}
      {uploadingFileName && (
        <div className="mx-3 my-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs font-medium text-blue-700">RAG 등록 중...</span>
          </div>
          <p className="text-[10px] text-blue-500 mt-1 ml-6 truncate">{uploadingFileName}</p>
        </div>
      )}

      {/* RAG 검색 중 표시 */}
      {isSearching && (
        <div className="mx-3 my-2 px-3 py-2.5 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
            </span>
            <span className="text-xs font-medium text-purple-700">RAG 검색 중...</span>
          </div>
          <p className="text-[10px] text-purple-500 mt-1 ml-[18px]">
            문서에서 관련 내용을 찾고 있습니다
          </p>
        </div>
      )}

      {/* 문서 목록 */}
      <div className="flex-1 overflow-y-auto py-1">
        {ragDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs px-4 text-center">
            <svg className="h-8 w-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            채팅 입력란의 RAG 버튼으로
            문서를 추가하세요
          </div>
        ) : (
          ragDocuments.map((doc) => (
            <RagDocumentItem key={doc.id} document={doc} onDelete={handleDelete} />
          ))
        )}
      </div>
    </aside>
  )
}
