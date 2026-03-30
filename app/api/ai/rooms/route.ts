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

  // 환영 메시지 + 에이전트 연결 안내
  ;(async () => {
    try {
      const status = checkClaudeCodeStatus()

      if (status.installed && status.authenticated) {
        // 로컬 서버에서 실행 중 — CLI 직접 사용 가능
        await supabase.from("messages").insert({
          room_id: roomId, sender_id: botProfileId,
          content: `✅ **Claude Code 연결 완료!**\n\nCLI v${status.version} 인증됨\n\n메시지를 보내보세요!`,
          type: "text", metadata: { is_bot: true },
        })
      } else {
        // 서버에 CLI 없음 — 로컬 에이전트 안내
        await supabase.from("messages").insert({
          room_id: roomId, sender_id: botProfileId,
          content: `👋 **Claude Code 채팅방에 오신 것을 환영합니다!**\n\nAI 기능을 사용하려면 **로컬 에이전트**를 실행해야 합니다.\n\n**1단계: Claude Code CLI 설치**\n\`\`\`bash\nnpm install -g @anthropic-ai/claude-code\nclaude login\n\`\`\`\n\n**2단계: 에이전트 실행**\n\`\`\`bash\ncd ${process.cwd()}/agent\nnpm install\nnode index.js\n\`\`\`\n\n에이전트가 실행되면 이 채팅방에서 Claude Code를 사용할 수 있습니다.\n\n💡 **구독**: https://claude.ai/settings/billing (Pro $20/월)`,
          type: "text", metadata: { is_bot: true, setup: true },
        })
      }
    } catch (err) {
      console.error("Background check failed:", err)
    }
  })()

  return NextResponse.json({ roomId })
}
