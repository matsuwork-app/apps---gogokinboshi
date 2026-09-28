# LINE Login / Supabase Auth 設定

## 安全な切り替え

`ACCESS_MODE` の既定値は安全側の `line` です。未設定や誤記でもLINE認証が有効になり、アプリが意図せず一般公開されることを防ぎます。`legacy` は移行確認用の一時的な匿名閲覧モードです。書き込みは既存の管理者cookieを持つセッションだけに許可されますが、新たに管理者cookieを発行する解除UIはありません。

本番移行時は、DB migration、Supabase Custom OIDC、管理者IDの設定と同時に `ACCESS_MODE=line` へ切り替えます。`legacy` のまま新UIを公開運用しないでください。

## LINE Developers

1. Webアプリ用のLINE Loginチャネルを作成します。
2. OpenID Connectを有効にし、`openid profile` を利用できるようにします。
3. LINEから返る `sub` が管理者本人のユーザーIDであることを確認します。

## Supabase Auth

Supabase Dashboardの Authentication / Providers でCustom OIDC Providerを追加します。

- Provider名: `line`（アプリからは `custom:line` として指定）
- Issuer URL: LINEのOpenID Connect discoveryに対応するURL
- Client ID / Secret: LINE Loginチャネルの値
- Supabase callback URL: Dashboardに表示される callback URL

LINE Loginチャネル側のCallback URLには、Supabaseが表示するcallback URLを登録します。アプリの `/auth/callback` はSupabaseとのPKCE交換後に使用されます。

## アプリ環境変数

```env
ACCESS_MODE=line
NEXT_PUBLIC_SITE_URL=https://your-app.example.com
LINE_ADMIN_USER_ID=LINEの管理者ユーザーID
```

Supabase接続用の `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、サーバー専用の `SUPABASE_SERVICE_ROLE_KEY` も必要です。

`LINE_ADMIN_USER_ID` とID tokenの `sub` が一致する1名だけが `admin / approved` になります。それ以外の初回利用者は `member / pending` で登録されます。一般利用者の既存状態は再ログインで上書きされません。

## Preview確認後の切り替え

1. `app_users` を含むmigrationをPreview DBへ適用します。
2. Previewの `NEXT_PUBLIC_SITE_URL` と `LINE_ADMIN_USER_ID` を設定します。
3. Previewだけ `ACCESS_MODE=line` にします。
4. 管理者ログイン、一般利用者の承認待ち、承認・停止、ログアウトを確認します。
5. 本番DB migrationと環境変数を確認後、本番の `ACCESS_MODE=line` を設定して再デプロイします。

緊急切り戻しでは `ACCESS_MODE=legacy` に戻して再デプロイできますが、これは実質的に閲覧専用です。既存の有効な管理者cookieが残っている場合を除き、新規の書き込み認証はできません。データを削除する必要はありません。
