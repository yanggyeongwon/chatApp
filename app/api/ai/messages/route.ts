import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room_id")
  if (!roomId) return NextResponse.json([], { status: 200 })

  const { data } = await supabase
    .from("messages")
    .select(`*, sender:profiles!sender_id(*), attachments:message_attachments(*)`)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(100)

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { room_id, content, type } = await request.json()
  if (!room_id || !content) return NextResponse.json({ error: "room_id and content required" }, { status: 400 })

  const { error } = await supabase
    .from("messages")
    .insert({ room_id, sender_id: user.id, content, type: type || "text" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // rooms 업데이트
  await supabase.from("rooms").update({ last_message_at: new Date().toISOString() }).eq("id", room_id)

  return NextResponse.json({ success: true })
}
