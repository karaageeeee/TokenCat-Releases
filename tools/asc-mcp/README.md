# asc-mcp — App Store Connect MCP サーバー

App Store Connect の設定（アプリ/バージョンのメタデータ、スクリーンショット、
価格・App内課金/サブスク）を **公式 App Store Connect API** 経由で CLI から
直接記入できるようにする MCP サーバーです。Web UI での手作業を置き換えます。

> 対象範囲: メタデータ / スクショ・プレビュー / 価格・IAP・サブスク。
> ビルド・TestFlight・審査提出は対象外です。

## 1. API キーの発行

App Store Connect → **Users and Access → Integrations → App Store Connect API**
で Team キーを作成します。発行されるもの:

- **Issuer ID**（UUID）
- **Key ID**（例: `2X9R4HXF34`）
- **`.p8` 秘密鍵**（ダウンロードは1回だけ。安全に保管）

`.p8` はリポジトリにコミットしないでください（`.gitignore` 済み）。

## 2. ビルド

```sh
cd tools/asc-mcp
npm ci
npm run build
```

## 3. 認証情報の設定

以下の環境変数で渡します（`ASC_PRIVATE_KEY` か `ASC_PRIVATE_KEY_PATH` のどちらか）:

| 変数 | 必須 | 説明 |
|------|------|------|
| `ASC_KEY_ID` | ✓ | Key ID |
| `ASC_ISSUER_ID` | ✓ | Issuer ID (UUID) |
| `ASC_PRIVATE_KEY_PATH` | ※ | `.p8` ファイルへの絶対パス |
| `ASC_PRIVATE_KEY` | ※ | `.p8` の PEM 文字列（パスの代わり） |

認証情報は**API リクエスト時に初めて読み込まれます**。未設定でも
`tools/list`（後述のハンドシェイク）は動作します。

## 4. Claude Code への登録

[`.mcp.json.example`](.mcp.json.example) をプロジェクト直下の `.mcp.json` に
コピーし、値を埋めてください。登録後、まず `asc_whoami` で疎通確認します。

## 5. 動作確認

```sh
# ビルド済みサーバーが起動し、ツール一覧を返せるか（認証情報不要）
npm run handshake

# 期待するツールの存在を表明
npm run handshake -- asc_whoami

# ユニットテスト（HTTP はスタブ。実 API は叩かない）
npm test

# 実 API スモークテスト（自分の API キーで）
ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_PRIVATE_KEY_PATH=... node dist/index.js
#   → Claude Code から asc_whoami を呼ぶ
```

## アーキテクチャ / ツールの追加方法

- `src/config.ts` — 認証情報の読み込み（遅延）
- `src/auth/jwt.ts` — ES256 JWT の発行とキャッシュ
- `src/client/ascClient.ts` — HTTP クライアント（ページネーション / 429 リトライ /
  アセットアップロードの reserve→PUT→commit ヘルパー）
- `src/tools/registry.ts` — `defineTool()` とツール自動探索
- `src/index.ts` — stdio MCP サーバー本体

新しいツールは `src/tools/<ドメイン>/<名前>.tool.ts` を追加するだけです。
各モジュールは `defineTool(...)` の配列（または単体）を default エクスポートし、
`*.tool.ts` 命名で**自動的に登録**されます（`index.ts` や `registry.ts` の
編集は不要）。実装例は [`src/tools/_health.tool.ts`](src/tools/_health.tool.ts)
を参照してください。HTTP は必ず `ctx.client` 経由で行い、認証や HTTP を独自実装
しないこと。引数は `zod` で検証します。
