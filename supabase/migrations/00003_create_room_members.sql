
CREATE POLICY "Members visible to fellow room members"
  ON room_members FOR SELECT TO authenticated
  USING (room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can join rooms"
  ON room_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
  ON room_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON room_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
