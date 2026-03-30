import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("room_id")
  if (!roomId) return new Response("room_id required", { status: 400 })

  const encoder = new TextEncoder()
  let lastHash = ""

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try { controller.enqueue(encoder.encode(`data: ${data}\n\n`)) } catch { /* closed */ }
      }

      let active = true
      request.signal.addEventListener("abort", () => { active = false })

      // 즉시 첫 데이터 전송
      try {
        const { data } = await supabase
          .from("messages")
          .select(`*, sender:profiles!sender_id(*), attachments:message_attachments(*)`)
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(100)

        if (data && data.length > 0) {
          lastHash = `${data.length}:${data[data.length - 1]?.id}:${data[data.length - 1]?.is_streaming}:${(data[data.length - 1]?.content ?? "").length}`
          send(JSON.stringify(data))
        }
      } catch { /* ignore */ }

      // 1.5초마다 변경 감지
      while (active) {
        await new Promise((r) => setTimeout(r, 1500))
        if (!active) break

        try {
          const { data } = await supabase
            .from("messages")
            .select(`*, sender:profiles!sender_id(*), attachments:message_attachments(*)`)
            .eq("room_id", roomId)
            .order("created_at", { ascending: true })
            .limit(100)

          if (data && data.length > 0) {
            const last = data[data.length - 1]
            const hash = `${data.length}:${last?.id}:${last?.is_streaming}:${(last?.content ?? "").length}`
            if (hash !== lastHash) {
              lastHash = hash
              send(JSON.stringify(data))
            }
          }
        } catch { /* ignore */ }
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
