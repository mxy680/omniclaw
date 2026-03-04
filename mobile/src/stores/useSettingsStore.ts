import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';

const SETTINGS_FILE = `${FileSystem.documentDirectory}omniclaw-settings.json`;
const AUTH_TOKEN_KEY = 'omniclaw_auth_token';

interface PersistedSettings {
  host: string;
  port: number;
  mcpPort: number;
}

interface SettingsState {
  host: string;
  port: number;
  mcpPort: number;
  authToken: string;
  isLoaded: boolean;
  load: () => Promise<void>;
  save: () => Promise<void>;
  setHost: (host: string) => void;
  setPort: (port: number) => void;
  setMcpPort: (port: number) => void;
  setAuthToken: (token: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  host: '',
  port: 18789,
  mcpPort: 9850,
  authToken: '',
  isLoaded: false,

  load: async () => {
    try {
      // Load non-sensitive settings from the file system
      const fileInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
      if (fileInfo.exists) {
        const raw = await FileSystem.readAsStringAsync(SETTINGS_FILE);
        const parsed: Partial<PersistedSettings> = JSON.parse(raw);
        set({
          host: parsed.host ?? '',
          port: parsed.port ?? 18789,
          mcpPort: parsed.mcpPort ?? 9850,
        });
      }

      // Load sensitive auth token from secure store
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      set({ authToken: token ?? '', isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  save: async () => {
    const { host, port, mcpPort, authToken } = get();
    try {
      const data: PersistedSettings = { host, port, mcpPort };
      await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(data));
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, authToken);
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }
  },

  setHost: (host) => {
    set({ host });
    get().save();
  },

  setPort: (port) => {
    set({ port });
    get().save();
  },

  setMcpPort: (mcpPort) => {
    set({ mcpPort });
    get().save();
  },

  setAuthToken: (authToken) => {
    set({ authToken });
    get().save();
  },
}));
