import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DeveloperListPage from '../pages/DeveloperListPage';

vi.mock('../lib/api', () => ({
  fetchDevelopers: vi.fn(),
  fetchSkills: vi.fn(),
  createDeveloper: vi.fn(),
}));

describe('DeveloperListPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows create developer button', async () => {
    const { fetchDevelopers, fetchSkills } = await import('../lib/api');
    vi.mocked(fetchDevelopers).mockResolvedValue([]);
    vi.mocked(fetchSkills).mockResolvedValue([]);
    render(<MemoryRouter><DeveloperListPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add team member/i })).toBeInTheDocument();
    });
  });

  it('shows and submits create form', async () => {
    const { fetchDevelopers, fetchSkills, createDeveloper } = await import('../lib/api');
    vi.mocked(fetchDevelopers).mockResolvedValue([]);
    vi.mocked(fetchSkills).mockResolvedValue([{ id: 's1', name: 'React' }]);
    vi.mocked(createDeveloper).mockResolvedValue({ id: 'new-dev', name: 'Eve', bio: null, cvText: null, cvFileName: null, skills: [] });
    const user = userEvent.setup();

    render(<MemoryRouter><DeveloperListPage /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /add team member/i }));
    await user.click(screen.getByRole('button', { name: /add team member/i }));
    await user.type(screen.getByPlaceholderText(/developer name/i), 'Eve');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(vi.mocked(createDeveloper)).toHaveBeenCalledWith({ name: 'Eve', skillIds: [] });
  });
});
