import Foundation

/// macOS Keychain から Claude Code の OAuth トークンを読み取る。
///
/// `/usr/bin/security find-generic-password -s "Claude Code-credentials" -w` を spawn する。
/// 直接 Security framework を叩いてもよいが、CLI 経由のほうが ACL 確認のダイアログ UX が
/// 安定する。
struct KeychainTokenSource: Sendable {
    static let serviceName = "Claude Code-credentials"

    /// Keychain のレコード値（JSON）から access_token を抜き出して返す。
    func readAccessToken() async throws -> String {
        let username = ProcessInfo.processInfo.environment["USER"] ?? NSUserName()

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/security")
        process.arguments = [
            "find-generic-password",
            "-a", username,
            "-s", Self.serviceName,
            "-w",
        ]

        let stdoutPipe = Pipe()
        process.standardOutput = stdoutPipe
        // stderr は捨て読みもしない。FileHandle.nullDevice に向けてパイプバッファ詰まりと
        // waitUntilExit のデッドロック経路をそもそも作らない。
        process.standardError = FileHandle.nullDevice

        // 旧実装は process.waitUntilExit() を同期で呼んでおり、Keychain ACL ダイアログ
        // 表示中に Swift Concurrency の Cooperative Thread Pool を奪っていた。
        // terminationHandler ベースで Continuation を解決し、async に整合させる。
        do {
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                process.terminationHandler = { _ in cont.resume() }
                do {
                    try process.run()
                } catch {
                    // run() が throw すると terminationHandler は発火しない。
                    // ここで Continuation を一度だけ resume する。
                    process.terminationHandler = nil
                    cont.resume(throwing: DomainError.keychainTokenMissing)
                }
            }
        } catch {
            throw DomainError.keychainTokenMissing
        }

        guard process.terminationStatus == 0 else {
            throw DomainError.keychainTokenMissing
        }

        let data = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let payload: KeychainPayload
        do {
            payload = try JSONDecoder().decode(KeychainPayload.self, from: data)
        } catch {
            throw DomainError.decoding("Keychain payload: \(error.localizedDescription)")
        }

        guard let token = payload.claudeAiOauth?.accessToken, !token.isEmpty else {
            throw DomainError.keychainTokenMissing
        }
        return token
    }
}

/// Claude Code が Keychain に保存する JSON 構造。
private struct KeychainPayload: Decodable {
    let claudeAiOauth: OAuth?

    enum CodingKeys: String, CodingKey {
        case claudeAiOauth = "claudeAiOauth"
    }

    struct OAuth: Decodable {
        let accessToken: String?

        enum CodingKeys: String, CodingKey {
            case accessToken = "accessToken"
        }
    }
}
