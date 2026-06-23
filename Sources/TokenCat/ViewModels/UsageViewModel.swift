import AppKit
import Foundation
import Observation
import OSLog

@MainActor
@Observable
final class UsageViewModel {
    // applicationWillTerminate から MainActor を経由せず shutdown を呼べるよう
    // nonisolated 化する。providers 自体は immutable なので Sendable 違反は起きない。
    private nonisolated let claudeProvider: UsageProvider
    private nonisolated let codexProvider: UsageProvider

    var snapshot: UsageSnapshot = .empty
    var isLoading: Bool = false
    var pollingInterval: PollingInterval {
        didSet { persistInterval() }
    }
    var usageFetchTarget: UsageFetchTarget {
        didSet { persistFetchTarget() }
    }
    var pollingLoopID: String {
        "\(pollingInterval.rawValue)-\(usageFetchTarget.rawValue)"
    }
    var isClaudeFetchEnabled: Bool {
        usageFetchTarget.includesClaude
    }
    var isCodexFetchEnabled: Bool {
        usageFetchTarget.includesCodex
    }
    var claudeUsagePercent: Double? {
        utilizationPercent(from: snapshot.claude)
    }
    var codexUsagePercent: Double? {
        utilizationPercent(from: snapshot.codex)
    }
    var overallUsagePercent: Double? {
        let values = [
            isClaudeFetchEnabled ? claudeUsagePercent : nil,
            isCodexFetchEnabled ? codexUsagePercent : nil
        ].compactMap { $0 }
        return values.max()
    }
    var overallRemainingPercent: Double? {
        guard let overallUsagePercent else { return nil }
        return max(0, 100 - min(overallUsagePercent, 100))
    }
    var catState: CatState {
        switch selectedUsageResult {
        case .some(.failure):
            return .unavailable
        case .some(.success):
            guard let overallRemainingPercent else { return .unavailable }
            return CatState.from(remainingPercent: overallRemainingPercent)
        case .none:
            return isLoading ? .running : .unavailable
        }
    }

    init(
        claudeProvider: UsageProvider = ClaudeUsageProvider(),
        codexProvider: UsageProvider = CodexUsageProvider()
    ) {
        self.claudeProvider = claudeProvider
        self.codexProvider = codexProvider
        self.pollingInterval = Self.loadPersistedInterval()
        self.usageFetchTarget = Self.loadPersistedFetchTarget()
    }

    /// `task(id: pollingInterval)` から駆動するメインループ。
    func runPollingLoop() async {
        await refresh()
        while !Task.isCancelled {
            do {
                try await Task.sleep(nanoseconds: UInt64(pollingInterval.seconds * 1_000_000_000))
            } catch {
                return
            }
            await refresh()
        }
    }

    /// アプリ終了時に子プロセスや永続接続を解放するためのクロージャを返す。
    ///
    /// `@MainActor` final class である自身を `@Sendable` クロージャがキャプチャできないため
    /// (Swift 6 strict-concurrency でエラー)、Sendable な providers だけを閉じ込めて公開する。
    /// AppDelegate.applicationWillTerminate からは MainActor を経由せず呼ばれる。
    nonisolated func makeShutdownHandler() -> @Sendable () async -> Void {
        let claude = claudeProvider
        let codex = codexProvider
        return {
            await claude.shutdown()
            await codex.shutdown()
        }
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        switch usageFetchTarget {
        case .claude:
            let claude = await fetchClaude()
            snapshot = UsageSnapshot(claude: claude, codex: nil, fetchedAt: Date())
        case .codex:
            let codex = await fetchCodex()
            snapshot = UsageSnapshot(claude: nil, codex: codex, fetchedAt: Date())
        }
    }

    private func fetchClaude() async -> Result<ServiceUsage, DomainError> {
        do {
            return .success(try await claudeProvider.fetch())
        } catch let err as DomainError {
            Logger.claude.error("fetch failed: \(err.localizedDescription)")
            return .failure(err)
        } catch {
            return .failure(.network(error.localizedDescription))
        }
    }

    private func fetchCodex() async -> Result<ServiceUsage, DomainError> {
        do {
            return .success(try await codexProvider.fetch())
        } catch let err as DomainError {
            Logger.codex.error("fetch failed: \(err.localizedDescription)")
            return .failure(err)
        } catch {
            return .failure(.network(error.localizedDescription))
        }
    }

    private var selectedUsageResult: Result<ServiceUsage, DomainError>? {
        switch usageFetchTarget {
        case .claude:
            return snapshot.claude
        case .codex:
            return snapshot.codex
        }
    }

    private func utilizationPercent(from result: Result<ServiceUsage, DomainError>?) -> Double? {
        guard case .success(let usage) = result,
              let utilization = [
                usage.fiveHour?.utilization,
                usage.weekly?.utilization,
                usage.weeklySonnet?.utilization
              ].compactMap({ $0 }).max() else {
            return nil
        }
        return max(0, utilization * 100)
    }

    // MARK: - ログインボタン

    /// どのサービスを再ログインするかは enum 型で表現する。
    /// 任意文字列を AppleScript に渡せないようにしてインジェクションを「型として」不能にする。
    enum LoginTarget {
        case claude
        case codex

        var command: String {
            switch self {
            case .claude: return "claude login"
            case .codex:  return "codex login"
            }
        }
    }

    func openClaudeLogin() { spawnLogin(.claude) }
    func openCodexLogin()  { spawnLogin(.codex) }

    func openSelectedWorkTarget() {
        switch usageFetchTarget {
        case .claude:
            spawnWork(.claude)
        case .codex:
            spawnWork(.codex)
        }
    }

    func openClaudeUpgrade() {
        guard let url = URL(string: "https://claude.ai/upgrade") else { return }
        NSWorkspace.shared.open(url)
    }

    func openCodexUpgrade() {
        guard let url = URL(string: "https://chatgpt.com/#pricing") else { return }
        NSWorkspace.shared.open(url)
    }

    private func spawnLogin(_ target: LoginTarget) {
        spawnTerminalCommand(target.command, logContext: "login")
    }

    private func spawnWork(_ target: LoginTarget) {
        let app: WorkTargetApp
        switch target {
        case .claude:
            app = .claude
        case .codex:
            app = .codex
        }
        openWorkApp(app)
    }

    private enum WorkTargetApp {
        case claude
        case codex

        var bundleIdentifier: String {
            switch self {
            case .claude:
                return "com.anthropic.claudefordesktop"
            case .codex:
                return "com.openai.codex"
            }
        }

        var appPaths: [String] {
            switch self {
            case .claude:
                return [
                    "/Applications/Claude.app",
                    "\(NSHomeDirectory())/Applications/Claude.app"
                ]
            case .codex:
                return [
                    "/Applications/Codex.app",
                    "\(NSHomeDirectory())/Applications/Codex.app"
                ]
            }
        }
    }

    private func openWorkApp(_ app: WorkTargetApp) {
        let workspace = NSWorkspace.shared

        for path in app.appPaths {
            let url = URL(fileURLWithPath: path)
            guard FileManager.default.fileExists(atPath: url.path) else { continue }
            if workspace.open(url) {
                return
            }
        }

        guard let url = workspace.urlForApplication(withBundleIdentifier: app.bundleIdentifier) else {
            Logger.ui.error("work app not found: \(app.bundleIdentifier)")
            return
        }
        if !workspace.open(url) {
            Logger.ui.error("work app open failed: \(app.bundleIdentifier)")
        }
    }

    private func spawnTerminalCommand(_ command: String, logContext: String) {
        let script = """
        tell application "Terminal"
            activate
            do script "\(command)"
        end tell
        """
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        process.arguments = ["-e", script]
        do { try process.run() } catch {
            Logger.ui.error("\(logContext) spawn failed: \(error.localizedDescription)")
        }
    }

    // MARK: - 永続化

    private static let intervalKey = "pollingInterval"
    private static let fetchTargetKey = "usageFetchTarget"

    private static func loadPersistedInterval() -> PollingInterval {
        let raw = UserDefaults.standard.integer(forKey: intervalKey)
        return PollingInterval(rawValue: raw) ?? .default
    }

    private static func loadPersistedFetchTarget() -> UsageFetchTarget {
        guard UserDefaults.standard.object(forKey: fetchTargetKey) != nil else {
            return .default
        }

        let raw = UserDefaults.standard.integer(forKey: fetchTargetKey)
        return UsageFetchTarget(rawValue: raw) ?? .default
    }

    private func persistInterval() {
        UserDefaults.standard.set(pollingInterval.rawValue, forKey: Self.intervalKey)
    }

    private func persistFetchTarget() {
        UserDefaults.standard.set(usageFetchTarget.rawValue, forKey: Self.fetchTargetKey)
    }
}
