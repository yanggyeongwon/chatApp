"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { RagSource, RagScores } from "@/lib/types/rag"

function ScoreBar({ label, value, color }: { label: string; value: number; color: "green" | "blue" | "purple" }) {
  const pct = Math.round(value * 100)
  const colorMap = {
    green: { bar: "bg-green-500", text: "text-green-600" },
    blue: { bar: "bg-blue-500", text: "text-blue-600" },
    purple: { bar: "bg-purple-500", text: "text-purple-600" },
  }
  const c = colorMap[color]

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", c.bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-[10px] font-medium w-8", c.text)}>{pct}%</span>
    </div>
  )
}

export function RagConfidenceBar({
  scores,
  score,
  sources,
  queryLogId,
}: {
  scores?: RagScores
  score: number
  sources: RagSource[]
  queryLogId?: string
}) {
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null)

  const sendFeedback = async (value: "helpful" | "not_helpful") => {
    if (!queryLogId || feedback) return
    setFeedback(value)
    await fetch("/api/ai/rag/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_log_id: queryLogId, feedback: value }),
    })
  }

  // 파일별로 페이지 번호 그룹핑 (page가 있는 것만)
  const filePages = new Map<string, Set<number>>()
  for (const s of sources) {
    if (!filePages.has(s.fileName)) filePages.set(s.fileName, new Set<number>())
    if (s.page != null && s.page > 0) filePages.get(s.fileName)!.add(s.page)
  }

  // scores가 없으면 기존 score로 fallback
  const keywordMatch = scores?.keywordMatch ?? score
  const docCoverage = scores?.docCoverage ?? score
  const confidence = scores?.confidence ?? score

  return (
    <div className="mb-2 px-1 space-y-1">
      <ScoreBar label="키워드" value={keywordMatch} color="green" />
      <ScoreBar label="활용도" value={docCoverage} color="blue" />
      <ScoreBar label="신뢰도" value={confidence} color="purple" />

      {/* 출처 */}
      <div className="pt-0.5 space-y-0.5">
        {[...filePages.entries()].map(([name, pages]) => {
          const sorted = [...pages].sort((a, b) => a - b)
          const hasPages = sorted.length > 0
          return (
            <div key={name} className="text-[10px] text-muted-foreground">
              <span className="text-purple-700 font-medium">출처:</span>{" "}
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{name}</span>
              {hasPages && (
                <span className="text-gray-400 ml-1">(p.{sorted.join(", ")})</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 인용 내용 미리보기 — 페이지 번호가 있는 문서만 표시 */}
      {sources.some((s) => s.page && s.preview) && (
        <div className="pt-1 space-y-1">
          <span className="text-[10px] text-purple-700 font-medium">참조 내용:</span>
          {sources
            .filter((s) => s.page && s.preview)
            .slice(0, 3)
            .map((s, i) => (
              <div key={i} className="text-[10px] text-muted-foreground bg-gray-50 rounded px-2 py-1 border-l-2 border-purple-300">
                <span className="text-purple-500 font-medium">p.{s.page}</span>
                {" — "}
                <span className="italic">{s.preview}...</span>
              </div>
            ))}
        </div>
      )}

      {/* 피드백 */}
      <div className="flex items-center justify-end pt-0.5">

        {queryLogId && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => sendFeedback("helpful")}
              className={cn(
                "p-0.5 rounded transition-colors",
                feedback === "helpful" ? "text-green-600" : "text-muted-foreground hover:text-green-600"
              )}
              title="도움이 됨"
            >
              <svg className="h-3.5 w-3.5" fill={feedback === "helpful" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
              </svg>
            </button>
            <button
              onClick={() => sendFeedback("not_helpful")}
              className={cn(
                "p-0.5 rounded transition-colors",
                feedback === "not_helpful" ? "text-red-600" : "text-muted-foreground hover:text-red-600"
              )}
              title="도움이 안 됨"
            >
              <svg className="h-3.5 w-3.5" fill={feedback === "not_helpful" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
