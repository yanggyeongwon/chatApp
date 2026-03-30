import type { SupabaseClient } from "@supabase/supabase-js"

// 한/영 변환 사전
const koToEn: Record<string, string[]> = {
  "스프링부트": ["spring", "boot", "springboot"], "스프링": ["spring"], "부트": ["boot"],
  "어노테이션": ["annotation", "autowired", "component", "service", "repository", "controller", "configuration", "bean"],
  "메시징": ["messaging", "message", "jms", "kafka"], "메시지": ["message"],
  "시스템": ["system"], "레스트": ["rest", "restful"], "레스트풀": ["rest", "restful"],
  "배치": ["batch"], "시큐리티": ["security"], "보안": ["security"],
  "데이터": ["data", "datasource", "jpa", "jdbc"], "데이터베이스": ["database"],
  "클라우드": ["cloud"], "웹": ["web", "mvc"], "서비스": ["service"],
  "컨트롤러": ["controller"], "리포지토리": ["repository"],
  "설정": ["config", "configuration", "properties"], "자동설정": ["autoconfiguration"],
  "인증": ["auth", "authentication", "oauth"], "로깅": ["logging", "log"], "로그": ["log"],
  "캐시": ["cache", "caching"], "테스트": ["test", "testing", "junit"],
  "배포": ["deploy", "deployment"], "프로파일": ["profile"],
  "마이그레이션": ["migration", "flyway", "liquibase"],
  "의존성": ["dependency", "starter"], "빈": ["bean"], "컴포넌트": ["component"],
  "주입": ["injection", "autowired"], "엔드포인트": ["endpoint"],
  "액추에이터": ["actuator"], "트랜잭션": ["transaction"],
  "에러": ["error", "exception"], "예외": ["exception"], "핸들러": ["handler"],
  "필터": ["filter"], "인터셉터": ["interceptor"], "리스너": ["listener"],
  "이벤트": ["event"], "스케줄": ["schedule"], "비동기": ["async"],
  "커넥션": ["connection"], "풀": ["pool"], "소켓": ["socket", "websocket"],
  "밸리데이션": ["validation"], "검증": ["validation"],
  "매핑": ["mapping"], "파라미터": ["parameter"], "헤더": ["header"],
  "리퀘스트": ["request"], "리스폰스": ["response"],
  "세션": ["session"], "쿠키": ["cookie"], "토큰": ["token"],
  "내장": ["embedded"], "톰캣": ["tomcat"],
}

const stopwords = new Set([
  "설명", "해줘", "알려줘", "대해서", "관해서", "뭐야", "좀", "하는", "있는", "되는",
  "언제", "어떻게", "무엇", "에서", "으로", "이란", "에서는", "대해", "관해", "해주세요",
  "사용해", "사용하는", "어떤", "왜", "뭔지", "인지", "건지", "하면", "되면", "에대해",
])

function isKorean(text: string): boolean {
  const ko = (text.match(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g) || []).length
  const en = (text.match(/[a-zA-Z]/g) || []).length
  return ko > en
}

function buildKeywords(query: string, docIsKorean: boolean): Set<string> {
  const rawWords = query
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)

  const keywords = new Set<string>()

  for (const w of rawWords) {
    if (stopwords.has(w)) continue

    const isWordKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(w)

    if (docIsKorean) {
      // 한글 문서 → 한글 키워드 그대로 사용
      keywords.add(w)
    } else {
      // 영문 문서
      if (isWordKorean) {
        // 한글 쿼리 → 영어로 변환
        let found = false
        for (const [ko, enList] of Object.entries(koToEn)) {
          if (w === ko || w.includes(ko) || ko.includes(w)) {
            enList.forEach((en) => keywords.add(en))
            found = true
          }
        }
        if (!found) keywords.add(w) // 사전에 없으면 원본
      } else {
        // 영문 쿼리 → 그대로
        keywords.add(w)
      }
    }
  }

  return keywords
}

export async function searchChunksByKeyword(
  supabase: SupabaseClient,
  roomId: string,
  query: string,
  maxResults: number = 10
): Promise<Array<{
  id: string
  document_id: string
  content: string
  chunk_index: number
  token_count: number
  metadata: Record<string, unknown> | null
  score: number
  matchedKeywords: string[]
}>> {
  const { data: chunks, error: chunkError } = await supabase
    .from("rag_chunks")
    .select("id, document_id, content, chunk_index, token_count, metadata")
    .eq("room_id", roomId)

  if (!chunks || chunks.length === 0) {
    console.log("[RAG-embedder] no chunks, error:", chunkError?.message ?? "none")
    return []
  }

  // 첫 몇 개 청크로 문서 언어 감지
  const sampleText = chunks.slice(0, 5).map((c) => c.content).join(" ")
  const docIsKorean = isKorean(sampleText)

  const keywords = buildKeywords(query, docIsKorean)

  console.log("[RAG-embedder] chunks:", chunks.length, "docLang:", docIsKorean ? "KO" : "EN", "keywords:", [...keywords].join(","))

  if (keywords.size === 0) return []

  // 키워드 매칭 스코어링
  const scored = chunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase()
    const queryLower = query.toLowerCase()

    let score = 0
    if (contentLower.includes(queryLower)) {
      score += 0.5
    }
    let matched = 0
    const hitKeywords: string[] = []
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      if (new RegExp(escaped, "i").test(contentLower)) {
        matched++
        score += 0.15
        hitKeywords.push(kw)
      }
    }
    if (keywords.size > 0) {
      score += (matched / keywords.size) * 0.3
    }
    score = Math.min(score, 1.0)

    return { ...chunk, score, matchedKeywords: hitKeywords }
  })

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}
