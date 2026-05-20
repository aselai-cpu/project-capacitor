import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskCreatePage from '../pages/TaskCreatePage';

vi.mock('../lib/api', () => ({
  fetchSkills: vi.fn(),
  createTask: vi.fn(() => Promise.resolve({ id: 'task-new' })),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage(path = '/tasks/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tasks/new" element={<TaskCreatePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TaskCreatePage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchSkills } = await import('../lib/api');
    vi.mocked(fetchSkills).mockResolvedValue([
      { id: 'skill-1', name: 'Frontend' },
      { id: 'skill-2', name: 'Backend' },
    ]);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') });
  });

  it('renders "Create Task" heading for new task', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Create Task')).toBeInTheDocument();
    });
  });

  it('renders "Add Subtask" heading when parentId is present', async () => {
    renderPage('/tasks/new?parentId=parent-123');
    await waitFor(() => {
      expect(screen.getByText('Add Subtask')).toBeInTheDocument();
    });
  });

  it('renders skill buttons after fetch', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Toggle Frontend skill' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle Backend skill' })).toBeInTheDocument();
    });
  });

  it('Save button is disabled when title is empty', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('Save button is enabled after typing a title', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByPlaceholderText('Task title...'));
    await user.type(screen.getByPlaceholderText('Task title...'), 'My Task');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('calls createTask and navigates to /tasks on submit', async () => {
    const { createTask } = await import('../lib/api');
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByPlaceholderText('Task title...'));
    await user.type(screen.getByPlaceholderText('Task title...'), 'My New Task');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(createTask).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith('/tasks');
    });
  });
});
