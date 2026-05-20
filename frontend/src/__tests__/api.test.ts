import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTasks, fetchDevelopers, createTask, updateTask } from '../lib/api';

const makeJsonResponse = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);

describe('API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchTasks calls the correct URL', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockReturnValue(makeJsonResponse([{ id: 'task-1', title: 'Build homepage' }]));
    const result = await fetchTasks();
    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/\/api\/tasks$/);
    expect(result).toEqual([{ id: 'task-1', title: 'Build homepage' }]);
  });

  it('fetchDevelopers calls the correct URL', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockReturnValue(makeJsonResponse([{ id: 'dev-1', name: 'Alice' }]));
    const result = await fetchDevelopers();
    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/\/api\/developers$/);
    expect(result).toEqual([{ id: 'dev-1', name: 'Alice' }]);
  });

  it('createTask sends POST with correct body', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockReturnValue(makeJsonResponse({ id: 'task-new' }));
    const body = { title: 'New Task', skillIds: ['skill-1'] };
    const result = await createTask(body);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/tasks$/);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body as string)).toEqual(body);
    expect(result).toEqual({ id: 'task-new' });
  });

  it('fetchSkills calls the correct URL', async () => {
    const { fetchSkills } = await import('../lib/api');
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockReturnValue(makeJsonResponse([{ id: 'skill-1', name: 'Frontend' }]));
    const result = await fetchSkills();
    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/\/api\/skills$/);
    expect(result).toEqual([{ id: 'skill-1', name: 'Frontend' }]);
  });

  it('updateTask sends PATCH with correct body and URL', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockReturnValue(makeJsonResponse({ id: 'task-1', status: 'DONE' }));
    const result = await updateTask('task-1', { status: 'DONE' });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/tasks\/task-1$/);
    expect(options.method).toBe('PATCH');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body as string)).toEqual({ status: 'DONE' });
    expect(result).toEqual({ id: 'task-1', status: 'DONE' });
  });
});
