import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KickstartForm from '../components/kickstart/KickstartForm';

vi.mock('../lib/api', () => ({
  fetchDevelopers: vi.fn(() => Promise.resolve([
    { id: 'dev-1', name: 'Alice', bio: null, cvText: null, cvFileName: null, skills: [{ id: 's1', name: 'React' }] },
    { id: 'dev-2', name: 'Bob', bio: null, cvText: null, cvFileName: null, skills: [{ id: 's2', name: 'Docker' }] },
  ])),
}));

describe('KickstartForm', () => {
  it('renders project name and description fields', async () => {
    render(<KickstartForm onSubmit={vi.fn()} />);
    expect(await screen.findByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('renders existing team members as toggleable chips', async () => {
    render(<KickstartForm onSubmit={vi.fn()} />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows add new member button', async () => {
    render(<KickstartForm onSubmit={vi.fn()} />);
    expect(await screen.findByText(/add another/i)).toBeInTheDocument();
  });
});
