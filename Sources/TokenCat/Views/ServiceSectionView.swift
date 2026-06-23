import SwiftUI

/// Claude / Codex 1 サービスぶんの詳細セクション。
/// どのブランドのセクションかを表す。
enum ServiceBrand {
    case claude
    case codex

    var localizationPrefix: String {
        switch self {
        case .claude: return "claude"
        case .codex: return "codex"
        }
    }
}

struct ServiceSectionView: View {
    let title: String
    let brand: ServiceBrand
    let result: Result<ServiceUsage, DomainError>?
    let loginAction: (() -> Void)?
    var upgradeAction: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                brandMark
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                if let loginAction {
                    Button {
                        loginAction()
                    } label: {
                        Image(systemName: "person.badge.key")
                    }
                    .buttonStyle(.borderless)
                    .help(L10n.format("help.login", title))
                }
            }

            switch result {
            case .none:
                Text(L10n.text("service.loading"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            case .some(.success(let usage)):
                usageBlock(usage)
            case .some(.failure(let err)):
                errorBlock(err)
            }

            if upgradeAction != nil {
                upgradeBlock(isExhausted: isLimitExhausted)
            }
        }
    }

    @ViewBuilder
    private func usageBlock(_ usage: ServiceUsage) -> some View {
        if let five = usage.fiveHour {
            limitRow(label: L10n.text("limit.five_hour"), limit: five)
        } else {
            Text(L10n.text("service.no_five_hour_data"))
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }

        if let weekly = usage.weekly {
            limitRow(label: L10n.text("limit.weekly"), limit: weekly)
        }
        if let sonnet = usage.weeklySonnet {
            limitRow(label: L10n.text("limit.weekly_sonnet"), limit: sonnet)
        }
    }

    private func limitRow(label: String, limit: RateLimit) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(limit.percent)%")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(color(for: limit.utilization))
            }
            ProgressBarView(value: limit.utilization)
            Text(resetLabel(limit.resetsAt))
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
        }
    }

    private func upgradeBlock(isExhausted: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: isExhausted ? "exclamationmark.circle.fill" : "arrow.up.circle.fill")
                .foregroundStyle(isExhausted ? .red : .accentColor)

            Text(L10n.text(upgradeMessageKey(isExhausted: isExhausted)))
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 4)

            if let upgradeAction {
                Button {
                    upgradeAction()
                } label: {
                    Image(systemName: "arrow.up.circle")
                }
                .buttonStyle(.borderless)
                .help(L10n.text("help.\(brand.localizationPrefix)_upgrade"))
                .accessibilityLabel(L10n.text("button.upgrade"))
            }
        }
        .padding(8)
        .background((isExhausted ? Color.red : Color.accentColor).opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func upgradeMessageKey(isExhausted: Bool) -> String {
        "\(brand.localizationPrefix).\(isExhausted ? "limit_exhausted" : "upgrade_available")"
    }

    private var isLimitExhausted: Bool {
        guard case .some(.success(let usage)) = result else { return false }
        return [
            usage.fiveHour?.utilization,
            usage.weekly?.utilization,
            usage.weeklySonnet?.utilization
        ]
        .compactMap { $0 }
        .contains { $0 >= 1.0 }
    }

    private func errorBlock(_ err: DomainError) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text(L10n.text("service.fetch_failed"))
                    .font(.system(size: 12, weight: .medium))
            }
            Text(err.errorDescription ?? L10n.text("error.unknown"))
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(8)
        .background(Color.orange.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder
    private var brandMark: some View {
        switch brand {
        case .claude:
            Image(systemName: "sparkles")
        case .codex:
            Image(systemName: "terminal.fill")
        }
    }

    private func color(for value: Double) -> Color {
        if value < 0.7 { return .green }
        if value < 0.85 { return .orange }
        return .red
    }

    private func resetLabel(_ date: Date) -> String {
        let now = Date()
        if date <= now { return L10n.text("reset.soon") }
        let rel = relativeResetTime(from: now, to: date)
        let absolute = DateFormatter.localizedString(from: date, dateStyle: .none, timeStyle: .short)
        return L10n.format("reset.remaining", rel, absolute)
    }

    private func relativeResetTime(from start: Date, to end: Date) -> String {
        let seconds = max(0, Int(end.timeIntervalSince(start).rounded()))
        if seconds >= 24 * 60 * 60 {
            let days = seconds / (24 * 60 * 60)
            let hours = (seconds % (24 * 60 * 60)) / (60 * 60)
            let minutes = (seconds % (60 * 60)) / 60
            return L10n.format("duration.days_hours_minutes", days, hours, minutes)
        }

        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.hour, .minute]
        formatter.unitsStyle = .abbreviated
        return formatter.string(from: TimeInterval(seconds)) ?? "-"
    }
}
