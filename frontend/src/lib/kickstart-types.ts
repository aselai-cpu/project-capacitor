export type StepName = 'enrich' | 'generate-tasks' | 'process-team' | 'assign';
export type StepStatus = 'running' | 'retrying' | 'done' | 'error';

export interface StepEvent {
  step: StepName;
  status: StepStatus;
  attempt?: number;
  error?: string;
  result?: Record<string, unknown>;
}

export interface TaskEvent {
  title: string;
  storyPoints: number;
  skills: string[];
}

export interface MemberEvent {
  name: string;
  skills: string[];
  isNew: boolean;
}

export interface AssignmentEvent {
  task: string;
  developer: string;
  points: number;
  reason: string;
}

export interface DoneEvent {
  projectId: string;
  summary: {
    taskCount: number;
    totalPoints: number;
    memberCount: number;
    balanceScore: number;
  };
}

export interface ErrorEvent {
  step?: string;
  error: string;
  partialProjectId?: string;
}

export type KickstartState = 'form' | 'running' | 'done' | 'error';
