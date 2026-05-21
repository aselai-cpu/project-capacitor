import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskFormNode from '../components/TaskFormNode';
import type { TaskFormState, Skill } from '../lib/types';

const mockSkills: Skill[] = [
  { id: 'skill-1', name: 'Frontend' },
  { id: 'skill-2', name: 'Backend' },
];

const makeNode = (overrides: Partial<TaskFormState> = {}): TaskFormState => ({
  id: 'node-1',
  title: '',
  skillIds: [],
  subtasks: [],
  ...overrides,
});

type OnUpdateFn = (id: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => void;

describe('TaskFormNode', () => {
  let onUpdate: Mock<OnUpdateFn>;

  beforeEach(() => {
    onUpdate = vi.fn<OnUpdateFn>();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'new-subtask-uuid'),
    });
  });

  it('renders title input with placeholder', () => {
    render(<TaskFormNode node={makeNode()} skills={mockSkills} depth={0} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText('Task title...');
    expect(input).toBeInTheDocument();
  });

  it('renders skill buttons for each skill', async () => {
    const user = userEvent.setup();
    render(<TaskFormNode node={makeNode()} skills={mockSkills} depth={0} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Refine skills manually' }));
    expect(screen.getByRole('button', { name: 'Toggle Frontend skill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle Backend skill' })).toBeInTheDocument();
  });

  it('calls onUpdate when title changes', async () => {
    const user = userEvent.setup();
    render(<TaskFormNode node={makeNode()} skills={mockSkills} depth={0} onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText('Task title...');
    await user.type(input, 'My Task');
    expect(onUpdate).toHaveBeenCalled();
    const [calledId, updaterFn] = onUpdate.mock.calls[0];
    expect(calledId).toBe('node-1');
    const result = updaterFn({ id: 'node-1', title: '', skillIds: [], subtasks: [] });
    expect(result).toHaveProperty('title');
  });

  it('calls onUpdate when a skill button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskFormNode node={makeNode()} skills={mockSkills} depth={0} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Refine skills manually' }));
    await user.click(screen.getByRole('button', { name: 'Toggle Frontend skill' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    const [calledId, updaterFn] = onUpdate.mock.calls[0];
    expect(calledId).toBe('node-1');
    const result = updaterFn({ id: 'node-1', title: '', skillIds: [], subtasks: [] });
    expect(result.skillIds).toContain('skill-1');
  });

  it('calls onUpdate with new subtask when "+ Subtask" button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskFormNode node={makeNode()} skills={mockSkills} depth={0} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: '+ Subtask' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    const [calledId, updaterFn] = onUpdate.mock.calls[0];
    expect(calledId).toBe('node-1');
    const result = updaterFn({ id: 'node-1', title: '', skillIds: [], subtasks: [] });
    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks![0]).toMatchObject({
      id: 'new-subtask-uuid',
      title: '',
      skillIds: [],
      subtasks: [],
    });
  });

  it('renders nested subtask components recursively', () => {
    const childNode: TaskFormState = {
      id: 'child-1',
      title: 'Child Task',
      skillIds: [],
      subtasks: [],
    };
    const node = makeNode({ subtasks: [childNode] });
    render(<TaskFormNode node={node} skills={mockSkills} depth={0} onUpdate={onUpdate} />);
    // Both root and child render their inputs — there should be 2 "Task title..." inputs
    const inputs = screen.getAllByPlaceholderText('Task title...');
    expect(inputs).toHaveLength(2);
  });
});
