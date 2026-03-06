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
  useTLS: boolean;
}

interface SettingsState {
  host: string;
  port: number;
  mcpPort: number;
  useTLS: boolean;
  authToken: string;
  isLoaded: boolean;
  load: () => Promise<void>;
  save: () => Promise<void>;
  setHost: (host: string) => void;
  setPort: (port: number) => void;
  setMcpPort: (port: number) => void;
  setUseTLS: (useTLS: boolean) => void;
  setAuthToken: (token: string) => void;
}

/** Build the gateway WebSocket URL from current settings. */
export function gatewayWsUrl(state: { host: string; port: number; useTLS: boolean }): string {
  const proto = state.useTLS ? 'wss' : 'ws';
  return `${proto}://${state.host}:${state.port}`;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  host: 'localhost',
  port: 18789,
  mcpPort: 9850,
  useTLS: false,
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
          host: parsed.host ?? 'localhost',
          port: parsed.port ?? 18789,
          mcpPort: parsed.mcpPort ?? 9850,
          useTLS: parsed.useTLS ?? false,
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
    const { host, port, mcpPort, useTLS, authToken } = get();
    try {
      const data: PersistedSettings = { host, port, mcpPort, useTLS };
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

  setUseTLS: (useTLS) => {
    set({ useTLS });
    get().save();
  },

  setAuthToken: (authToken) => {
    set({ authToken });
    get().save();
  },
}));
