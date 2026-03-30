import { NextResponse } from "next/server"
import { execFileSync } from "child_process"

export async function GET() {
  try {
    // Check if claude CLI is installed
    const version = execFileSync("claude", ["--version"], {
      timeout: 5000,
    })
      .toString()
      .trim()

    if (!version) {
      return NextResponse.json({
        available: false,
        message:
          "Claude Code CLI가 설치되어 있지 않습니다.\n\n설치: npm install -g @anthropic-ai/claude-code",
      })
    }

    return NextResponse.json({ available: true, version })
  } catch {
    return NextResponse.json({
      available: false,
      message:
        "Claude Code CLI를 찾을 수 없습니다.\n\n설치:\nnpm install -g @anthropic-ai/claude-code\n\n그 후 로그인:\nclaude login\n\nClaude Pro/Max 구독 필요:\nhttps://claude.ai/settings/billing",
    })
  }
}
