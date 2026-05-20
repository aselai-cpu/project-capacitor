import type { Task, Developer, Skill } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export interface CreateTaskPayload {
  title: string;
  skillIds: string[];
  parentId?: string | null;
  subtasks?: CreateTaskPayload[];
}

export interface UpdateTaskPayload {
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  developerId?: string | null;
}

export const fetchTasks = (): Promise<Task[]> =>
  fetch(`${API}/api/tasks`).then(r => handleResponse<Task[]>(r));

export const fetchDevelopers = (): Promise<Developer[]> =>
  fetch(`${API}/api/developers`).then(r => handleResponse<Developer[]>(r));

export const fetchSkills = (): Promise<Skill[]> =>
  fetch(`${API}/api/skills`).then(r => handleResponse<Skill[]>(r));

export const createTask = (body: CreateTaskPayload): Promise<Task> =>
  fetch(`${API}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Task>(r));

export const updateTask = (id: string, body: UpdateTaskPayload): Promise<Task> =>
  fetch(`${API}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Task>(r));
