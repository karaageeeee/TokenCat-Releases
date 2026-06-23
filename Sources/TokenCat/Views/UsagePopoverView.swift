import SwiftUI
import AppKit

struct UsagePopoverView: View {
    @Bindable var viewModel: UsageViewModel
    let catAnimation: CatAnimationManager
    @ObservedObject var launchAtLogin: LaunchAtLoginStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            catStatePreview
            summaryBlock

            if viewModel.isClaudeFetchEnabled {
                Divider()

                ServiceSectionView(
                    title: "Claude Code",
                    brand: .claude,
                    result: viewModel.snapshot.claude,
                    loginAction: { viewModel.openClaudeLogin() },
                    upgradeAction: { viewModel.openClaudeUpgrade() }
                )
            }

            if viewModel.isCodexFetchEnabled {
                Divider()

                ServiceSectionView(
                    title: "Codex",
                    brand: .codex,
                    result: viewModel.snapshot.codex,
                    loginAction: { viewModel.openCodexLogin() },
                    upgradeAction: { viewModel.openCodexUpgrade() }
                )
            }

            Divider()
            settingsBlock
            Divider()
            workButton
            footer
        }
        .padding(16)
        .frame(width: 320)
    }

    private var header: some View {
        HStack {
            Text("TokenCat")
                .font(.system(size: 14, weight: .semibold))
            Spacer()
        }
    }

    private var catStatePreview: some View {
        HStack {
            Spacer(minLength: 0)
            if let image = catAnimation.currentImage {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.none)
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .frame(height: 92)
            } else {
                Text(catAnimation.currentFallback)
                    .font(.system(size: 54))
                    .frame(maxWidth: .infinity)
                    .frame(height: 92)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .accessibilityLabel(viewModel.catState.displayName)
    }

    private var summaryBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            summaryRow(label: L10n.text("summary.target"), value: viewModel.usageFetchTarget.label)
            summaryRow(label: L10n.text("summary.overall_used"), value: percentText(viewModel.overallUsagePercent))
            summaryRow(label: L10n.text("summary.remaining"), value: percentText(viewModel.overallRemainingPercent))
            summaryRow(label: L10n.text("summary.animal_status"), value: viewModel.catState.displayName)
        }
    }

    private func summaryRow(label: String, value: String) -> some View {
        HStack {
            Text("\(label):")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .medium))
                .monospacedDigit()
        }
    }

    private var settingsBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(L10n.text("settings.fetch_target"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Spacer()
                Picker("", selection: $viewModel.usageFetchTarget) {
                    ForEach(UsageFetchTarget.allCases) { target in
                        Text(target.label).tag(target)
                    }
                }
                .labelsHidden()
                .fixedSize()
            }

            HStack {
                Text(L10n.text("settings.polling_interval"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Spacer()
                Picker("", selection: $viewModel.pollingInterval) {
                    ForEach(PollingInterval.allCases) { interval in
                        Text(interval.label).tag(interval)
                    }
                }
                .labelsHidden()
                .fixedSize()
            }

            HStack {
                Text(L10n.text("settings.launch_at_login"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { launchAtLogin.isEnabled },
                    set: { _ in launchAtLogin.toggle() }
                ))
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.mini)
            }
        }
    }

    private var footer: some View {
        HStack {
            if viewModel.snapshot.fetchedAt > .distantPast {
                Text(L10n.format("footer.updated_at", DateFormatter.localizedString(from: viewModel.snapshot.fetchedAt, dateStyle: .none, timeStyle: .short)))
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Button {
                Task { await viewModel.refresh() }
            } label: {
                if viewModel.isLoading {
                    HStack(spacing: 4) {
                        ProgressView().controlSize(.small)
                        Text(L10n.text("button.refresh"))
                    }
                } else {
                    Label(L10n.text("button.refresh"), systemImage: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderless)
            .help(L10n.text("help.refresh_now"))

            Button(L10n.text("button.quit")) {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.borderless)
            .foregroundStyle(.secondary)
        }
    }

    private var workButton: some View {
        Button {
            viewModel.openSelectedWorkTarget()
        } label: {
            Label(
                L10n.format("button.start_work", viewModel.usageFetchTarget.label),
                systemImage: "play.fill"
            )
            .frame(maxWidth: .infinity)
        }
        .controlSize(.small)
        .help(L10n.format("help.start_work", viewModel.usageFetchTarget.label))
    }

    private func percentText(_ percent: Double?) -> String {
        guard let percent else { return "--%" }
        if percent > 100 { return "100%+" }
        return "\(Int(max(0, percent).rounded()))%"
    }
}
