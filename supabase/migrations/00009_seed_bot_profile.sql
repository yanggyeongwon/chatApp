-- Seed: Claude bot profile
-- NOTE: This must be run AFTER a bot user is created in Supabase Auth,
-- or insert directly with a known UUID.
-- The bot profile uses a reserved system UUID.

-- You can run this manually after setting up Supabase:
-- 1. Create a user in Auth with email: claude-bot@system.internal
-- 2. Use the generated UUID below

-- Example (replace UUID with actual bot user ID):
-- INSERT INTO profiles (id, username, full_name, avatar_url, status_message)
-- VALUES (
--   'YOUR_BOT_USER_UUID',
--   'claude',
--   'Claude AI',
--   '',
--   'AI Assistant powered by Anthropic'
-- );

-- INSERT INTO bots (profile_id, bot_type, model, system_prompt)
-- VALUES (
--   'YOUR_BOT_USER_UUID',
--   'claude',
--   'claude-sonnet-4-20250514',
--   'You are a helpful AI assistant in a chat room. Be concise, friendly, and helpful. Respond in the same language the user writes in.'
-- );
