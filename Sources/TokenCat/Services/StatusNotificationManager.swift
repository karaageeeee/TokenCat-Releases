import Foundation
import UserNotifications

@MainActor
final class StatusNotificationManager {
    private let center: UNUserNotificationCenter
    private var didRequestAuthorization = false
    private var shouldSuppressNextStatusChange = false
    /// 一度でもデータ取得に成功（unavailable 以外）したか。
    /// 起動直後の初回取得を「復帰」と誤認しないためのガード。
    private var hasLeftInitialState = false

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

        // 起動直後、初めて unavailable を抜ける遷移は通知しない（その日最初の挨拶で十分）。
        // 一度でも取得できた後に unavailable から復帰したときだけ「お帰りなさい」。
        let isFirstLeave = !hasLeftInitialState && oldState == .unavailable && newState != .unavailable
        let isRecovery = hasLeftInitialState && oldState == .unavailable && newState != .unavailable
        if newState != .unavailable {
            hasLeftInitialState = true
        }
        if isFirstLeave {
            return
        }

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
            if isRecovery {
                content.title = L10n.text("notification.recovered.title")
                content.body = L10n.text("notification.recovered.body")
            } else {
                content.title = L10n.text("notification.status_changed.title")
                content.body = L10n.format(
                    statusBodyKey(for: newState),
                    target.label,
                    remainingText(remainingPercent)
                )
            }
            content.sound = .default

            let request = UNNotificationRequest(
                identifier: "tokencat-status-\(Date().timeIntervalSince1970)",
                content: content,
                trigger: nil
            )
            try? await center.add(request)
        }
    }

    // MARK: - 起動時の挨拶

    private static let lastDailyGreetingKey = "lastDailyGreetingDate"

    /// その日はじめての起動なら「勤務開始」を通知する。1 日 1 回。
    func notifyDailyStartIfNeeded(target: UsageFetchTarget) {
        let defaults = UserDefaults.standard
        let now = Date()
        if let last = defaults.object(forKey: Self.lastDailyGreetingKey) as? Date,
           Calendar.current.isDate(last, inSameDayAs: now) {
            return  // 今日はもう挨拶済み
        }
        // 先にフラグを立てて二重発火を防ぐ。未認可なら後で取り消して次回起動に再挑戦。
        defaults.set(now, forKey: Self.lastDailyGreetingKey)

        Task {
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                defaults.removeObject(forKey: Self.lastDailyGreetingKey)
                return
            }

            let content = UNMutableNotificationContent()
            content.title = L10n.text("notification.daily_start.title")
            content.body = L10n.format("notification.daily_start.body", target.label)
            content.sound = .default

            let request = UNNotificationRequest(
                identifier: "tokencat-daily-\(now.timeIntervalSince1970)",
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
