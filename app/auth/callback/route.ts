import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error_description = searchParams.get("error_description")
  const next = searchParams.get("next") ?? "/chat"

  if (error_description) {
    console.error("[auth callback] error:", error_description)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_description)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error("[auth callback] exchange error:", error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
