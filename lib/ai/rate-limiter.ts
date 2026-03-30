import { createClient } from "@/lib/supabase/server"

const RATE_LIMIT_PER_HOUR = parseInt(
  process.env.AI_RATE_LIMIT_PER_HOUR ?? "20",
  10
)

export async function checkRateLimit(
  userId: string,
  botId: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const supabase = await createClient()
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  // Get or create rate limit entry
  const { data: existing } = await supabase
    .from("bot_rate_limits")
    .select("*")
    .eq("user_id", userId)
    .eq("bot_id", botId)
    .single()

  if (!existing) {
    // Create new entry
    await supabase.from("bot_rate_limits").insert({
      user_id: userId,
      bot_id: botId,
      window_start: now.toISOString(),
      request_count: 1,
    })
    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_HOUR - 1,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    }
  }

  const windowStart = new Date(existing.window_start)

  // If window expired, reset
  if (windowStart < oneHourAgo) {
    await supabase
      .from("bot_rate_limits")
      .update({
        window_start: now.toISOString(),
        request_count: 1,
      })
      .eq("id", existing.id)

    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_HOUR - 1,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    }
  }

  // Check count
  if (existing.request_count >= RATE_LIMIT_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(windowStart.getTime() + 60 * 60 * 1000),
    }
  }

  // Increment
  await supabase
    .from("bot_rate_limits")
    .update({ request_count: existing.request_count + 1 })
    .eq("id", existing.id)

  return {
    allowed: true,
    remaining: RATE_LIMIT_PER_HOUR - existing.request_count - 1,
    resetAt: new Date(windowStart.getTime() + 60 * 60 * 1000),
  }
}
