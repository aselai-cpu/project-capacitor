import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskRow from '../components/TaskRow';
import type { Task, Developer } from '../lib/types';

vi.mock('../lib/api', () => ({
  updateTask: vi.fn(() => Promise.resolve({})),
}));

const mockSkills = [
  { id: 'skill-1', name: 'Frontend' },
  { id: 'skill-2', name: 'Backend' },
];

const mockDevelopers: Developer[] = [
  { id: 'dev-1', name: 'Alice', skills: [{ id: 'skill-1', name: 'Frontend' }] },
  { id: 'dev-2', name: 'Bob', skills: [{ id: 'skill-2', name: 'Backend' }] },
  {
    id: 'dev-3',
    name: 'Carol',
    skills: [
      { id: 'skill-1', name: 'Frontend' },
      { id: 'skill-2', name: 'Backend' },
    ],
  },
];

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

function renderRow(task: Task, developers: Developer[] = mockDevelopers) {
  const onUpdate = vi.fn();
  render(
    <table>
      <tbody>
        <TaskRow task={task} developers={developers} onUpdate={onUpdate} />
      </tbody>
    </table>
  );
  return { onUpdate };
}

describe('TaskRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the task title', () => {
    renderRow(mockTask);
    expect(screen.getByText('Build homepage')).toBeInTheDocument();
  });

  it('renders skill badges', () => {
    renderRow(mockTask);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('does not show "↳" prefix for root tasks (depth 0)', () => {
    renderRow(mockTask);
    expect(screen.queryByText('↳')).not.toBeInTheDocument();
  });

  it('shows "↳" prefix for subtasks (depth > 0)', () => {
    const subtask: Task = { ...mockTask, depth: 1 };
    renderRow(subtask);
    expect(screen.getByText('↳')).toBeInTheDocument();
  });

  it('renders status dropdown with 3 options', () => {
    renderRow(mockTask);
    const select = screen.getByDisplayValue('To-do');
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole('option', { hidden: false });
    const statusOptions = options.filter(o =>
      ['To-do', 'In Progress', 'Done'].includes(o.textContent ?? '')
    );
    expect(statusOptions).toHaveLength(3);
  });

  it('renders assignee dropdown filtered by eligible developers', () => {
    // Task requires Frontend (skill-1)
    // Alice has Frontend => eligible
    // Bob has only Backend => NOT eligible
    // Carol has both => eligible
    renderRow(mockTask);
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Carol' })).toBeInTheDocument();
  });

  it('does not show Bob for a Frontend-only task (skill guard filtering)', () => {
    renderRow(mockTask);
    expect(screen.queryByRole('option', { name: 'Bob' })).not.toBeInTheDocument();
  });

  it('shows "+ Subtask" link with correct href', () => {
    renderRow(mockTask);
    const link = screen.getByRole('link', { name: '+ Subtask' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/tasks/new?parentId=task-1');
  });

  it('calls updateTask and onUpdate when assignee changes', async () => {
    const { updateTask } = await import('../lib/api');
    const user = userEvent.setup();
    const { onUpdate } = renderRow(mockTask);
    const assigneeSelect = screen.getByDisplayValue('Unassigned');
    await user.selectOptions(assigneeSelect, 'dev-1');
    expect(updateTask).toHaveBeenCalledWith('task-1', { developerId: 'dev-1' });
    expect(onUpdate).toHaveBeenCalled();
  });

  it('calls updateTask and onUpdate when status changes', async () => {
    const { updateTask } = await import('../lib/api');
    const user = userEvent.setup();
    const { onUpdate } = renderRow(mockTask);
    const select = screen.getByDisplayValue('To-do');
    await user.selectOptions(select, 'DONE');
    expect(updateTask).toHaveBeenCalledWith('task-1', { status: 'DONE' });
    expect(onUpdate).toHaveBeenCalled();
  });
});
