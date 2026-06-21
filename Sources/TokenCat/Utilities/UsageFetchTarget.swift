import Foundation

enum UsageFetchTarget: Int, CaseIterable, Identifiable, Codable, Sendable {
    case claude = 0
    case codex = 1

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .claude:
            return "Claude Code"
        case .codex:
            return "Codex"
        }
    }

    var includesClaude: Bool {
        switch self {
        case .claude:
            return true
        case .codex:
            return false
        }
    }

    var includesCodex: Bool {
        switch self {
        case .codex:
            return true
        case .claude:
            return false
        }
    }

    static let `default`: UsageFetchTarget = .claude
}
