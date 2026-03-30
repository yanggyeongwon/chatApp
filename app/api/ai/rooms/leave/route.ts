import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { room_id } = await request.json()
  if (!room_id) return NextResponse.json({ error: "room_id required" }, { status: 400 })

  // RAG 문서 삭제
  const { data: ragDocs } = await supabase
    .from("rag_documents")
    .select("id, storage_path")
    .eq("room_id", room_id)

  console.log("[leave] room:", room_id, "ragDocs:", ragDocs?.length ?? 0)
  if (ragDocs && ragDocs.length > 0) {
    const paths = ragDocs
      .map((d) => d.storage_path)
      .filter((p): p is string => !!p && !p.startsWith("http"))
    if (paths.length > 0) {
      await supabase.storage.from("rag-documents").remove(paths)
    }
    for (const doc of ragDocs) {
      await supabase.from("rag_documents").delete().eq("id", doc.id)
    }
  }

  // 멤버십 삭제
  await supabase
    .from("room_members")
    .delete()
    .eq("room_id", room_id)
    .eq("user_id", user.id)

  return NextResponse.json({ success: true })
}
