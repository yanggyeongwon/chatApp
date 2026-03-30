"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { RagDocument } from "@/lib/types/rag"

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain": "TXT",
  "text/markdown": "MD",
  "text/uri": "URL",
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function RagDocumentItem({
  document,
  onDelete,
}: {
  document: RagDocument
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const ext = FILE_ICONS[document.file_type] ?? "FILE"

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/ai/rag/documents/${document.id}`, { method: "DELETE" })
      if (res.ok) onDelete(document.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-purple-50 rounded-lg transition-colors">
      {/* 파일 아이콘 */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold",
        ext === "PDF" ? "bg-red-100 text-red-600" :
        ext === "URL" ? "bg-green-100 text-green-600" :
        ext === "MD" ? "bg-blue-100 text-blue-600" :
        "bg-gray-100 text-gray-600"
      )}>
        {ext}
      </div>

      {/* 파일 정보 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{document.file_name}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{formatSize(document.file_size)}</span>
          <span>·</span>
          <span className={cn(
            "px-1 rounded",
            document.file_type === "text/uri" ? "bg-green-100 text-green-700" :
            document.strategy === "context_stuffing" ? "bg-purple-100 text-purple-700" :
            "bg-blue-100 text-blue-700"
          )}>
            {document.file_type === "text/uri" ? "실시간" : document.strategy === "context_stuffing" ? "전문" : "벡터"}
          </span>
          {document.status === "parsing" && (
            <span className="text-yellow-600 animate-pulse">파싱중...</span>
          )}
          {document.status === "error" && (
            <span className="text-red-600">오류</span>
          )}
        </div>
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-all"
        title="삭제"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
