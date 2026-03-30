"use client"

import { useState } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { RoomList } from "@/components/chat/room-list"
import { CreateRoomDialog } from "@/components/chat/create-room-dialog"
import { CreateDmDialog } from "@/components/chat/create-dm-dialog"
import { CreateAIRoomButton } from "@/components/ai/create-ai-room-button"

function SidebarContent() {
  const { profile, signOut } = useAuth()
  const [search, setSearch] = useState("")
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showCreateDm, setShowCreateDm] = useState(false)

  return (
    <div className="flex flex-col h-full w-full bg-sidebar">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-bold">ChatApp</h1>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9 hover:bg-accent">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowCreateRoom(true)}>
              그룹 채팅 만들기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCreateDm(true)}>
              1:1 메시지
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-4 pb-3">
        <Input
          placeholder="채팅방 검색..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="h-9"
        />
      </div>

      <Separator />

      {/* AI Room shortcut — 로컬에서만 표시 */}
      {process.env.NEXT_PUBLIC_ENABLE_CLAUDE === "true" && (
        <>
          <div className="px-2 py-1">
            <CreateAIRoomButton />
          </div>
          <Separator />
        </>
      )}

      <ScrollArea className="flex-1">
        <RoomList searchQuery={search} />
      </ScrollArea>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>
                {profile?.username?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.username ?? "User"}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => { window.location.href = "/profile" }}>
              프로필 설정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>로그아웃</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showCreateRoom && (
        <CreateRoomDialog open={showCreateRoom} onOpenChange={setShowCreateRoom} />
      )}
      {showCreateDm && (
        <CreateDmDialog open={showCreateDm} onOpenChange={setShowCreateDm} />
      )}
    </div>
  )
}

export function ChatSidebar() {
  return (
    <>
      <aside className="hidden md:block w-72 flex-shrink-0 overflow-hidden border-r">
        <SidebarContent />
      </aside>

      <div className="md:hidden absolute top-3 left-3 z-50">
        <Sheet>
          <SheetTrigger className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-accent">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
