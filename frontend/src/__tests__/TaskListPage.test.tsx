import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskListPage from '../pages/TaskListPage';
import type { Task, Developer } from '../lib/types';

vi.mock('../lib/api', () => ({
  fetchTasks: vi.fn(),
  fetchDevelopers: vi.fn(),
  updateTask: vi.fn(() => Promise.resolve({})),
}));

const mockTask: Task = {
  id: 'task-1',
  title: 'Build homepage',
  status: 'TODO',
  parentId: null,
  depth: 0,
  skills: [{ id: 'skill-1', name: 'Frontend' }],
  developer: null,
  createdAt: '2026-05-21T00:00:00Z',
};

const mockDeveloper: Developer = {
  id: 'dev-1',
  name: 'Alice',
  skills: [{ id: 'skill-1', name: 'Frontend' }],
};

describe('TaskListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no tasks', async () => {
    const { fetchTasks, fetchDevelopers } = await import('../lib/api');
    vi.mocked(fetchTasks).mockResolvedValue([]);
    vi.mocked(fetchDevelopers).mockResolvedValue([]);
    render(<MemoryRouter><TaskListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument();
    });
  });

  it('renders tasks fetched from API', async () => {
    const { fetchTasks, fetchDevelopers } = await import('../lib/api');
    vi.mocked(fetchTasks).mockResolvedValue([mockTask]);
    vi.mocked(fetchDevelopers).mockResolvedValue([mockDeveloper]);
    render(<MemoryRouter><TaskListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Build homepage')).toBeInTheDocument();
    });
  });

  it('renders "Create Task" link pointing to /tasks/new', async () => {
    const { fetchTasks, fetchDevelopers } = await import('../lib/api');
    vi.mocked(fetchTasks).mockResolvedValue([]);
    vi.mocked(fetchDevelopers).mockResolvedValue([]);
    render(<MemoryRouter><TaskListPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Create Task' })).toHaveAttribute('href', '/tasks/new');
  });

  it('renders table headers', async () => {
    const { fetchTasks, fetchDevelopers } = await import('../lib/api');
    vi.mocked(fetchTasks).mockResolvedValue([]);
    vi.mocked(fetchDevelopers).mockResolvedValue([]);
    render(<MemoryRouter><TaskListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Task Title')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Assignee')).toBeInTheDocument();
    });
  });
});
