"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { useRagContext } from "@/lib/hooks/use-rag-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { RoomWithPreview } from "@/lib/types/chat"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"

function getRoomIcon(type: string, hasBot: boolean) {
  if (type === "ai" || hasBot) return "AI"
  if (type === "dm") return "DM"
  return "#"
}

function getRoomDisplayName(room: RoomWithPreview) {
  if (room.type === "dm" && room.dmPartnerName) return room.dmPartnerName
  if (room.name) return room.name
  if (room.type === "dm") return "Direct Message"
  if (room.type === "ai") return "Claude AI"
  return "Unnamed Room"
}

export function RoomItem({ room, onLeave }: { room: RoomWithPreview; onLeave?: (roomId: string) => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const isActive = pathname === `/chat/${room.id}`
  const supabase = createClient()
  const ragCtx = useRagContext()

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [displayName, setDisplayName] = useState(getRoomDisplayName(room))
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditName(displayName)
    setEditing(true)
  }

  const handleRename = async () => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== displayName) {
      await supabase
        .from("rooms")
        .update({ name: trimmed })
        .eq("id", room.id)
      setDisplayName(trimmed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRename()
    if (e.key === "Escape") setEditing(false)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || deleting) return
    setDeleting(true)
    try {
      // RAG 패널 닫기 + 상태 초기화
      ragCtx.setShowRagPanel(false)
      ragCtx.setCurrentRoomId(null)

      // API route로 RAG 삭제 + 멤버십 삭제
      await fetch("/api/ai/rooms/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: room.id }),
      })

      onLeave?.(room.id)
      if (isActive) {
        router.push("/chat")
      }
    } catch {
      setDeleting(false)
    }
  }

  const icon = getRoomIcon(room.type, room.has_bot)
  const timeAgo = room.last_message_at
    ? formatDistanceToNow(new Date(room.last_message_at), {
        addSuffix: true,
        locale: ko,
      })
    : ""

  if (editing) {
    return (
      <div className="flex items-center gap-3 rounded-lg p-2.5 bg-sidebar-accent">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className={cn("text-xs font-semibold", room.type === "ai" && "bg-purple-100 text-purple-700")}>
            {icon}
          </AvatarFallback>
        </Avatar>
        <Input
          ref={inputRef}
          value={editName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleRename}
          className="h-7 text-sm"
        />
      </div>
    )
  }

  return (
    <div className="group relative">
      <Link
        href={`/chat/${room.id}`}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent"
        )}
      >
        <Avatar className="h-10 w-10 flex-shrink-0">
          {room.type === "dm" && room.dmPartnerAvatar && (
            <AvatarImage src={room.dmPartnerAvatar} />
          )}
          <AvatarFallback
            className={cn(
              "text-xs font-semibold",
              room.type === "ai" && "bg-purple-100 text-purple-700",
              room.type === "dm" && "bg-blue-100 text-blue-700",
              room.type === "group" && "bg-emerald-100 text-emerald-700"
            )}
          >
            {room.type === "dm" && room.dmPartnerName ? room.dmPartnerName[0].toUpperCase() : icon}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{displayName}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {(room.unread_count ?? 0) > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {room.unread_count! > 99 ? "99+" : room.unread_count}
                </span>
              )}
              {timeAgo && (
                <span className="text-[11px] text-muted-foreground group-hover:hidden">
                  {timeAgo}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {room.type === "ai" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">AI</Badge>
            )}
          </div>
        </div>
      </Link>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        title="채팅방 나가기"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
