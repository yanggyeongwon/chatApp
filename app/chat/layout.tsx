"use client"

import { useState, useCallback } from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { SkillsPanel } from "@/components/ai/skills-panel"
import { SkillContext } from "@/lib/hooks/use-skill-context"
import { RagContext } from "@/lib/hooks/use-rag-context"
import { RagDocumentPanel } from "@/components/rag/rag-document-panel"
import type { RagDocument } from "@/lib/types/rag"
import { ElectronTitlebar } from "@/components/electron-titlebar"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showSkills, setShowSkills] = useState(false)
  const [pendingSkill, setPendingSkill] = useState<string | null>(null)

  // RAG state
  const [showRagPanel, setShowRagPanel] = useState(false)
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStep, setUploadStep] = useState("")
  const currentRoomIdRef = { current: null as string | null }
  const [currentRoomId, setCurrentRoomIdState] = useState<string | null>(null)

  const setCurrentRoomId = useCallback((id: string | null) => {
    currentRoomIdRef.current = id
    setCurrentRoomIdState(id)
  }, [])

  const refreshDocuments = useCallback(async () => {
    const rid = currentRoomIdRef.current
    if (!rid) return
    try {
      const res = await fetch(`/api/ai/rag/documents?room_id=${rid}`)
      const data = await res.json()
      const docs = (data.documents ?? []) as RagDocument[]
      setRagDocuments(docs)
      if (docs.length > 0) setShowRagPanel(true)
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectSkill = (command: string) => {
    setPendingSkill(command + " ")
    setShowSkills(false)
  }

  return (
    <SkillContext.Provider value={{ showSkills, setShowSkills, pendingSkill, setPendingSkill }}>
      <RagContext.Provider value={{ showRagPanel, setShowRagPanel, ragDocuments, refreshDocuments, currentRoomId, setCurrentRoomId, isSearching, setIsSearching, uploadingFileName, setUploadingFileName, uploadProgress, setUploadProgress, uploadStep, setUploadStep }}>
        <div className="flex flex-col h-screen overflow-hidden">
          {/* macOS Electron 타이틀바 드래그 영역 */}
          <ElectronTitlebar />
        <div className="flex flex-1 overflow-hidden">
          <ChatSidebar />
          {showRagPanel && ragDocuments.length > 0 && currentRoomId && <RagDocumentPanel />}
          <main className="flex-1 flex flex-col min-w-0">{children}</main>
          {showSkills && (
            <aside className="w-80 border-l flex-shrink-0 hidden md:block overflow-hidden">
              <SkillsPanel onSelectSkill={handleSelectSkill} />
            </aside>
          )}

          {/* RAG 업로드 전체 화면 토스트 + 프로그레스 */}
          {uploadingFileName && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl min-w-[320px]">
                <div className="flex items-center gap-3">
                  {uploadProgress < 100 ? (
                    <svg className="h-5 w-5 text-purple-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{uploadStep || "RAG 문서 등록 중..."}</p>
                    <p className="text-xs text-gray-400 truncate">{uploadingFileName}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{uploadProgress}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-purple-500"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </RagContext.Provider>
    </SkillContext.Provider>
  )
}
