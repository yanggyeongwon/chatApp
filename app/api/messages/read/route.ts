import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { room_id } = await request.json()
  if (!room_id) return NextResponse.json({ error: "room_id required" }, { status: 400 })

  await supabase
    .from("room_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", room_id)
    .eq("user_id", user.id)

  return NextResponse.json({ success: true })
}
