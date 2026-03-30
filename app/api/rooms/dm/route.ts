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

  const { targetUserId } = await request.json()

  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 })
  }

  // Check if DM room already exists between the two users
  const { data: existingRooms } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id)

  if (existingRooms && existingRooms.length > 0) {
    const roomIds = existingRooms.map((r) => r.room_id)

    for (const roomId of roomIds) {
      const { data: room } = await supabase
        .from("rooms")
        .select("id, type")
        .eq("id", roomId)
        .eq("type", "dm")
        .single()

      if (room) {
        const { data: targetMember } = await supabase
          .from("room_members")
          .select("id")
          .eq("room_id", room.id)
          .eq("user_id", targetUserId)
          .single()

        if (targetMember) {
          return NextResponse.json({ roomId: room.id })
        }
      }
    }
  }

  // Create new DM room - use raw insert without .select() to avoid RLS issue
  const { error: roomError } = await supabase
    .from("rooms")
    .insert({
      type: "dm",
      created_by: user.id,
    })

  if (roomError) {
    return NextResponse.json(
      { error: "Failed to create room", detail: roomError.message },
      { status: 500 }
    )
  }

  // Fetch the room we just created
  const { data: newRoom } = await supabase
    .from("rooms")
    .select("id")
    .eq("created_by", user.id)
    .eq("type", "dm")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!newRoom) {
    return NextResponse.json({ error: "Room created but not found" }, { status: 500 })
  }

  // Add both users as members
  await supabase.from("room_members").insert([
    { room_id: newRoom.id, user_id: user.id, role: "member" },
    { room_id: newRoom.id, user_id: targetUserId, role: "member" },
  ])

  return NextResponse.json({ roomId: newRoom.id })
}
