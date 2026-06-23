# TokenCat

TokenCat は、Claude Code または Codex の使用状況を macOS のメニューバーで確認できる常駐アプリです。

猫のドット絵アニメーションと残り使用率をメニューバーに表示し、使用量が増えるほど猫の状態が変わります。

配布用アプリは `TokenCat vol.N.app` の形式で作成されます。変更履歴と古いバージョンは Git/GitHub のブランチ、コミット、タグ、リリースで管理します。

## Features

- macOS メニューバー常駐アプリ
- 猫のドット絵アニメーションをメニューバーに表示
- 残り使用率の数字を白色で表示
- 取得対象を `Claude Code` または `Codex` から選択
- 選択中の AI だけトークン使用状況を表示
- 対象外の AI セクションは非表示
- `Target` / `Overall Used` / `Remaining` / `現在の状態` のサマリー表示
- `現在の状態` が変わったときに macOS 通知を送信
- 手動更新、更新間隔設定、ログイン時自動起動
- PNG フレームが読めない場合は絵文字表示にフォールバック

## Current UI

メニューバーには、猫フレームと全体の残り使用率が表示されます。

ポップオーバー上部のサマリー:

```text
Target:
Overall Used:
Remaining:
現在の状態:
```

詳細セクションは、現在の取得対象だけ表示されます。

```text
Target: Claude Code -> Claude Code の詳細のみ表示
Target: Codex       -> Codex の詳細のみ表示
```

## How It Works

TokenCat は、Mac 上でログイン済みの CLI 認証情報を使って使用状況を取得します。

- Claude Code: macOS Keychain の `Claude Code-credentials` から OAuth トークンを読み、Anthropic の usage endpoint を呼び出します。
- Codex: `codex app-server` を起動し、line-delimited JSON-RPC で rate limit を取得します。

取得するのは、設定画面で選ばれている対象だけです。

## Cat States

猫の状態は、残り使用率から決まります。

| Remaining | State |
| --- | --- |
| 70-100% | `running` |
| 40-69% | `tiredRunning` |
| 20-39% | `sleepyRunning` |
| 5-19% | `exhaustedWalking` |
| 0-4% | `collapsed` |

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
