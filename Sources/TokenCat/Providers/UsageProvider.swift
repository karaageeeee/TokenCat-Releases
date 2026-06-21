import Foundation

/// Claude / Codex / Mock を差し替え可能にするための抽象。
protocol UsageProvider: Sendable {
    /// 1 サービスぶんの使用状況を返す。失敗時は DomainError を throw。
    func fetch() async throws -> ServiceUsage

    /// 子プロセスや永続接続を持つ実装はここで解放する。
    /// アプリ終了時 (applicationWillTerminate) に同期的に呼ばれる前提。
    func shutdown() async
}

extension UsageProvider {
    /// stateless な実装向けのデフォルト。何もしない。
    func shutdown() async {}
}
