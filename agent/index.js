#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js")
const { spawn, execFileSync } = require("child_process")
const readline = require("readline")

// ===== 설정 =====
const SUPABASE_URL = "https://vzyinfemfmvbxgdmxftn.supabase.co"
const SUPABASE_KEY = "sb_publishable_T3bYS7kib40MSMqFdQTZAQ_DPBD89ee"

let supabase
let botProfileId
let currentUserId
let sessionMap = new Map() // roomId → sessionId

// ===== CLI 색상 =====
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

// ===== Claude Code 실행 =====
function checkClaudeInstalled() {
  try {
    const version = execFileSync("claude", ["--version"], { timeout: 5000 }).toString().trim()
    return { installed: true, version }
  } catch {
    return { installed: false, version: null }
  }
}

async function runClaude(prompt, roomId, messageId) {
  const args = ["-p", "--output-format", "stream-json", "--verbose"]

  const sessionId = sessionMap.get(roomId)
  if (sessionId) {
    args.push("--resume", sessionId)
  }

  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY

  return new Promise((resolve) => {
    const proc = spawn("claude", args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    })

    proc.stdin.write(prompt)
    proc.stdin.end()

    let buffer = ""
    let finalResult = ""
    let streamingContent = ""
    let newSessionId = ""
    let outputTokens = 0
    let inputTokens = 0

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const event = JSON.parse(trimmed)

          if (event.type === "system" && event.session_id) {
            newSessionId = event.session_id
          }

          if (event.type === "assistant" && event.message?.content) {
            const texts = event.message.content
              .filter((c) => c.type === "text" && c.text)
              .map((c) => c.text)
            if (texts.length > 0) {
              streamingContent = texts.join("")
              // 중간 업데이트
              updateMessage(messageId, { content: streamingContent })
            }
          }

          if (event.type === "result") {
            if (event.result) finalResult = event.result
            const usage = event.usage || {}
            outputTokens = usage.output_tokens || 0
            inputTokens = usage.input_tokens || 0
          }
        } catch {
          // skip
        }
      }
    })

    proc.stderr.on("data", () => {})

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM")
      resolve({ result: "⏱️ 타임아웃 (5분 초과)", sessionId: newSessionId, outputTokens: 0, inputTokens: 0 })
    }, 300000)

    proc.on("close", () => {
      clearTimeout(timeout)
      if (newSessionId) sessionMap.set(roomId, newSessionId)
      resolve({
        result: finalResult || streamingContent || "응답을 생성하지 못했습니다.",
        sessionId: newSessionId,
        outputTokens,
        inputTokens,
      })
    })
  })
}

// ===== Supabase 메시지 업데이트 =====
async function updateMessage(messageId, fields) {
  await supabase.from("messages").update(fields).eq("id", messageId)
}

// ===== 새 메시지 처리 =====
async function handleNewMessage(payload) {
  const msg = payload.new
  if (!msg || msg.sender_id === botProfileId) return
  if (msg.type === "system") return

  const roomId = msg.room_id

  // 이 방에 봇이 있는지 확인
  const { data: botConfig } = await supabase
    .from("bot_room_configs")
    .select("*, bots(*)")
    .eq("room_id", roomId)
    .eq("is_active", true)
    .single()

  if (!botConfig) return

  const content = msg.content
  if (!content) return

  console.log(c.cyan(`\n💬 [${roomId.slice(0, 8)}] ${content.slice(0, 60)}`))

  // 봇 응답 메시지 생성 (입력중...)
  const { data: botMessage } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: botProfileId,
      content: "",
      type: "text",
      is_streaming: true,
      metadata: { is_bot: true, source: "claude-code" },
    })
    .select()
    .single()

  if (!botMessage) {
    console.log(c.red("  ❌ 봇 메시지 생성 실패"))
    return
  }

  // RAG 검색 (서버에 위임 — 에이전트에서는 스킵, 프롬프트 그대로 전달)
  console.log(c.dim(`  🔄 Claude 실행 중...`))

  const result = await runClaude(content, roomId, botMessage.id)

  // 최종 결과 업데이트
  await updateMessage(botMessage.id, {
    content: result.result,
    is_streaming: false,
    metadata: {
      is_bot: true,
      source: "claude-code",
      session_id: result.sessionId,
      output_tokens: result.outputTokens,
      input_tokens: result.inputTokens,
    },
  })

  console.log(c.green(`  ✅ 응답 완료 (${result.outputTokens} tokens)`))
}

// ===== 로그인 =====
async function login() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise((r) => rl.question(q, r))

  console.log(c.bold("\n🤖 ChatApp 로컬 에이전트\n"))

  const email = await ask("이메일: ")
  const password = await ask("비밀번호 (Google OAuth 사용 시 아무 값): ")

  // Google OAuth 사용자는 서비스 키로 접근
  // 여기서는 에이전트 토큰 방식 사용
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.log(c.yellow("\n⚠️  비밀번호 로그인 실패. 에이전트 토큰으로 연결합니다."))
    console.log(c.dim("  (Google OAuth 사용자는 이 방식으로 접속)\n"))

    // 에이전트 키 입력
    const agentKey = await ask("에이전트 키 (웹에서 복사): ")
    rl.close()
    return agentKey
  }

  currentUserId = data.user.id
  console.log(c.green(`\n✅ 로그인 성공: ${email}`))
  rl.close()
  return null
}

// ===== 메인 =====
async function main() {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Claude Code 확인
  const claude = checkClaudeInstalled()
  if (!claude.installed) {
    console.log(c.red("\n❌ Claude Code CLI가 설치되어 있지 않습니다."))
    console.log(c.dim("  npm install -g @anthropic-ai/claude-code"))
    console.log(c.dim("  claude login\n"))
    process.exit(1)
  }

  console.log(c.bold("\n🤖 ChatApp 로컬 에이전트"))
  console.log(c.dim(`  Claude Code CLI v${claude.version}`))
  console.log(c.dim(`  서버: ${SUPABASE_URL}\n`))

  // 봇 프로필 조회
  const { data: bot } = await supabase
    .from("bots")
    .select("profile_id")
    .eq("bot_type", "claude")
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!bot) {
    console.log(c.red("❌ 봇 설정을 찾을 수 없습니다."))
    process.exit(1)
  }

  botProfileId = bot.profile_id
  console.log(c.green("✅ 봇 연결됨"))

  // Supabase Realtime으로 새 메시지 구독
  const channel = supabase
    .channel("agent-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        handleNewMessage(payload).catch((err) => {
          console.log(c.red(`  ❌ 에러: ${err.message}`))
        })
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(c.green("✅ 메시지 구독 시작"))
        console.log(c.cyan("\n📡 대기 중... (웹에서 채팅을 보내세요)\n"))
      }
    })

  // 종료 처리
  process.on("SIGINT", () => {
    console.log(c.dim("\n👋 에이전트 종료"))
    supabase.removeChannel(channel)
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(c.red("에이전트 에러:"), err.message)
  process.exit(1)
})
