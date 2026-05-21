import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DeveloperProfilePage from '../pages/DeveloperProfilePage';

vi.mock('../lib/api', () => ({
  fetchDeveloper: vi.fn(),
  updateDeveloper: vi.fn(),
  deleteDeveloper: vi.fn(),
  uploadCV: vi.fn(),
  extractSkillsFromText: vi.fn(),
}));

const mockDev = {
  id: 'dev-1', name: 'Alice', bio: 'Senior dev', cvText: null, cvFileName: null,
  skills: [{ id: 's1', name: 'React' }],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/developers/dev-1']}>
    <Routes>
      <Route path="/developers/:id" element={<DeveloperProfilePage />} />
      <Route path="/developers" element={<div>Developer List</div>} />
    </Routes>
  </MemoryRouter>
);

describe('DeveloperProfilePage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows edit button and allows editing name', async () => {
    const { fetchDeveloper, updateDeveloper } = await import('../lib/api');
    vi.mocked(fetchDeveloper).mockResolvedValue(mockDev);
    vi.mocked(updateDeveloper).mockResolvedValue({ ...mockDev, name: 'Alice Smith' });
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => screen.getByText('Alice'));

    await user.click(screen.getByRole('button', { name: /edit/i }));
    const nameInput = screen.getByDisplayValue('Alice');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alice Smith');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(vi.mocked(updateDeveloper)).toHaveBeenCalledWith('dev-1', { name: 'Alice Smith', bio: 'Senior dev' });
  });

  it('shows delete button', async () => {
    const { fetchDeveloper } = await import('../lib/api');
    vi.mocked(fetchDeveloper).mockResolvedValue(mockDev);

    renderPage();
    await waitFor(() => screen.getByText('Alice'));
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
