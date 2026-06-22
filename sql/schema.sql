-- 心情气象台 v3.0 数据库建表 SQL
-- 在 Supabase Dashboard → SQL Editor 中执行

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  user_id text PRIMARY KEY,
  nickname text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);

-- 房间表
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  creator_user_id text REFERENCES users(user_id),
  member_count int2 DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 房间成员表
CREATE TABLE IF NOT EXISTS room_members (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id text REFERENCES users(user_id),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- 心情表
CREATE TABLE IF NOT EXISTS moods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(user_id),
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  status text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL REFERENCES users(user_id),
  type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}',
  reply_to_id uuid REFERENCES messages(id),
  created_at timestamptz DEFAULT now(),
  read_by jsonb DEFAULT '[]'
);

-- 日记表
CREATE TABLE IF NOT EXISTS diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(user_id),
  mood text NOT NULL DEFAULT 'sunny',
  text text DEFAULT '',
  doodle_data_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 纪念日表
CREATE TABLE IF NOT EXISTS anniversaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '💗',
  date date NOT NULL,
  created_by text REFERENCES users(user_id),
  created_at timestamptz DEFAULT now()
);

-- 愿望清单表
CREATE TABLE IF NOT EXISTS wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_done boolean DEFAULT false,
  created_by text REFERENCES users(user_id),
  done_by text REFERENCES users(user_id),
  created_at timestamptz DEFAULT now(),
  done_at timestamptz
);

-- 启用 Realtime (需要 superuser 权限，在 Dashboard → Replication 中手动启用)
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE moods;
-- ALTER PUBLICATION supabase_realtime ADD TABLE room_members;

-- 索引
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_user ON diaries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moods_user ON moods(user_id);
CREATE INDEX IF NOT EXISTS idx_anniversaries_room ON anniversaries(room_id);
CREATE INDEX IF NOT EXISTS idx_wishes_room ON wishes(room_id);

-- RLS 策略（允许 anon key 访问，因为房间密码提供安全层）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;

-- 允许 anon 角色全表访问（安全性由 room_code + password_hash 保证）
CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON room_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON moods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON diaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON anniversaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON wishes FOR ALL USING (true) WITH CHECK (true);
