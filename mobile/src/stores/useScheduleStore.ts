import { create } from 'zustand';
import { ScheduleJob } from '../types/schedule';
import * as ScheduleService from '../services/ScheduleService';

interface ScheduleState {
  jobs: ScheduleJob[];
  isLoading: boolean;
  error: string | null;
  fetchSchedules: (host: string, mcpPort: number, authToken: string) => Promise<void>;
  triggerJob: (jobId: string, host: string, mcpPort: number, authToken: string) => Promise<boolean>;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  jobs: [],
  isLoading: false,
  error: null,

  fetchSchedules: async (host, mcpPort, authToken) => {
    console.log('[schedules] fetching', { host, mcpPort, authToken, url: `http://${host}:${mcpPort}/api/schedules` });
    set({ isLoading: true, error: null });
    try {
      const jobs = await ScheduleService.fetchSchedules(host, mcpPort, authToken);
      console.log('[schedules] got jobs:', jobs.length, jobs.map((j: ScheduleJob) => j.id));
      set({ jobs, isLoading: false });
    } catch (err: any) {
      console.error('[schedules] fetch error:', err.message);
      set({ error: err.message, isLoading: false });
    }
  },

  triggerJob: async (jobId, host, mcpPort, authToken) => {
    return ScheduleService.triggerJob(jobId, host, mcpPort, authToken);
  },
}));
