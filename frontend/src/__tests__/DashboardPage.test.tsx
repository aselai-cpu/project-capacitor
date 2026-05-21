import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';

vi.mock('../lib/api', () => ({
  fetchDashboard: vi.fn(),
}));

const mockDashboard = {
  activeProjects: 2,
  unassignedTasks: 5,
  teamMembers: 4,
  inProgressTasks: 3,
  projects: [
    { id: 'p1', name: 'Project Alpha', unassignedCount: 3 },
    { id: 'p2', name: 'E-Commerce', unassignedCount: 2 },
  ],
  workload: [
    { developerId: 'd1', developerName: 'Alice', taskCount: 3 },
    { developerId: 'd2', developerName: 'Bob', taskCount: 1 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders metric cards and allocation CTA', async () => {
    const { fetchDashboard } = await import('../lib/api');
    vi.mocked(fetchDashboard).mockResolvedValue(mockDashboard);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText(/tasks need developers/i)).toBeInTheDocument();
    });
  });

  it('shows project list with unassigned counts', async () => {
    const { fetchDashboard } = await import('../lib/api');
    vi.mocked(fetchDashboard).mockResolvedValue(mockDashboard);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('E-Commerce')).toBeInTheDocument();
    });
  });
});
