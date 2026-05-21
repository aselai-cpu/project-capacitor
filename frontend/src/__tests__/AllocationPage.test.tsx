// frontend/src/__tests__/AllocationPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AllocationPage from '../pages/AllocationPage';

vi.mock('../lib/api', () => ({
  fetchAllocationScores: vi.fn(),
  fetchProjects: vi.fn(),
  fetchTasks: vi.fn(),
  fetchDevelopers: vi.fn(),
  fetchAllocationReason: vi.fn(),
  updateTask: vi.fn(),
}));

const mockScores = [
  {
    taskId: 't1',
    taskTitle: 'Build auth flow',
    taskSkills: ['React', 'Node.js'],
    scores: [
      { developerId: 'd1', developerName: 'Alice', matchPercent: 100, missingSkills: [], currentTaskCount: 2, isTopPick: true },
      { developerId: 'd2', developerName: 'Bob', matchPercent: 50, missingSkills: ['React'], currentTaskCount: 1, isTopPick: false },
    ],
  },
];

describe('AllocationPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders matrix view by default with scores', async () => {
    const { fetchAllocationScores, fetchProjects } = await import('../lib/api');
    vi.mocked(fetchAllocationScores).mockResolvedValue(mockScores);
    vi.mocked(fetchProjects).mockResolvedValue([]);

    render(<MemoryRouter><AllocationPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Build auth flow')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('shows view switcher tabs', async () => {
    const { fetchAllocationScores, fetchProjects } = await import('../lib/api');
    vi.mocked(fetchAllocationScores).mockResolvedValue([]);
    vi.mocked(fetchProjects).mockResolvedValue([]);

    render(<MemoryRouter><AllocationPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Matrix')).toBeInTheDocument();
      expect(screen.getByText('Kanban')).toBeInTheDocument();
      expect(screen.getByText('Focus')).toBeInTheDocument();
    });
  });

  it('switches to focus view on tab click', async () => {
    const { fetchAllocationScores, fetchProjects } = await import('../lib/api');
    vi.mocked(fetchAllocationScores).mockResolvedValue(mockScores);
    vi.mocked(fetchProjects).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<MemoryRouter><AllocationPage /></MemoryRouter>);
    await waitFor(() => screen.getByText('Focus'));
    await user.click(screen.getByText('Focus'));

    await waitFor(() => {
      expect(screen.getByText('Select a task to see AI recommendations')).toBeInTheDocument();
    });
  });

  it('shows unassigned task count', async () => {
    const { fetchAllocationScores, fetchProjects } = await import('../lib/api');
    vi.mocked(fetchAllocationScores).mockResolvedValue(mockScores);
    vi.mocked(fetchProjects).mockResolvedValue([]);

    render(<MemoryRouter><AllocationPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/1 unassigned task/)).toBeInTheDocument();
    });
  });
});
