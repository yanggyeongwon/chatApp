-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,                           -- NULL if attachment-only
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'file', 'system')) DEFAULT 'text',
  is_deleted BOOLEAN DEFAULT false,
  is_streaming BOOLEAN DEFAULT false,     -- AI response in progress
  metadata JSONB,                         -- token usage, webhook source, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages visible to room members"
  ON messages FOR SELECT TO authenticated
  USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Room members can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Sender can update own messages"
  ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id);
