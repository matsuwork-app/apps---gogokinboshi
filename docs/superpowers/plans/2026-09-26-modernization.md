# GOGO金星 得点王 モダナイズ計画

## Goal

既存データを失わずに、認証・認可、DB整合性、試合計測、デプロイ運用を安全な状態へ更新する。

## 現状

- Next.js 16 App Router / React 19 / Supabase / Vercel 構成。
- 公開画面はランキング、イベント一覧、試合結果。メンバー・イベント・試合の管理は共有パスコードで解除する運用。
- 旧実装はブラウザと Server Actions が anon key で読み書きしていた。
- 旧クライアント内固定パスコードは UI の表示制御のみで、API・DBの認可にはなっていなかった。
- ローカルには migration 履歴、RLS、policy、テスト、Preview環境がない。
- Supabaseの既存データはローカルアプリから読み取れることを確認済み。管理用service roleとmigration適用権限は未確認。
- Vercel本番は稼働中だが、最新2件はGit SHAを持たないCLIデプロイ。Previewデプロイはない。

## Acceptance criteria

1. 本番SupabaseプロジェクトとVercelの環境変数が照合され、既存データのバックアップと復旧手順がある。
2. 匿名利用者は許可された読み取りだけ可能で、書き込みは認証済みの権限保持者だけが行える。
3. Server Actions、RPC、REST直接呼び出しのどの経路でもRLSを迂回できない。
4. イベント作成、試合作成、開始、一時停止、再開、終了、得点取消がトランザクションまたは冪等な状態遷移として扱われる。
5. 一時停止・再読込・再開・終了後も試合時間と出場時間が正しい。
6. migrationと生成型が実DBと一致し、`paused` を含む状態制約のドリフトがない。
7. 型チェック、単体テスト、Playwright主要フロー、本番ビルドがCIで成功する。
8. mainへの変更はPreviewで検証され、承認後にproductionへ昇格できる。

## 設計方針

### 認証・認可

確定モデルは「ランキング・イベント・試合結果は公開閲覧、記録と管理は共有パスコード必須」。

- パスコード検証はServer Actionでscrypt hashに対して行い、平文をコードやブラウザへ保存しない。
- 成功時は署名付きHttpOnly cookieを発行し、全mutation Server Actionで再検証する。
- ブラウザはanon keyでSELECTだけを行い、書き込みは認証済みServer Actionがservice roleで実行する。
- DBではRLSと権限を公開SELECT / service role書き込みに制限し、UIを迂回したanon書き込みを拒否する。

### データ更新

ブラウザからの複数テーブル直接更新を廃止し、Server Actionsから認証済みRPCを呼ぶ。

- `create_event(event_date, notes, member_ids)`
- `create_match(event_id, team_a_ids, team_b_ids)`
- `transition_match(match_id, expected_status, next_status)`
- `toggle_player(match_id, member_id, is_playing)`
- `record_goal(match_id, member_id, operation_id)`
- `undo_goal(match_id, goal_id)`

RPC内で権限、現在状態、所属関係、重複要求を検証し、関連書き込みを1トランザクションで完了する。

### DB制約

- `matches.status` を `pending | active | paused | finished` に統一。
- `unique(event_id, match_number)` を追加し、採番はDB内で直列化する。
- 1選手・1試合につきopenな `playing_intervals` は1件だけにするpartial unique indexを追加。
- `ended_at >= started_at` を保証する。
- goal/intervalの選手が当該lineupに所属することをRPCで検証する。
- 一覧・集計クエリに必要な外部キー・日付indexを追加する。

### 読み取り・集計

ランキング集計をSQL viewまたはread-only RPCへ移し、クライアントへの全明細配信と重複集計ロジックを削除する。障害時は空配列ではなく明示的なエラー状態を表示する。

### Vercel運用

- リポジトリを正しいVercel projectへ明示リンクする。
- development / preview / production のSupabase環境を分離する。
- GitHub PR → Vercel Preview → Playwright smoke → production promote に統一する。
- Supabaseリージョン確認後、Vercel Function regionをDB近傍へ合わせる。
- Git SHAを持たない手動production deployは原則停止する。

## Tasks

### Phase 0: 緊急保守

- [x] Next.js 16.2.4を既知Critical脆弱性のない16.3.6へ更新。
- [x] TypeScript型チェックとproduction buildを確認。
- [x] 残る間接依存の脆弱性を互換範囲内で更新し、`npm audit` 0件を確認。

### Phase 1: 接続復旧・保全

- [x] Vercelへ再認証し、対象projectのenvironment variablesを照合してserver-only secretsを登録。
- [x] Supabase Dashboardで対象projectの稼働状態、東京リージョン、7テーブル、RLS未設定を確認。
- [x] 既存データを論理バックアップし、全件をローカルPostgreSQLへ復元してmigration・RPC・RLSを検証。
- [x] 既存schemaを最初のbaseline migrationとして追加。
- [x] DB生成型を `src/types/database.ts` に反映し、CIでドリフトを検知。

### Phase 2: 認証・RLS

- [x] 利用者モデルを公開閲覧＋共有パスコード管理に確定。
- [x] scryptパスコード検証と署名付きHttpOnly sessionを実装。
- [x] 公開SELECT / service role書き込みのRLS・権限migrationを追加。
- [x] 全mutation Server Actionにsession検証とサーバー専用clientを追加。
- [x] クライアント固定パスコードを削除し、暗号処理の単体テストを追加。

### Phase 3: DB整合性・試合状態機械

- [x] 2〜4イベントチーム、1試合2チーム、制約、index、状態遷移RPCをmigrationで追加。
- [x] 試合記録画面のブラウザ直書きをServer Action/RPCに置換。
- [x] タイマーを永続化された経過秒＋active区間から算出し、pause/reload/resume/finishを修正。
- [x] 得点・出場切替を楽観更新し、失敗時にrollbackするUIへ変更。

### Phase 4: 品質・性能

- [x] Vitestで認証暗号、チームローテーション、タイマーの単体テストを追加。
- [x] Playwright主要フローを追加（公開閲覧、3〜4チーム編成、2チーム対戦選択、管理認証、誤パスコード拒否、使い捨てDBでの試合開始〜終了）。
- [x] ランキングRPCとserver-only DALを導入。
- [x] JST日付生成をtimezone-safeな実装へ変更。
- [x] dialog、キーボード操作、aria-labelを改善。
- [x] Supabase runbookへmigration、バックアップ、権限確認、互換ロールバック手順を記載。

### Phase 5: Preview・本番移行

- [ ] Preview用SupabaseとVercel環境変数を設定。
- [x] migration → smoke test → production promote → rollbackの手順を確認。
- [x] 既存データを保持したまま本番migrationを適用。
- [x] Runtime logs、エラー通知、Web Analytics/Speed Insightsの必要範囲を設定。

## Verification

- `npx tsc --noEmit --incremental false`
- `npm run build`
- `npm run db:verify`（実データ復元、migration、RPC、RLS policy）
- Playwright: 公開閲覧、ログイン、管理操作、試合開始〜終了、未認証拒否、権限不足拒否
- Vercel Previewでconsole error、server/runtime log、Supabase errorがないことを確認

## Decision log

- 2026-09-26: Supabase Free Planのため論理バックアップを取得し、実データをPGliteへ復元してmigration/RPC/RLS/rollbackを検証したうえで現行projectへ適用。
- 2026-09-26: 新しい共有パスコードを発行し、Vercel Production / Previewへservice roleを含むserver-only秘密環境変数を登録。
- 2026-09-26: Vercel Previewで公開閲覧・複数チームUI・管理認証を非破壊確認後、同じ成果物をProductionへ昇格。
- 2026-09-26: CIの使い捨てSupabaseとPlaywrightで3チームイベント作成から試合終了・再読込までを自動検証。
- 2026-09-26: 公開ランキングをJST日付境界・最大3660日で集計するread-only RPCへ移し、ブラウザへの全明細配信を廃止。
- 2026-09-26: ダイアログのフォーカス管理とARIAを改善し、Web Analytics/Speed Insightsを導入。Hobby範囲では標準Runtime Logsとデプロイ失敗通知を利用。
