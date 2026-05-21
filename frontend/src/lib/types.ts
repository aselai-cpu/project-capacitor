export interface Skill {
  id: string;
  name: string;
}

export interface Developer {
  id: string;
  name: string;
  bio: string | null;
  cvText: string | null;
  cvFileName: string | null;
  skills: Skill[];
}

export interface ExtractedSkill {
  name: string;
  level: string;
}

export interface Task {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  parentId: string | null;
  depth: number;
  skills: Skill[];
  developer: Developer | null;
  createdAt: string;
  projectId: string | null;
  acceptanceCriteria: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  techStack: string[];
  architecture: string | null;
  domain: string | null;
  requirements: string | null;
  constraints: string | null;
  stakeholders: string | null;
  tasks: { id: string; title: string; status: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedStory {
  title: string;
  acceptanceCriteria: string;
}

export interface TaskFormState {
  id: string;
  title: string;
  skillIds: string[];
  subtasks: TaskFormState[];
}

export interface TaskFilters {
  projectId?: string;
  status?: string;
  developerId?: string;
}
