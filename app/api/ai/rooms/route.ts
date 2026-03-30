import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { execFileSync } from "child_process"

function checkClaudeCodeStatus() {
  if (process.env.CLAUDE_CODE_TEST_DISCONNECTED === "true") {
    return { installed: false, authenticated: false, version: "" }
  }
  try {
    const version = execFileSync("claude", ["--version"], { timeout: 5000 }).toString().trim()
    return { installed: true, authenticated: true, version }
  } catch {
    return { installed: false, authenticated: false, version: "" }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await request.json().catch(() => ({}))

  // 봇 조회
  const { data: bot } = await supabase
    .from("bots")
    .select("id, profile_id")
    .eq("bot_type", "claude")
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!bot) {
    return NextResponse.json({ error: "No active Claude bot found" }, { status: 404 })
  }

  // 기존 AI 방 수 조회 → 이름에 번호 부여
  const { count } = await supabase
    .from("room_members")
    .select("room_id, rooms!inner(type)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("rooms.type", "ai")

  const roomNum = (count ?? 0) + 1
  const roomName = roomNum === 1 ? "Claude Code" : `Claude Code ${roomNum}`

  const { data: room } = await supabase
    .from("rooms")
    .insert({ name: roomName, type: "ai", has_bot: true, created_by: user.id })
    .select("id")
    .single()

  if (!room) return NextResponse.json({ error: "Failed to create room" }, { status: 500 })

  await supabase.from("room_members").insert([
    { room_id: room.id, user_id: user.id, role: "owner" },
    { room_id: room.id, user_id: bot.profile_id, role: "member" },
  ])

  await supabase.from("bot_room_configs").insert({
    bot_id: bot.id, room_id: room.id, invocation_mode: "always", added_by: user.id,
  })

  // 즉시 응답 — 채팅방 바로 열림
  const roomId = room.id
  const botProfileId = bot.profile_id

  // 백그라운드: 연결 확인 + 환영 메시지
  ;(async () => {
    try {
      // "확인 중" 메시지
      await supabase.from("messages").insert({
        room_id: roomId, sender_id: botProfileId,
        content: "⏳ **Claude Code 연결 확인 중...**",
        type: "text", metadata: { is_bot: true, checking: true },
      })

      const status = checkClaudeCodeStatus()

      // "확인 중" 메시지 삭제
      await supabase.from("messages").delete()
        .eq("room_id", roomId).eq("metadata->>checking", "true")

      if (status.installed && status.authenticated) {
        // 연결 성공
        await supabase.from("messages").insert({
          room_id: roomId, sender_id: botProfileId,
          content: `✅ **Claude Code 연결 완료!**\n\nCLI v${status.version} 인증됨\n\n이 채팅방에서 Claude Code를 사용할 수 있습니다:\n- 💬 코드 질문하기\n- 📁 파일 읽기/편집\n- 🔍 코드베이스 검색\n- ⚡ 터미널 명령 실행\n\n메시지를 보내보세요!`,
          type: "text", metadata: { is_bot: true },
        })
        // 파일 권한 요청
        const homeDir = process.env.HOME || process.env.USERPROFILE || "/"
        await supabase.from("messages").insert({
          room_id: roomId, sender_id: botProfileId,
          content: `🔐 **파일 시스템 접근 권한 요청**\n\nClaude Code가 작업을 수행하려면 컴퓨터의 파일에 접근해야 합니다.\n\n**접근 범위:**\n- 📁 파일 읽기/쓰기\n- ⚡ 터미널 명령 실행\n- 🔍 디렉토리 탐색\n\n**현재 홈 디렉토리:** \`${homeDir}\`\n\n아래에서 선택해주세요:\n- **"승인"** → 파일 접근을 허용합니다\n- **"거부"** → 파일 접근 없이 대화만 가능합니다\n- **"경로 변경"** → 특정 폴더만 접근하도록 설정합니다`,
          type: "text", metadata: { is_bot: true, permission_request: true },
        })
      } else if (status.installed) {
        // CLI 있지만 인증 안 됨
        await supabase.from("messages").insert({
          room_id: roomId, sender_id: botProfileId,
          content: `⚠️ **Claude Code CLI 감지됨** (v${status.version})\n\n하지만 로그인이 필요합니다.\n\n터미널에서 실행:\n\`\`\`bash\nclaude login\n\`\`\`\n\n구독이 없다면: https://claude.ai/settings/billing`,
          type: "text", metadata: { is_bot: true, setup: true },
        })
      } else {
        // CLI 미설치
        await supabase.from("messages").insert({
          room_id: roomId, sender_id: botProfileId,
          content: `❌ **Claude Code CLI가 설치되어 있지 않습니다.**\n\n설치:\n\`\`\`bash\nnpm install -g @anthropic-ai/claude-code\n\`\`\`\n\n로그인:\n\`\`\`bash\nclaude login\n\`\`\`\n\n구독: https://claude.ai/settings/billing\n\n📖 가이드: https://docs.anthropic.com/en/docs/claude-code/overview`,
          type: "text", metadata: { is_bot: true, setup: true },
        })
      }
    } catch (err) {
      console.error("Background check failed:", err)
    }
  })()

  return NextResponse.json({ roomId })
}
