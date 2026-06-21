import Foundation

enum PollingInterval: Int, CaseIterable, Identifiable, Codable, Sendable {
    case sec30 = 30
    case min1 = 60
    case min2 = 120
    case min5 = 300
    case min10 = 600

    var id: Int { rawValue }
    var seconds: TimeInterval { TimeInterval(rawValue) }

    var label: String {
        switch self {
        case .sec30: return L10n.text("polling.30_seconds")
        case .min1:  return L10n.text("polling.1_minute")
        case .min2:  return L10n.text("polling.2_minutes")
        case .min5:  return L10n.text("polling.5_minutes")
        case .min10: return L10n.text("polling.10_minutes")
        }
    }

    /// Anthropic OAuth usage エンドポイントの暗黙レートリミットを考慮して 5 分をデフォルトに。
    /// 値表示用としては十分で、`oauth/usage` への過剰アクセスを避けられる。
    static let `default`: PollingInterval = .min5
}
