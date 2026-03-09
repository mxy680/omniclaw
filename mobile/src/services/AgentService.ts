import { Agent } from '../types/agent';
import { Platform } from 'react-native';
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
 * Token-only auth via controlUi bypass (dangerouslyDisableDeviceAuth).
 */
export async function fetchAgents(config: AgentServiceConfig): Promise<Agent[]> {
  const { host, port, authToken, useTLS } = config;
  if (!host) return [];

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

      // Send connect frame (token-only, no device auth)
      if (json.type === 'event' && json.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req',
          id: 'agent-svc-1',
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: { id: 'openclaw-control-ui', version: '1.0.0', platform: Platform.OS, mode: 'ui' },
            role: 'operator',
            scopes,
            auth: { token: authToken },
          },
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
