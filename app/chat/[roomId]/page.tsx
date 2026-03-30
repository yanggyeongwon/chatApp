import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChatRoom } from "@/components/chat/chat-room"

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Verify user is a member of this room
  const { data: membership } = await supabase
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  if (!membership) redirect("/chat")

  // Fetch room info
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single()

  if (!room) redirect("/chat")

  // Fetch initial messages (latest 50)
  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      *,
      sender:profiles!sender_id(*),
      attachments:message_attachments(*)
    `
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(50)

  // Fetch bot config if room has a bot
  let botConfig = null
  if (room.has_bot) {
    const { data } = await supabase
      .from("bot_room_configs")
      .select("*")
      .eq("room_id", roomId)
      .eq("is_active", true)
      .single()
    botConfig = data
  }

  return (
    <ChatRoom
      room={room}
      initialMessages={(messages ?? []).reverse()}
      currentUserId={user.id}
      botConfig={botConfig}
    />
  )
}
