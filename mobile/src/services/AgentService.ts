import { Agent } from '../types/agent';
import { ConnectFrame, AgentsListFrame } from '../types/protocol';
import { Platform } from 'react-native';

interface AgentServiceConfig {
  host: string;
  port: number;
  authToken: string;
}

export async function fetchAgents(config: AgentServiceConfig): Promise<Agent[]> {
  const { host, port, authToken } = config;
  if (!host) return [];

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${host}:${port}`);
    let phase: 'connecting' | 'listing' = 'connecting';
    let messageCount = 0;

    const cleanup = () => { try { ws.close(); } catch {} };

    ws.onopen = () => {
      const frame: ConnectFrame = {
        type: 'req',
        id: 'agent-svc-1',
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: 'openclaw-rn', version: '1.0.0', platform: Platform.OS, mode: 'cli' },
          role: 'operator',
          scopes: ['operator.read'],
          auth: { token: authToken },
        },
      };
      ws.send(JSON.stringify(frame));
    };

    ws.onmessage = (event) => {
      messageCount++;
      if (messageCount > 20) { cleanup(); reject(new Error('Too many messages')); return; }

      const json = JSON.parse(event.data as string);

      if (json.type === 'event') return; // skip events

      if (phase === 'connecting' && json.type === 'res') {
        if (json.ok) {
          phase = 'listing';
          const listFrame: AgentsListFrame = {
            type: 'req',
            id: 'agent-svc-2',
            method: 'agents.list',
            params: {},
          };
          ws.send(JSON.stringify(listFrame));
        } else {
          cleanup();
          reject(new Error(json.error?.message ?? 'Connection rejected'));
        }
        return;
      }

      if (phase === 'listing' && json.type === 'res') {
        cleanup();
        if (json.ok && json.payload?.agents) {
          const agents: Agent[] = (json.payload.agents as any[]).map((a) => ({
            id: a.id,
            name: a.name ?? a.id,
            role: a.role ?? '',
            colorName: a.colorName ?? 'blue',
            services: a.services ?? [],
          }));
          resolve(agents);
        } else {
          reject(new Error('agents.list not supported'));
        }
        return;
      }
    };

    ws.onerror = () => { cleanup(); reject(new Error('WebSocket error')); };

    // Timeout after 10 seconds
    setTimeout(() => { cleanup(); reject(new Error('Timeout')); }, 10000);
  });
}
