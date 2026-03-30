"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function InviteMemberDialog({
  roomId,
  onClose,
  onInvited,
}: {
  roomId: string
  onClose: () => void
  onInvited: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [inviting, setInviting] = useState(false)
  const supabase = createClient()

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 1) { setResults([]); return }

    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`)
      .limit(10)

    setResults(data ?? [])
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleInvite = async () => {
    if (selected.size === 0) return
    setInviting(true)
    await fetch(`/api/rooms/${roomId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: [...selected] }),
    })
    setInviting(false)
    onInvited()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-[400px] max-h-[500px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">멤버 초대</h3>
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="유저명 검색..."
            className="mt-2"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => toggleSelect(user.id)}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                selected.has(user.id) ? "bg-purple-100 text-purple-900" : "hover:bg-muted"
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <span className="flex-1 text-left">{user.username}</span>
              {selected.has(user.id) && (
                <svg className="h-4 w-4 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          ))}
          {query && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">검색 결과 없음</p>
          )}
        </div>

        <div className="p-3 border-t flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{selected.size}명 선택</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={handleInvite} disabled={selected.size === 0 || inviting}>
              {inviting ? "초대 중..." : "초대하기"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
