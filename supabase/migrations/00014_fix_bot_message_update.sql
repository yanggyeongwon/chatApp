-- 봇 메시지를 API에서 업데이트할 수 있도록 정책 추가
-- 기존: "Sender can update own messages" → auth.uid() = sender_id
-- 문제: 봇 메시지의 sender_id는 봇 프로필이지만, API는 유저 세션으로 인증됨
-- 해결: 같은 방의 멤버라면 봇 메시지 업데이트 허용

CREATE POLICY "Room members can update bot messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
    AND sender_id IN (SELECT profile_id FROM bots WHERE is_active = true)
  );
