import Foundation
import StoreKit

/// 所有エンタイトルメント（どの相棒を購入済みか）の抽象。
/// 真実の源は StoreKit だが、テストや非課金ビルドのために差し替え可能にしておく。
protocol EntitlementStore: Sendable {
    /// 所有済み相棒の Product ID 集合（無料相棒は含まない＝有料の所有のみ）。
    func ownedProductIDs() async -> Set<String>
    /// 指定 Product の価格表示文字列（例 "¥300"）。取得前は nil。
    func displayPrice(for productID: String) async -> String?
    /// 購入フローを起動。成功なら所有 Product ID を返す。ユーザーキャンセル/保留は nil。
    func purchase(productID: String) async throws -> String?
    /// 過去購入の復元（App Store ガイドライン必須）。
    func restore() async throws
    /// 所有状態の変化通知（返金・別デバイス購入を反映）。
    var ownershipChanges: AsyncStream<Set<String>> { get }
}

enum EntitlementError: LocalizedError {
    case productNotFound
    case purchaseUnverified
    case pending

    var errorDescription: String? {
        switch self {
        case .productNotFound: return L10n.text("store.error.product_not_found")
        case .purchaseUnverified: return L10n.text("store.error.unverified")
        case .pending: return L10n.text("store.error.pending")
        }
    }
}

/// StoreKit 2 ベースの実装。
actor StoreKitEntitlementStore: EntitlementStore {
    private let productIDs: [String]
    private var productsByID: [String: Product] = [:]
    private var didLoadProducts = false

    private let changeContinuation: AsyncStream<Set<String>>.Continuation
    let ownershipChanges: AsyncStream<Set<String>>

    private var updatesTask: Task<Void, Never>?

    init(productIDs: [String] = CompanionCatalog.allProductIDs) {
        self.productIDs = productIDs
        var continuation: AsyncStream<Set<String>>.Continuation!
        self.ownershipChanges = AsyncStream { continuation = $0 }
        self.changeContinuation = continuation
    }

    deinit {
        updatesTask?.cancel()
        changeContinuation.finish()
    }

    /// `Transaction.updates` の購読を開始する。アプリ起動直後に一度呼ぶ。
    func startObservingTransactions() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = update {
                    await transaction.finish()
                }
                let owned = await self.ownedProductIDs()
                await self.emit(owned)
            }
        }
    }

    private func emit(_ owned: Set<String>) {
        changeContinuation.yield(owned)
    }

    private func loadProductsIfNeeded() async {
        guard !didLoadProducts, !productIDs.isEmpty else { return }
        do {
            let products = try await Product.products(for: productIDs)
            productsByID = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
            didLoadProducts = true
        } catch {
            // 取得失敗時は次回再試行できるよう didLoadProducts を立てない。
        }
    }

    func ownedProductIDs() async -> Set<String> {
        var owned: Set<String> = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            // 買い切り（非消費型）のみ対象。返金済みは除外。
            if transaction.revocationDate == nil,
               productIDs.contains(transaction.productID) {
                owned.insert(transaction.productID)
            }
        }
        return owned
    }

    func displayPrice(for productID: String) async -> String? {
        await loadProductsIfNeeded()
        return productsByID[productID]?.displayPrice
    }

    func purchase(productID: String) async throws -> String? {
        await loadProductsIfNeeded()
        guard let product = productsByID[productID] else {
            throw EntitlementError.productNotFound
        }

        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                throw EntitlementError.purchaseUnverified
            }
            await transaction.finish()
            let owned = await ownedProductIDs()
            emit(owned)
            return transaction.productID
        case .pending:
            throw EntitlementError.pending
        case .userCancelled:
            return nil
        @unknown default:
            return nil
        }
    }

    func restore() async throws {
        try await AppStore.sync()
        let owned = await ownedProductIDs()
        emit(owned)
    }
}
