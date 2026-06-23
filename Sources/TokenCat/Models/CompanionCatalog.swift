import Foundation

/// 販売・配布する相棒の静的カタログ。
///
/// 価格は App Store Connect 側で設定するため、ここには持たない（StoreKit から取得する）。
/// Product ID 命名規則: `com.tokencat.companion.<id>`。
enum CompanionCatalog {
    /// 標準・無料の相棒（猫）。所有判定では常に解放扱い。
    static let free = Companion(
        id: "cat",
        displayNameKey: "companion.cat.name",
        taglineKey: "companion.cat.tagline",
        assetNamespace: "CatFrames",
        tier: .free,
        productID: nil,
        fallbackOverrides: [:]
    )

    /// 買い切りで解放できる相棒たち。
    static let paid: [Companion] = [
        Companion(
            id: "dog",
            displayNameKey: "companion.dog.name",
            taglineKey: "companion.dog.tagline",
            assetNamespace: "Companions/dog",
            tier: .paid,
            productID: "com.tokencat.companion.dog",
            fallbackOverrides: [
                .running: ["🐕", "🐾", "🐕", "🐾"],
                .tiredRunning: ["🐕", "💨", "🐕", "💨"],
                .sleepyRunning: ["🐕", "💤", "🐕", "💤"],
                .exhaustedWalking: ["🐕", "…", "🐕", "…"],
                .collapsed: ["💤", "🐕", "💤", "🐕"],
                .unavailable: ["🐕❓", "❓🐕", "🐕❓", "❓🐕"]
            ]
        ),
        Companion(
            id: "rabbit",
            displayNameKey: "companion.rabbit.name",
            taglineKey: "companion.rabbit.tagline",
            assetNamespace: "Companions/rabbit",
            tier: .paid,
            productID: "com.tokencat.companion.rabbit",
            fallbackOverrides: [
                .running: ["🐇", "🥕", "🐇", "🥕"],
                .tiredRunning: ["🐇", "💨", "🐇", "💨"],
                .sleepyRunning: ["🐇", "💤", "🐇", "💤"],
                .exhaustedWalking: ["🐇", "…", "🐇", "…"],
                .collapsed: ["💤", "🐇", "💤", "🐇"],
                .unavailable: ["🐇❓", "❓🐇", "🐇❓", "❓🐇"]
            ]
        ),
        Companion(
            id: "robot",
            displayNameKey: "companion.robot.name",
            taglineKey: "companion.robot.tagline",
            assetNamespace: "Companions/robot",
            tier: .paid,
            productID: "com.tokencat.companion.robot",
            fallbackOverrides: [
                .running: ["🤖", "⚡️", "🤖", "⚡️"],
                .tiredRunning: ["🤖", "🔧", "🤖", "🔧"],
                .sleepyRunning: ["🤖", "💤", "🤖", "💤"],
                .exhaustedWalking: ["🤖", "🪫", "🤖", "🪫"],
                .collapsed: ["🪫", "🤖", "🪫", "🤖"],
                .unavailable: ["🤖❓", "❓🤖", "🤖❓", "❓🤖"]
            ]
        ),
        Companion(
            id: "cat_santa",
            displayNameKey: "companion.cat_santa.name",
            taglineKey: "companion.cat_santa.tagline",
            assetNamespace: "Companions/cat_santa",
            tier: .paid,
            productID: "com.tokencat.companion.cat_santa",
            fallbackOverrides: [
                .running: ["🎅🐈", "🐈🎄", "🎅🐈", "🐈🎄"],
                .tiredRunning: ["🐈🎄", "🎁", "🐈🎄", "🎁"],
                .sleepyRunning: ["🐈🎄", "💤", "🐈🎄", "💤"],
                .exhaustedWalking: ["🐈🎄", "…", "🐈🎄", "…"],
                .collapsed: ["💤", "🐈🎄", "💤", "🐈🎄"],
                .unavailable: ["🐈🎄❓", "❓🐈🎄", "🐈🎄❓", "❓🐈🎄"]
            ]
        )
    ]

    /// 全相棒（無料 + 有料）。表示順 = 無料が先頭。
    static let all: [Companion] = [free] + paid

    /// 有料相棒の Product ID 一覧（StoreKit へ渡す）。
    static let allProductIDs: [String] = paid.compactMap(\.productID)

    static func companion(withID id: String) -> Companion? {
        all.first { $0.id == id }
    }

    static func companion(forProductID productID: String) -> Companion? {
        all.first { $0.productID == productID }
    }
}
