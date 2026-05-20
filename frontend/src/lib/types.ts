export interface Skill {
  id: string;
  name: string;
}

export interface Developer {
  id: string;
  name: string;
  skills: Skill[];
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
}

export interface TaskFormState {
  id: string;
  title: string;
  skillIds: string[];
  subtasks: TaskFormState[];
}
