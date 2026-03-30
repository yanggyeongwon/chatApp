"use client"

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ClipboardEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSkillContext } from "@/lib/hooks/use-skill-context"
import { useRagContext } from "@/lib/hooks/use-rag-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type FileItem = string

export function MessageInput({
  roomId,
  currentUserId,
  hasBot = false,
  botInvocationMode = "always",
  workingDir = "",
  onTyping,
}: {
  roomId: string
  currentUserId: string
  hasBot?: boolean
  botInvocationMode?: "always" | "mention"
  workingDir?: string
  onTyping?: (typing: boolean) => void
}) {
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [pastedImages, setPastedImages] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ragFileInputRef = useRef<HTMLInputElement>(null)
  const fileListRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { showSkills, setShowSkills, pendingSkill, setPendingSkill } = useSkillContext()
  const { showRagPanel, setShowRagPanel, ragDocuments, refreshDocuments, setCurrentRoomId, setIsSearching, setUploadingFileName, setUploadProgress, setUploadStep } = useRagContext()
  const [showRagMenu, setShowRagMenu] = useState(false)
  const [showRagUrlInput, setShowRagUrlInput] = useState(false)
  const [ragUrlValue, setRagUrlValue] = useState("")
  const [ragUrlLoading, setRagUrlLoading] = useState(false)

  // RAG: roomId가 바뀌면 문서 목록 갱신
  useEffect(() => {
    setCurrentRoomId(roomId)
    // setCurrentRoomId 이후 ref가 업데이트되므로 약간의 딜레이
    const timer = setTimeout(() => refreshDocuments(), 100)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // @ mention autocomplete state
  const [showFiles, setShowFiles] = useState(false)
  const [fileQuery, setFileQuery] = useState("")
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFileIdx, setSelectedFileIdx] = useState(0)
  const [atPosition, setAtPosition] = useState(-1)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipChangeRef = useRef(false)

  // Auto-fill when a skill is selected from the panel
  useEffect(() => {
    if (pendingSkill) {
      setContent(pendingSkill)
      setPendingSkill(null)
      textareaRef.current?.focus()
    }
  }, [pendingSkill, setPendingSkill])

  // Fetch files when query changes
  const fetchFiles = useCallback(async (query: string) => {
    try {
      const dirParam = workingDir ? `&dir=${encodeURIComponent(workingDir)}` : ""
      const res = await fetch(`/api/ai/files?q=${encodeURIComponent(query)}${dirParam}`)
      const data = await res.json()
      setFiles(data.files ?? [])
      setSelectedFileIdx(0)
    } catch {
      setFiles([])
    }
  }, [workingDir])

  useEffect(() => {
    if (!showFiles) return
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(() => fetchFiles(fileQuery), 150)
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current) }
  }, [fileQuery, showFiles, fetchFiles])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)

    // Broadcast typing state
    if (val.trim().length > 0) {
      onTyping?.(true)
    } else {
      onTyping?.(false)
    }

    // Skip @ detection if programmatically set (e.g. folder drill-down)
    if (skipChangeRef.current) {
      skipChangeRef.current = false
      return
    }

    // Detect @ mention
    const cursorPos = e.target.selectionStart ?? val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const lastAtIdx = textBeforeCursor.lastIndexOf("@")

    if (lastAtIdx >= 0) {
      const charBefore = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : " "
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1)
      // Only trigger if @ is at start or after a space, and no space in query
      if ((charBefore === " " || charBefore === "\n" || lastAtIdx === 0) && !textAfterAt.includes(" ")) {
        setShowFiles(true)
        setFileQuery(textAfterAt)
        setAtPosition(lastAtIdx)
        return
      }
    }
    setShowFiles(false)
  }

  const scrollToItem = (idx: number) => {
    const container = fileListRef.current
    if (!container) return
    const item = container.querySelector(`[data-idx="${idx}"]`) as HTMLElement
    if (item) {
      item.scrollIntoView({ block: "nearest" })
    }
  }

  const selectFile = async (file: string) => {
    // Everything before the @
    const before = content.slice(0, atPosition)
    // Find where the current @query ends (first space after @ or end of string)
    const afterAt = content.slice(atPosition + 1) // text after @
    const spaceIdx = afterAt.indexOf(" ")
    const afterQuery = spaceIdx >= 0 ? afterAt.slice(spaceIdx) : ""

    if (file.endsWith("/")) {
      // Folder: drill into it, replace @query with @folder/
      const newContent = `${before}@${file}${afterQuery}`
      skipChangeRef.current = true
      setContent(newContent)
      setFileQuery(file)
      setSelectedFileIdx(0)
      setShowFiles(true)

      // Fetch children
      const dirParam = workingDir ? `&dir=${encodeURIComponent(workingDir)}` : ""
      try {
        const res = await fetch(`/api/ai/files?q=${encodeURIComponent(file)}${dirParam}`)
        const data = await res.json()
        setFiles(data.files ?? [])
        setSelectedFileIdx(0)
      } catch {
        setFiles([])
      }
      textareaRef.current?.focus()
    } else {
      // File: insert and close
      const newContent = `${before}@${file} ${afterQuery}`
      setContent(newContent)
      setShowFiles(false)
      setFiles([])
      textareaRef.current?.focus()
    }
  }

  const uploadFile = async (file: File, messageId: string) => {
    const path = `${roomId}/${messageId}/${file.name}`
    const { data } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false })

    if (data) {
      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(data.path)

      await supabase.from("message_attachments").insert({
        message_id: messageId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: data.path,
        url: urlData.publicUrl,
      })
    }
  }

  const sendMessage = () => {
    const trimmed = content.trim()
    if ((!trimmed && pastedImages.length === 0) || sending) return

    // 즉시 UI 초기화 (async 전에)
    const msgContent = trimmed || (pastedImages.length > 0 ? "[이미지]" : "")
    const msgType = pastedImages.length > 0 ? "image" : "text"
    const imagesToSend = [...pastedImages]

    setSending(true)
    onTyping?.(false)
    if (textareaRef.current) {
      textareaRef.current.blur()
      textareaRef.current.value = ""
    }
    setContent("")
    setPastedImages([])
    setShowFiles(false)

    // 3초 안전장치: 어떤 상황에서도 sending 해제
    const safetyTimer = setTimeout(() => {
      setSending(false)
      textareaRef.current?.focus()
    }, 3000)

    // 비동기 작업 시작 — fetch로 직접 (SDK lock 문제 우회)
    ;(async () => {
      try {
        await fetch("/api/ai/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId, content: msgContent, type: msgType }),
        })

        if (imagesToSend.length > 0) {
          const { data: latestMsg } = await supabase
            .from("messages")
            .select("id")
            .eq("room_id", roomId)
            .eq("sender_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()
          if (latestMsg) {
            for (const img of imagesToSend) {
              await uploadFile(img, latestMsg.id)
            }
          }
        }
      } catch (err) {
        console.error("Send message error:", err)
      }

      // INSERT 완료 즉시 해제
      clearTimeout(safetyTimer)
      setSending(false)
      setTimeout(() => textareaRef.current?.focus(), 50)

      // rooms 업데이트는 POST에서 이미 처리됨

      const shouldTriggerBot =
        hasBot &&
        (botInvocationMode === "always" ||
          (botInvocationMode === "mention" && /@claude/i.test(trimmed)))

      if (shouldTriggerBot) {
        if (ragDocuments.length > 0) setIsSearching(true)
        fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId }),
        })
          .finally(() => setIsSearching(false))
          .catch(() => {})
      }
    })()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return

    // File autocomplete navigation
    if (showFiles && files.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedFileIdx((prev) => {
          const next = Math.min(prev + 1, files.length - 1)
          scrollToItem(next)
          return next
        })
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedFileIdx((prev) => {
          const next = Math.max(prev - 1, 0)
          scrollToItem(next)
          return next
        })
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        selectFile(files[selectedFileIdx])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowFiles(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const images: File[] = []
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) images.push(file)
      }
    }

    if (images.length > 0) {
      e.preventDefault()
      setPastedImages((prev) => [...prev, ...images])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (fileList) {
      setPastedImages((prev) => [...prev, ...Array.from(fileList)])
    }
    e.target.value = ""
  }

  const removeImage = (index: number) => {
    setPastedImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t bg-background relative">
      {/* @ File autocomplete popup */}
      {showFiles && files.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="max-h-[320px] overflow-y-auto" ref={fileListRef}>
            {files.map((file, i) => {
              const isDir = file.endsWith("/")
              return (
                <button
                  key={file}
                  data-idx={i}
                  onClick={() => selectFile(file)}
                  onMouseEnter={() => setSelectedFileIdx(i)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors",
                    i === selectedFileIdx ? "bg-accent" : "hover:bg-muted"
                  )}
                >
                  {isDir ? (
                    <svg className="h-4 w-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="truncate font-mono text-xs">{file}</span>
                </button>
              )
            })}
          </div>
          <div className="px-3 py-1.5 border-t bg-muted/50 text-[10px] text-muted-foreground flex justify-between">
            <span>↑↓ 이동 · Enter/Tab 선택 · Esc 닫기</span>
            <span>{files.length}개 파일</span>
          </div>
        </div>
      )}

      {/* Image preview area */}
      {pastedImages.length > 0 && (
        <div className="px-3 pt-3 flex gap-2 flex-wrap">
          {pastedImages.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={URL.createObjectURL(img)}
                alt="preview"
                className="h-16 w-16 object-cover rounded-lg border"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* File attach button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </Button>

        {/* RAG document upload button + menu */}
        {hasBot && (
          <div className="relative flex-shrink-0">
            <input
              ref={ragFileInputRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploadingFileName(file.name)
                setUploadProgress(0)
                setUploadStep("파일 업로드 중...")
                setShowRagPanel(true)
                try {
                  const docId = crypto.randomUUID()
                  const storagePath = `${roomId}/${docId}/${file.name}`

                  // 1단계: Storage 업로드 (0~40%)
                  setUploadProgress(10)
                  await supabase.storage
                    .from("rag-documents")
                    .upload(storagePath, file, { contentType: file.type, cacheControl: "3600" })
                  setUploadProgress(40)
                  setUploadStep("텍스트 추출 중...")

                  // 2단계: 서버 파싱 (40~90%)
                  setUploadProgress(50)
                  await fetch("/api/ai/rag/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      room_id: roomId,
                      storage_path: storagePath,
                      file_name: file.name,
                      file_type: file.type || "application/octet-stream",
                      file_size: file.size,
                    }),
                  })
                  setUploadProgress(90)
                  setUploadStep("벡터화 완료")

                  // 3단계: 완료
                  setUploadProgress(100)
                  setUploadStep("등록 완료!")
                  await new Promise((r) => setTimeout(r, 800))
                } catch (err) {
                  console.error("RAG upload error:", err)
                  setUploadStep("오류 발생")
                  await new Promise((r) => setTimeout(r, 1500))
                }
                setUploadingFileName(null)
                setUploadProgress(0)
                refreshDocuments()
                if (ragFileInputRef.current) ragFileInputRef.current.value = ""
              }}
              className="hidden"
            />
            {/* RAG 업로드 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRagMenu((v) => !v)}
              title="RAG 문서 추가"
            >
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </Button>

            {/* RAG 패널 토글 버튼 (문서가 있을 때만) */}
            {ragDocuments.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRagPanel(!showRagPanel)}
                title={showRagPanel ? "RAG 패널 닫기" : "RAG 패널 열기"}
                className={cn("flex-shrink-0", showRagPanel && "text-purple-600 bg-purple-50")}
              >
                <span className="relative">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-purple-600 text-white text-[8px] flex items-center justify-center">
                    {ragDocuments.length}
                  </span>
                </span>
              </Button>
            )}

            {/* RAG source picker popover */}
            {showRagMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-purple-50 transition-colors"
                  onClick={() => {
                    setShowRagMenu(false)
                    ragFileInputRef.current?.click()
                  }}
                >
                  <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium">파일 업로드</p>
                    <p className="text-[10px] text-muted-foreground">PDF, TXT, MD</p>
                  </div>
                </button>
                <div className="border-t" />
                <button
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-purple-50 transition-colors"
                  onClick={() => {
                    setShowRagMenu(false)
                    setShowRagUrlInput(true)
                  }}
                >
                  <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium">URL 입력</p>
                    <p className="text-[10px] text-muted-foreground">웹 페이지 스크래핑</p>
                  </div>
                </button>
              </div>
            )}

            {/* URL input overlay */}
            {showRagUrlInput && (
              <div className="absolute bottom-full left-0 mb-2 w-80 bg-background border rounded-lg shadow-lg z-50 p-3">
                <p className="text-xs font-medium mb-2">웹 페이지 URL 입력</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const url = ragUrlValue.trim()
                    if (!url) return
                    setRagUrlLoading(true)
                    try {
                      const res = await fetch("/api/ai/rag/upload", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url, room_id: roomId }),
                      })
                      if (res.ok) {
                        refreshDocuments()
                        setShowRagPanel(true)
                      }
                    } finally {
                      setRagUrlLoading(false)
                      setRagUrlValue("")
                      setShowRagUrlInput(false)
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="url"
                    value={ragUrlValue}
                    onChange={(e) => setRagUrlValue(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 text-sm border rounded-md px-2 py-1.5 bg-background"
                    autoFocus
                  />
                  <Button size="sm" type="submit" disabled={ragUrlLoading || !ragUrlValue.trim()}>
                    {ragUrlLoading ? "..." : "추가"}
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setShowRagUrlInput(false)}>
                    취소
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            hasBot && botInvocationMode === "mention"
              ? "@claude로 AI를 호출하세요..."
              : "메시지를 입력하세요... (@로 파일 참조)"
          }
          rows={1}
          className="min-h-[40px] max-h-32 resize-none"
        />

        {/* Send button */}
        <Button
          onClick={sendMessage}
          disabled={(!content.trim() && pastedImages.length === 0) || sending}
          size="icon"
          className="flex-shrink-0"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>

        {/* Skills toggle button (right side) */}
        {hasBot && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("flex-shrink-0", showSkills && "text-purple-600 bg-purple-50")}
            onClick={() => setShowSkills(!showSkills)}
            title="스킬 패널"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
