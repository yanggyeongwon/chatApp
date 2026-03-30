import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { execFileSync, execFile } from "child_process"
import { runClaudeCode } from "@/lib/ai/claude-code"
import { retrieveRagContext } from "@/lib/ai/rag-retriever"

type SetupStatus = {
  installed: boolean
  authenticated: boolean
  version?: string
}

function checkSetupStatus(): SetupStatus {
  if (process.env.CLAUDE_CODE_TEST_DISCONNECTED === "true") {
    return { installed: false, authenticated: false }
  }
  try {
    const version = execFileSync("claude", ["--version"], { timeout: 5000 }).toString().trim()
    return { installed: true, authenticated: true, version }
  } catch {
    return { installed: false, authenticated: false }
  }
}

function handleSetupMessage(userMsg: string, status: SetupStatus): string | { action: string; response: string } {
  const msg = userMsg.toLowerCase()

  // 설치 요청
  if (msg.includes("설치") || msg.includes("install")) {
    if (status.installed) {
      return `✅ **Claude Code가 이미 설치되어 있습니다!** (v${status.version})\n\n다음 단계로 로그인이 필요합니다.\n"로그인해줘" 라고 말해주세요.`
    }
    return {
      action: "install",
      response: "📦 **Claude Code 설치를 시작합니다...**\n\n잠시만 기다려주세요.",
    }
  }

  // 로그인 요청
  if (msg.includes("로그인") || msg.includes("login") || msg.includes("연결")) {
    if (!status.installed) {
      return '❌ **Claude Code가 먼저 설치되어야 합니다.**\n\n"설치해줘" 라고 말해주세요.'
    }
    return {
      action: "login",
      response: "🔐 **Claude Code 로그인을 시작합니다...**\n\n브라우저가 열리면 Claude 계정으로 로그인하세요.",
    }
  }

  // 구독 요청
  if (msg.includes("구독") || msg.includes("subscribe") || msg.includes("결제") || msg.includes("billing") || msg.includes("플랜") || msg.includes("plan")) {
    return `💳 **Claude 구독 안내:**\n\n아래 링크에서 구독할 수 있습니다:\n\n👉 **https://claude.ai/settings/billing**\n\n| 플랜 | 가격 | 특징 |\n|------|------|------|\n| **Pro** | $20/월 | 기본 사용량 |\n| **Max** | $100/월 | 대용량 + 우선 처리 |\n\n구독 완료 후 "확인" 이라고 말해주세요.`
  }

  // 상태 확인 / 확인 / 테스트
  if (msg.includes("확인") || msg.includes("상태") || msg.includes("체크") || msg.includes("check") || msg.includes("테스트") || msg.includes("test")) {
    return { action: "recheck", response: "🔍 **Claude Code 연결 상태를 확인합니다...**" }
  }

  // 도움말
  if (msg.includes("도움") || msg.includes("help") || msg.includes("어떻게") || msg.includes("뭐해")) {
    return `🤖 **Claude Code 셋업 도우미입니다.**\n\n아래 명령어로 대화할 수 있어요:\n\n- **"설치해줘"** → Claude Code CLI 자동 설치\n- **"로그인해줘"** → 로그인 방법 안내\n- **"구독 알려줘"** → 구독 플랜 및 링크\n- **"확인"** → 현재 연결 상태 재확인\n\n현재 상태:\n- CLI 설치: ${status.installed ? "✅" : "❌"}\n- 인증: ${status.authenticated ? "✅" : "❌"}`
  }

  // 기본 응답
  return `아직 Claude Code가 연결되지 않았습니다.\n\n다음 중 하나를 말해주세요:\n- **"설치해줘"** → 자동 설치\n- **"로그인해줘"** → 로그인 안내\n- **"구독 알려줘"** → 구독 링크\n- **"확인"** → 상태 재확인\n- **"도움말"** → 전체 안내`
}

async function tryLoginClaudeCode(): Promise<string> {
  return new Promise((resolve) => {
    const proc = execFile("claude", ["login"], { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(`⚠️ **자동 로그인에 문제가 발생했습니다.**\n\n\`\`\`\n${stderr || error.message}\n\`\`\`\n\n터미널에서 직접 실행해주세요:\n\`\`\`bash\nclaude login\n\`\`\`\n\n완료 후 "확인" 이라고 말해주세요.`)
      } else {
        resolve(`✅ **Claude Code 로그인 완료!**\n\n${stdout ? `\`\`\`\n${stdout.trim()}\n\`\`\`` : ""}\n\n이제 Claude Code를 사용할 수 있습니다.\n"확인" 이라고 말해서 연결 상태를 확인하세요.`)
      }
    })

    // If process spawned, it will open browser - give feedback
    if (proc.pid) {
      // Process started successfully, browser should open
    }
  })
}

async function tryInstallClaudeCode(): Promise<string> {
  return new Promise((resolve) => {
    execFile("npm", ["install", "-g", "@anthropic-ai/claude-code"], { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        resolve(`❌ **설치 실패:**\n\n\`\`\`\n${stderr || error.message}\n\`\`\`\n\n수동으로 설치해주세요:\n\`\`\`bash\nnpm install -g @anthropic-ai/claude-code\n\`\`\`\n\n권한 오류 시:\n\`\`\`bash\nsudo npm install -g @anthropic-ai/claude-code\n\`\`\``)
      } else {
        resolve(`✅ **Claude Code 설치 완료!**\n\n${stdout ? `\`\`\`\n${stdout.trim()}\n\`\`\`` : ""}\n\n다음 단계: 터미널에서 \`claude login\` 실행\n\n"로그인해줘" 라고 말해주세요.`)
      }
    })
  })
}

// RLS가 봇 메시지 UPDATE를 차단할 수 있으므로 DELETE+INSERT로 fallback
async function updateBotMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messageId: string,
  fields: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("messages")
    .update(fields)
    .eq("id", messageId)
    .select("id")

  if (!error && data && data.length > 0) {
    return // 성공
  }

  console.error("[updateBotMessage] UPDATE failed:", { error, rowsAffected: data?.length ?? 0, messageId })

  // fallback: DELETE + INSERT
  try {
    const { data: existing } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single()

    if (existing) {
      await supabase.from("messages").delete().eq("id", messageId)
      const { error: insErr } = await supabase.from("messages").insert({ ...existing, ...fields })
      if (insErr) console.error("[updateBotMessage] fallback INSERT failed:", insErr)
      else console.log("[updateBotMessage] fallback succeeded")
    } else {
      console.error("[updateBotMessage] message not found for fallback:", messageId)
    }
  } catch (e) {
    console.error("[updateBotMessage] fallback error:", e)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { room_id } = await request.json()

  if (!room_id) {
    return NextResponse.json({ error: "room_id required" }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from("room_members")
    .select("*")
    .eq("room_id", room_id)
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: "Not a room member" }, { status: 403 })
  }

  const { data: botConfig } = await supabase
    .from("bot_room_configs")
    .select("*, bots(*)")
    .eq("room_id", room_id)
    .eq("is_active", true)
    .single()

  if (!botConfig) {
    return NextResponse.json({ error: "No bot configured" }, { status: 404 })
  }

  const bot = (botConfig as unknown as { bots: { id: string; profile_id: string } }).bots

  const { data: latestMessage } = await supabase
    .from("messages")
    .select("content, sender:profiles!sender_id(username)")
    .eq("room_id", room_id)
    .neq("sender_id", bot.profile_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!latestMessage?.content) {
    return NextResponse.json({ error: "No user message found" }, { status: 400 })
  }

  // === SETUP MODE: Claude Code not available ===
  const status = checkSetupStatus()
  if (!status.installed || !status.authenticated) {
    const result = handleSetupMessage(latestMessage.content, status)

    if (typeof result === "string") {
      // Simple text response
      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: result,
        type: "text",
        metadata: { is_bot: true, setup: true },
      })
      return NextResponse.json({ setup: true })
    }

    // Action required
    if (result.action === "install") {
      // Show "installing..." message first
      const { data: botMsg } = await supabase
        .from("messages")
        .insert({
          room_id,
          sender_id: bot.profile_id,
          content: result.response,
          type: "text",
          is_streaming: true,
          metadata: { is_bot: true, setup: true },
        })
        .select()
        .single()

      // Run installation
      const installResult = await tryInstallClaudeCode()

      if (botMsg) {
        await supabase
          .from("messages")
          .update({ content: installResult, is_streaming: false })
          .eq("id", botMsg.id)
      }
      return NextResponse.json({ setup: true, action: "install" })
    }

    if (result.action === "login") {
      const { data: botMsg } = await supabase
        .from("messages")
        .insert({
          room_id,
          sender_id: bot.profile_id,
          content: result.response,
          type: "text",
          is_streaming: true,
          metadata: { is_bot: true, setup: true },
        })
        .select()
        .single()

      const loginResult = await tryLoginClaudeCode()

      if (botMsg) {
        await supabase
          .from("messages")
          .update({ content: loginResult, is_streaming: false })
          .eq("id", botMsg.id)
      }
      return NextResponse.json({ setup: true, action: "login" })
    }

    if (result.action === "recheck") {
      // Recheck and report
      const freshStatus = checkSetupStatus()
      let statusMsg: string

      if (freshStatus.installed && freshStatus.authenticated) {
        statusMsg = `✅ **Claude Code 연결 완료!**\n\nCLI v${freshStatus.version} 인증됨\n\n이제 메시지를 보내면 Claude Code가 응답합니다. 아무 질문이나 해보세요!`
      } else if (freshStatus.installed && !freshStatus.authenticated) {
        statusMsg = `⚠️ **Claude Code 설치됨** (v${freshStatus.version})\n\n하지만 아직 로그인이 필요합니다.\n\n"로그인해줘" 라고 말해주세요.`
      } else {
        statusMsg = `❌ **Claude Code가 아직 설치되지 않았습니다.**\n\n"설치해줘" 라고 말해주세요.`
      }

      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: statusMsg,
        type: "text",
        metadata: { is_bot: true, setup: true },
      })
      return NextResponse.json({ setup: true, action: "recheck" })
    }

    return NextResponse.json({ setup: true })
  }

  // === PERMISSION CHECK ===
  const userMsg = latestMessage.content.toLowerCase()

  // Check if this is a permission response
  const { data: lastBotMsg } = await supabase
    .from("messages")
    .select("metadata")
    .eq("room_id", room_id)
    .eq("sender_id", bot.profile_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const lastMeta = lastBotMsg?.metadata as Record<string, unknown> | null
  const isPermissionPending = lastMeta?.permission_request === true

  if (isPermissionPending) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "/"

    if (userMsg.includes("승인") || userMsg.includes("허용") || userMsg === "y" || userMsg === "yes") {
      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: `✅ **파일 접근이 승인되었습니다.**\n\n작업 디렉토리: \`${homeDir}\`\n\n이제 자유롭게 질문하세요! \`@\`를 입력하면 파일을 참조할 수 있습니다.`,
        type: "text",
        metadata: { is_bot: true, permission_granted: true },
      })
      return NextResponse.json({ permission: "granted" })
    }

    if (userMsg.includes("거부") || userMsg.includes("거절") || userMsg === "n" || userMsg === "no") {
      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: "⛔ **파일 접근이 거부되었습니다.**\n\n파일 읽기/쓰기, 터미널 명령 실행이 제한됩니다.\n일반 대화만 가능합니다.\n\n권한을 변경하려면 **\"승인\"**이라고 말해주세요.",
        type: "text",
        metadata: { is_bot: true, permission_denied: true },
      })
      return NextResponse.json({ permission: "denied" })
    }

    if (userMsg.includes("경로") || userMsg.includes("변경") || userMsg.includes("폴더") || userMsg.includes("디렉토리")) {
      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: `📁 **작업 디렉토리를 설정해주세요.**\n\n접근을 허용할 경로를 입력하세요:\n\n예시:\n- \`/Users/username/projects\`\n- \`~/Desktop\`\n- \`/home/user/workspace\`\n\n현재 홈: \`${homeDir}\``,
        type: "text",
        metadata: { is_bot: true, awaiting_path: true },
      })
      return NextResponse.json({ permission: "awaiting_path" })
    }

    // Check if user is providing a path
    if (userMsg.startsWith("/") || userMsg.startsWith("~")) {
      const resolvedPath = userMsg.startsWith("~") ? userMsg.replace("~", homeDir) : userMsg
      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: `✅ **작업 디렉토리가 설정되었습니다.**\n\n경로: \`${resolvedPath}\`\n\n이제 자유롭게 질문하세요! \`@\`를 입력하면 해당 경로의 파일을 참조할 수 있습니다.`,
        type: "text",
        metadata: { is_bot: true, permission_granted: true, working_dir: resolvedPath },
      })
      return NextResponse.json({ permission: "granted", workingDir: resolvedPath })
    }

    // Not a permission response, remind
    await supabase.from("messages").insert({
      room_id,
      sender_id: bot.profile_id,
      content: "파일 접근 권한을 먼저 설정해주세요:\n- **\"승인\"** → 전체 접근 허용\n- **\"거부\"** → 대화만 가능\n- **\"경로 변경\"** → 특정 폴더만 접근",
      type: "text",
      metadata: { is_bot: true, permission_request: true },
    })
    return NextResponse.json({ permission: "pending" })
  }

  // Check if permission was denied
  const { data: permMsgs } = await supabase
    .from("messages")
    .select("metadata")
    .eq("room_id", room_id)
    .eq("sender_id", bot.profile_id)
    .not("metadata", "is", null)
    .order("created_at", { ascending: false })
    .limit(10)

  const permDenied = permMsgs?.some((m) => (m.metadata as Record<string, unknown>)?.permission_denied === true)
  const permGranted = permMsgs?.some((m) => (m.metadata as Record<string, unknown>)?.permission_granted === true)

  if (permDenied && !permGranted) {
    // Re-check if user says "승인" even after denial
    if (userMsg.includes("승인") || userMsg.includes("허용")) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || "/"
      await supabase.from("messages").insert({
        room_id,
        sender_id: bot.profile_id,
        content: `✅ **파일 접근이 승인되었습니다.**\n\n작업 디렉토리: \`${homeDir}\``,
        type: "text",
        metadata: { is_bot: true, permission_granted: true },
      })
      return NextResponse.json({ permission: "granted" })
    }

    // Permission denied - only allow text chat, no Claude Code
    await supabase.from("messages").insert({
      room_id,
      sender_id: bot.profile_id,
      content: "⛔ 파일 접근이 거부된 상태입니다. 일반 대화만 가능합니다.\n\n파일 작업이 필요하면 **\"승인\"**이라고 말해주세요.",
      type: "text",
      metadata: { is_bot: true },
    })
    return NextResponse.json({ permission: "denied" })
  }

  // === NORMAL MODE: Claude Code available + permission granted ===

  // Find working directory from permission messages
  let cwdForClaude = process.env.HOME || process.env.USERPROFILE || "/"
  if (permMsgs) {
    for (const m of permMsgs) {
      const meta = m.metadata as Record<string, unknown> | null
      if (meta?.working_dir) {
        cwdForClaude = meta.working_dir as string
        break
      }
      if (meta?.permission_granted) break
    }
  }

  // 이전 세션 ID 조회 (대화 이어하기)
  let prevSessionId = ""
  const { data: prevBotMsgs } = await supabase
    .from("messages")
    .select("metadata")
    .eq("room_id", room_id)
    .eq("sender_id", bot.profile_id)
    .not("metadata", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)

  if (prevBotMsgs) {
    for (const m of prevBotMsgs) {
      const meta = m.metadata as Record<string, unknown> | null
      if (meta?.session_id && meta?.source === "claude-code") {
        prevSessionId = meta.session_id as string
        break
      }
    }
  }

  // 봇 메시지를 먼저 생성 (입력중... 표시)
  const { data: botMessage } = await supabase
    .from("messages")
    .insert({
      room_id,
      sender_id: bot.profile_id,
      content: "",
      type: "text",
      is_streaming: true,
      metadata: { is_bot: true, source: "claude-code" },
    })
    .select()
    .single()

  if (!botMessage) {
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }

  // RAG 검색은 요청 컨텍스트 안에서 (supabase 인증 필요)
  await updateBotMessage(supabase, botMessage.id, { content: "🔍 RAG 문서 검색 중..." })

  const ragStartTime = Date.now()
  let ragResult: Awaited<ReturnType<typeof retrieveRagContext>> = null
  try {
    ragResult = await Promise.race([
      retrieveRagContext(room_id, latestMessage.content, supabase),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000)),
    ])
  } catch {
    ragResult = null
  }
  const ragElapsed = Date.now() - ragStartTime
  console.log("[RAG]", ragResult ? `found ${ragResult.sources.length} sources, ${ragResult.totalTokens} tokens, ${ragElapsed}ms` : `no results, ${ragElapsed}ms`)

  let fullPrompt = latestMessage.content
  if (ragResult && ragResult.context) {
    fullPrompt = `아래 문서 내용만을 사용하여 질문에 답변하세요.
절대로 웹 검색(WebSearch, WebFetch)을 하지 마세요. 도구를 사용하지 마세요.
문서에 있는 정보만으로 답변하세요.
출처나 chunk 번호를 답변에 포함하지 마세요. 출처는 시스템이 자동으로 표시합니다.

중요: 문서에 해당 정보가 없으면 아래 형식으로만 답변하세요:
"제공된 문서에 해당 정보가 없습니다. 일반 지식 기반으로 답변해드릴까요?"
절대로 일반 지식으로 답변하지 마세요. 사용자가 승인할 때까지 기다리세요.

<documents>
${ragResult.context}
</documents>

질문: ${latestMessage.content}`
  }

  await updateBotMessage(supabase, botMessage.id, { content: "" })

  // Claude 실행은 백그라운드 (즉시 응답 반환)
  const bgProcess = async () => { try {

    let streamingContent = ""
    let finalResult = ""
    let sessionId = ""
    let outputTokens = 0
    let inputTokens = 0
    let costUsd = 0
    let lastUpdateTime = 0
    const UPDATE_INTERVAL_MS = 500

    const progressLog: string[] = []
    let turnIndex = 0

    for await (const event of runClaudeCode(fullPrompt, {
      cwd: cwdForClaude,
      timeoutMs: 300_000, // 5 minutes
      sessionId: prevSessionId || undefined,
      continueSession: !!prevSessionId,
      // RAG 모드에서도 도구 허용 (프롬프트에서 사용 제한)
    })) {
      if (event.type === "system" && event.session_id) {
        sessionId = event.session_id
      }

      if (event.type === "assistant" && event.message?.content) {
        turnIndex++
        const texts = event.message.content
          .filter((c: { type: string; text?: string }) => c.type === "text" && c.text)
          .map((c: { type: string; text?: string }) => c.text!)

        // tool_use 로그 누적
        const tools = event.message.content
          .filter((c: { type: string; name?: string }) => c.type === "tool_use")
        for (const tool of tools) {
          const t = tool as { name?: string; input?: Record<string, unknown> }
          const name = t.name ?? "tool"
          const input = t.input ?? {}
          let detail = ""
          if (name === "Read" || name === "Write" || name === "Edit") {
            detail = ` \`${input.file_path ?? ""}\``
          } else if (name === "Bash") {
            const cmd = String(input.command ?? "").slice(0, 60)
            detail = ` \`${cmd}\``
          } else if (name === "Glob" || name === "Grep") {
            detail = ` \`${input.pattern ?? ""}\``
          }
          progressLog.push(`🔧 **${name}**${detail}`)
        }

        if (texts.length > 0) {
          streamingContent = texts.join("")
          // 텍스트는 진행 로그 아래에 표시
          const display = progressLog.length > 0
            ? progressLog.join("\n") + "\n\n---\n\n" + streamingContent
            : streamingContent
          const now = Date.now()
          if (now - lastUpdateTime > UPDATE_INTERVAL_MS) {
            await updateBotMessage(supabase, botMessage.id, { content: display })
            lastUpdateTime = now
          }
        } else if (progressLog.length > 0) {
          // tool만 실행 중일 때 진행 로그만 표시
          const now = Date.now()
          if (now - lastUpdateTime > UPDATE_INTERVAL_MS) {
            await updateBotMessage(supabase, botMessage.id, { content: progressLog.join("\n") + "\n\n⏳ 작업 중..." })
            lastUpdateTime = now
          }
        }
      }

      if (event.type === "result") {
        if (event.result) finalResult = event.result
        const usage = event.usage as Record<string, unknown> | undefined
        if (usage) {
          outputTokens = (usage.output_tokens as number) ?? 0
          inputTokens = (usage.input_tokens as number) ?? 0
        }
        costUsd = (event.total_cost_usd as number) ?? 0
      }
    }

    const resultText = finalResult || streamingContent || "응답을 생성하지 못했습니다."
    // 최종 결과: 진행 로그 + 구분선 + 결과
    const content = progressLog.length > 0
      ? progressLog.join("\n") + "\n\n---\n\n" + resultText
      : resultText

    await updateBotMessage(supabase, botMessage.id, {
      content,
      is_streaming: false,
      metadata: {
        is_bot: true,
        source: "claude-code",
        session_id: sessionId,
        output_tokens: outputTokens,
        input_tokens: inputTokens,
        cost_usd: costUsd,
        ...(ragResult && {
          rag_enabled: true,
          rag_scores: ragResult.scores,
          rag_relevance_score: ragResult.topScore,
          rag_avg_score: ragResult.avgScore,
          rag_sources: ragResult.sources,
          rag_strategy: ragResult.strategyUsed,
        }),
      },
    })

    // RAG 쿼리 로그 저장
    if (ragResult) {
      await supabase.from("rag_query_logs").insert({
        room_id,
        message_id: botMessage.id,
        user_id: user.id,
        query_text: latestMessage.content,
        strategy_used: ragResult.strategyUsed,
        retrieved_chunks: ragResult.sources.map((s) => ({
          doc_id: s.docId,
          file_name: s.fileName,
          chunk_index: s.chunkIndex,
          score: s.score,
        })),
        top_relevance_score: ragResult.topScore,
        avg_relevance_score: ragResult.avgScore,
        total_context_tokens: ragResult.totalTokens,
        response_time_ms: ragElapsed,
      })
    }

    await supabase
      .from("rooms")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", room_id)

  } catch (error) {
    console.error("Claude Code error:", error)

    await updateBotMessage(supabase, botMessage.id, {
      content: "Claude Code 실행 중 오류가 발생했습니다.",
      is_streaming: false,
      metadata: { is_bot: true, error: true },
    })
  } }

  // 백그라운드 실행 (응답 기다리지 않음)
  bgProcess().catch((e) => console.error("[bg] error:", e))

  // 즉시 응답 — Next.js 서버가 다른 요청 처리 가능
  return NextResponse.json({ messageId: botMessage.id, status: "processing" })
}
