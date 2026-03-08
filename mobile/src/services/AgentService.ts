import { Agent } from '../types/agent';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getDeviceIdentity, signChallenge } from './DeviceIdentity';
import { agentProfiles } from '../config/agentProfiles';

interface AgentServiceConfig {
  host: string;
  port: number;
  authToken: string;
  useTLS?: boolean;
}

/**
 * Fetch agents by extracting them from the connect handshake snapshot.
 * The gateway includes health.agents in the connect response payload.
 * Uses Ed25519 device auth to get proper scopes.
 */
export async function fetchAgents(config: AgentServiceConfig): Promise<Agent[]> {
  const { host, port, authToken, useTLS } = config;
  if (!host) return [];

  const isSimulator = !Constants.isDevice;
  const deviceKeys = isSimulator ? null : await getDeviceIdentity();
  const scopes = ['operator.read', 'operator.write'];

  return new Promise((resolve, reject) => {
    const proto = useTLS ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${host}:${port}`);

    let timeoutId: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timeoutId); try { ws.close(); } catch {} };

    ws.onmessage = (event) => {
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(event.data as string);
      } catch {
        return;
      }

      // Send connect frame, with device signature on real devices only
      if (json.type === 'event' && json.event === 'connect.challenge') {
        const payload = json.payload as { nonce: string };

        const connectParams: Record<string, unknown> = {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: Platform.OS === 'ios' ? 'openclaw-ios' : 'openclaw-android', version: '1.0.0', platform: Platform.OS, mode: 'ui' },
          role: 'operator',
          scopes,
          auth: { token: authToken },
        };

        if (deviceKeys) {
          connectParams.device = signChallenge(deviceKeys, payload.nonce, authToken, scopes);
        }

        ws.send(JSON.stringify({
          type: 'req',
          id: 'agent-svc-1',
          method: 'connect',
          params: connectParams,
        }));
        return;
      }

      if (json.type === 'event') return;

      if (json.type === 'res') {
        cleanup();
        if (json.ok) {
          const payload = json.payload as Record<string, unknown> | undefined;
          const snapshot = payload?.snapshot as Record<string, unknown> | undefined;
          const health = snapshot?.health as Record<string, unknown> | undefined;
          const rawAgents = health?.agents as Array<Record<string, unknown>> | undefined;

          if (rawAgents && rawAgents.length > 0) {
            const agents: Agent[] = rawAgents.map((a) => {
              const id = (a.agentId as string) ?? (a.id as string) ?? 'unknown';
              const profile = agentProfiles[id];
              return {
                id,
                name: (a.name as string) ?? (a.agentId as string) ?? 'Unknown',
                role: (a.role as string) ?? '',
                colorName: (a.colorName as string) ?? 'blue',
                services: (a.services as string[]) ?? [],
                description: profile?.description,
                avatarIcon: profile?.avatarIcon,
                avatarColor: profile?.avatarColor,
              };
            });
            resolve(agents);
          } else {
            resolve([]);
          }
        } else {
          const err = json.error as Record<string, unknown> | undefined;
          reject(new Error((err?.message as string) ?? 'Connection rejected'));
        }
        return;
      }
    };

    ws.onerror = () => { cleanup(); reject(new Error('WebSocket error')); };

    timeoutId = setTimeout(() => { cleanup(); reject(new Error('Timeout')); }, 10000);
  });
}
