import Foundation
import SwiftUI

@Observable
final class SettingsStore {
    var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") }
    }
    var authToken: String {
        didSet { UserDefaults.standard.set(authToken, forKey: "authToken") }
    }

    var isConfigured: Bool {
        !serverURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !authToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static let defaultServerURL = "ws://100.122.77.79:9800"
    private static let defaultAuthToken = "12114508a208ff38b1ee25a2b043162ac6f966f5f96dc8db83de81be8b4d7ce2"

    init() {
        let storedURL = UserDefaults.standard.string(forKey: "serverURL") ?? ""
        let storedToken = UserDefaults.standard.string(forKey: "authToken") ?? ""
        self.serverURL = storedURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Self.defaultServerURL : storedURL
        self.authToken = storedToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Self.defaultAuthToken : storedToken
    }
}
