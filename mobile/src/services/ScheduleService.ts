import { ScheduleJob, ScheduleRun } from '../types/schedule';

function baseURL(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export async function fetchSchedules(host: string, mcpPort: number, authToken: string): Promise<ScheduleJob[]> {
  const response = await fetch(`${baseURL(host, mcpPort)}/api/schedules`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!response.ok) throw new Error(`Failed: ${response.status}`);
  const data = await response.json();
  return data.jobs ?? [];
}

export async function fetchRuns(jobId: string, host: string, mcpPort: number, authToken: string, limit = 20): Promise<ScheduleRun[]> {
  const response = await fetch(`${baseURL(host, mcpPort)}/api/schedules/${jobId}/runs?limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.runs ?? [];
}

export async function triggerJob(jobId: string, host: string, mcpPort: number, authToken: string): Promise<boolean> {
  const response = await fetch(`${baseURL(host, mcpPort)}/api/schedules/${jobId}/trigger`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  return response.ok;
}
