import SwiftUI

struct ScheduleDetailView: View {
    let job: ScheduleJob
    @EnvironmentObject var agentService: AgentService
    @State private var runs: [ScheduleRun] = []
    @State private var isLoadingRuns = false

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("mcpPort") private var mcpPort = 9850
    @AppStorage("authToken") private var authToken = ""

    @StateObject private var scheduleService = ScheduleService()

    var body: some View {
        List {
            Section("Details") {
                LabeledContent("Agent", value: agentService.agent(for: job.agentId)?.name ?? job.agentId)
                LabeledContent("Schedule", value: job.cron)
                if let tz = job.timezone {
                    LabeledContent("Timezone", value: tz)
                }
                LabeledContent("Instruction", value: job.instructionFile)
                LabeledContent("Status", value: job.enabled ? "Enabled" : "Disabled")
                if let nextRun = job.nextRun {
                    LabeledContent("Next Run") {
                        Text(nextRun, style: .relative)
                    }
                }
            }

            if let desc = job.description {
                Section("Description") {
                    Text(desc)
                        .font(.body)
                }
            }

            Section {
                Button {
                    Task {
                        _ = await scheduleService.triggerJob(
                            jobId: job.id, host: host, mcpPort: mcpPort, authToken: authToken
                        )
                        try? await Task.sleep(for: .seconds(2))
                        await loadRuns()
                    }
                } label: {
                    Label("Run Now", systemImage: "play.fill")
                }
            }

            Section("Recent Runs") {
                if isLoadingRuns {
                    ProgressView()
                } else if runs.isEmpty {
                    Text("No runs yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(runs) { run in
                        NavigationLink {
                            ScheduleRunView(run: run, agentName: agentService.agent(for: run.agentId)?.name)
                        } label: {
                            ScheduleRunRow(run: run)
                        }
                    }
                }
            }
        }
        .navigationTitle(job.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loadRuns() }
        .task { await loadRuns() }
    }

    private func loadRuns() async {
        isLoadingRuns = true
        runs = await scheduleService.fetchRuns(
            jobId: job.id, host: host, mcpPort: mcpPort, authToken: authToken
        )
        isLoadingRuns = false
    }
}

struct ScheduleRunRow: View {
    let run: ScheduleRun

    var statusIcon: (String, Color) {
        switch run.status {
        case .completed: return ("checkmark.circle.fill", .green)
        case .error: return ("xmark.circle.fill", .red)
        case .running: return ("hourglass", .orange)
        }
    }

    var body: some View {
        HStack {
            Image(systemName: statusIcon.0)
                .foregroundStyle(statusIcon.1)

            VStack(alignment: .leading, spacing: 2) {
                Text(run.startedAt, style: .date)
                    .font(.subheadline)
                Text(run.startedAt, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if let duration = run.durationFormatted {
                Text(duration)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
