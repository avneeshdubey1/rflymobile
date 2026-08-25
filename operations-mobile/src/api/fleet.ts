import { fetchApi } from './client';

export interface ScheduleItem {
  id: string;
  missionStatus: string;
  pilotName: string;
  droneLabel: string;
  startTime: string;
}

export interface ExceptionItem {
  id: string;
  assignmentId: string;
  reason: string;
  severity: string;
  createdAt: string;
}

export const fleetApi = {
  getSchedule: (date?: string) => 
    fetchApi(\`/api/mobile/v1/operations/fleet/schedule\${date ? \`?date=\${date}\` : ''}\`),
    
  getExceptions: () => 
    fetchApi('/api/mobile/v1/operations/fleet/exceptions'),
    
  overrideCopilot: (assignmentId: string, copilotId: string, reason: string) => 
    fetchApi(\`/api/mobile/v1/operations/assignments/\${assignmentId}/copilot-override\`, {
      method: 'POST',
      body: JSON.stringify({ copilotId, reason }),
    }),
};
