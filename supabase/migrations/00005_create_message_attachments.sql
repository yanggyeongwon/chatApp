-- Message attachments (files/images)
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,               -- MIME type
  storage_path TEXT NOT NULL,            -- Path in Supabase Storage
  url TEXT NOT NULL,                     -- Public or signed URL
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attachments_message ON message_attachments(message_id);

-- RLS
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments visible to room members"
  ON message_attachments FOR SELECT TO authenticated
  USING (message_id IN (
    SELECT id FROM messages WHERE room_id IN (
      SELECT room_id FROM room_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Message sender can add attachments"
  ON message_attachments FOR INSERT TO authenticated
  WITH CHECK (message_id IN (
    SELECT id FROM messages WHERE sender_id = auth.uid()
  ));
