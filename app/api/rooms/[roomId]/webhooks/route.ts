import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { randomBytes } from "crypto"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 })
  }

  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("id, name, source_type, event_filters, is_active, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ webhooks: webhooks ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify admin/owner
  const { data: membership } = await supabase
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const { name, source_type, event_filters } = await request.json()

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 })
  }

  const secret = randomBytes(32).toString("hex")

  const { data: webhook, error } = await supabase
    .from("webhooks")
    .insert({
      room_id: roomId,
      name,
      secret,
      source_type: source_type ?? "generic",
      event_filters: event_filters ?? [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error || !webhook) {
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }

  // Return with plaintext secret (shown only once)
  return NextResponse.json({
    webhook: {
      id: webhook.id,
      name: webhook.name,
      source_type: webhook.source_type,
      event_filters: webhook.event_filters,
      url: `${request.headers.get("origin") ?? ""}/api/webhooks/${webhook.id}`,
      secret, // Only shown once
    },
  })
}
