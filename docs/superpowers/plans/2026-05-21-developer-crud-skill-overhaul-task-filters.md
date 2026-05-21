# Developer CRUD + Skill Overhaul + Task Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add developer management (create/edit/delete), replace hardcoded Frontend/Backend skills with real tech skills, and add project/status/assignee filtering to the task list page.

**Architecture:** Three independent feature slices touching backend routes/services and frontend pages. Developer CRUD adds POST/PATCH/DELETE endpoints + frontend forms. Skill overhaul updates the seed file and `classifySkills` Zod schema. Task filters add query param-based filtering to both backend GET /api/tasks and the TaskListPage UI.

**Tech Stack:** Express, Prisma, Zod (backend); React, React Router, Tailwind CSS (frontend); Vitest (tests)

---

## File Map

### Feature 1: Developer CRUD
- **Modify:** `backend/src/routes/developers.ts` — add POST `/`, PATCH `/:id`, DELETE `/:id`
- **Modify:** `backend/src/types.ts` — add `createDeveloperSchema`, `updateDeveloperSchema`
- **Modify:** `frontend/src/lib/api.ts` — add `createDeveloper`, `updateDeveloper`, `deleteDeveloper`
- **Modify:** `frontend/src/pages/DeveloperListPage.tsx` — add "Create Developer" button + inline form
- **Modify:** `frontend/src/pages/DeveloperProfilePage.tsx` — add edit name/bio + delete button
- **Create:** `backend/src/__tests__/developerSchemas.test.ts` — validation tests
- **Create:** `frontend/src/__tests__/DeveloperListPage.test.tsx` — CRUD UI tests
- **Create:** `frontend/src/__tests__/DeveloperProfilePage.test.tsx` — edit/delete tests

### Feature 2: Skill Overhaul
- **Modify:** `backend/prisma/seed.ts` — seed 16 real tech skills instead of Frontend/Backend
- **Modify:** `backend/src/services/llmService.ts:261-263` — fix `classifySkills` Zod schema to use `z.enum`

### Feature 3: Task Filters
- **Modify:** `backend/src/routes/tasks.ts` — accept `projectId`, `status`, `developerId` query params
- **Modify:** `backend/src/services/taskService.ts` — add filter params to `getAllTasksFlat`
- **Modify:** `frontend/src/lib/api.ts` — add filter params to `fetchTasks`
- **Modify:** `frontend/src/lib/types.ts` — add `TaskFilters` interface
- **Modify:** `frontend/src/pages/TaskListPage.tsx` — add filter dropdowns + URL sync
- **Modify:** `frontend/src/pages/ProjectDetailPage.tsx` — "View Tasks" links with project filter
- **Modify:** `frontend/src/__tests__/TaskListPage.test.tsx` — filter UI tests

---

## Task 1: Developer Zod Schemas

**Files:**
- Modify: `backend/src/types.ts`
- Create: `backend/src/__tests__/developerSchemas.test.ts`

- [ ] **Step 1: Write failing tests for developer schemas**

```typescript
// backend/src/__tests__/developerSchemas.test.ts
import { describe, it, expect } from 'vitest';
import { createDeveloperSchema, updateDeveloperSchema } from '../types.js';

describe('createDeveloperSchema', () => {
  it('accepts valid input with name only', () => {
    const result = createDeveloperSchema.safeParse({ name: 'Alice' });
    expect(result.success).toBe(true);
  });

  it('accepts name with optional skillIds', () => {
    const result = createDeveloperSchema.safeParse({
      name: 'Bob',
      skillIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createDeveloperSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = createDeveloperSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid skillIds', () => {
    const result = createDeveloperSchema.safeParse({ name: 'X', skillIds: ['not-uuid'] });
    expect(result.success).toBe(false);
  });
});

describe('updateDeveloperSchema', () => {
  it('accepts partial name update', () => {
    const result = updateDeveloperSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts partial bio update', () => {
    const result = updateDeveloperSchema.safeParse({ bio: 'Senior dev' });
    expect(result.success).toBe(true);
  });

  it('accepts skillIds update', () => {
    const result = updateDeveloperSchema.safeParse({
      skillIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = updateDeveloperSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts empty object (no-op update)', () => {
    const result = updateDeveloperSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/__tests__/developerSchemas.test.ts`
Expected: FAIL — `createDeveloperSchema` and `updateDeveloperSchema` not found in `../types.js`

- [ ] **Step 3: Add schemas to types.ts**

Add to `backend/src/types.ts` after the project schemas:

```typescript
// --- Developer schemas ---

export interface CreateDeveloperInput {
  name: string;
  skillIds?: string[];
}

export const createDeveloperSchema = z.object({
  name: z.string().min(1),
  skillIds: z.array(z.string().uuid()).optional().default([]),
});

export interface UpdateDeveloperInput {
  name?: string;
  bio?: string;
  skillIds?: string[];
}

export const updateDeveloperSchema = z.object({
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  skillIds: z.array(z.string().uuid()).optional(),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/__tests__/developerSchemas.test.ts`
Expected: PASS — all 10 tests green

- [ ] **Step 5: Commit**

```bash
git add backend/src/types.ts backend/src/__tests__/developerSchemas.test.ts
git commit -m "feat: add Zod schemas for developer create/update"
```

---

## Task 2: Developer CRUD Backend Routes

**Files:**
- Modify: `backend/src/routes/developers.ts`

- [ ] **Step 1: Add POST / route for creating developers**

Add to `backend/src/routes/developers.ts` after the imports, add the validate import:

```typescript
import { validate } from '../middleware/validate.js';
import { createDeveloperSchema, updateDeveloperSchema } from '../types.js';
```

Add after the `GET /:id` route:

```typescript
// POST /api/developers — Create a new developer
router.post('/', validate(createDeveloperSchema), asyncHandler(async (req, res) => {
  const { name, skillIds } = req.body as { name: string; skillIds: string[] };
  const developer = await prisma.developer.create({
    data: {
      name,
      skills: skillIds.length > 0 ? { connect: skillIds.map(id => ({ id })) } : undefined,
    },
    include: { skills: { select: { id: true, name: true } } },
  });
  logger.info({ developerId: developer.id }, 'Developer created');
  res.status(201).json(developer);
}));
```

- [ ] **Step 2: Add PATCH /:id route for updating developers**

Add after the POST route:

```typescript
// PATCH /api/developers/:id — Update developer name/bio/skills
router.patch('/:id', validate(updateDeveloperSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.developer.findUnique({ where: { id: id as string } });
  if (!existing) { res.status(404).json({ error: 'Developer not found' }); return; }

  const { name, bio, skillIds } = req.body as { name?: string; bio?: string; skillIds?: string[] };
  const developer = await prisma.developer.update({
    where: { id: id as string },
    data: {
      ...(name !== undefined && { name }),
      ...(bio !== undefined && { bio }),
      ...(skillIds !== undefined && { skills: { set: skillIds.map(id => ({ id })) } }),
    },
    include: { skills: { select: { id: true, name: true } } },
  });
  logger.info({ developerId: id }, 'Developer updated');
  res.json(developer);
}));
```

- [ ] **Step 3: Add DELETE /:id route**

Add after the PATCH route:

```typescript
// DELETE /api/developers/:id — Delete a developer
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.developer.findUnique({ where: { id: id as string } });
  if (!existing) { res.status(404).json({ error: 'Developer not found' }); return; }

  await prisma.developer.delete({ where: { id: id as string } });
  logger.info({ developerId: id }, 'Developer deleted');
  res.json({ deleted: true });
}));
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/developers.ts
git commit -m "feat: add POST/PATCH/DELETE endpoints for developer CRUD"
```

---

## Task 3: Developer CRUD Frontend API + Types

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add frontend API functions**

Add to `frontend/src/lib/api.ts` after the `extractSkillsFromText` function:

```typescript
export interface CreateDeveloperPayload {
  name: string;
  skillIds?: string[];
}

export interface UpdateDeveloperPayload {
  name?: string;
  bio?: string;
  skillIds?: string[];
}

export const createDeveloper = (body: CreateDeveloperPayload): Promise<Developer> =>
  fetch(`${API}/api/developers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Developer>(r));

export const updateDeveloper = (id: string, body: UpdateDeveloperPayload): Promise<Developer> =>
  fetch(`${API}/api/developers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => handleResponse<Developer>(r));

export const deleteDeveloper = (id: string): Promise<void> =>
  fetch(`${API}/api/developers/${id}`, { method: 'DELETE' })
    .then(r => handleResponse<void>(r));
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add developer CRUD API functions in frontend"
```

---

## Task 4: DeveloperListPage — Create Developer Form

**Files:**
- Modify: `frontend/src/pages/DeveloperListPage.tsx`
- Create: `frontend/src/__tests__/DeveloperListPage.test.tsx`

- [ ] **Step 1: Write failing test for create developer UI**

```typescript
// frontend/src/__tests__/DeveloperListPage.test.tsx
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
      expect(screen.getByRole('button', { name: /create developer/i })).toBeInTheDocument();
    });
  });

  it('shows and submits create form', async () => {
    const { fetchDevelopers, fetchSkills, createDeveloper } = await import('../lib/api');
    vi.mocked(fetchDevelopers).mockResolvedValue([]);
    vi.mocked(fetchSkills).mockResolvedValue([{ id: 's1', name: 'React' }]);
    vi.mocked(createDeveloper).mockResolvedValue({ id: 'new-dev', name: 'Eve', bio: null, cvText: null, cvFileName: null, skills: [] });
    const user = userEvent.setup();

    render(<MemoryRouter><DeveloperListPage /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /create developer/i }));
    await user.click(screen.getByRole('button', { name: /create developer/i }));
    await user.type(screen.getByPlaceholderText(/developer name/i), 'Eve');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(vi.mocked(createDeveloper)).toHaveBeenCalledWith({ name: 'Eve', skillIds: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/DeveloperListPage.test.tsx`
Expected: FAIL — no "Create Developer" button found

- [ ] **Step 3: Implement the create developer UI in DeveloperListPage**

Replace `frontend/src/pages/DeveloperListPage.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Developer, Skill } from '../lib/types';
import { fetchDevelopers, fetchSkills, createDeveloper } from '../lib/api';

export default function DeveloperListPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devs, sk] = await Promise.all([fetchDevelopers(), fetchSkills()]);
      setDevelopers(devs);
      setSkills(sk);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createDeveloper({ name: name.trim(), skillIds: selectedSkillIds });
      setName('');
      setSelectedSkillIds([]);
      setShowForm(false);
      await loadData();
    } catch {
      alert('Failed to create developer');
    } finally {
      setCreating(false);
    }
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Developers</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          {showForm ? 'Cancel' : 'Create Developer'}
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Developer name" className="w-full border rounded px-3 py-2 mb-3" />
          {skills.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Skills (optional):</p>
              <div className="flex gap-2 flex-wrap">
                {skills.map(s => (
                  <button key={s.id} type="button" onClick={() => toggleSkill(s.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      selectedSkillIds.includes(s.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleCreate} disabled={!name.trim() || creating}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
            Save
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {developers.map(dev => (
          <Link key={dev.id} to={`/developers/${dev.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50 transition">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">{dev.name}</h2>
                {dev.bio && <p className="text-gray-500 text-sm mt-0.5">{dev.bio}</p>}
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {dev.skills.map(s => (
                  <span key={s.id} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/DeveloperListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DeveloperListPage.tsx frontend/src/__tests__/DeveloperListPage.test.tsx
git commit -m "feat: add create developer form to DeveloperListPage"
```

---

## Task 5: DeveloperProfilePage — Edit Name/Bio + Delete

**Files:**
- Modify: `frontend/src/pages/DeveloperProfilePage.tsx`
- Create: `frontend/src/__tests__/DeveloperProfilePage.test.tsx`

- [ ] **Step 1: Write failing test for edit/delete UI**

```tsx
// frontend/src/__tests__/DeveloperProfilePage.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/DeveloperProfilePage.test.tsx`
Expected: FAIL — no Edit/Delete buttons

- [ ] **Step 3: Add edit/delete functionality to DeveloperProfilePage**

Replace `frontend/src/pages/DeveloperProfilePage.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Developer, ExtractedSkill } from '../lib/types';
import { fetchDeveloper, uploadCV, extractSkillsFromText, updateDeveloper, deleteDeveloper } from '../lib/api';

export default function DeveloperProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<ExtractedSkill[]>([]);
  const [cvText, setCvText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDeveloper(id).then(dev => {
      setDeveloper(dev);
      setEditName(dev.name);
      setEditBio(dev.bio || '');
    }).finally(() => setLoading(false));
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setExtracting(true);
    try {
      const result = await uploadCV(id, file);
      setDeveloper(result);
      setExtractedSkills(result.extractedSkills);
    } catch {
      alert('CV upload failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleTextExtract = async () => {
    if (!id || !cvText.trim()) return;
    setExtracting(true);
    try {
      const result = await extractSkillsFromText(id, cvText);
      setDeveloper(result);
      setExtractedSkills(result.extractedSkills);
    } catch {
      alert('Skill extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateDeveloper(id, { name: editName.trim(), bio: editBio.trim() || undefined });
      setDeveloper(updated);
      setEditing(false);
    } catch {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this developer?')) return;
    try {
      await deleteDeveloper(id);
      navigate('/developers');
    } catch {
      alert('Delete failed');
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!developer) return <div className="max-w-4xl mx-auto p-6 text-red-600">Developer not found</div>;

  const levelColors: Record<string, string> = {
    expert: 'bg-purple-100 text-purple-800',
    advanced: 'bg-blue-100 text-blue-800',
    intermediate: 'bg-green-100 text-green-800',
    beginner: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/developers" className="text-blue-600 text-sm hover:underline">← Back to Developers</Link>

      {/* Header with edit/delete */}
      <div className="flex justify-between items-start mt-2">
        {editing ? (
          <div className="flex-1 mr-4">
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className="text-2xl font-bold border rounded px-2 py-1 w-full mb-2" />
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
              placeholder="Bio (optional)" rows={2}
              className="w-full border rounded px-2 py-1 text-sm" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSaveEdit} disabled={saving || !editName.trim()}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                Save
              </button>
              <button onClick={() => { setEditing(false); setEditName(developer.name); setEditBio(developer.bio || ''); }}
                className="border px-3 py-1 rounded text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold">{developer.name}</h1>
            {developer.bio && <p className="text-gray-600 mt-1">{developer.bio}</p>}
            {developer.cvFileName && <p className="text-xs text-gray-400 mt-1">CV: {developer.cvFileName}</p>}
          </div>
        )}
        {!editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)}
              className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
              Edit
            </button>
            <button onClick={handleDelete}
              className="border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Current Skills */}
      <div className="my-6">
        <h2 className="text-lg font-semibold mb-2">Skills</h2>
        {developer.skills.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {developer.skills.map(s => (
              <span key={s.id} className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">{s.name}</span>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No skills yet — upload a CV to extract skills</p>
        )}
      </div>

      {/* Extracted Skills Result */}
      {extractedSkills.length > 0 && (
        <div className="mb-6 border rounded-lg p-4 bg-green-50">
          <h3 className="text-sm font-semibold text-green-800 mb-2">Extracted {extractedSkills.length} skills from CV</h3>
          <div className="flex gap-2 flex-wrap">
            {extractedSkills.map((s, i) => (
              <span key={i} className={`inline-block text-xs px-2 py-1 rounded-full ${levelColors[s.level] || 'bg-gray-100 text-gray-600'}`}>
                {s.name} <span className="opacity-60">({s.level})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CV Upload Section */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Upload CV / Resume</h2>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded text-sm ${activeTab === 'upload' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            Upload PDF
          </button>
          <button onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded text-sm ${activeTab === 'paste' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            Paste Text
          </button>
        </div>

        {activeTab === 'upload' ? (
          <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition">
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={extracting} />
            <p className="text-gray-500">{extracting ? 'Extracting skills...' : 'Click to upload PDF (max 5MB)'}</p>
          </label>
        ) : (
          <div>
            <textarea value={cvText} onChange={e => setCvText(e.target.value)}
              placeholder="Paste your CV/resume text here..." rows={8}
              className="w-full border rounded px-3 py-2 text-sm mb-3" />
            <button onClick={handleTextExtract} disabled={extracting || !cvText.trim()}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
              {extracting ? 'Extracting skills...' : 'Extract Skills'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/DeveloperProfilePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all existing tests to check no regressions**

Run: `cd frontend && npx vitest run && cd ../backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DeveloperProfilePage.tsx frontend/src/__tests__/DeveloperProfilePage.test.tsx
git commit -m "feat: add edit name/bio and delete to DeveloperProfilePage"
```

---

## Task 6: Skill Overhaul — Seed Real Tech Skills

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Update seed to use real tech skills**

Replace `backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data for idempotent re-runs (Docker restarts)
  await prisma.task.deleteMany();
  await prisma.developer.deleteMany();
  await prisma.skill.deleteMany();

  // Create real tech skills (flat — no hierarchy)
  const skillNames = [
    'React', 'Angular', 'Vue', 'TypeScript', 'Node.js',
    'Python', 'Java', 'Go', 'Rust', 'PostgreSQL',
    'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
    'GraphQL',
  ];

  const skills: Record<string, string> = {};
  for (const name of skillNames) {
    const skill = await prisma.skill.create({ data: { name } });
    skills[name] = skill.id;
  }

  // Create developers with realistic skill sets
  const devs = [
    { name: 'Alice', skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'] },
    { name: 'Bob', skills: ['Java', 'PostgreSQL', 'Docker', 'Kubernetes'] },
    { name: 'Carol', skills: ['React', 'TypeScript', 'Python', 'AWS', 'Docker'] },
    { name: 'Dave', skills: ['Go', 'PostgreSQL', 'Redis', 'Kubernetes'] },
  ];

  for (const dev of devs) {
    await prisma.developer.create({
      data: {
        name: dev.name,
        skills: { connect: dev.skills.map(name => ({ id: skills[name] })) },
      },
    });
  }

  console.log(`Seed complete: ${skillNames.length} skills, ${devs.length} developers`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: seed 16 real tech skills instead of Frontend/Backend"
```

---

## Task 7: Fix classifySkills Zod Schema

**Files:**
- Modify: `backend/src/services/llmService.ts:261-263`

- [ ] **Step 1: Fix the Zod schema to use z.enum for available skills**

In `backend/src/services/llmService.ts`, replace lines 261-263:

```typescript
    const dynamicSchema = z.object({
      skills: z.array(z.string()),
    });
```

With:

```typescript
    const dynamicSchema = z.object({
      skills: z.array(z.enum(skillNames as [string, ...string[]])),
    });
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run backend tests**

Run: `cd backend && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/llmService.ts
git commit -m "fix: use z.enum for classifySkills to constrain LLM output to available skills"
```

---

## Task 8: Task Filters — Backend

**Files:**
- Modify: `backend/src/services/taskService.ts`
- Modify: `backend/src/routes/tasks.ts`

- [ ] **Step 1: Add filter params to getAllTasksFlat**

In `backend/src/services/taskService.ts`, replace the `getAllTasksFlat` function:

```typescript
export interface TaskFilters {
  projectId?: string;
  status?: string;
  developerId?: string;
}

export async function getAllTasksFlat(filters?: TaskFilters) {
  const where: Record<string, unknown> = {};
  if (filters?.projectId) where.projectId = filters.projectId;
  if (filters?.status) where.status = filters.status;
  if (filters?.developerId) {
    where.developerId = filters.developerId === 'unassigned' ? null : filters.developerId;
  }

  const tasks = await prisma.task.findMany({ where, include: taskInclude });
  return computeFlatListWithDepth(tasks);
}
```

- [ ] **Step 2: Update tasks route to pass query params**

In `backend/src/routes/tasks.ts`, replace the GET `/` handler:

```typescript
router.get('/', async (req, res) => {
  const { projectId, status, developerId } = req.query as Record<string, string | undefined>;
  const tasks = await taskService.getAllTasksFlat({ projectId, status, developerId });
  res.json(tasks);
});
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/taskService.ts backend/src/routes/tasks.ts
git commit -m "feat: add project/status/assignee filters to GET /api/tasks"
```

---

## Task 9: Task Filters — Frontend

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/pages/TaskListPage.tsx`
- Modify: `frontend/src/pages/ProjectDetailPage.tsx`

- [ ] **Step 1: Add TaskFilters type**

Add to `frontend/src/lib/types.ts`:

```typescript
export interface TaskFilters {
  projectId?: string;
  status?: string;
  developerId?: string;
}
```

- [ ] **Step 2: Update fetchTasks to accept filters**

In `frontend/src/lib/api.ts`, replace the `fetchTasks` function:

```typescript
export const fetchTasks = (filters?: { projectId?: string; status?: string; developerId?: string }): Promise<Task[]> => {
  const params = new URLSearchParams();
  if (filters?.projectId) params.set('projectId', filters.projectId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.developerId) params.set('developerId', filters.developerId);
  const qs = params.toString();
  return fetch(`${API}/api/tasks${qs ? `?${qs}` : ''}`).then(r => handleResponse<Task[]>(r));
};
```

- [ ] **Step 3: Rewrite TaskListPage with filter dropdowns and URL sync**

Replace `frontend/src/pages/TaskListPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Task, Developer, Project } from '../lib/types';
import { fetchTasks, fetchDevelopers, fetchProjects } from '../lib/api';
import TaskRow from '../components/TaskRow';

export default function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = searchParams.get('projectId') || '';
  const status = searchParams.get('status') || '';
  const developerId = searchParams.get('developerId') || '';

  const activeProject = projects.find(p => p.id === projectId);

  const setFilter = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        ...(projectId && { projectId }),
        ...(status && { status }),
        ...(developerId && { developerId }),
      };
      const [tasksData, devsData, projsData] = await Promise.all([
        fetchTasks(Object.keys(filters).length > 0 ? filters : undefined),
        fetchDevelopers(),
        fetchProjects(),
      ]);
      setTasks(tasksData);
      setDevelopers(devsData);
      setProjects(projsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId, status, developerId]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Project banner when filtered */}
      {activeProject && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 flex justify-between items-center">
          <span className="text-sm text-blue-800">
            Showing tasks for <strong>{activeProject.name}</strong>
          </span>
          <button onClick={() => setFilter('projectId', '')}
            className="text-blue-600 text-sm hover:underline">Clear filter</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link to="/tasks/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create Task
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select aria-label="Filter by project" value={projectId} onChange={e => setFilter('projectId', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={e => setFilter('status', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="TODO">To-do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
        <select aria-label="Filter by assignee" value={developerId} onChange={e => setFilter('developerId', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {(projectId || status || developerId) && (
          <button onClick={() => setSearchParams({})}
            className="text-gray-500 text-sm hover:text-gray-700">
            Clear all
          </button>
        )}
      </div>

      {loading && <p className="text-gray-500 mt-4">Loading...</p>}
      {error && (
        <div className="mt-4">
          <p className="text-red-600">{error}</p>
          <button type="button" onClick={() => { void loadData(); }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b font-semibold text-sm text-gray-600">
                <th className="py-2 pr-4">Task Title</th>
                <th className="py-2 pr-4">Skills</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Assignee</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} developers={developers} onUpdate={loadData} />
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && <p className="text-gray-500 mt-4">No tasks match the current filters.</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update ProjectDetailPage "View Tasks" link**

In `frontend/src/pages/ProjectDetailPage.tsx`, replace the "View all tasks" link (line 192):

```tsx
<Link to={`/tasks?projectId=${project.id}`} className="text-blue-600 text-sm hover:underline mt-2 inline-block">View all tasks →</Link>
```

- [ ] **Step 5: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass (existing TaskListPage tests may need mock updates — see next step)

- [ ] **Step 6: Update TaskListPage tests for new dependencies**

In `frontend/src/__tests__/TaskListPage.test.tsx`, update the mock to include `fetchProjects`:

```typescript
vi.mock('../lib/api', () => ({
  fetchTasks: vi.fn(),
  fetchDevelopers: vi.fn(),
  fetchProjects: vi.fn(),
  updateTask: vi.fn(() => Promise.resolve({})),
}));
```

Add `fetchProjects` mock setup wherever `fetchTasks` and `fetchDevelopers` are mocked:

```typescript
vi.mocked(fetchProjects).mockResolvedValue([]);
```

Also add the import:
```typescript
import { fetchTasks, fetchDevelopers, fetchProjects } from '../lib/api';
// ... in the vi.mock setup and each test's beforeEach
```

- [ ] **Step 7: Run all tests**

Run: `cd frontend && npx vitest run && cd ../backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/pages/TaskListPage.tsx frontend/src/pages/ProjectDetailPage.tsx frontend/src/__tests__/TaskListPage.test.tsx
git commit -m "feat: add project/status/assignee filter dropdowns to TaskListPage with URL sync"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: TypeScript compile check (both)**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify no regressions in existing functionality**

Run: `cd backend && npm run build`
Expected: Clean build
