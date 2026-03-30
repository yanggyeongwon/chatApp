import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET: 멤버 목록 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, role, joined_at, profiles:profiles!user_id(id, username, full_name, avatar_url, is_online)")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true })

  return NextResponse.json({ members: members ?? [] })
}

// POST: 멤버 초대
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { user_ids } = await request.json()
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return NextResponse.json({ error: "user_ids required" }, { status: 400 })
  }

  // 요청자가 멤버인지 확인
  const { data: myMembership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  if (!myMembership) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  // 이미 멤버인 유저 제외
  const { data: existing } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .in("user_id", user_ids)

  const existingIds = new Set((existing ?? []).map((m) => m.user_id))
  const newUserIds = user_ids.filter((id: string) => !existingIds.has(id))

  if (newUserIds.length === 0) {
    return NextResponse.json({ message: "All users already members" })
  }

  // 멤버 추가
  const rows = newUserIds.map((uid: string) => ({
    room_id: roomId, user_id: uid, role: "member",
  }))
  await supabase.from("room_members").insert(rows)

  // 시스템 메시지
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username")
    .in("id", newUserIds)

  const names = (profiles ?? []).map((p) => p.username).join(", ")
  await supabase.from("messages").insert({
    room_id: roomId,
    sender_id: user.id,
    content: `${names}님이 초대되었습니다.`,
    type: "system",
  })

  return NextResponse.json({ invited: newUserIds.length })
}

// DELETE: 멤버 강퇴
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { user_id } = await request.json()

  // 요청자가 owner/admin인지 확인
  const { data: myRole } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  if (!myRole || (myRole.role !== "owner" && myRole.role !== "admin")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 })
  }

  await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user_id)

  return NextResponse.json({ success: true })
}
