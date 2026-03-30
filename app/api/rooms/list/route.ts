import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ rooms: [] })

  // 방 목록 + last_read_at
  const { data: memberships } = await supabase
    .from("room_members")
    .select(`room_id, last_read_at, rooms(id, name, type, has_bot, avatar_url, last_message_at, created_at)`)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })

  if (!memberships) return NextResponse.json({ rooms: [] })

  const rooms = memberships
    .map((m: Record<string, unknown>) => ({
      ...(m.rooms as Record<string, unknown>),
      last_read_at: m.last_read_at,
    }))
    .filter((r: Record<string, unknown>) => r.id)
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(b.last_message_at as string).getTime() - new Date(a.last_message_at as string).getTime()
    )

  // DM 파트너 이름
  const dmRoomIds = rooms.filter((r: Record<string, unknown>) => r.type === "dm").map((r: Record<string, unknown>) => r.id as string)
  if (dmRoomIds.length > 0) {
    const { data: dmMembers } = await supabase
      .from("room_members")
      .select("room_id, profiles:profiles!user_id(username, avatar_url)")
      .in("room_id", dmRoomIds)
      .neq("user_id", user.id)

    if (dmMembers) {
      const partnerMap = new Map<string, { name: string; avatar: string | null }>()
      for (const m of dmMembers as unknown as Array<{ room_id: string; profiles: { username: string; avatar_url: string | null } }>) {
        if (m.profiles) partnerMap.set(m.room_id, { name: m.profiles.username, avatar: m.profiles.avatar_url })
      }
      for (const room of rooms) {
        const r = room as Record<string, unknown>
        if (r.type === "dm") {
          const partner = partnerMap.get(r.id as string)
          if (partner) {
            r.dmPartnerName = partner.name
            r.dmPartnerAvatar = partner.avatar
          }
        }
      }
    }
  }

  // 안 읽은 메시지 카운트
  for (const room of rooms) {
    const r = room as Record<string, unknown>
    const lastRead = r.last_read_at as string
    if (lastRead) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", r.id as string)
        .gt("created_at", lastRead)
        .neq("sender_id", user.id)
      r.unread_count = count ?? 0
    }
  }

  return NextResponse.json({ rooms })
}
