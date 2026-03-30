-- Webhooks for external service integration
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  secret TEXT NOT NULL,                    -- HMAC signing secret
  source_type TEXT NOT NULL DEFAULT 'generic'
    CHECK (source_type IN ('github', 'gitlab', 'generic')),
  event_filters TEXT[] DEFAULT '{}',       -- e.g., ['push', 'issues', 'pull_request']
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_room ON webhooks(room_id);

-- Webhook delivery logs
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  headers JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'filtered')),
  error_message TEXT,
  message_id UUID REFERENCES messages(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id, created_at DESC);

-- RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Webhooks visible to room members"
  ON webhooks FOR SELECT TO authenticated
  USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Room admins can create webhooks"
  ON webhooks FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Room admins can update webhooks"
  ON webhooks FOR UPDATE TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Room admins can delete webhooks"
  ON webhooks FOR DELETE TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Webhook logs visible to room members"
  ON webhook_logs FOR SELECT TO authenticated
  USING (webhook_id IN (
    SELECT id FROM webhooks WHERE room_id IN (
      SELECT room_id FROM room_members WHERE user_id = auth.uid()
    )
  ));
