import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseDocument, estimateTokens, determineStrategy, chunkText } from "@/lib/ai/rag-parser"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contentType = request.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")

  if (isJson) {
    const body = await request.json()
    const roomId = body.room_id as string
    if (!roomId) return NextResponse.json({ error: "room_id required" }, { status: 400 })

    const { data: membership } = await supabase
      .from("room_members").select("*").eq("room_id", roomId).eq("user_id", user.id).single()
    if (!membership) return NextResponse.json({ error: "Not a room member" }, { status: 403 })

    // === URL 모드 ===
    if (body.url) {
      const url = body.url as string
      const hostname = new URL(url).hostname
      const { data: doc, error: insertError } = await supabase
        .from("rag_documents")
        .insert({
          room_id: roomId,
          uploaded_by: user.id,
          file_name: hostname,
          file_type: "text/uri",
          file_size: 0,
          storage_path: url,
          strategy: "context_stuffing",
          status: "ready",
          parsed_text: null,
        })
        .select()
        .single()

      if (insertError || !doc) {
        return NextResponse.json({ error: `Failed: ${insertError?.message}` }, { status: 500 })
      }
      return NextResponse.json({ documentId: doc.id, strategy: "url", status: "ready" })
    }

    // === 파일 모드 (Storage에 이미 업로드됨, 서버에서 다운로드 후 파싱) ===
    if (body.storage_path) {
      const sp = body.storage_path as string
      const fileName = (body.file_name as string) || sp.split("/").pop() || "document"
      const fileType = (body.file_type as string) || "application/octet-stream"
      const fileSize = (body.file_size as number) || 0

      try {
        const { data: fileData, error: dlError } = await supabase.storage
          .from("rag-documents")
          .download(sp)
        if (dlError || !fileData) {
          return NextResponse.json({ error: `Storage download: ${dlError?.message}` }, { status: 500 })
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())
        const { text, pages } = await parseDocument(buffer, fileType)
        const tokenCount = estimateTokens(text)
        const strategy = determineStrategy(tokenCount)

        const { data: doc, error: insertError } = await supabase
          .from("rag_documents")
          .insert({
            room_id: roomId,
            uploaded_by: user.id,
            file_name: fileName,
            file_type: fileType,
            file_size: fileSize,
            storage_path: sp,
            parsed_text: strategy === "context_stuffing" ? text : null,
            token_count: tokenCount,
            strategy,
            status: "ready",
          })
          .select()
          .single()

        if (insertError || !doc) {
          return NextResponse.json({ error: `DB: ${insertError?.message}` }, { status: 500 })
        }

        if (strategy === "vectorized") {
          const chunks = chunkText(text, pages)
          const chunkRows = chunks.map((chunk) => ({
            document_id: doc.id, room_id: roomId,
            chunk_index: chunk.index, content: chunk.content,
            token_count: chunk.tokenCount, metadata: chunk.metadata,
          }))
          for (let i = 0; i < chunkRows.length; i += 100) {
            await supabase.from("rag_chunks").insert(chunkRows.slice(i, i + 100))
          }
        }

        return NextResponse.json({ documentId: doc.id, strategy, tokenCount, status: "ready" })
      } catch (error) {
        console.error("[rag-upload] file parse error:", error)
        return NextResponse.json({ error: `Parse: ${error instanceof Error ? error.message : "Unknown"}` }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "url or storage_path required" }, { status: 400 })
  }

  // === 파일 모드 ===
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    // FormData 파싱 실패 (파일 너무 큼) → Storage에서 가져오기 시도
    console.error("[rag-upload] formData too large, trying to parse from request body")
    return NextResponse.json({ error: "File too large for direct upload. Max 10MB." }, { status: 413 })
  }

  const file = formData.get("file") as File | null
  const roomId = formData.get("room_id") as string ?? ""
  const storagePath = formData.get("storage_path") as string ?? ""
  if (!roomId) return NextResponse.json({ error: "room_id required" }, { status: 400 })

  const { data: membership } = await supabase
    .from("room_members").select("*").eq("room_id", roomId).eq("user_id", user.id).single()
  if (!membership) return NextResponse.json({ error: "Not a room member" }, { status: 403 })

  try {
    let buffer: Buffer
    let fileName: string
    let fileType: string
    let fileSize: number

    if (file && file.size > 0) {
      // FormData에 파일이 있음
      buffer = Buffer.from(await file.arrayBuffer())
      fileName = file.name
      fileType = file.type || "application/octet-stream"
      fileSize = file.size
    } else if (storagePath) {
      // 파일이 없으면 Storage에서 다운로드
      const { data: fileData, error: dlError } = await supabase.storage
        .from("rag-documents")
        .download(storagePath)
      if (dlError || !fileData) {
        return NextResponse.json({ error: `Storage download failed: ${dlError?.message}` }, { status: 500 })
      }
      buffer = Buffer.from(await fileData.arrayBuffer())
      fileName = storagePath.split("/").pop() ?? "document"
      fileType = fileName.endsWith(".pdf") ? "application/pdf" : "text/plain"
      fileSize = buffer.length
    } else {
      return NextResponse.json({ error: "file or storage_path required" }, { status: 400 })
    }

    const { text, pages } = await parseDocument(buffer, fileType)
    const tokenCount = estimateTokens(text)
    const strategy = determineStrategy(tokenCount)

    // 2) DB insert
    const { data: doc, error: insertError } = await supabase
      .from("rag_documents")
      .insert({
        room_id: roomId,
        uploaded_by: user.id,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath || "",
        parsed_text: strategy === "context_stuffing" ? text : null,
        token_count: tokenCount,
        strategy,
        status: "ready",
      })
      .select()
      .single()

    if (insertError || !doc) {
      console.error("[rag-upload] DB insert error:", insertError)
      return NextResponse.json({ error: `DB error: ${insertError?.message ?? "unknown"}` }, { status: 500 })
    }

    // 4) 벡터화 필요 시 청크 생성
    if (strategy === "vectorized") {
      const chunks = chunkText(text, pages)
      const chunkRows = chunks.map((chunk) => ({
        document_id: doc.id, room_id: roomId,
        chunk_index: chunk.index, content: chunk.content,
        token_count: chunk.tokenCount, metadata: chunk.metadata,
      }))
      for (let i = 0; i < chunkRows.length; i += 100) {
        await supabase.from("rag_chunks").insert(chunkRows.slice(i, i + 100))
      }
    }

    return NextResponse.json({ documentId: doc.id, strategy, tokenCount, status: "ready" })
  } catch (error) {
    console.error("[rag-upload] processing error:", error)
    return NextResponse.json({
      error: `Processing failed: ${error instanceof Error ? error.message : "Unknown"}`,
    }, { status: 500 })
  }
}
