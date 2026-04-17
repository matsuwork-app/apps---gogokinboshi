-- ================================================================
-- GOGO金星_得点王 — Supabase Schema
-- Supabase Dashboard の SQL Editor で実行してください
-- ================================================================

-- メンバー
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

-- 日次イベント（活動日）
create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  event_date date not null default current_date,
  notes      text,
  created_at timestamptz default now()
);

-- イベント参加者
create table if not exists event_participants (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  created_at timestamptz default now(),
  unique(event_id, member_id)
);

-- 試合（チーム編成が変わるごとに新規）
create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  match_number int not null default 1,
  status       text not null default 'pending'
                 check (status in ('pending', 'active', 'finished')),
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz default now()
);

-- チーム編成（試合ごと）
create table if not exists match_lineups (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  team       text not null check (team in ('A', 'B')),
  created_at timestamptz default now(),
  unique(match_id, member_id)
);

-- 得点ログ
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  scored_at  timestamptz default now(),
  created_at timestamptz default now()
);

-- 出場時間インターバル（開始〜終了を記録）
create table if not exists playing_intervals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_at timestamptz default now()
);

-- ================================================================
-- サンプルデータ（任意）
-- ================================================================
-- insert into members (name) values
--   ('田中 太郎'),
--   ('鈴木 次郎'),
--   ('佐藤 三郎'),
--   ('高橋 四郎'),
--   ('伊藤 五郎'),
--   ('渡辺 六郎'),
--   ('山本 七郎'),
--   ('中村 八郎'),
--   ('小林 九郎'),
--   ('加藤 十郎');
