import { spawn, type ChildProcess } from "child_process"

export type ClaudeCodeEvent = {
  type: string
  subtype?: string
  message?: {
    content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>
    [key: string]: unknown
  }
  result?: string
  session_id?: string
  is_error?: boolean
  tool_use_id?: string
  [key: string]: unknown
}

const DEFAULT_TIMEOUT_MS = 120_000

export type ClaudeCodeProcess = {
  events: AsyncGenerator<ClaudeCodeEvent>
  sendInput: (text: string) => void
  kill: () => void
}

/**
 * Runs Claude Code CLI in print mode with stream-json output.
 * Returns events generator + sendInput for permission responses.
 */
export function startClaudeCode(
  prompt: string,
  options?: {
    cwd?: string
    sessionId?: string
    continueSession?: boolean
    allowedTools?: string[]
    timeoutMs?: number
  }
): ClaudeCodeProcess {
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
  ]

  if (options?.allowedTools && options.allowedTools.length > 0) {
    for (const tool of options.allowedTools) {
      args.push("--allowedTools", tool)
    }
  }

  if (options?.sessionId && options?.continueSession) {
    args.push("--resume", options.sessionId)
  }

  const env = { ...process.env }
  // API 키가 있으면 구독 대신 API 과금되므로 제거
  delete env.ANTHROPIC_API_KEY

  const proc: ChildProcess = spawn("claude", args, {
    cwd: options?.cwd ?? process.cwd(),
    env,
    stdio: ["pipe", "pipe", "pipe"],
  })

  // stderr 수집 (디버깅용)
  let stderrOutput = ""
  proc.stderr?.on("data", (chunk) => {
    stderrOutput += chunk.toString()
  })

  // prompt를 stdin으로 전달 (--allowedTools 뒤에 positional arg가 인식 안 되는 문제 해결)
  proc.stdin?.write(prompt)
  proc.stdin?.end()

  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    proc.kill("SIGTERM")
    setTimeout(() => proc.kill("SIGKILL"), 3000)
  }, timeout)

  async function* generateEvents(): AsyncGenerator<ClaudeCodeEvent> {
    let buffer = ""
    const stdout = proc.stdout
    if (!stdout) {
      clearTimeout(timer)
      return
    }

    try {
      for await (const chunk of stdout) {
        buffer += chunk.toString()
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            yield JSON.parse(trimmed) as ClaudeCodeEvent
          } catch {
            // skip
          }
        }
      }

      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim()) as ClaudeCodeEvent
        } catch {
          // skip
        }
      }

      if (timedOut) {
        yield {
          type: "result",
          subtype: "error",
          is_error: true,
          result: "⏱️ 타임아웃: 응답 시간이 초과되었습니다.",
        }
      }
    } finally {
      clearTimeout(timer)
      if (!proc.killed) proc.kill("SIGTERM")

      // stderr에 에러가 있으면 마지막 이벤트로 전달
      if (stderrOutput.trim()) {
        console.error("[claude-code stderr]", stderrOutput.trim())
      }
    }
  }

  return {
    events: generateEvents(),
    sendInput: (text: string) => {
      proc.stdin?.write(text + "\n")
    },
    kill: () => {
      clearTimeout(timer)
      if (!proc.killed) proc.kill("SIGTERM")
    },
  }
}

// Backward compat
export async function* runClaudeCode(
  prompt: string,
  options?: {
    cwd?: string
    sessionId?: string
    continueSession?: boolean
    allowedTools?: string[]
    timeoutMs?: number
  }
): AsyncGenerator<ClaudeCodeEvent> {
  const proc = startClaudeCode(prompt, {
    ...options,
    allowedTools: options?.allowedTools ?? [
      "Read", "Write", "Edit", "Bash", "Glob", "Grep",
    ],
  })
  yield* proc.events
}

export function extractContent(event: ClaudeCodeEvent): string | null {
  if (event.type === "assistant" && event.message?.content) {
    const texts = event.message.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
    if (texts.length > 0) return texts.join("")
  }

  if (event.type === "result" && event.result) {
    return event.result
  }

  return null
}
