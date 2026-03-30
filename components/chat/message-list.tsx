"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { MessageItem } from "@/components/chat/message-item"
import type { Message } from "@/lib/types/chat"

const supabase = createClient()

export function MessageList({
  roomId,
  initialMessages,
  currentUserId,
}: {
  roomId: string
  initialMessages: Message[]
  currentUserId: string
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [myLastReadAt, setMyLastReadAt] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(initialMessages.length)
  const initialScrollDone = useRef(false)

  // 최초 맨 아래로
  useEffect(() => {
    if (!initialScrollDone.current) {
      bottomRef.current?.scrollIntoView()
      initialScrollDone.current = true
    }
  }, [])

  // 새 메시지 시 스크롤
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevCountRef.current = messages.length
  }, [messages])

  // 메시지 전체 로드
  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select(`*, sender:profiles!sender_id(*), attachments:message_attachments(*)`)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100)
    if (data && data.length > 0) setMessages(data as Message[])
  }, [roomId])

  // 내 last_read_at 조회
  useEffect(() => {
    supabase
      .from("room_members")
      .select("last_read_at")
      .eq("room_id", roomId)
      .eq("user_id", currentUserId)
      .single()
      .then(({ data }: { data: { last_read_at: string } | null }) => {
        if (data) setMyLastReadAt(data.last_read_at)
      })
  }, [roomId, currentUserId])

  // 읽음 처리
  const markAsRead = useCallback(() => {
    if (document.visibilityState === "visible") {
      fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId }),
      }).then(() => {
        setMyLastReadAt(new Date().toISOString())
      }).catch(() => {})
    }
  }, [roomId])

  // 방 입장 시 읽음 처리
  useEffect(() => {
    markAsRead()
    document.addEventListener("visibilitychange", markAsRead)
    return () => document.removeEventListener("visibilitychange", markAsRead)
  }, [markAsRead])

  // Supabase Realtime 구독 + 폴링 fallback
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let realtimeWorking = false

    const channel = supabase
      .channel(`room:${roomId}:msgs`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        () => {
          realtimeWorking = true
          fetchMessages()
          markAsRead()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        () => {
          realtimeWorking = true
          fetchMessages()
        }
      )
      .subscribe()

    // 폴링 fallback — Realtime 안 오면 3초마다
    pollTimer = setInterval(() => {
      if (!realtimeWorking) fetchMessages()
    }, 3000)

    // 5초 후에도 Realtime 안 오면 폴링 유지, 오면 폴링 중지
    setTimeout(() => {
      if (realtimeWorking && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [roomId, fetchMessages, markAsRead])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isOwn={message.sender_id === currentUserId}
          isUnread={!!(myLastReadAt && message.created_at > myLastReadAt && message.sender_id !== currentUserId)}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
