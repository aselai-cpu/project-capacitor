import type { Task, Developer, Skill, Project, GeneratedStory, ExtractedSkill, DashboardData, ScoredTask, ClassifyResult } from './types';

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
  projectId?: string | null;
  acceptanceCriteria?: string | null;
}

export interface UpdateTaskPayload {
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  developerId?: string | null;
}

export const fetchTasks = (filters?: { projectId?: string; status?: string; developerId?: string }): Promise<Task[]> => {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.developerId) params.set('developerId', filters.developerId);
  const qs = params.toString();
  return fetch(`${API}/api/tasks${qs ? `?${qs}` : ''}`).then(r => handleResponse<Task[]>(r));
};

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

export interface Recommendation {
  developerId: string;
  developerName: string;
  reason: string;
}

export const recommendAssignee = (taskId: string): Promise<Recommendation | null> =>
  fetch(`${API}/api/tasks/${taskId}/recommend-assignee`, { method: 'POST' })
    .then(r => r.ok ? r.json() as Promise<Recommendation> : null)
    .catch(() => null);

export const updateTask = (id: string, body: UpdateTaskPayload): Promise<Task> =>
  fetch(`${API}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Task>(r));

// --- Project API ---

export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export const fetchProjects = (): Promise<Project[]> =>
  fetch(`${API}/api/projects`).then(r => handleResponse<Project[]>(r));

export const fetchProject = (id: string): Promise<Project> =>
  fetch(`${API}/api/projects/${id}`).then(r => handleResponse<Project>(r));

export const createProjectApi = (body: CreateProjectPayload): Promise<Project> =>
  fetch(`${API}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Project>(r));

export const enrichProjectApi = (id: string): Promise<Project> =>
  fetch(`${API}/api/projects/${id}/enrich`, { method: 'POST' })
    .then(r => handleResponse<Project>(r));

export const generateStories = (projectId: string): Promise<{ stories: GeneratedStory[] }> =>
  fetch(`${API}/api/projects/${projectId}/generate-stories`, { method: 'POST' })
    .then(r => handleResponse<{ stories: GeneratedStory[] }>(r));

export const deleteProjectApi = (id: string): Promise<void> =>
  fetch(`${API}/api/projects/${id}`, { method: 'DELETE' })
    .then(r => handleResponse<void>(r));

// --- Developer Profile API ---

export const fetchDeveloper = (id: string): Promise<Developer> =>
  fetch(`${API}/api/developers/${id}`).then(r => handleResponse<Developer>(r));

export interface CVExtractionResult extends Developer {
  extractedSkills: ExtractedSkill[];
}

export const uploadCV = async (developerId: string, file: File): Promise<CVExtractionResult> => {
  const formData = new FormData();
  formData.append('cv', file);
  return fetch(`${API}/api/developers/${developerId}/upload-cv`, { method: 'POST', body: formData })
    .then(r => handleResponse<CVExtractionResult>(r));
};

export const extractSkillsFromText = (developerId: string, cvText: string): Promise<CVExtractionResult> =>
  fetch(`${API}/api/developers/${developerId}/extract-skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cvText }),
  }).then(r => handleResponse<CVExtractionResult>(r));

export interface CreateDeveloperPayload {
  name: string;
  skillIds?: string[];
}

export interface UpdateDeveloperPayload {
  name?: string;
  bio?: string;
  skillIds?: string[];
}

export const createDeveloper = (body: CreateDeveloperPayload): Promise<Developer> =>
  fetch(`${API}/api/developers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Developer>(r));

export const updateDeveloper = (id: string, body: UpdateDeveloperPayload): Promise<Developer> =>
  fetch(`${API}/api/developers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Developer>(r));

export const deleteDeveloper = (id: string): Promise<void> =>
  fetch(`${API}/api/developers/${id}`, { method: 'DELETE' })
    .then(r => handleResponse<void>(r));

// --- Dashboard API ---

export const fetchDashboard = (): Promise<DashboardData> =>
  fetch(`${API}/api/dashboard`).then(r => handleResponse<DashboardData>(r));

// --- Allocation API ---

export const fetchAllocationScores = (projectId?: string): Promise<ScoredTask[]> => {
  const qs = projectId ? `?projectId=${projectId}` : '';
  return fetch(`${API}/api/allocate/scores${qs}`).then(r => handleResponse<ScoredTask[]>(r));
};

export const fetchAllocationReason = (taskId: string, developerId: string): Promise<{ reason: string }> =>
  fetch(`${API}/api/allocate/reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, developerId }),
  }).then(r => handleResponse<{ reason: string }>(r));

// --- Skill Classification Preview ---

export const classifyTaskSkills = (title: string, acceptanceCriteria?: string): Promise<ClassifyResult> =>
  fetch(`${API}/api/tasks/classify-skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, acceptanceCriteria }),
  }).then(r => handleResponse<ClassifyResult>(r));
