import Foundation

enum CatState: CaseIterable, Equatable, Sendable {
    case running
    case tiredRunning
    case sleepyRunning
    case exhaustedWalking
    case collapsed
    case unavailable

    static func from(usagePercent: Double) -> CatState {
        switch usagePercent {
        case 0..<31:
            return .running
        case 31..<61:
            return .tiredRunning
        case 61..<81:
            return .sleepyRunning
        case 81..<96:
            return .exhaustedWalking
        default:
            return .collapsed
        }
    }

    static func from(remainingPercent: Double) -> CatState {
        let clampedPercent = min(max(remainingPercent, 0), 100)

        switch clampedPercent {
        case 70...100:
            return .running
        case 40..<70:
            return .tiredRunning
        case 20..<40:
            return .sleepyRunning
        case 5..<20:
            return .exhaustedWalking
        default:
            return .collapsed
        }
    }

    var frameInterval: TimeInterval {
        switch self {
        case .running:
            return 0.15
        case .tiredRunning:
            return 0.22
        case .sleepyRunning:
            return 0.28
        case .exhaustedWalking:
            return 0.36
        case .collapsed:
            return 0.5
        case .unavailable:
            return 0.65
        }
    }

    var displayName: String {
        switch self {
        case .running:
            return L10n.text("cat_state.running")
        case .tiredRunning:
            return L10n.text("cat_state.tired_running")
        case .sleepyRunning:
            return L10n.text("cat_state.sleepy_running")
        case .exhaustedWalking:
            return L10n.text("cat_state.exhausted_walking")
        case .collapsed:
            return L10n.text("cat_state.collapsed")
        case .unavailable:
            return L10n.text("cat_state.unavailable")
        }
    }

    var assetPrefix: String {
        switch self {
        case .running:
            return "running"
        case .tiredRunning:
            return "tired"
        case .sleepyRunning:
            return "sleepy"
        case .exhaustedWalking:
            return "exhausted"
        case .collapsed:
            return "collapsed"
        case .unavailable:
            return "unavailable"
        }
    }

    var expectedFrameCount: Int {
        switch self {
        case .running, .tiredRunning, .sleepyRunning, .exhaustedWalking, .collapsed, .unavailable:
            return 4
        }
    }

    var fallbackFrames: [String] {
        switch self {
        case .running:
            return ["🐈", "🐈‍⬛", "🐈", "🐈‍⬛"]
        case .tiredRunning:
            return ["🐈", "🐾", "🐈", "🐾"]
        case .sleepyRunning:
            return ["🐈", "💤", "🐈", "💤"]
        case .exhaustedWalking:
            return ["🐈", "…", "🐈", "…"]
        case .collapsed:
            return ["💤", "🐈", "💤", "🐈"]
        case .unavailable:
            return ["🐈🐤", "🐤🐈", "🐈🐤", "🐤🐈"]
        }
    }
}
