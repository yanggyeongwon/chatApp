"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { useRagContext } from "@/lib/hooks/use-rag-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Room } from "@/lib/types/chat"

export function RoomHeader({
  room,
  onMembersClick,
  usage,
  onClearContext,
  workingDir,
  onChangeDir,
}: {
  room: Room
  onMembersClick?: () => void
  usage?: { inputTokens: number; outputTokens: number; costUsd: number } | null
  onClearContext?: () => void
  workingDir?: string
  onChangeDir?: (dir: string) => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const displayName = room.name ?? (room.type === "ai" ? "Claude AI" : "Chat")

  const [leaving, setLeaving] = useState(false)
  const [editingDir, setEditingDir] = useState(false)
  const [dirInput, setDirInput] = useState("")

  const { setShowRagPanel, refreshDocuments, setCurrentRoomId } = useRagContext()

  const handleLeaveRoom = async () => {
    if (!user || leaving) return
    setLeaving(true)

    // RAG 패널 닫기 + 상태 초기화
    setShowRagPanel(false)
    setCurrentRoomId(null)

    // API route로 RAG 삭제 + 멤버십 삭제
    await fetch("/api/ai/rooms/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: room.id }),
    })

    refreshDocuments()
    router.push("/chat")
  }

  const handleDownloadHistory = async () => {
    const { data: messages } = await supabase
      .from("messages")
      .select("content, type, created_at, sender:profiles!sender_id(username)")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })

    if (!messages) return

    type MsgRow = { content: string | null; type: string; created_at: string; sender: { username: string } | null }
    let md = `# ${displayName} - 채팅 히스토리\n\n`
    for (const msg of messages as unknown as MsgRow[]) {
      const time = new Date(msg.created_at).toLocaleString("ko-KR")
      const sender = msg.sender?.username ?? "System"
      if (msg.type === "system") {
        md += `> _${msg.content}_ (${time})\n\n`
      } else {
        md += `**${sender}** (${time}):\n${msg.content}\n\n`
      }
    }

    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${displayName}-history.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Context usage bar for AI rooms
  const maxContext = 200000
  const usedTokens = usage ? usage.inputTokens + usage.outputTokens : 0
  const usagePercent = Math.min((usedTokens / maxContext) * 100, 100)

  return (
    <div className="border-b bg-background">
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs font-semibold">
            {room.type === "ai" ? "AI" : room.type === "dm" ? "DM" : "#"}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{displayName}</h2>
            {room.type === "ai" && (
              <Badge variant="secondary" className="text-[10px]">AI</Badge>
            )}
          </div>
          {room.description && (
            <p className="text-xs text-muted-foreground">{room.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Usage indicator for AI rooms */}
        {room.type === "ai" && (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-purple-500"
                      )}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                    {(usedTokens / 1000).toFixed(1)}k / {(maxContext / 1000)}k
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="space-y-1 text-xs">
                  <p>컨텍스트: {usedTokens.toLocaleString()} / {maxContext.toLocaleString()} 토큰</p>
                  {usage && <p>입력: {usage.inputTokens.toLocaleString()} 토큰</p>}
                  {usage && <p>출력: {usage.outputTokens.toLocaleString()} 토큰</p>}
                  {usage && <p>비용: ${usage.costUsd.toFixed(4)}</p>}
                  <p className="text-muted-foreground">사용률: {usagePercent.toFixed(1)}%</p>
                </div>
              </TooltipContent>
            </Tooltip>
            <div
              onClick={onClearContext}
              className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="컨텍스트 비우기 (새 세션)"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
        )}

        {onMembersClick && (
          <Button variant="ghost" size="icon" onClick={onMembersClick}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </Button>
        )}

        {/* Room menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadHistory}>
              히스토리 MD 다운로드
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLeaveRoom} disabled={leaving} className="text-destructive">
              {leaving ? "나가는 중..." : "채팅방 나가기"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

      {/* Working directory bar for AI rooms */}
      {room.type === "ai" && workingDir && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-t text-[11px]">
          <svg className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {editingDir ? (
            <input
              autoFocus
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onChangeDir?.(dirInput.trim())
                  setEditingDir(false)
                }
                if (e.key === "Escape") setEditingDir(false)
              }}
              onBlur={() => setEditingDir(false)}
              className="flex-1 bg-background border rounded px-2 py-0.5 text-[11px] font-mono outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <button
              onClick={() => {
                setDirInput(workingDir)
                setEditingDir(true)
              }}
              className="flex-1 text-left font-mono text-muted-foreground hover:text-foreground truncate transition-colors"
              title="클릭하여 작업 디렉토리 변경"
            >
              {workingDir}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
