import Foundation
import UserNotifications

@MainActor
final class StatusNotificationManager {
    private let center: UNUserNotificationCenter
    private var didRequestAuthorization = false
    private var shouldSuppressNextStatusChange = false

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    func requestAuthorizationIfNeeded() {
        guard !didRequestAuthorization else { return }
        didRequestAuthorization = true

        Task {
            do {
                _ = try await center.requestAuthorization(options: [.alert, .sound])
            } catch {
                // 通知許可に失敗しても使用量表示自体は継続する。
            }
        }
    }

    func suppressNextStatusChange() {
        shouldSuppressNextStatusChange = true
    }

    func notifyFetchTargetChange(from oldTarget: UsageFetchTarget, to newTarget: UsageFetchTarget) {
        guard oldTarget != newTarget else { return }

        Task {
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                return
            }

            let content = UNMutableNotificationContent()
            content.title = L10n.text("notification.target_changed.title")
            content.body = L10n.format("notification.target_changed.body", oldTarget.label, newTarget.label)
            content.sound = .default

            let request = UNNotificationRequest(
                identifier: "tokencat-target-\(Date().timeIntervalSince1970)",
                content: content,
                trigger: nil
            )
            try? await center.add(request)
        }
    }

    func notifyStatusChange(
        from oldState: CatState,
        to newState: CatState,
        remainingPercent: Double?,
        target: UsageFetchTarget
    ) {
        guard oldState != newState else { return }
        if shouldSuppressNextStatusChange {
            shouldSuppressNextStatusChange = false
            return
        }

        Task {
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                return
            }

            let content = UNMutableNotificationContent()
            content.title = L10n.text("notification.status_changed.title")
            content.body = L10n.format(
                statusBodyKey(for: newState),
                target.label,
                remainingText(remainingPercent)
            )
            content.sound = .default

            let request = UNNotificationRequest(
                identifier: "tokencat-status-\(Date().timeIntervalSince1970)",
                content: content,
                trigger: nil
            )
            try? await center.add(request)
        }
    }

    private func statusBodyKey(for state: CatState) -> String {
        switch state {
        case .running:
            return "notification.status.running"
        case .tiredRunning:
            return "notification.status.tired_running"
        case .sleepyRunning:
            return "notification.status.sleepy_running"
        case .exhaustedWalking:
            return "notification.status.exhausted_walking"
        case .collapsed:
            return "notification.status.collapsed"
        case .unavailable:
            return "notification.status.unavailable"
        }
    }

    private func remainingText(_ percent: Double?) -> String {
        guard let percent else { return "" }
        if percent > 100 { return L10n.text("notification.remaining_over_100") }
        return L10n.format("notification.remaining", Int(max(0, percent).rounded()))
    }
}
