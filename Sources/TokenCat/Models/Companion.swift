import Foundation

/// メニューバーに住む「相棒（動物）」。
///
/// TokenCat は当初「猫」だけだったが、マネタイズに伴い犬・うさぎ・ロボット・季節スキンなどを
/// 追加していく。各 Companion はアニメーション状態（`CatState`）を共通で持ち、
/// アセットの名前空間（`assetNamespace`）と購入ティア（`tier`）だけが異なる。
struct Companion: Identifiable, Hashable, Sendable {
    /// 安定 ID。アセットフォルダ名・StoreKit Product ID・永続化キーに使う。
    let id: String
    /// 表示名の L10n キー。
    let displayNameKey: String
    /// 一言キャッチコピーの L10n キー（ストアでの訴求用）。
    let taglineKey: String
    /// アセット解決時のサブフォルダ名。`CatAssetLoader` が `<namespace>/<prefix>_<index>.png` を探す。
    let assetNamespace: String
    /// 課金ティア。
    let tier: Tier
    /// 有料相棒の StoreKit Product ID。無料相棒は nil。
    let productID: String?
    /// PNG が読めないときのフォールバック絵文字（state ごとに上書きしたい場合のみ）。
    /// nil の state は `CatState.fallbackFrames`（猫の既定）を使う。
    let fallbackOverrides: [CatState: [String]]

    enum Tier: Sendable, Hashable {
        /// 標準・無料（猫）。
        case free
        /// 買い切りアンロック。
        case paid
    }

    var isFree: Bool { tier == .free }

    /// 指定 state のフォールバック絵文字フレーム。
    func fallbackFrames(for state: CatState) -> [String] {
        fallbackOverrides[state] ?? state.fallbackFrames
    }
}
