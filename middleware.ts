import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  // Webhook endpoints are public (called by external services)
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next()
  }

  // RAG upload은 middleware body size 제한 우회
  if (request.nextUrl.pathname.startsWith("/api/ai/rag/upload")) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
