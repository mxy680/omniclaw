import SwiftUI

struct ScheduleListView: View {
    @EnvironmentObject var agentService: AgentService
    @StateObject private var scheduleService = ScheduleService()

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("mcpPort") private var mcpPort = 9850
    @AppStorage("authToken") private var authToken = ""

    var body: some View {
        List(scheduleService.jobs) { job in
            NavigationLink(value: job.id) {
                ScheduleRow(job: job, agent: agentService.agent(for: job.agentId))
            }
        }
        .listStyle(.plain)
        .navigationTitle("Schedules")
        .navigationDestination(for: String.self) { jobId in
            if let job = scheduleService.jobs.first(where: { $0.id == jobId }) {
                ScheduleDetailView(job: job)
            }
        }
        .refreshable {
            await scheduleService.fetchSchedules(
                host: host, mcpPort: mcpPort, authToken: authToken
            )
        }
        .overlay {
            if scheduleService.isLoading {
                ProgressView("Loading schedules...")
            } else if scheduleService.jobs.isEmpty {
                ContentUnavailableView(
                    "No Schedules",
                    systemImage: "clock.badge.questionmark",
                    description: Text("No cron jobs configured.")
                )
            }
        }
        .task {
            await scheduleService.fetchSchedules(
                host: host, mcpPort: mcpPort, authToken: authToken
            )
        }
    }
}

struct ScheduleRow: View {
    let job: ScheduleJob
    let agent: Agent?

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill((agent?.color ?? .gray).gradient)
                    .frame(width: 44, height: 44)
                Image(systemName: "clock.fill")
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(job.name)
                        .font(.headline)
                    Spacer()
                    if !job.enabled {
                        Text("Disabled")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.secondary.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    if job.isRunning == true {
                        ProgressView()
                            .controlSize(.mini)
                    }
                }

                HStack {
                    Text(agent?.name ?? job.agentId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("·")
                        .foregroundStyle(.secondary)
                    Text(job.cron)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }

                if let nextRun = job.nextRun {
                    Text("Next: \(nextRun, style: .relative)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
