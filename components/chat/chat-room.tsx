"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { RoomHeader } from "@/components/chat/room-header"
import { MessageList } from "@/components/chat/message-list"
import { MessageInput } from "@/components/chat/message-input"
import { TypingIndicator } from "@/components/chat/typing-indicator"
import { useTypingPresence } from "@/lib/hooks/use-typing-presence"
import { useAuth } from "@/lib/hooks/use-auth"
import type { Room, Message, BotRoomConfig } from "@/lib/types/chat"
import { MembersPanel } from "@/components/chat/members-panel"

type UsageInfo = { inputTokens: number; outputTokens: number; costUsd: number }

export function ChatRoom({
  room,
  initialMessages,
  currentUserId,
  botConfig,
}: {
  room: Room
  initialMessages: Message[]
  currentUserId: string
  botConfig?: BotRoomConfig | null
}) {
  const [showMembers, setShowMembers] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [workingDir, setWorkingDir] = useState<string>("")
  const supabase = createClient()
  const router = useRouter()
  const { profile } = useAuth()

  const { typingUsers, setTyping } = useTypingPresence(
    room.id,
    currentUserId,
    profile?.username ?? "사용자",
    profile?.avatar_url ?? null
  )

  // Fetch initial working directory (user's home)
  useEffect(() => {
    if (room.type === "ai") {
      fetch("/api/ai/files?q=")
        .then((r) => r.json())
        .then((data) => setWorkingDir(data.cwd ?? ""))
        .catch(() => {})
    }
  }, [room.type])

  // Check if permission granted a custom working dir
  useEffect(() => {
    if (room.type !== "ai") return
    const checkPermDir = async () => {
      const { data } = await supabase
        .from("messages")
        .select("metadata")
        .eq("room_id", room.id)
        .not("metadata", "is", null)
        .order("created_at", { ascending: false })
        .limit(20)
      if (data) {
        for (const msg of data) {
          const meta = msg.metadata as Record<string, unknown> | null
          if (meta?.working_dir) {
            setWorkingDir(meta.working_dir as string)
            return
          }
        }
      }
    }
    checkPermDir()
  }, [room.id, room.type, supabase])

  const handleClearContext = useCallback(async () => {
    await supabase.from("messages").insert({
      room_id: room.id,
      sender_id: currentUserId,
      content: "컨텍스트가 비워졌습니다. 새 세션으로 시작합니다.",
      type: "system",
    })
    setUsage({ inputTokens: 0, outputTokens: 0, costUsd: 0 })
    router.refresh()
  }, [room.id, currentUserId, supabase, router])

  const handleChangeDir = useCallback(async (newDir: string) => {
    setWorkingDir(newDir)
  }, [])

  useEffect(() => {
    if (room.type !== "ai") return

    const calcUsage = async () => {
      const { data } = await supabase
        .from("messages")
        .select("metadata")
        .eq("room_id", room.id)
        .not("metadata", "is", null)

      if (data) {
        let inputTokens = 0
        let outputTokens = 0
        let costUsd = 0
        for (const msg of data) {
          const meta = msg.metadata as Record<string, unknown> | null
          if (meta?.is_bot) {
            inputTokens += (meta.input_tokens as number) ?? 0
            outputTokens += (meta.output_tokens as number) ?? 0
            costUsd += (meta.cost_usd as number) ?? 0
          }
        }
        setUsage({ inputTokens, outputTokens, costUsd })
      }
    }
    calcUsage()
  }, [room.id, room.type, supabase])

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <RoomHeader
          room={room}
          onMembersClick={
            room.type !== "dm" ? () => setShowMembers(!showMembers) : undefined
          }
          usage={process.env.NEXT_PUBLIC_ENABLE_CLAUDE === "true" ? usage : null}
          onClearContext={process.env.NEXT_PUBLIC_ENABLE_CLAUDE === "true" && room.type === "ai" ? handleClearContext : undefined}
          workingDir={process.env.NEXT_PUBLIC_ENABLE_CLAUDE === "true" ? workingDir : ""}
          onChangeDir={process.env.NEXT_PUBLIC_ENABLE_CLAUDE === "true" && room.type === "ai" ? handleChangeDir : undefined}
        />

        <MessageList
          roomId={room.id}
          initialMessages={initialMessages}
          currentUserId={currentUserId}
        />

        <TypingIndicator typingUsers={typingUsers} />

        <MessageInput
          roomId={room.id}
          currentUserId={currentUserId}
          hasBot={room.has_bot}
          botInvocationMode={botConfig?.invocation_mode ?? "always"}
          workingDir={workingDir}
          onTyping={setTyping}
        />
      </div>

      {showMembers && room.type !== "dm" && (
        <MembersPanel roomId={room.id} onClose={() => setShowMembers(false)} />
      )}
    </div>
  )
}
