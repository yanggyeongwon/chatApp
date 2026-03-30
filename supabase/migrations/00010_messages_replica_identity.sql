-- Realtime UPDATE 이벤트에서 필터(room_id)가 작동하려면 REPLICA IDENTITY FULL 필요
-- 없으면 UPDATE 시 old record에 PK만 포함되어 room_id 필터를 매칭할 수 없음
ALTER TABLE messages REPLICA IDENTITY FULL;
