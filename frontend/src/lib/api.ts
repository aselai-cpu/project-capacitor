import type { Task, Developer, Skill } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const fetchTasks = (): Promise<Task[]> =>
  fetch(`${API}/api/tasks`).then(r => r.json());

export const fetchDevelopers = (): Promise<Developer[]> =>
  fetch(`${API}/api/developers`).then(r => r.json());

export const fetchSkills = (): Promise<Skill[]> =>
  fetch(`${API}/api/skills`).then(r => r.json());

export const createTask = (body: any): Promise<any> =>
  fetch(`${API}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

export const updateTask = (id: string, body: any): Promise<any> =>
  fetch(`${API}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
