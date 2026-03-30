const CONTEXT_STUFFING_THRESHOLD = 50_000 // 50K 토큰 이상이면 벡터화
const CHUNK_SIZE = 2000 // ~500 토큰 (chars)
const CHUNK_OVERLAP = 200 // ~50 토큰 오버랩

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function determineStrategy(tokenCount: number): "context_stuffing" | "vectorized" {
  return tokenCount < CONTEXT_STUFFING_THRESHOLD ? "context_stuffing" : "vectorized"
}

export type PageInfo = { page: number; startChar: number; endChar: number }

export async function parseDocument(
  buffer: Buffer,
  fileType: string
): Promise<{ text: string; pages: PageInfo[] }> {
  if (fileType === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse-new") as (buf: Buffer, opts?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>

    // 페이지별 텍스트를 수집하는 콜백
    const pageTexts: string[] = []
    const result = await pdfParse(buffer, {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => {
        return pageData.getTextContent().then((tc) => {
          const text = tc.items.map((item) => item.str).join(" ")
          pageTexts.push(text)
          return text
        })
      },
    })

    // 페이지별로 정확한 startChar/endChar 매핑
    const pages: PageInfo[] = []
    let fullText = ""

    if (pageTexts.length > 0) {
      fullText = result.text

      // 페이지 번호 감지: 텍스트 마지막의 단독 숫자를 페이지 번호로 인식
      // "소개   1", "관리합니다.  2" → 끝에 있는 숫자가 페이지 번호
      // 연속 3개 이상 일치하면 확정
      let pageOffset = 0
      const offsets: number[] = []

      for (let i = 0; i < pageTexts.length; i++) {
        const text = pageTexts[i].trim()
        if (text.length < 20) continue

        // 텍스트 맨 끝의 숫자만 추출 (공백 + 숫자로 끝나는 패턴)
        const endMatch = text.match(/\s+(\d{1,4})\s*$/)
        if (endMatch) {
          const num = parseInt(endMatch[1])
          const physicalIdx = i + 1
          const off = physicalIdx - num
          if (off > 0 && off < 50) {
            offsets.push(off)
          }
        }
      }

      if (offsets.length >= 3) {
        // 가장 빈번한 offset 선택
        const freq = new Map<number, number>()
        for (const o of offsets) freq.set(o, (freq.get(o) || 0) + 1)
        let maxCount = 0
        for (const [off, count] of freq) {
          if (count > maxCount) { maxCount = count; pageOffset = off }
        }
      }

      // 각 페이지 텍스트의 위치를 fullText에서 찾기
      let searchFrom = 0
      for (let i = 0; i < pageTexts.length; i++) {
        const snippet = pageTexts[i].trim().slice(0, 40)
        let pos = snippet.length > 5 ? fullText.indexOf(snippet, searchFrom) : -1
        if (pos === -1) pos = searchFrom

        const nextStart = i < pageTexts.length - 1
          ? (() => {
              const nextSnippet = pageTexts[i + 1].trim().slice(0, 40)
              const nextPos = nextSnippet.length > 5 ? fullText.indexOf(nextSnippet, pos + 1) : -1
              return nextPos !== -1 ? nextPos : fullText.length
            })()
          : fullText.length

        // 표시 페이지 번호 = 물리 인덱스 - 오프셋 + 1
        const displayPage = Math.max(1, i + 1 - pageOffset)
        pages.push({ page: displayPage, startChar: pos, endChar: nextStart })
        searchFrom = pos + 1
      }

      console.log(`[PDF] physical: ${pageTexts.length}, detected offset: ${pageOffset}, matches: ${offsets.filter((o) => o === pageOffset).length}/${offsets.length}`)
    } else {
      fullText = result.text
    }

    return { text: fullText, pages }
  }

  // text/plain, text/markdown, etc.
  const text = buffer.toString("utf-8")
  return { text, pages: [{ page: 1, startChar: 0, endChar: text.length }] }
}

export type Chunk = {
  content: string
  index: number
  tokenCount: number
  metadata: { startChar: number; endChar: number; page?: number }
}

export function chunkText(text: string, pages?: PageInfo[]): Chunk[] {
  const chunks: Chunk[] = []

  const findPage = (charPos: number): number | undefined => {
    if (!pages || pages.length === 0) return undefined
    for (const p of pages) {
      if (charPos >= p.startChar && charPos < p.endChar) return p.page
    }
    return pages[pages.length - 1]?.page
  }

  // 마크다운 헤딩 경계로 먼저 분할 시도
  const sections = splitByHeadings(text)

  let chunkIndex = 0
  for (const section of sections) {
    if (section.length <= CHUNK_SIZE) {
      const startChar = text.indexOf(section)
      chunks.push({
        content: section.trim(),
        index: chunkIndex++,
        tokenCount: estimateTokens(section),
        metadata: { startChar, endChar: startChar + section.length, page: findPage(startChar) },
      })
    } else {
      const subChunks = splitBySize(section, CHUNK_SIZE, CHUNK_OVERLAP)
      for (const sub of subChunks) {
        const sc = text.indexOf(sub)
        chunks.push({
          content: sub.trim(),
          index: chunkIndex++,
          tokenCount: estimateTokens(sub),
          metadata: { startChar: sc, endChar: sc + sub.length, page: findPage(sc) },
        })
      }
    }
  }

  return chunks.filter((c) => c.content.length > 10) // 빈 청크 제거
}

function splitByHeadings(text: string): string[] {
  // ## 또는 ### 기준으로 분할
  const parts = text.split(/(?=^#{1,3}\s)/m)
  if (parts.length <= 1) return [text]

  // 인접한 작은 파트를 합치기
  const merged: string[] = []
  let current = ""
  for (const part of parts) {
    if (current.length + part.length <= CHUNK_SIZE * 1.2) {
      current += part
    } else {
      if (current) merged.push(current)
      current = part
    }
  }
  if (current) merged.push(current)

  return merged
}

function splitBySize(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length && chunks.length < 5000) {
    const end = Math.min(start + size, text.length)
    chunks.push(text.slice(start, end))
    const next = end - overlap
    // 반드시 앞으로 전진
    start = next <= start ? start + size : next
  }
  return chunks
}
