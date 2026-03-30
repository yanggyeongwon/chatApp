import { NextResponse } from "next/server"
import { execFileSync } from "child_process"

type Skill = {
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  command: string
}

// Claude Code 스킬 정의 (CLI에서 사용 가능한 슬래시 커맨드)
const SKILL_CATALOG: Skill[] = [
  // 코드 작업
  { name: "review", displayName: "코드 리뷰", description: "현재 변경사항을 리뷰하고 개선점을 제안합니다. 버그, 보안 문제, 코드 품질을 분석합니다.", category: "코드", icon: "🔍", command: "/review" },
  { name: "simplify", displayName: "코드 단순화", description: "복잡한 코드를 더 읽기 쉽고 유지보수하기 좋게 리팩토링합니다.", category: "코드", icon: "✨", command: "/simplify" },
  { name: "security-review", displayName: "보안 리뷰", description: "코드의 보안 취약점을 분석하고 OWASP Top 10 기반으로 검토합니다.", category: "코드", icon: "🔒", command: "/security-review" },

  // 문서 생성
  { name: "doc-coauthoring", displayName: "문서 작성", description: "기술 문서, 제안서, 스펙 문서 등을 함께 작성합니다.", category: "문서", icon: "📝", command: "/doc-coauthoring" },
  { name: "release-notes", displayName: "릴리즈 노트", description: "최근 커밋/변경사항 기반으로 릴리즈 노트를 자동 생성합니다.", category: "문서", icon: "📋", command: "/release-notes" },
  { name: "pr-comments", displayName: "PR 코멘트", description: "Pull Request에 대한 리뷰 코멘트를 생성합니다.", category: "문서", icon: "💬", command: "/pr-comments" },

  // 프론트엔드
  { name: "frontend-design", displayName: "프론트엔드 디자인", description: "웹 컴포넌트, 페이지, 대시보드를 디자인하고 구현합니다. 고품질 UI를 생성합니다.", category: "프론트엔드", icon: "🎨", command: "/frontend-design" },
  { name: "web-design-guidelines", displayName: "웹 디자인 가이드라인", description: "UI 코드를 웹 인터페이스 가이드라인에 맞게 리뷰합니다. 접근성, UX를 점검합니다.", category: "프론트엔드", icon: "📐", command: "/web-design-guidelines" },

  // 개발 워크플로우
  { name: "feature-dev", displayName: "기능 개발", description: "코드베이스를 분석하고 새 기능을 체계적으로 개발합니다. 아키텍처 설계부터 구현까지.", category: "개발", icon: "🚀", command: "/feature-dev" },
  { name: "code-review", displayName: "PR 코드 리뷰", description: "Pull Request를 전문적으로 리뷰합니다.", category: "개발", icon: "👀", command: "/code-review" },

  // 파일 작업
  { name: "pdf", displayName: "PDF 작업", description: "PDF 파일 읽기, 생성, 병합, 분할, 워터마크 추가 등 PDF 관련 모든 작업.", category: "파일", icon: "📄", command: "/pdf" },
  { name: "docx", displayName: "Word 문서", description: "Word 문서(.docx) 생성, 편집, 서식 적용. 보고서, 메모, 편지 등.", category: "파일", icon: "📃", command: "/docx" },
  { name: "xlsx", displayName: "스프레드시트", description: "Excel 파일(.xlsx) 생성, 편집, 수식, 차트 생성. 데이터 정리.", category: "파일", icon: "📊", command: "/xlsx" },
  { name: "pptx", displayName: "프레젠테이션", description: "PowerPoint(.pptx) 슬라이드 생성, 편집. 발표 자료 제작.", category: "파일", icon: "📽️", command: "/pptx" },

  // 유틸리티
  { name: "claude-api", displayName: "Claude API 가이드", description: "Anthropic SDK, Claude API를 사용하는 코드를 작성할 때 최신 가이드를 제공합니다.", category: "유틸리티", icon: "🔌", command: "/claude-api" },
  { name: "mcp-builder", displayName: "MCP 서버 빌더", description: "외부 서비스와 연동하는 MCP(Model Context Protocol) 서버를 만듭니다.", category: "유틸리티", icon: "🔧", command: "/mcp-builder" },
  { name: "webapp-testing", displayName: "웹앱 테스팅", description: "Playwright로 웹 앱을 자동 테스트합니다. UI 검증, 스크린샷 캡처.", category: "유틸리티", icon: "🧪", command: "/webapp-testing" },

  // 디자인/아트
  { name: "canvas-design", displayName: "시각 디자인", description: "포스터, 아트, 디자인을 PNG/PDF로 생성합니다.", category: "디자인", icon: "🖼️", command: "/canvas-design" },
  { name: "algorithmic-art", displayName: "알고리즘 아트", description: "p5.js로 생성적 아트를 만듭니다. 플로우 필드, 파티클 시스템 등.", category: "디자인", icon: "🎭", command: "/algorithmic-art" },
]

export async function GET() {
  // Check if Claude Code is available
  let cliAvailable = false
  let version = ""
  try {
    version = execFileSync("claude", ["--version"], { timeout: 5000 }).toString().trim()
    cliAvailable = true
  } catch {
    // not available
  }

  const categories = [...new Set(SKILL_CATALOG.map((s) => s.category))]

  return NextResponse.json({
    available: cliAvailable,
    version,
    skills: SKILL_CATALOG,
    categories,
  })
}
