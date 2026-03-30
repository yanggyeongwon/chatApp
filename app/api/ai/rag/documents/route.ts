import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room_id")
  if (!roomId) return NextResponse.json({ error: "room_id required" }, { status: 400 })

  const { data: documents } = await supabase
    .from("rag_documents")
    .select("id, room_id, file_name, file_type, file_size, token_count, strategy, status, error_message, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ documents: documents ?? [] })
}
