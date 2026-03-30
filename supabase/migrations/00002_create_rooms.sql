-- Chat rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,                              -- NULL for DMs
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('dm', 'group', 'ai')) DEFAULT 'group',
  has_bot BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rooms_last_message ON rooms(last_message_at DESC);

-- RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Room members (many-to-many)
CREATE TABLE room_members (
                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                              user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                              role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
                              joined_at TIMESTAMPTZ DEFAULT now(),
                              last_read_at TIMESTAMPTZ DEFAULT now(),
                              UNIQUE(room_id, user_id)
);

CREATE INDEX idx_room_members_user ON room_members(user_id);
CREATE INDEX idx_room_members_room ON room_members(room_id);

-- RLS
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms visible to members"
  ON rooms FOR SELECT TO authenticated
  USING (id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create rooms"
  ON rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creator can update"
  ON rooms FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
