import SwiftUI

struct ScheduleRunView: View {
    let run: ScheduleRun
    let agentName: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Status header
                HStack {
                    statusBadge
                    Spacer()
                    if let duration = run.durationFormatted {
                        Label(duration, systemImage: "clock")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                // Metadata
                Group {
                    LabeledContent("Agent", value: agentName ?? run.agentId)
                    LabeledContent("Started", value: run.startedAt.formatted())
                    if let completed = run.completedAt {
                        LabeledContent("Completed", value: completed.formatted())
                    }
                }
                .font(.caption)

                Divider()

                // Instruction
                Text("Instruction")
                    .font(.headline)
                Text(run.instruction)
                    .font(.body)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                Divider()

                // Response
                Text("Response")
                    .font(.headline)

                if run.status == .error {
                    Label(run.errorMessage ?? "Unknown error", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Text(run.response)
                    .font(.body)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .textSelection(.enabled)
            }
            .padding()
        }
        .navigationTitle("Run Result")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch run.status {
        case .completed:
            Label("Completed", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .error:
            Label("Error", systemImage: "xmark.circle.fill")
                .foregroundStyle(.red)
        case .running:
            Label("Running", systemImage: "hourglass")
                .foregroundStyle(.orange)
        }
    }
}
