"use client"

import { useState, useEffect, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.min.css"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Message } from "@/lib/types/chat"
import { format } from "date-fns"
import { RagConfidenceBar } from "@/components/rag/rag-confidence-bar"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      onMouseLeave={() => setCopied(false)}
      className={cn(
        "absolute -top-2 right-1 hidden group-hover/bubble:flex items-center justify-center h-6 w-6 rounded-md border shadow-sm transition-colors",
        copied
          ? "bg-green-50 border-green-300 text-green-600"
          : "bg-background text-muted-foreground hover:text-foreground"
      )}
      title={copied ? "복사됨!" : "복사"}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

function Linkify({ text }: { text: string }) {
  if (!text.includes("http")) return <>{text}</>
  const parts = text.split(/(https?:\/\/[^\s<]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.match(/^https?:\/\//) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
          >
            {part}
          </a>
        ) : (
          part || null
        )
      )}
    </>
  )
}

function extractTextFromChildren(children: ReactNode): string {
  if (typeof children === "string") return children
  if (typeof children === "number") return String(children)
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join("")
  if (children && typeof children === "object" && "props" in children) {
    const el = children as { props: { children?: ReactNode } }
    return extractTextFromChildren(el.props.children)
  }
  return ""
}

function CodeBlockCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className={cn(
        "absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs transition-all",
        "opacity-0 group-hover/codeblock:opacity-100",
        copied
          ? "bg-green-600 text-white"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
      )}
    >
      {copied ? (
        <>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          복사됨
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          복사
        </>
      )}
    </button>
  )
}

function StreamingIndicator({ startTime, content }: { startTime: string; content: string | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startTime).getTime()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  const tokenCount = content ? content.length / 4 : 0 // rough estimate
  const tokenStr = tokenCount > 1000
    ? `${(tokenCount / 1000).toFixed(1)}k`
    : `${Math.floor(tokenCount)}`

  return (
    <span className="text-[10px] text-purple-500 flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
      </span>
      {timeStr} · ↓ {tokenStr} tokens
    </span>
  )
}

export function MessageItem({
  message,
  isOwn,
}: {
  message: Message
  isOwn: boolean
}) {
  // System messages (including webhook events)
  if (message.type === "system") {
    const isWebhook = (message.metadata as Record<string, unknown>)?.source === "webhook"
    return (
      <div className="flex justify-center py-2">
        <div className={cn(
          "text-xs px-3 py-1.5 rounded-lg max-w-[80%]",
          isWebhook
            ? "bg-blue-50 text-blue-800 border border-blue-200 text-left"
            : "bg-muted text-muted-foreground rounded-full"
        )}>
          {isWebhook ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content ?? ""}
            </ReactMarkdown>
          ) : (
            message.content
          )}
        </div>
      </div>
    )
  }

  const sender = message.sender
  const isBot = (message.metadata as Record<string, unknown>)?.is_bot === true

  return (
    <div className={cn("flex gap-2.5 py-1", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
          <AvatarImage src={sender?.avatar_url ?? undefined} />
          <AvatarFallback className={cn("text-xs", isBot && "bg-purple-100 text-purple-700")}>
            {isBot ? "AI" : sender?.username?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-[70%] space-y-1", isOwn ? "items-end" : "items-start")}>
        {!isOwn && (
          <p className="text-xs text-muted-foreground ml-1">
            {isBot ? "Claude Code" : sender?.username ?? "Unknown"}
          </p>
        )}

        {/* RAG confidence bar */}
        {isBot && !!(message.metadata as Record<string, unknown>)?.rag_enabled && (
          <RagConfidenceBar
            scores={(message.metadata as Record<string, unknown>).rag_scores as { keywordMatch: number; docCoverage: number; confidence: number } | undefined}
            score={(message.metadata as Record<string, unknown>).rag_relevance_score as number ?? 0}
            sources={((message.metadata as Record<string, unknown>).rag_sources as Array<{ docId: string; fileName: string; chunkIndex?: number; score?: number }>) ?? []}
            queryLogId={(message.metadata as Record<string, unknown>).rag_query_log_id as string | undefined}
          />
        )}

        {/* Message bubble */}
        <div className="relative group/bubble">
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
              isOwn
                ? "bg-primary text-primary-foreground rounded-br-md"
                : isBot
                  ? "bg-purple-50 text-purple-900 border border-purple-200 rounded-bl-md"
                  : "bg-muted rounded-bl-md"
            )}
          >
            {message.is_streaming && !message.content ? (
              <span className="text-muted-foreground animate-pulse">입력중...</span>
            ) : isBot ? (
              <div className="prose prose-sm prose-purple max-w-none [&_pre]:bg-[#0d1117] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre_code]:text-gray-200 [&_code:not(pre_code)]:bg-purple-100 [&_code:not(pre_code)]:text-purple-800 [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-xs [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    pre({ children, ...props }) {
                      const codeText = extractTextFromChildren(children)
                      return (
                        <div className="relative group/codeblock">
                          <CodeBlockCopyButton code={codeText} />
                          <pre {...props}>{children}</pre>
                        </div>
                      )
                    },
                    a({ href, children, ...props }) {
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 underline hover:text-purple-800"
                          {...props}
                        >
                          {children}
                        </a>
                      )
                    },
                  }}
                >
                  {message.content ?? ""}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                <Linkify text={message.content ?? ""} />
              </p>
            )}
          </div>
          {/* Copy button */}
          {message.content && !message.is_streaming && (
            <CopyButton text={message.content} />
          )}
        </div>

        {/* Image attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="space-y-1 mt-1">
            {message.attachments.map((att) =>
              att.file_type.startsWith("image/") ? (
                <img
                  key={att.id}
                  src={att.url}
                  alt={att.file_name}
                  className="max-w-xs rounded-lg border cursor-pointer hover:opacity-90"
                  onClick={() => window.open(att.url, "_blank")}
                />
              ) : (
                <div
                  key={att.id}
                  className="flex items-center gap-2 text-xs bg-muted rounded-lg px-3 py-2"
                >
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                    {att.file_name}
                  </a>
                </div>
              )
            )}
          </div>
        )}

        {/* Timestamp or streaming indicator */}
        <div className={cn("ml-1", isOwn ? "text-right mr-1" : "")}>
          {message.is_streaming ? (
            <StreamingIndicator startTime={message.created_at} content={message.content} />
          ) : (
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(message.created_at), "HH:mm")}
              {isBot && (message.metadata as Record<string, unknown>)?.output_tokens ? (
                <span className="ml-1.5 text-purple-400">
                  ↓ {Number((message.metadata as Record<string, unknown>).output_tokens).toLocaleString()} tokens
                </span>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
