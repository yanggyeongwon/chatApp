"use client"

import { useEffect, useRef, useState } from "react"
import { MessageItem } from "@/components/chat/message-item"
import type { Message } from "@/lib/types/chat"

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(initialMessages.length)
  const initialScrollDone = useRef(false)

  useEffect(() => {
    if (!initialScrollDone.current) {
      bottomRef.current?.scrollIntoView()
      initialScrollDone.current = true
    }
  }, [])

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
    prevCountRef.current = messages.length
  }, [messages])

  // SSE 연결
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let active = true

    const connect = () => {
      if (!active) return
      es = new EventSource(`/api/ai/messages/stream?room_id=${roomId}`)

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as Message[]
          if (active && data.length > 0) setMessages(data)
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        es?.close()
        if (active) reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      active = false
      es?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [roomId])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isOwn={message.sender_id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
