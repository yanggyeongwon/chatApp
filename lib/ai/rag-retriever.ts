import type { SupabaseClient } from "@supabase/supabase-js"
import type { RagRetrievalResult, RagSource } from "@/lib/types/rag"
import { searchChunksByKeyword } from "@/lib/ai/rag-embedder"

const MAX_CONTEXT_TOKENS = 100_000

/** 단일 URL 스크래핑 */
async function scrapeSingleUrl(targetUrl: string): Promise<string> {
  const apiText = await tryKnownApi(targetUrl)
  if (apiText && apiText.length > 100) return apiText

  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
      signal: AbortSignal.timeout(20000),
    })
    if (res.ok) {
      const text = await res.text()
      if (text.length > 200) return text
    }
  } catch { /* continue */ }

  try {
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ChatApp-RAG/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    return ""
  }
}

/** 메인 페이지 + 질문 관련 하위 링크 자동 탐색 */
async function scrapeUrl(targetUrl: string, query?: string): Promise<string> {
  const mainText = await scrapeSingleUrl(targetUrl)
  if (!query || !mainText) return mainText

  // 마크다운 링크에서 같은 도메인 링크 추출
  const baseHostname = new URL(targetUrl).hostname
  const baseOrigin = new URL(targetUrl).origin
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g
  const links: Array<{ text: string; href: string }> = []
  let m
  while ((m = linkPattern.exec(mainText)) !== null) {
    let href = m[2]
    if (href.startsWith("/")) href = baseOrigin + href
    try {
      if (new URL(href).hostname === baseHostname) {
        links.push({ text: m[1], href })
      }
    } catch { /* skip */ }
  }

  if (links.length === 0) return mainText

  // 질문과 관련 있는 링크만 선택 (최대 3개)
  const qWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  const relevant = links
    .map((link) => {
      const lt = link.text.toLowerCase()
      let score = 0
      for (const w of qWords) { if (lt.includes(w)) score++ }
      return { ...link, score }
    })
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (relevant.length === 0) return mainText

  const subTexts = await Promise.all(
    relevant.map(async (link) => {
      const sub = await scrapeSingleUrl(link.href)
      return sub && sub.length > 100
        ? `\n\n### ${link.text} (${link.href})\n${sub}`
        : ""
    })
  )

  return mainText + subTexts.join("")
}

/** 알려진 사이트의 API 엔드포인트를 직접 호출 */
async function tryKnownApi(url: string): Promise<string> {
  try {
    const u = new URL(url)

    // spring.io → api.spring.io
    if (u.hostname === "spring.io" && u.pathname.startsWith("/projects/")) {
      const projectSlug = u.pathname.split("/")[2] // e.g. "spring-boot"
      if (!projectSlug) return ""

      // 프로젝트 정보 + 세대별 릴리스 날짜
      const [projRes, genRes] = await Promise.all([
        fetch(`https://api.spring.io/projects/${projectSlug}`, { signal: AbortSignal.timeout(10000) }),
        fetch(`https://api.spring.io/projects/${projectSlug}/generations`, { signal: AbortSignal.timeout(10000) }),
      ])

      const parts: string[] = []

      if (projRes.ok) {
        const proj = await projRes.json()
        parts.push(`# ${proj.name ?? projectSlug}`)
        if (proj.repositoryUrl) parts.push(`Repository: ${proj.repositoryUrl}`)
        if (proj.status) parts.push(`Status: ${proj.status}`)
      }

      if (genRes.ok) {
        const genData = await genRes.json()
        const generations = genData?._embedded?.generations ?? []
        if (generations.length > 0) {
          parts.push("\n## Support / Release Dates\n")
          parts.push("| Branch | Initial Release | End of OSS Support | End Enterprise Support |")
          parts.push("|--------|----------------|-------------------|----------------------|")
          for (const gen of generations) {
            parts.push(`| ${gen.name} | ${gen.initialReleaseDate ?? "N/A"} | ${gen.ossSupportEndDate ?? "N/A"} | ${gen.commercialSupportEndDate ?? "N/A"} |`)
          }
        }
      }

      if (parts.length > 0) return parts.join("\n")
    }
  } catch { /* ignore */ }
  return ""
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * 질문과 문서 텍스트 간 관련도 계산 (0~1)
 * - 문서 내용이 충분히 있으면 기본 신뢰도 부여 (컨텍스트로 제공하니까)
 * - 키워드 매칭으로 보너스
 */
function calculateRelevance(query: string, text: string): number {
  if (!text || text.length < 50) return 0

  // 1) 문서 크기 기반 기본 점수 (내용이 있으면 최소 0.5)
  const baseScore = Math.min(text.length / 2000, 0.5)

  // 2) 키워드 매칭 (한/영 모두, 동의어 포함)
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  // 쿼리 단어 추출 + 동의어 확장
  const rawWords = queryLower
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)

  // 한/영 동의어 매핑
  const synonyms: Record<string, string[]> = {
    "레스트": ["rest", "restful"],
    "레스트풀": ["rest", "restful"],
    "가이드": ["guide", "guides", "tutorial"],
    "스프링": ["spring"],
    "부트": ["boot"],
    "배치": ["batch"],
    "시큐리티": ["security"],
    "데이터": ["data"],
    "클라우드": ["cloud"],
    "웹": ["web"],
    "서비스": ["service"],
    "빌딩": ["building", "build"],
    "릴리스": ["release"],
    "날짜": ["date", "release"],
    "설치": ["install", "setup"],
    "설정": ["config", "configuration", "setup"],
    "인증": ["auth", "authentication"],
  }

  const expandedWords = new Set<string>()
  for (const word of rawWords) {
    expandedWords.add(word)
    const syns = synonyms[word]
    if (syns) syns.forEach((s) => expandedWords.add(s))
  }

  if (expandedWords.size === 0) return baseScore

  let matched = 0
  for (const word of expandedWords) {
    if (textLower.includes(word)) matched++
  }

  const matchRatio = matched / expandedWords.size
  // 기본 점수 (0~0.5) + 매칭 보너스 (0~0.5)
  return Math.min(baseScore + matchRatio * 0.5, 1.0)
}

export async function retrieveRagContext(
  roomId: string,
  query: string,
  supabase: SupabaseClient
): Promise<RagRetrievalResult | null> {
  const { data: documents, error: docError } = await supabase
    .from("rag_documents")
    .select("id, file_name, file_type, strategy, parsed_text, token_count, storage_path")
    .eq("room_id", roomId)
    .eq("status", "ready")

  console.log("[RAG-retriever] room:", roomId, "docs:", documents?.length ?? 0, "error:", docError?.message ?? "none")

  if (!documents || documents.length === 0) return null

  const sources: RagSource[] = []
  const contextParts: string[] = []
  let totalTokens = 0
  const allScores: number[] = []
  const strategies = new Set<string>()

  // 1) URL 문서 — 실시간 스크래핑 (질문 관련 하위 페이지 포함)
  const urlDocs = documents.filter((d) => d.file_type === "text/uri")
  for (const doc of urlDocs) {
    const url = doc.storage_path
    if (!url) continue

    const text = await scrapeUrl(url, query)
    if (!text) continue

    const tokens = estimateTokens(text)
    if (totalTokens + tokens > MAX_CONTEXT_TOKENS) {
      const remaining = MAX_CONTEXT_TOKENS - totalTokens
      const truncated = text.slice(0, remaining * 4)
      contextParts.push(`### ${doc.file_name} (${url})\n${truncated}\n...(truncated)`)
      totalTokens += remaining
    } else {
      contextParts.push(`### ${doc.file_name} (${url})\n${text}`)
      totalTokens += tokens
    }
    strategies.add("url")
    // URL은 실시간 스크래핑이므로 내용이 충분하면 높은 기본 점수
    const keywordBonus = calculateRelevance(query, text)
    const urlScore = Math.max(0.7, keywordBonus) // 최소 70%
    allScores.push(urlScore)
    sources.push({ docId: doc.id, fileName: doc.file_name, score: urlScore })
  }

  // 2) Context stuffing 파일 문서
  const stuffingDocs = documents
    .filter((d) => d.strategy === "context_stuffing" && d.file_type !== "text/uri" && d.parsed_text)
    .sort((a, b) => a.token_count - b.token_count)

  for (const doc of stuffingDocs) {
    if (totalTokens + doc.token_count > MAX_CONTEXT_TOKENS) break
    contextParts.push(`### ${doc.file_name}\n${doc.parsed_text}`)
    totalTokens += doc.token_count
    strategies.add("context_stuffing")
    const keywordScore = calculateRelevance(query, doc.parsed_text ?? "")
    const fileScore = Math.max(0.6, keywordScore) // 전문 포함이므로 최소 60%
    allScores.push(fileScore)
    sources.push({ docId: doc.id, fileName: doc.file_name, score: fileScore })
  }

  // 3) Vectorized 파일 문서 — 키워드 매칭
  const vectorizedDocs = documents.filter((d) => d.strategy === "vectorized")
  console.log("[RAG-retriever] vectorized docs:", vectorizedDocs.length, "stuffing docs:", stuffingDocs.length, "url docs:", urlDocs.length)
  if (vectorizedDocs.length > 0) {
    const chunks = await searchChunksByKeyword(supabase, roomId, query, 10)
    console.log("[RAG-retriever] chunks found:", chunks.length)
    const docNameMap = new Map(vectorizedDocs.map((d) => [d.id, d.file_name]))

    for (const chunk of chunks) {
      if (totalTokens + chunk.token_count > MAX_CONTEXT_TOKENS) break
      const fileName = docNameMap.get(chunk.document_id) ?? "unknown"
      const chunkMeta = chunk.metadata as Record<string, unknown> | null
      const pageNum = chunkMeta?.page as number | undefined
      const location = pageNum ? `p.${pageNum}` : `#${chunk.chunk_index + 1}`
      contextParts.push(`### ${fileName} (${location})\n${chunk.content}`)
      totalTokens += chunk.token_count
      strategies.add("vectorized")
      const chunkScore = Math.max(0.6, chunk.score)
      allScores.push(chunkScore)
      // 인용 미리보기: 첫 줄에서 의미 있는 내용 추출
      const preview = chunk.content
        .replace(/^\s+/, "")
        .split("\n")
        .filter((l: string) => l.trim().length > 10)
        .slice(0, 2)
        .join(" ")
        .slice(0, 120)
      sources.push({ docId: chunk.document_id, fileName, chunkIndex: chunk.chunk_index, page: pageNum, score: chunkScore, preview })
    }
  }

  if (contextParts.length === 0) return null

  let strategyUsed: "context_stuffing" | "vectorized" | "mixed" = "context_stuffing"
  if (strategies.size > 1) strategyUsed = "mixed"
  else if (strategies.has("vectorized")) strategyUsed = "vectorized"

  const topScore = allScores.length > 0 ? Math.max(...allScores) : 0
  const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0

  // 3가지 점수 계산
  const keywordMatch = avgScore // 키워드 매칭 기반 점수
  const docCoverage = Math.min(totalTokens / 5000, 1.0) // 문서 활용도 (5000토큰 = 100%)
  const confidence = keywordMatch * 0.5 + docCoverage * 0.3 + (contextParts.length > 0 ? 0.2 : 0) // 종합

  return {
    context: contextParts.join("\n\n---\n\n"),
    sources,
    scores: { keywordMatch, docCoverage, confidence },
    topScore, avgScore, totalTokens, strategyUsed,
  }
}
