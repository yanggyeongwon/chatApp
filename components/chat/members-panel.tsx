"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InviteMemberDialog } from "@/components/chat/invite-member-dialog"

type Member = {
  user_id: string
  role: string
  profiles: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
    is_online: boolean
  }
}

export function MembersPanel({
  roomId,
  onClose,
}: {
  roomId: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState<string>("member")
  const [showInvite, setShowInvite] = useState(false)

  const fetchMembers = async () => {
    const res = await fetch(`/api/rooms/${roomId}/members`)
    const data = await res.json()
    if (data.members) {
      setMembers(data.members)
      const me = data.members.find((m: Member) => m.user_id === user?.id)
      if (me) setMyRole(me.role)
    }
  }

  useEffect(() => { fetchMembers() }, [roomId])

  const handleKick = async (userId: string) => {
    if (!confirm("이 멤버를 내보내시겠습니까?")) return
    await fetch(`/api/rooms/${roomId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    fetchMembers()
  }

  const canManage = myRole === "owner" || myRole === "admin"

  return (
    <>
      <aside className="w-64 border-l flex-shrink-0 hidden md:flex flex-col bg-background">
        <div className="flex items-center justify-between px-3 py-3 border-b">
          <span className="text-sm font-medium">멤버 ({members.length})</span>
          <div className="flex gap-1">
            {canManage && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowInvite(true)}>
                + 초대
              </Button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {members.map((m) => (
            <div key={m.user_id} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 rounded-lg mx-1">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.profiles.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{m.profiles.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                {m.profiles.is_online && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm truncate">{m.profiles.username}</span>
                  {m.role === "owner" && <Badge className="text-[9px] px-1 py-0 bg-yellow-100 text-yellow-700">방장</Badge>}
                  {m.role === "admin" && <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700">관리자</Badge>}
                </div>
                {m.profiles.full_name && (
                  <p className="text-[10px] text-muted-foreground truncate">{m.profiles.full_name}</p>
                )}
              </div>
              {canManage && m.user_id !== user?.id && m.role !== "owner" && (
                <button
                  onClick={() => handleKick(m.user_id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-all"
                  title="내보내기"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {showInvite && (
        <InviteMemberDialog
          roomId={roomId}
          onClose={() => setShowInvite(false)}
          onInvited={fetchMembers}
        />
      )}
    </>
  )
}
