-- AI Bots
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bot_type TEXT NOT NULL DEFAULT 'claude',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_prompt TEXT,
  max_context_messages INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bot room configurations
CREATE TABLE bot_room_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  invocation_mode TEXT NOT NULL DEFAULT 'always'
    CHECK (invocation_mode IN ('always', 'mention')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bot_id, room_id)
);

-- Rate limiting for AI usage
CREATE TABLE bot_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, bot_id)
);

-- RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_room_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bots readable by authenticated users"
  ON bots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Bot room configs visible to room members"
  ON bot_room_configs FOR SELECT TO authenticated
  USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Room admins can manage bot configs"
  ON bot_room_configs FOR INSERT TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Room admins can update bot configs"
  ON bot_room_configs FOR UPDATE TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view own rate limits"
  ON bot_rate_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
