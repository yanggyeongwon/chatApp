import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, description } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 })
  }

  // Insert room - RLS allows INSERT if created_by = auth.uid()
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      name: name.trim(),
      description: description?.trim() ?? "",
      type: "group",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (roomError) {
    // If RLS blocks select after insert, query by created_by + name
    const { data: fallbackRoom } = await supabase
      .from("rooms")
      .select("id")
      .eq("created_by", user.id)
      .eq("name", name.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!fallbackRoom) {
      return NextResponse.json({ error: "Failed to create room", detail: roomError.message }, { status: 500 })
    }

    // Add owner as member
    await supabase.from("room_members").insert({
      room_id: fallbackRoom.id,
      user_id: user.id,
      role: "owner",
    })

    return NextResponse.json({ roomId: fallbackRoom.id })
  }

  // Add owner as member
  await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: user.id,
    role: "owner",
  })

  return NextResponse.json({ roomId: room.id })
}
