import AppKit
import Foundation

struct CatAssetLoader: Sendable {
    /// 指定した相棒・状態の PNG フレームを読み込む。
    /// アセットは `<namespace>/<prefix>_<index>.png` に置かれる想定。
    /// 例: 猫 = `CatFrames/running_0.png`、犬 = `Companions/dog/running_0.png`。
    func loadFrames(for state: CatState, namespace: String) -> [NSImage] {
        (0..<state.expectedFrameCount).compactMap { index in
            image(named: "\(state.assetPrefix)_\(index)", namespace: namespace)
        }
    }

    private func image(named baseName: String, namespace: String) -> NSImage? {
        for url in candidateURLs(for: baseName, namespace: namespace) {
            guard FileManager.default.fileExists(atPath: url.path),
                  let image = NSImage(contentsOf: url) else {
                continue
            }
            image.isTemplate = false
            return image
        }
        return nil
    }

    private func candidateURLs(for baseName: String, namespace: String) -> [URL] {
        // namespace は "CatFrames" や "Companions/dog" のように 1 段以上のサブパスを取りうる。
        let lastComponent = namespace.split(separator: "/").last.map(String.init)

        var urls: [URL?] = [
            // バンドルに namespace ごと展開された場合（Xcode の folder reference など）。
            Bundle.main.url(forResource: baseName, withExtension: "png", subdirectory: namespace),
            lastComponent.flatMap {
                Bundle.main.url(forResource: baseName, withExtension: "png", subdirectory: $0)
            },
            Bundle.main.url(forResource: baseName, withExtension: "png"),
            Bundle.main.resourceURL?.appendingPathComponent("\(namespace)/\(baseName).png")
        ]

        if let executableURL = Bundle.main.executableURL {
            let contentsURL = executableURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
            urls.append(contentsURL.appendingPathComponent("Resources/\(namespace)/\(baseName).png"))
        }

        urls.append(
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
                .appendingPathComponent("Resources/\(namespace)/\(baseName).png")
        )

        return urls.compactMap { $0 }
    }
}
