import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query_log_id, feedback } = await request.json()
  if (!query_log_id || !["helpful", "not_helpful"].includes(feedback)) {
    return NextResponse.json({ error: "query_log_id and feedback (helpful/not_helpful) required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("rag_query_logs")
    .update({ user_feedback: feedback })
    .eq("id", query_log_id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
