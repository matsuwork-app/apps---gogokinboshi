-- ================================================================
-- GOGO金星_得点王 — Supabase Schema
-- 新規環境向けテーブル定義の参照用スナップショットです。
-- 既存環境への適用、RPC、RLS、backfillは migrations/ を使用してください。
-- ================================================================

-- LINE Loginとアプリ内承認状態
create table if not exists app_users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  line_user_id text not null unique,
  display_name text not null,
  avatar_url   text,
  role         text not null default 'member'
                 check (role in ('admin', 'member')),
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'revoked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

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
  team_count int not null default 2 check (team_count between 2 and 4),
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

-- イベントで利用する2〜4チーム
create table if not exists event_teams (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  team_code    text not null check (team_code in ('A', 'B', 'C', 'D')),
  display_name text not null,
  sort_order   int not null check (sort_order between 1 and 4),
  created_at   timestamptz not null default now(),
  unique(event_id, team_code),
  unique(event_id, sort_order),
  unique(event_id, id)
);

-- 次ターン作成時にも更新する互換用の「現在の編成」
create table if not exists event_team_members (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  event_team_id uuid not null,
  member_id     uuid not null references members(id) on delete cascade,
  created_at    timestamptz not null default now(),
  foreign key (event_id, event_team_id)
    references event_teams(event_id, id) on delete cascade,
  foreign key (event_id, member_id)
    references event_participants(event_id, member_id) on delete cascade,
  unique(event_id, member_id),
  unique(event_team_id, member_id)
);

-- 編成が変わるまでを1つの不変ターンとして保存
create table if not exists event_turns (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  turn_number int not null check (turn_number > 0),
  created_at  timestamptz not null default now(),
  unique(event_id, turn_number),
  unique(id, event_id)
);

create table if not exists turn_team_members (
  id            uuid primary key default gen_random_uuid(),
  event_turn_id uuid not null,
  event_id      uuid not null,
  event_team_id uuid not null,
  member_id     uuid not null references members(id) on delete cascade,
  created_at    timestamptz not null default now(),
  foreign key (event_turn_id, event_id)
    references event_turns(id, event_id) on delete cascade,
  foreign key (event_id, event_team_id)
    references event_teams(event_id, id),
  foreign key (event_id, member_id)
    references event_participants(event_id, member_id) on delete cascade,
  unique(event_turn_id, member_id),
  unique(event_turn_id, event_team_id, member_id)
);

-- 試合（チーム編成が変わるごとに新規）
create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  match_number int not null default 1,
  status       text not null default 'pending'
                 check (status in ('pending', 'active', 'paused', 'finished')),
  started_at   timestamptz,
  ended_at     timestamptz,
  elapsed_seconds int not null default 0 check (elapsed_seconds >= 0),
  active_started_at timestamptz,
  created_at   timestamptz default now()
);

create unique index if not exists matches_event_match_number_uidx
  on matches(event_id, match_number);
create unique index if not exists matches_id_event_uidx
  on matches(id, event_id);

-- 旧試合履歴の対戦チームスナップショット
create table if not exists match_teams (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null,
  event_id      uuid not null,
  event_team_id uuid not null,
  side          smallint not null check (side in (1, 2)),
  created_at    timestamptz not null default now(),
  foreign key (match_id, event_id) references matches(id, event_id) on delete cascade,
  foreign key (event_id, event_team_id) references event_teams(event_id, id),
  unique(match_id, side),
  unique(match_id, event_team_id),
  unique(match_id, id)
);

-- チーム編成（試合ごと）
create table if not exists match_lineups (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  team       text not null check (team in ('A', 'B')),
  match_team_id uuid not null,
  is_playing boolean not null default true,
  created_at timestamptz default now(),
  unique(match_id, member_id),
  foreign key (match_id, match_team_id) references match_teams(match_id, id)
);

-- 得点ログ
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid references matches(id) on delete cascade,
  event_turn_id uuid,
  member_id  uuid not null references members(id) on delete cascade,
  scored_at  timestamptz default now(),
  created_at timestamptz default now(),
  check (num_nonnulls(match_id, event_turn_id) = 1),
  foreign key (match_id, member_id)
    references match_lineups(match_id, member_id),
  foreign key (event_turn_id, member_id)
    references turn_team_members(event_turn_id, member_id) on delete cascade
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
