"use client"

import { createContext, useContext } from "react"
import type { RagDocument } from "@/lib/types/rag"

export type RagContextType = {
  showRagPanel: boolean
  setShowRagPanel: (v: boolean) => void
  ragDocuments: RagDocument[]
  refreshDocuments: () => void
  currentRoomId: string | null
  setCurrentRoomId: (id: string | null) => void
  isSearching: boolean
  setIsSearching: (v: boolean) => void
  uploadingFileName: string | null
  setUploadingFileName: (v: string | null) => void
  uploadProgress: number
  setUploadProgress: (v: number) => void
  uploadStep: string
  setUploadStep: (v: string) => void
}

export const RagContext = createContext<RagContextType>({
  showRagPanel: false,
  setShowRagPanel: () => {},
  ragDocuments: [],
  refreshDocuments: () => {},
  currentRoomId: null,
  setCurrentRoomId: () => {},
  isSearching: false,
  setIsSearching: () => {},
  uploadingFileName: null,
  setUploadingFileName: () => {},
  uploadProgress: 0,
  setUploadProgress: () => {},
  uploadStep: "",
  setUploadStep: () => {},
})

export const useRagContext = () => useContext(RagContext)
