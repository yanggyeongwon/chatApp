export type Profile = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  status_message: string
  is_online: boolean
  last_seen_at: string
  created_at: string
  updated_at: string
}

export type RoomType = "dm" | "group" | "ai"

export type Room = {
  id: string
  name: string | null
  description: string
  type: RoomType
  has_bot: boolean
  avatar_url: string | null
  created_by: string | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export type MemberRole = "owner" | "admin" | "member"

export type RoomMember = {
  id: string
  room_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  last_read_at: string
}

export type MessageType = "text" | "image" | "file" | "system"

export type Message = {
  id: string
  room_id: string
  sender_id: string
  content: string | null
  type: MessageType
  is_deleted: boolean
  is_streaming: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  // Joined data
  sender?: Profile
  attachments?: MessageAttachment[]
}

export type MessageAttachment = {
  id: string
  message_id: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  url: string
  created_at: string
}

export type Bot = {
  id: string
  profile_id: string
  bot_type: string
  model: string
  system_prompt: string | null
  max_context_messages: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type InvocationMode = "always" | "mention"

export type BotRoomConfig = {
  id: string
  bot_id: string
  room_id: string
  invocation_mode: InvocationMode
  is_active: boolean
  added_by: string
  created_at: string
}

export type WebhookSourceType = "github" | "gitlab" | "generic"

export type Webhook = {
  id: string
  room_id: string
  name: string
  secret: string
  source_type: WebhookSourceType
  event_filters: string[]
  avatar_url: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type WebhookLogStatus = "pending" | "success" | "failed" | "filtered"

export type WebhookLog = {
  id: string
  webhook_id: string
  payload: Record<string, unknown>
  headers: Record<string, unknown> | null
  status: WebhookLogStatus
  error_message: string | null
  message_id: string | null
  processed_at: string | null
  created_at: string
}

export type TypingUser = {
  userId: string
  username: string
  avatarUrl: string | null
}

// Room with last message preview (for sidebar)
export type RoomWithPreview = Room & {
  members?: RoomMember[]
  last_message?: Pick<Message, "content" | "created_at" | "sender_id"> & {
    sender?: Pick<Profile, "username">
  }
  unread_count?: number
  dmPartnerName?: string
  dmPartnerAvatar?: string | null
}
