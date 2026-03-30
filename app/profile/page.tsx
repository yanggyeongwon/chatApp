"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "")
      setFullName(profile.full_name ?? "")
      setStatusMessage(profile.status_message ?? "")
      setAvatarUrl(profile.avatar_url)
    }
  }, [profile])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    setMessage("")

    const ext = file.name.split(".").pop()
    const path = `${user.id}/avatar.${ext}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true })

    if (uploadError) {
      setMessage("이미지 업로드 실패: " + uploadError.message)
      setUploading(false)
      return
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path)

    const newUrl = urlData.publicUrl + "?t=" + Date.now()

    // Update profile
    await supabase
      .from("profiles")
      .update({ avatar_url: newUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    setAvatarUrl(newUrl)
    setMessage("프로필 이미지가 변경되었습니다!")
    setUploading(false)
    e.target.value = ""
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setMessage("")

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        full_name: fullName.trim(),
        status_message: statusMessage.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (error) {
      setMessage("저장 실패: " + error.message)
    } else {
      setMessage("저장 완료!")
    }
    setSaving(false)
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background pt-20">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/chat")}>
            ←
          </Button>
          <h1 className="text-xl font-bold">프로필 설정</h1>
        </div>

        {/* Avatar with upload */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="text-3xl">
                {profile?.username?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <span className="text-white text-xs animate-pulse">업로드 중...</span>
              ) : (
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <p className="text-xs text-muted-foreground">클릭하여 이미지 변경</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">유저명</label>
            <Input
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">이름</label>
            <Input
              value={fullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">상태 메시지</label>
            <Textarea
              value={statusMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStatusMessage(e.target.value)}
              rows={2}
            />
          </div>

          {message && (
            <p className={`text-sm ${message.includes("실패") ? "text-destructive" : "text-green-600"}`}>
              {message}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  )
}
