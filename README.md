# TokenCat

TokenCat は、AI 作業を見守る macOS メニューバーの小さな相棒です。

Claude Code や Codex の使用状況に合わせて、猫の元気が変わります。AI と一緒に作業している時間を、少しだけ楽しく、少しだけ安心できるものにするための常駐アプリです。

![TokenCat preview](Resources/CatFrames/preview.png)

## Concept

AI をただのツールとして使うだけでなく、メニューバーに小さな生き物が住んでいるような感覚で付き合えるアプリを目指しています。

今は猫が Claude Code / Codex の使用状況を見守ります。今後は犬、うさぎ、ロボットなど、動かせる相棒を増やしていく予定です。

## Download

配布用アプリは GitHub Releases で公開予定です。

現在のビルド成果物は `TokenCat vol.N.app` の形式で作成されます。変更履歴と古いバージョンは Git/GitHub のブランチ、コミット、タグ、リリースで管理します。

## Features

- macOS メニューバーに住むドット絵の猫
- Claude Code または Codex の使用状況に合わせて変わるアニメーション
- 残り使用率のメニューバー表示
- 取得対象を `Claude Code` または `Codex` から選択
- `Target` / `Overall Used` / `Remaining` / `現在の状態` のサマリー表示
- 状態が変わったときの macOS 通知
- 手動更新、更新間隔設定、ログイン時自動起動
- 日本語 / 英語対応
- PNG フレームが読めない場合の絵文字フォールバック
- 相棒ストア（猫は無料、追加動物は買い切りでアンロック）

## Cat States

猫の状態は、残り使用率から決まります。

| Remaining | State |
| --- | --- |
| 70-100% | `running` |
| 40-69% | `tiredRunning` |
| 20-39% | `sleepyRunning` |
| 5-19% | `exhaustedWalking` |
| 0-4% | `collapsed` |

## Companions & Store

TokenCat は「相棒（動物）」を切り替えて使えます。ポップオーバー内の **相棒ストア** から選択・購入します。

- **猫（標準）は無料。** インストールしたその瞬間から全機能を使えます。
- **追加動物は買い切りでアンロック。** 一度購入すれば永続的に使えます（サブスクではありません）。
- 使用状況の監視・通知・更新間隔などの**実用機能はすべて無料**。課金対象は「見た目の楽しさ」だけです。
- 未購入の動物も**ストアでアニメーションのプレビュー**を確認できます。

### マネタイズ方針

RunCat 型のモデルを採用しています。アプリ本体は無料で配布し、追加の相棒を少額の買い切りアプリ内課金（IAP）として販売します。価格は App Store Connect 側で設定し、StoreKit から取得します。

| 相棒 | ティア | Product ID |
| --- | --- | --- |
| ねこ | 無料 | — |
| いぬ | 買い切り | `com.tokencat.companion.dog` |
| うさぎ | 買い切り | `com.tokencat.companion.rabbit` |
| ロボット | 買い切り | `com.tokencat.companion.robot` |
| サンタねこ（季節限定） | 買い切り | `com.tokencat.companion.cat_santa` |

> 課金（StoreKit IAP）は **App Store 版でのみ有効**です。GitHub Releases の直接配布版では追加相棒のアンロックは行えません。

## Roadmap

- 追加動物のドット絵アセット制作（現状はストア導線・課金基盤が完成、アートは順次追加）
- 季節限定スキンの拡充
- AI ごとの相棒切り替え
- アニメーションやテーマの追加
- 全部入りの「コンプリートパック」IAP

「次に追加してほしい相棒」や使ってみた感想があれば、Issue やレビューで教えてください。反応が多いものから優先して作っていきます。

## How It Works

TokenCat は、Mac 上でログイン済みの CLI 認証情報を使って使用状況を取得します。

- Claude Code: macOS Keychain の `Claude Code-credentials` から OAuth トークンを読み、Anthropic の usage endpoint を呼び出します。
- Codex: `codex app-server` を起動し、line-delimited JSON-RPC で rate limit を取得します。

取得するのは、設定画面で選ばれている対象だけです。

## Build

Requirements:

- macOS 14 Sonoma or later
- Swift 5.9 or later
- Claude Code CLI, if using Claude Code
- Codex CLI, if using Codex

Build the app:

```bash
./Scripts/build.sh
```

The script creates:

```text
TokenCat.app
TokenCat vol.N.app
```

`TokenCat vol.N.app` がすでに存在する場合、上書きや `_archive/` への退避は行いません。新しい `--vol` を指定するか、不要なビルド成果物を手動で整理してください。

公開コピーを作らずにビルドだけ確認する場合:

```bash
./Scripts/build.sh --clean --no-publish
```

### App Store 向けビルド（StoreKit 課金あり）

App Store 版は Xcode プロジェクトでビルドします。プロジェクトは [XcodeGen](https://github.com/yonaskolb/XcodeGen) で `project.yml` から生成します（`TokenCat.xcodeproj` は Git 管理外で、`project.yml` が真実の源です）。

```bash
brew install xcodegen        # 未導入の場合
xcodegen generate            # TokenCat.xcodeproj を生成
open TokenCat.xcodeproj
```

App Store 版の構成:

- App Sandbox を有効化（`TokenCat.AppStore.entitlements`）
- 買い切りアプリ内課金（StoreKit 2 / 非消費型）
- ローカル課金テスト用の `StoreKit/Products.storekit`

提出前に必要な手順（要 Apple Developer Program）:

1. `project.yml` の `DEVELOPMENT_TEAM` に自分の Team ID を設定。
2. App Store Connect で `com.tokencat.companion.*` の各 IAP（非消費型）を作成し価格を設定。
3. Xcode の StoreKit Configuration（`Products.storekit`）でローカル課金テスト → Sandbox テスター → TestFlight。
4. Archive して App Store Connect へアップロード。

> 注: App Sandbox 下で Codex 子プロセス起動・CLI 認証情報の読み取りが従来どおり動作するかは、提出前に実機検証が必要です（最大の技術リスク）。フル機能が必要なユーザー向けには GitHub Releases の直接配布版を並行提供します。

## Resources

Cat animation frames live in:

```text
Resources/CatFrames/
```

Expected file names:

- `running_0.png` ... `running_3.png`
- `tired_0.png` ... `tired_3.png`
- `sleepy_0.png` ... `sleepy_3.png`
- `exhausted_0.png` ... `exhausted_3.png`
- `collapsed_0.png` ... `collapsed_3.png`
- `unavailable_0.png` ... `unavailable_3.png`

Small transparent PNGs around 22x18 points work best in the macOS menu bar.

追加の相棒（動物）は名前空間ごとにフォルダを分けます。フレームのファイル名規則は猫と同じです。

```text
Resources/Companions/dog/        # com.tokencat.companion.dog
Resources/Companions/rabbit/     # com.tokencat.companion.rabbit
Resources/Companions/robot/      # com.tokencat.companion.robot
Resources/Companions/cat_santa/  # com.tokencat.companion.cat_santa
```

PNG が未配置の相棒は、絵文字フォールバックで表示されます（`CompanionCatalog` で定義）。

## Privacy

TokenCat does not include analytics.

Tokens are read locally at runtime and are not stored by this app. Usage data is sent only to the service required for the selected target.

Status change notifications are local macOS notifications. No notification data is sent to an external server by TokenCat.

## Uninstall

Quit TokenCat, then remove the app bundle.

```bash
rm -rf "TokenCat vol.N.app"
defaults delete com.tokencat.app 2>/dev/null
```

## License

Distributed under the [MIT License](./LICENSE).

TokenCat is based on [`token-checker`](https://github.com/otoha1119/token-checker) by otoha1119, distributed under the MIT License.

TokenCat also includes UI design portions derived from [`ccmeter`](https://github.com/s-age/ccmeter), distributed under the MIT License by s-age.

## Disclaimer

This is an unofficial third-party tool. "Anthropic", "Claude", "Claude Code", "OpenAI", and "Codex" are trademarks of their respective owners. This project is not affiliated with, endorsed by, or sponsored by Anthropic or OpenAI.
