"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TypingUser } from "@/lib/types/chat"
import type { RealtimeChannel } from "@supabase/supabase-js"

const TYPING_TIMEOUT_MS = 3000

type PresenceState = {
  userId: string
  username: string
  avatarUrl: string | null
  isTyping: boolean
}

export function useTypingPresence(
  roomId: string,
  currentUserId: string,
  currentUsername: string,
  currentAvatarUrl: string | null
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}:presence`, {
      config: { presence: { key: currentUserId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const users: TypingUser[] = []

        for (const [key, presences] of Object.entries(state)) {
          if (key === currentUserId) continue
          const arr = presences as PresenceState[]
          const latest = arr[arr.length - 1]
          if (latest?.isTyping) {
            users.push({
              userId: latest.userId,
              username: latest.username,
              avatarUrl: latest.avatarUrl,
            })
          }
        }

        setTypingUsers(users)
      })
      .subscribe()

    // Track initial presence after a short delay to ensure subscription is ready
    const trackTimeout = setTimeout(() => {
      channel.track({
        userId: currentUserId,
        username: currentUsername,
        avatarUrl: currentAvatarUrl,
        isTyping: false,
      } satisfies PresenceState)
    }, 500)

    channelRef.current = channel

    return () => {
      clearTimeout(trackTimeout)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [roomId, currentUserId, currentUsername, currentAvatarUrl, supabase])

  const setTyping = useCallback(
    (typing: boolean) => {
      const channel = channelRef.current
      if (!channel) return

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }

      if (typing) {
        // Only broadcast if not already typing
        if (!isTypingRef.current) {
          isTypingRef.current = true
          channel.track({
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentAvatarUrl,
            isTyping: true,
          } satisfies PresenceState)
        }

        // Auto-stop after timeout
        typingTimeoutRef.current = setTimeout(() => {
          isTypingRef.current = false
          channel.track({
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentAvatarUrl,
            isTyping: false,
          } satisfies PresenceState)
        }, TYPING_TIMEOUT_MS)
      } else {
        if (isTypingRef.current) {
          isTypingRef.current = false
          channel.track({
            userId: currentUserId,
            username: currentUsername,
            avatarUrl: currentAvatarUrl,
            isTyping: false,
          } satisfies PresenceState)
        }
      }
    },
    [currentUserId, currentUsername, currentAvatarUrl]
  )

  return { typingUsers, setTyping }
}
