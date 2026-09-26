# Supabase migration runbook

## 使い捨てDBによる試合ライフサイクルE2E

GitHub ActionsのCIは、Supabase CLIで毎回まっさらなローカルスタックを起動し、migrationと`seed.sql`を適用してから、次の主要フローをPlaywrightで確認します。

- 3チームイベントの作成と均等割り当て
- 2チームの対戦作成と残り1チームの休憩表示
- キックオフ、一時停止、再開、得点、ベンチ切替、試合終了
- 再読込後の状態・得点保持とDBレコードの整合性

ライフサイクルテストはデータを書き換えるため、通常の`npm run test:e2e`から分離しています。専用設定は、Supabase URLが`http://127.0.0.1:54321`であること、明示的な書込許可、シードされたガード値をすべて検証し、条件を満たさなければ開始前に停止します。本番・PreviewのSupabaseへ向けて実行できません。

Dockerが利用できるローカル環境では、CIと同じ流れを次のように再現できます。生成された認証情報ファイルと環境ファイルは一時ディレクトリに置き、Gitへ追加しません。

```sh
npx supabase start -x studio,imgproxy,realtime,storage-api,edge-runtime,logflare,vector,supavisor,mailpit
npx supabase status -o env > /tmp/gogokinboshi-supabase.env
node scripts/generate-manager-credentials.mjs /tmp/gogokinboshi-manager.json
node scripts/prepare-local-e2e-env.mjs \
  /tmp/gogokinboshi-supabase.env \
  /tmp/gogokinboshi-manager.json \
  /tmp/gogokinboshi-e2e.env
set -a
. /tmp/gogokinboshi-e2e.env
set +a
npm run test:e2e:lifecycle
npx supabase stop --no-backup
```

`migrations/202609260001_multiteam_state_machine_rls.sql` は、既存データを保持したまま次を追加します。

- イベントごとの2〜4チームとイベント共通の所属
- 1試合2チームの対戦スナップショット
- 再読込に耐える試合経過時間、状態遷移、出場切替RPC
- DB制約・検索index
- 公開SELECT / service role限定の書き込みとRPC

## 適用前の必須確認

本番へ直接適用せず、まずバックアップを取得して複製環境で確認します。このmigrationは1トランザクションなので、途中の検査に失敗すると全変更がロールバックされます。

Dockerがない環境でも、取得済みJSONバックアップをWASM版PostgreSQLへ復元してmigrationを検証できます。

```sh
npm run db:verify
```

この検証は旧テーブルの全件数維持、A/B backfill、RLS権限、3チームイベント作成、試合状態遷移、匿名書き込み拒否まで確認します。Supabase固有のPostgREST/API Gateway挙動はPreview環境で別途確認します。
CIでは実データを含まない`test/fixtures/supabase-legacy-backup.json`を明示的に使用します。引数なしのローカル実行だけが、Git管理外の`backups/`にある最新バックアップを使用します。

```sql
-- 試合番号の重複（0行であること）
select event_id, match_number, count(*)
from public.matches
group by event_id, match_number
having count(*) > 1;

-- 不正な時間区間（0行であること）
select id from public.playing_intervals
where ended_at is not null and ended_at < started_at;

-- 同じ選手の重複open区間（0行であること）
select match_id, member_id, count(*)
from public.playing_intervals
where ended_at is null
group by match_id, member_id
having count(*) > 1;

-- ラインナップ外の得点・出場時間（どちらも0行であること）
select g.id from public.goals g
where not exists (
  select 1 from public.match_lineups ml
  where ml.match_id = g.match_id and ml.member_id = g.member_id
);

select pi.id from public.playing_intervals pi
where not exists (
  select 1 from public.match_lineups ml
  where ml.match_id = pi.match_id and ml.member_id = pi.member_id
);
```

Supabase CLIをprojectへlinkした複製環境では以下を実行します。

```sh
supabase db lint --linked
supabase db push --dry-run --linked
supabase db push --linked
supabase db lint --linked
```

適用後は最低限、次を確認します。

```sql
-- 全イベントにteam_count分のチームがあること
select e.id, e.team_count, count(et.id) as actual_teams
from public.events e
left join public.event_teams et on et.event_id = e.id
group by e.id, e.team_count
having count(et.id) <> e.team_count;

-- 全lineupが対戦チームへ接続されていること（0行）
select id from public.match_lineups where match_team_id is null;

-- event共通所属を推測しなかった、チーム変更経験者を確認
select m.event_id, ml.member_id, array_agg(distinct ml.team order by ml.team)
from public.match_lineups ml
join public.matches m on m.id = ml.match_id
group by m.event_id, ml.member_id
having count(distinct ml.team) > 1;

-- 公開ロールに書込権限・mutation RPC権限がないこと
select
  has_table_privilege('anon', 'public.matches', 'select') as anon_can_read,
  has_table_privilege('anon', 'public.matches', 'insert') as anon_can_insert,
  has_function_privilege(
    'anon',
    'public.transition_match(uuid,text,text)',
    'execute'
  ) as anon_can_transition;
-- 期待値: true, false, false
```

## 権限境界

`anon` と `authenticated` は公開テーブルのSELECTだけを行えます。INSERT / UPDATE / DELETEおよび4つのmutation RPCは`service_role`だけに許可しています。service role keyはブラウザへ渡さず、Vercelのサーバー専用環境変数からのみ利用してください。現在のanon keyによるServer Action書き込みはmigration適用後に失敗するため、アプリ側の切替と同一リリースで適用する必要があります。

migrationファイル自体は履歴として一度だけ実行する前提です。`IF EXISTS` / `IF NOT EXISTS` は安全な再試行を補助しますが、適用済みmigrationを手動で再実行する運用はしません。Supabaseのmigration履歴で一意に管理してください。

## ロールバック

適用中の失敗は自動で全ロールバックされます。適用完了後の逆migrationは、新テーブルに3〜4チームの本番データが入り得るため自動DROPにしません。問題が起きた場合は先にアプリを旧版へ戻さず書き込みを停止し、バックアップから複製環境へ復元してデータを確認します。

旧Vercelデプロイへ戻す場合は、先に`rollback/20260926_restore_legacy_writes.sql`をSupabase SQL Editorで実行します。この互換性ロールバックは新しい列・テーブルとデータを保持したまま、旧ブラウザクライアントに必要なanon書き込み権限と制約だけを戻します。新アプリへ再移行する前に、互換期間中に作成された旧形式データの再backfillが必要です。このSQLは`npm run db:verify`で旧形式のイベント・試合・得点・出場時間を書き込めることまで検証します。

## 既存タイマー移行の制約

旧スキーマには一時停止区間そのものがないため、過去または移行時点で一時停止中の試合について、正確な実時間を完全復元することはできません。終了済み試合は`ended_at - started_at`、一時停止中の試合は移行時点と`started_at`の差を初期値にします。進行中の試合は`started_at`から新しいactive区間を開始します。本番適用前に進行中・一時停止中の試合がない状態にするのが安全です。

2026-09-26の本番事前監査では、終了済み14試合のうち1件に未終了の`playing_intervals`がありました。migrationは、その区間開始より後にある試合終了時刻を区間終了として補正します。それ以外の「activeではない試合に未終了区間がある」状態は自動推測せず、migration全体をロールバックします。

状態遷移・出場切替の時刻は、ブラウザやVercel Functionの時計ではなくPostgreSQLの`clock_timestamp()`で確定します。

## 手動データバックアップ

Free PlanにはSupabase管理バックアップがないため、migration前に次を実行します。

```sh
npm run backup:supabase
```

出力は`backups/supabase-data-<timestamp>.json`です。公開anon keyによるSELECTだけを使用し、service role keyや環境変数値は保存しません。ファイルはGit対象外・所有者のみ読み書き可能な権限で作成されます。表示されたSHA-256と行数をmigration前後で保管してください。

これは論理データの退避であり、Supabase全体の物理バックアップではありません。復元時は新規/複製環境にbaseline migrationからschemaを構築し、外部キー順にデータを戻して件数と集計を照合します。
