import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("gatewayPort") private var port = 18789
    @AppStorage("mcpPort") private var mcpPort = 9850
    @AppStorage("authToken") private var authToken = ""

    @State private var connectionStatus: ConnectionStatus = .idle
    @StateObject private var chatService = ChatService()

    enum ConnectionStatus: Equatable {
        case idle
        case testing
        case success
        case failure(String)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Gateway Connection") {
                    HStack {
                        Image(systemName: "network")
                            .foregroundStyle(.secondary)
                        TextField("Tailscale hostname or IP", text: $host)
                            .textContentType(.URL)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }

                    HStack {
                        Image(systemName: "number")
                            .foregroundStyle(.secondary)
                        TextField("Gateway Port", value: $port, format: .number)
                            .keyboardType(.numberPad)
                    }

                    HStack {
                        Image(systemName: "key")
                            .foregroundStyle(.secondary)
                        SecureField("Auth token", text: $authToken)
                            .textContentType(.password)
                    }
                }

                Section("MCP Server") {
                    HStack {
                        Image(systemName: "server.rack")
                            .foregroundStyle(.secondary)
                        TextField("MCP Server Port", value: $mcpPort, format: .number)
                            .keyboardType(.numberPad)
                    }
                }

                Section {
                    Button {
                        testConnection()
                    } label: {
                        HStack {
                            Text("Test Connection")
                            Spacer()
                            switch connectionStatus {
                            case .idle:
                                EmptyView()
                            case .testing:
                                ProgressView()
                                    .controlSize(.small)
                            case .success:
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            case .failure:
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.red)
                            }
                        }
                    }
                    .disabled(host.isEmpty || authToken.isEmpty || connectionStatus == .testing)

                    if case .failure(let message) = connectionStatus {
                        Text(message)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }

                Section("Info") {
                    LabeledContent("Gateway") {
                        if host.isEmpty {
                            Text("Not configured")
                                .foregroundStyle(.secondary)
                        } else {
                            Text("ws://\(host):\(port)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func testConnection() {
        connectionStatus = .testing
        let config = ChatService.ServerConfig(host: host, port: port, authToken: authToken)

        Task {
            do {
                let ok = try await chatService.testConnection(config: config)
                connectionStatus = ok ? .success : .failure("Unexpected response")
            } catch {
                connectionStatus = .failure(error.localizedDescription)
            }
        }
    }
}
