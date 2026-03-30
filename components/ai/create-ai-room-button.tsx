"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function CreateAIRoomButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/ai/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.roomId) {
        // Navigate immediately - connection check happens in background
        router.push(`/chat/${data.roomId}`)
      } else {
        console.error("Failed to create AI room:", data.error)
      }
    } catch (error) {
      console.error("Failed to create AI room:", error)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-sm transition-colors hover:bg-sidebar-accent text-purple-600"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
        +
      </span>
      <span className="font-medium">
        {loading ? "생성 중..." : "새 Claude Code 채팅"}
      </span>
    </button>
  )
}
