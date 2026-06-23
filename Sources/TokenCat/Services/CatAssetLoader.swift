import AppKit
import Foundation

struct CatAssetLoader: Sendable {
    func loadFrames(for state: CatState) -> [NSImage] {
        (0..<state.expectedFrameCount).compactMap { index in
            image(named: "\(state.assetPrefix)_\(index)")
        }
    }

    private func image(named baseName: String) -> NSImage? {
        for url in candidateURLs(for: baseName) {
            guard FileManager.default.fileExists(atPath: url.path),
                  let image = NSImage(contentsOf: url) else {
                continue
            }
            image.isTemplate = false
            return image
        }
        return nil
    }

    private func candidateURLs(for baseName: String) -> [URL] {
        var urls: [URL?] = [
            Bundle.main.url(forResource: baseName, withExtension: "png", subdirectory: "CatFrames"),
            Bundle.main.url(forResource: baseName, withExtension: "png"),
            Bundle.main.resourceURL?.appendingPathComponent("CatFrames/\(baseName).png")
        ]

        if let executableURL = Bundle.main.executableURL {
            let contentsURL = executableURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
            urls.append(contentsURL.appendingPathComponent("Resources/CatFrames/\(baseName).png"))
        }

        urls.append(
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
                .appendingPathComponent("Resources/CatFrames/\(baseName).png")
        )

        return urls.compactMap { $0 }
    }
}
