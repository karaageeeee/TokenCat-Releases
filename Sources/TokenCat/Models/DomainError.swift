import Foundation

enum DomainError: Error, Equatable, LocalizedError, Sendable {
    case keychainTokenMissing
    case anthropicUnauthorized
    case anthropicRateLimited(retryAfter: TimeInterval?)
    case anthropicHTTP(status: Int)
    case codexCLINotFound
    case codexProcessExited
    case codexRPCError(message: String)
    case decoding(String)
    case timeout
    case network(String)

    /// 一時的（自動で回復しうる）エラーかどうか。
    ///
    /// true の場合、取得失敗時に直近の成功データを保持して表示のチラつき（途切れ）を防ぐ。
    /// false はユーザーの対応（再ログイン等）が必要な恒久的エラーで、UI に状態として表示する。
    var isTransient: Bool {
        switch self {
        case .anthropicRateLimited, .network, .timeout, .decoding, .codexProcessExited:
            return true
        case .anthropicHTTP(let status):
            return status >= 500
        case .keychainTokenMissing, .anthropicUnauthorized, .codexCLINotFound, .codexRPCError:
            return false
        }
    }

    /// レート制限のとき、次回取得まで待つべき秒数（分かれば）。
    var rateLimitRetryAfter: TimeInterval? {
        if case .anthropicRateLimited(let retryAfter) = self {
            return retryAfter
        }
        return nil
    }

    var errorDescription: String? {
        switch self {
        case .keychainTokenMissing:
            return L10n.text("error.keychain_token_missing")
        case .anthropicUnauthorized:
            return L10n.text("error.anthropic_unauthorized")
        case .anthropicRateLimited(let retryAfter):
            if let sec = retryAfter {
                let mins = max(1, Int((sec / 60).rounded()))
                return L10n.format("error.anthropic_rate_limited_retry", mins)
            }
            return L10n.text("error.anthropic_rate_limited")
        case .anthropicHTTP(let status):
            return L10n.format("error.anthropic_http", status)
        case .codexCLINotFound:
            return L10n.text("error.codex_cli_not_found")
        case .codexProcessExited:
            return L10n.text("error.codex_process_exited")
        case .codexRPCError(let message):
            return L10n.format("error.codex_rpc", message)
        case .decoding(let detail):
            return L10n.format("error.decoding", detail)
        case .timeout:
            return L10n.text("error.timeout")
        case .network(let detail):
            return L10n.format("error.network", detail)
        }
    }
}
