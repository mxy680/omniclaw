import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const AUTH_TOKEN_KEY = 'omniclaw_auth_token';
const GATEWAY_TOKEN = 'e23e564a957acd23de76f2ce31c6a143bc7e6a03dcd17321';
const MCP_TOKEN = 'dev';

// Simulator connects to localhost; real devices go through the tunnel
const isSimulator = !Constants.isDevice;

interface SettingsState {
  host: string;
  port: number;
  mcpPort: number;
  useTLS: boolean;
  authToken: string;
  mcpToken: string;
  isLoaded: boolean;
  load: () => Promise<void>;
}

/** Build the gateway WebSocket URL from current settings. */
export function gatewayWsUrl(state: { host: string; port: number; useTLS: boolean }): string {
  const proto = state.useTLS ? 'wss' : 'ws';
  return `${proto}://${state.host}:${state.port}`;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  host: isSimulator ? 'localhost' : 'omniclaw.markshteyn.com',
  port: isSimulator ? 18789 : 443,
  mcpPort: 9850,
  useTLS: !isSimulator,
  authToken: GATEWAY_TOKEN,
  mcpToken: MCP_TOKEN,
  isLoaded: false,

  load: async () => {
    try {
      // Clear any stale token — we now use separate constants
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      set({ authToken: GATEWAY_TOKEN, mcpToken: MCP_TOKEN, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },
}));
