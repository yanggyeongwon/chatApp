import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyWebhookSignature } from "@/lib/webhooks/signature"
import { parseWebhookPayload } from "@/lib/webhooks/parsers"
import { formatEventMessage } from "@/lib/webhooks/formatter"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params

  // Read raw body for signature verification
  const rawBody = await request.text()
  let payload: Record<string, unknown>

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Payload size check (1MB)
  if (rawBody.length > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  const supabase = await createClient()

  // Fetch webhook config
  const { data: webhook } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .eq("is_active", true)
    .single()

  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
  }

  // Extract headers
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  // Verify signature
  const isValid = verifyWebhookSignature(
    webhook.source_type,
    rawBody,
    headers,
    webhook.secret
  )

  if (!isValid) {
    // Log failed attempt
    await supabase.from("webhook_logs").insert({
      webhook_id: webhookId,
      payload,
      headers,
      status: "failed",
      error_message: "Invalid signature",
      processed_at: new Date().toISOString(),
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Determine event type
  let eventType = "unknown"
  if (webhook.source_type === "github") {
    eventType = headers["x-github-event"] ?? "unknown"
  } else if (webhook.source_type === "gitlab") {
    eventType = headers["x-gitlab-event"] ?? "unknown"
  } else {
    eventType = (payload.event as string) ?? "generic"
  }

  // Check event filters
  if (
    webhook.event_filters &&
    webhook.event_filters.length > 0 &&
    !webhook.event_filters.includes(eventType)
  ) {
    await supabase.from("webhook_logs").insert({
      webhook_id: webhookId,
      payload,
      headers,
      status: "filtered",
      processed_at: new Date().toISOString(),
    })
    return NextResponse.json({ status: "filtered" })
  }

  // Parse payload
  const parsedEvent = parseWebhookPayload(
    webhook.source_type,
    eventType,
    payload
  )

  if (!parsedEvent) {
    await supabase.from("webhook_logs").insert({
      webhook_id: webhookId,
      payload,
      headers,
      status: "filtered",
      error_message: `Unsupported event: ${eventType}`,
      processed_at: new Date().toISOString(),
    })
    return NextResponse.json({ status: "unsupported_event" })
  }

  // Format and insert message
  const messageContent = formatEventMessage(parsedEvent)

  const { data: message } = await supabase
    .from("messages")
    .insert({
      room_id: webhook.room_id,
      sender_id: webhook.created_by, // Use webhook creator as sender
      content: messageContent,
      type: "system",
      metadata: {
        source: "webhook",
        webhook_id: webhookId,
        webhook_name: webhook.name,
        source_type: webhook.source_type,
        event_type: eventType,
        parsed_event: parsedEvent,
      },
    })
    .select()
    .single()

  // Update room last_message_at
  await supabase
    .from("rooms")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", webhook.room_id)

  // Log success
  await supabase.from("webhook_logs").insert({
    webhook_id: webhookId,
    payload,
    headers,
    status: "success",
    message_id: message?.id,
    processed_at: new Date().toISOString(),
  })

  return NextResponse.json({ status: "ok", messageId: message?.id })
}
