import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 문서 조회
  const { data: doc, error: selectError } = await supabase
    .from("rag_documents")
    .select("id, storage_path, room_id")
    .eq("id", documentId)
    .single()

  if (selectError || !doc) {
    // RLS로 SELECT 안 되면 직접 삭제 시도 (CASCADE가 이미 처리했을 수 있음)
    await supabase.from("rag_documents").delete().eq("id", documentId)
    return NextResponse.json({ success: true })
  }

  // Storage 파일 삭제 (URL이 아닌 경우만)
  if (doc.storage_path && !doc.storage_path.startsWith("http")) {
    await supabase.storage.from("rag-documents").remove([doc.storage_path])
  }

  // DB 삭제 (chunks는 CASCADE)
  await supabase.from("rag_documents").delete().eq("id", documentId)

  return NextResponse.json({ success: true })
}
