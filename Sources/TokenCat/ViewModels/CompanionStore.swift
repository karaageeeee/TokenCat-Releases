import Foundation
import Observation

/// 相棒の選択・所有状態・購入を束ねる UI 向けファサード。
/// 所有判定は `EntitlementStore`（StoreKit）に委譲し、本クラスは UI 状態と永続化を担う。
@MainActor
@Observable
final class CompanionStore {
    /// 現在メニューバーに表示している相棒。
    private(set) var selectedCompanion: Companion
    /// 所有済み有料相棒の Product ID。
    private(set) var ownedProductIDs: Set<String> = []
    /// Product ID → 価格表示文字列。
    private(set) var prices: [String: String] = [:]
    /// 購入処理中の相棒 ID（UI のスピナー用）。
    private(set) var purchasingCompanionID: String?
    /// 直近のエラーメッセージ（トースト用）。
    var errorMessage: String?

    @ObservationIgnored private let entitlements: EntitlementStore
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var observationTask: Task<Void, Never>?

    private static let selectedKey = "selectedCompanionID"

    init(
        entitlements: EntitlementStore = StoreKitEntitlementStore(),
        defaults: UserDefaults = .standard
    ) {
        self.entitlements = entitlements
        self.defaults = defaults

        let storedID = defaults.string(forKey: Self.selectedKey)
        self.selectedCompanion = storedID
            .flatMap(CompanionCatalog.companion(withID:)) ?? CompanionCatalog.free
    }

    deinit {
        observationTask?.cancel()
    }

    var allCompanions: [Companion] { CompanionCatalog.all }

    func isOwned(_ companion: Companion) -> Bool {
        if companion.isFree { return true }
        guard let productID = companion.productID else { return false }
        return ownedProductIDs.contains(productID)
    }

    func displayPrice(for companion: Companion) -> String? {
        guard let productID = companion.productID else { return nil }
        return prices[productID]
    }

    func isPurchasing(_ companion: Companion) -> Bool {
        purchasingCompanionID == companion.id
    }

    /// 起動時に一度呼ぶ。トランザクション購読・所有状態取得・価格取得・選択検証。
    func bootstrap() async {
        if let store = entitlements as? StoreKitEntitlementStore {
            await store.startObservingTransactions()
        }
        startObservingOwnershipChanges()
        await refreshOwnership()
        await refreshPrices()
        revalidateSelectionIfNeeded()
    }

    /// 相棒を選択（所有済みのみ）。未所有なら何もしない（UI 側でアンロックを促す）。
    func select(_ companion: Companion) {
        guard isOwned(companion) else { return }
        selectedCompanion = companion
        defaults.set(companion.id, forKey: Self.selectedKey)
    }

    /// 買い切り購入。成功したら自動で選択する。
    func purchase(_ companion: Companion) async {
        guard let productID = companion.productID, !isOwned(companion) else { return }
        purchasingCompanionID = companion.id
        errorMessage = nil
        defer { purchasingCompanionID = nil }

        do {
            if let purchased = try await entitlements.purchase(productID: productID) {
                ownedProductIDs.insert(purchased)
                select(companion)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// 購入の復元。
    func restore() async {
        errorMessage = nil
        do {
            try await entitlements.restore()
            await refreshOwnership()
            revalidateSelectionIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Private

    private func startObservingOwnershipChanges() {
        guard observationTask == nil else { return }
        observationTask = Task { [weak self] in
            guard let stream = self?.entitlements.ownershipChanges else { return }
            for await owned in stream {
                guard let self else { return }
                self.ownedProductIDs = owned
                self.revalidateSelectionIfNeeded()
            }
        }
    }

    private func refreshOwnership() async {
        ownedProductIDs = await entitlements.ownedProductIDs()
    }

    private func refreshPrices() async {
        for companion in CompanionCatalog.paid {
            guard let productID = companion.productID else { continue }
            if let price = await entitlements.displayPrice(for: productID) {
                prices[productID] = price
            }
        }
    }

    /// 選択中の相棒が未所有になった（返金等）場合に無料相棒へ戻す。
    private func revalidateSelectionIfNeeded() {
        if !isOwned(selectedCompanion) {
            select(CompanionCatalog.free)
        }
    }
}
