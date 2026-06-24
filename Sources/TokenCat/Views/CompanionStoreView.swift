import SwiftUI
import AppKit

/// ポップオーバー内の相棒ストア。相棒の切り替え・買い切りアンロック・購入復元を提供する。
struct CompanionStoreView: View {
    @Bindable var store: CompanionStore
    /// ストアで現在フォーカス中の相棒（プレビュー対象）。選択中とは別概念。
    @State private var focused: Companion?

    private var focusedCompanion: Companion {
        focused ?? store.selectedCompanion
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(L10n.text("store.title"))
                    .font(.system(size: 12, weight: .semibold))
                Spacer()
                Button(L10n.text("store.restore")) {
                    Task { await store.restore() }
                }
                .buttonStyle(.borderless)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .help(L10n.text("store.restore.help"))
            }

            chipRow
            detailPanel

            if let message = store.errorMessage {
                Text(message)
                    .font(.system(size: 10))
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.allCompanions) { companion in
                    chip(for: companion)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func chip(for companion: Companion) -> some View {
        let isFocused = companion.id == focusedCompanion.id
        let owned = store.isOwned(companion)
        return Button {
            focused = companion
        } label: {
            VStack(spacing: 3) {
                CompanionPreviewView(companion: companion, state: .running)
                    .frame(width: 40, height: 40)
                    .opacity(owned ? 1 : 0.55)
                    .overlay(alignment: .topTrailing) {
                        if !owned {
                            Image(systemName: "lock.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                                .padding(2)
                        } else if store.selectedCompanion.id == companion.id {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(.green)
                        }
                    }
                Text(L10n.text(companion.displayNameKey))
                    .font(.system(size: 9))
                    .lineLimit(1)
            }
            .frame(width: 52)
            .padding(4)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isFocused ? Color.accentColor.opacity(0.15) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var detailPanel: some View {
        let companion = focusedCompanion
        let owned = store.isOwned(companion)

        HStack(alignment: .center, spacing: 10) {
            CompanionPreviewView(companion: companion, state: .running)
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 2) {
                Text(L10n.text(companion.displayNameKey))
                    .font(.system(size: 12, weight: .medium))
                Text(L10n.text(companion.taglineKey))
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)

            actionButton(for: companion, owned: owned)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.secondary.opacity(0.08))
        )
    }

    @ViewBuilder
    private func actionButton(for companion: Companion, owned: Bool) -> some View {
        if owned {
            if store.selectedCompanion.id == companion.id {
                Label(L10n.text("store.selected"), systemImage: "checkmark")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.green)
                    .labelStyle(.titleAndIcon)
            } else {
                Button(L10n.text("store.use")) {
                    store.select(companion)
                }
                .controlSize(.small)
            }
        } else {
            Button {
                Task { await store.purchase(companion) }
            } label: {
                if store.isPurchasing(companion) {
                    ProgressView().controlSize(.small)
                } else {
                    Text(unlockLabel(for: companion))
                }
            }
            .controlSize(.small)
            .buttonStyle(.borderedProminent)
            .disabled(store.purchasingCompanionID != nil)
        }
    }

    private func unlockLabel(for companion: Companion) -> String {
        if let price = store.displayPrice(for: companion) {
            return L10n.format("store.unlock_price", price)
        }
        return L10n.text("store.unlock")
    }
}

/// 指定した相棒・状態のアニメーションを表示する小さなプレビュー。
/// PNG が無い相棒はフォールバック絵文字でアニメーションする（購入前でも動きが見える）。
struct CompanionPreviewView: View {
    let companion: Companion
    let state: CatState

    @State private var frames: [NSImage] = []

    private let loader = CatAssetLoader()

    var body: some View {
        TimelineView(.periodic(from: .now, by: state.frameInterval)) { context in
            content(at: context.date)
        }
        .task(id: companion.id) {
            frames = loader.loadFrames(for: state, namespace: companion.assetNamespace)
        }
    }

    @ViewBuilder
    private func content(at date: Date) -> some View {
        if !frames.isEmpty {
            let index = frameIndex(at: date, count: frames.count)
            Image(nsImage: frames[index])
                .resizable()
                .interpolation(.none)
                .aspectRatio(contentMode: .fit)
        } else {
            let fallback = companion.fallbackFrames(for: state)
            let index = frameIndex(at: date, count: fallback.count)
            Text(fallback[index])
                .font(.system(size: 26))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
        }
    }

    private func frameIndex(at date: Date, count: Int) -> Int {
        guard count > 0 else { return 0 }
        let tick = Int(date.timeIntervalSinceReferenceDate / state.frameInterval)
        return ((tick % count) + count) % count
    }
}
