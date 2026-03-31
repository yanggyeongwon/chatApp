"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { RoomItem } from "@/components/chat/room-item"
import { Skeleton } from "@/components/ui/skeleton"
import type { RoomWithPreview } from "@/lib/types/chat"

export function RoomList({ searchQuery }: { searchQuery: string }) {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<RoomWithPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let lastHash = ""
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/rooms/list")
        if (!res.ok) return
        const data = await res.json()
        if (data.rooms) {
          // 데이터가 같으면 업데이트 안 함 (리렌더링 방지)
          const hash = JSON.stringify(data.rooms.map((r: RoomWithPreview) => `${r.id}:${r.last_message_at}:${r.unread_count ?? 0}`))
          if (hash !== lastHash) {
            lastHash = hash
            setRooms(data.rooms as RoomWithPreview[])
          }
        }
      } catch {
        // 에러 시 기존 유지
      }
      setLoading(false)
    }

    fetchRooms()

    // 5초마다 폴링
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [user])

  const filteredRooms = rooms.filter((room) => {
    if (!searchQuery) return true
    const name = room.dmPartnerName || room.name || ""
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filteredRooms.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {searchQuery ? "검색 결과가 없습니다." : "채팅방이 없습니다."}
      </div>
    )
  }

  const handleLeave = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId))
  }

  return (
    <div className="space-y-0.5 p-2">
      {filteredRooms.map((room) => (
        <RoomItem key={room.id} room={room} onLeave={handleLeave} />
      ))}
    </div>
  )
}
