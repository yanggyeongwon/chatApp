"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Profile } from "@/lib/types/chat"

export function CreateDmDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (query: string) => {
    setSearch(query)
    if (query.length < 2) {
      setResults([])
      return
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user?.id)
      .ilike("username", `%${query}%`)
      .limit(10)

    setResults(data ?? [])
  }

  const handleSelectUser = async (targetUser: Profile) => {
    if (!user) return
    setLoading(true)

    // Call API to find-or-create DM room
    const res = await fetch("/api/rooms/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: targetUser.id }),
    })

    const { roomId } = await res.json()

    if (roomId) {
      setSearch("")
      setResults([])
      onOpenChange(false)
      router.push(`/chat/${roomId}`)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>1:1 메시지</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="유저명으로 검색..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <ScrollArea className="max-h-64">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((profile) => (
                  <Button
                    key={profile.id}
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-2.5"
                    onClick={() => handleSelectUser(profile)}
                    disabled={loading}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {profile.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-medium">{profile.username}</p>
                      {profile.full_name && (
                        <p className="text-xs text-muted-foreground">
                          {profile.full_name}
                        </p>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            ) : search.length >= 2 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                검색 결과가 없습니다.
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                유저명을 2글자 이상 입력하세요.
              </p>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
