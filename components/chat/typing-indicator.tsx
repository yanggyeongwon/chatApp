"use client"

import type { TypingUser } from "@/lib/types/chat"

export function TypingIndicator({ typingUsers }: { typingUsers: TypingUser[] }) {
  if (typingUsers.length === 0) return null

  const names = typingUsers.map((u) => u.username)
  let text: string
  if (names.length === 1) {
    text = `${names[0]}님이 입력 중`
  } else if (names.length === 2) {
    text = `${names[0]}님, ${names[1]}님이 입력 중`
  } else {
    text = `${names[0]}님 외 ${names.length - 1}명이 입력 중`
  }

  return (
    <div className="px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 min-h-[28px]">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
      </span>
      <span>{text}</span>
    </div>
  )
}
