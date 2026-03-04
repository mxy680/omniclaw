import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';

const AUTH_TOKEN_KEY = 'omniclaw_auth_token';
const DEFAULT_AUTH_TOKEN = 'e23e564a957acd23de76f2ce31c6a143bc7e6a03dcd17321';

function settingsFile(): File {
  return new File(Paths.document, 'omniclaw-settings.json');
}

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
  host: '100.71.39.86',
  port: 18789,
  mcpPort: 9850,
  authToken: DEFAULT_AUTH_TOKEN,
  isLoaded: false,

  load: async () => {
    try {
      // Load non-sensitive settings from the file system
      const file = settingsFile();
      if (file.exists) {
        const raw = await file.text();
        const parsed: Partial<PersistedSettings> = JSON.parse(raw);
        set({
          host: parsed.host ?? '100.71.39.86',
          port: parsed.port ?? 18789,
          mcpPort: parsed.mcpPort ?? 9850,
        });
      }

      // Load sensitive auth token from secure store
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      set({ authToken: token || DEFAULT_AUTH_TOKEN, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  save: async () => {
    const { host, port, mcpPort, authToken } = get();
    try {
      const data: PersistedSettings = { host, port, mcpPort };
      await settingsFile().write(JSON.stringify(data));
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
