import SwiftUI
import AppKit

/// メニューバーに表示する「猫フレーム + overall %」。
///
/// SwiftUI ビューを `ImageRenderer` で NSImage に焼いて、
/// `Image(nsImage:)` でメニューバーに渡す。
/// `MenuBarExtra` の label に SwiftUI ビューを直接渡すとフォント等が制限されるため。
struct MenuBarLabel: View {
    let viewModel: UsageViewModel
    let catAnimation: CatAnimationManager

    var body: some View {
        if let image = renderedImage {
            Image(nsImage: image)
        } else {
            Text("🐈 --%")
        }
    }

    private var renderedImage: NSImage? {
        let content = HStack(spacing: 5) {
            if let image = catAnimation.currentImage {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.none)
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 22, height: 18)
            } else {
                Text(catAnimation.currentFallback)
                    .font(.system(size: 15))
                    .frame(width: 22, height: 18)
            }

            Text(percentLabel(viewModel.overallRemainingPercent))
                .font(.system(size: 11, weight: .semibold))
                .monospacedDigit()
        }
        .padding(.horizontal, 3)
        .foregroundStyle(Color.white)

        let renderer = ImageRenderer(content: content)
        // ビットマップは高 DPI で焼いておく．image.size には触らない
        // （触ると point 単位として誤認されて表示サイズまで縮んでしまう）．
        let maxScale = NSScreen.screens.map(\.backingScaleFactor).max() ?? 2
        renderer.scale = max(maxScale, 3)
        guard let image = renderer.nsImage else { return nil }
        image.isTemplate = false
        return image
    }

    private func percentLabel(_ percent: Double?) -> String {
        guard let percent else { return "--%" }
        // メニューバーは横幅が限られるため 100% で頭打ちにし、超過は "+" で示す。
        // RateLimit.utilization は仕様上 1.0 を超えうる（Anthropic API 既知挙動）。
        if percent > 100 { return "100%+" }
        return "\(Int(max(0, percent).rounded()))%"
    }
}
