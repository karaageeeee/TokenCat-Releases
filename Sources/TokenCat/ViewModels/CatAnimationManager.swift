import AppKit
import Foundation
import Observation

@MainActor
@Observable
final class CatAnimationManager {
    var state: CatState = .running
    var currentImage: NSImage?
    var currentFallback: String

    /// 現在アニメーションさせている相棒。
    private(set) var companion: Companion

    @ObservationIgnored private let assetLoader: CatAssetLoader
    @ObservationIgnored private var framesByState: [CatState: [NSImage]] = [:]
    @ObservationIgnored private var timer: Timer?
    private var frameIndex = 0

    init(
        companion: Companion = CompanionCatalog.free,
        assetLoader: CatAssetLoader = CatAssetLoader()
    ) {
        self.companion = companion
        self.assetLoader = assetLoader
        self.currentFallback = companion.fallbackFrames(for: .running)[0]
        reloadAssets()
        updateCurrentFrame()
    }

    deinit {
        timer?.invalidate()
    }

    func start() {
        guard timer == nil else { return }
        scheduleTimer()
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    func setState(_ newState: CatState) {
        guard state != newState else { return }
        state = newState
        frameIndex = 0
        updateCurrentFrame()

        if timer != nil {
            scheduleTimer()
        }
    }

    /// 表示する相棒を切り替える。アセットを再読込し、即座に反映する。
    func setCompanion(_ newCompanion: Companion) {
        guard companion != newCompanion else { return }
        companion = newCompanion
        frameIndex = 0
        reloadAssets()
        updateCurrentFrame()
    }

    func reloadAssets() {
        framesByState = Dictionary(
            uniqueKeysWithValues: CatState.allCases.map { state in
                (state, assetLoader.loadFrames(for: state, namespace: companion.assetNamespace))
            }
        )
    }

    private func advanceFrame() {
        let imageCount = framesByState[state]?.count ?? 0
        let fallbackCount = companion.fallbackFrames(for: state).count
        let frameCount = max(imageCount, fallbackCount)
        guard frameCount > 0 else { return }
        frameIndex = (frameIndex + 1) % frameCount
        updateCurrentFrame()
    }

    private func scheduleTimer() {
        timer?.invalidate()

        let timer = Timer(timeInterval: state.frameInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.advanceFrame()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    private func updateCurrentFrame() {
        let imageFrames = framesByState[state] ?? []
        if !imageFrames.isEmpty {
            currentImage = imageFrames[frameIndex % imageFrames.count]
        } else {
            currentImage = nil
        }

        let fallbackFrames = companion.fallbackFrames(for: state)
        currentFallback = fallbackFrames[frameIndex % fallbackFrames.count]
    }
}
