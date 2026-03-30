"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { RoomItem } from "@/components/chat/room-item"
import { Skeleton } from "@/components/ui/skeleton"
import type { RoomWithPreview } from "@/lib/types/chat"

export function RoomList({ searchQuery }: { searchQuery: string }) {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<RoomWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    const fetchRooms = async () => {
      const { data } = await supabase
        .from("room_members")
        .select(
          `
          room_id,
          rooms (
            id, name, type, has_bot, avatar_url, last_message_at, created_at
          )
        `
        )
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })

      if (data) {
        type RoomMemberRow = { room_id: string; rooms: RoomWithPreview }
        const roomList = (data as unknown as RoomMemberRow[])
          .map((item: RoomMemberRow) => item.rooms)
          .filter(Boolean)
          .sort(
            (a: RoomWithPreview, b: RoomWithPreview) =>
              new Date(b.last_message_at).getTime() -
              new Date(a.last_message_at).getTime()
          )

        // DM 방의 상대방 이름 조회
        const dmRooms = roomList.filter((r) => r.type === "dm")
        if (dmRooms.length > 0) {
          const { data: dmMembers } = await supabase
            .from("room_members")
            .select("room_id, user_id, profiles:profiles!user_id(username, avatar_url)")
            .in("room_id", dmRooms.map((r) => r.id))
            .neq("user_id", user.id)

          if (dmMembers) {
            const partnerMap = new Map<string, { name: string; avatar: string | null }>()
            for (const m of dmMembers as Array<{ room_id: string; user_id: string; profiles: { username: string; avatar_url: string | null } }>) {
              if (m.profiles) partnerMap.set(m.room_id, { name: m.profiles.username, avatar: m.profiles.avatar_url })
            }
            for (const room of roomList) {
              if (room.type === "dm") {
                const partner = partnerMap.get(room.id)
                if (partner) {
                  room.dmPartnerName = partner.name
                  room.dmPartnerAvatar = partner.avatar
                }
              }
            }
          }
        }

        setRooms(roomList)
      }
      setLoading(false)
    }

    fetchRooms()

    // 5초마다 폴링 (Realtime 대신 확실한 갱신)
    const interval = setInterval(fetchRooms, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [user, supabase])

  const filteredRooms = rooms.filter((room) => {
    if (!searchQuery) return true
    return room.name?.toLowerCase().includes(searchQuery.toLowerCase())
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
