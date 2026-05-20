import { test, expect, request as playwrightRequest } from '@playwright/test';

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve skill/developer IDs from the live API once per suite. */
interface SeedData {
  frontendSkillId: string;
  backendSkillId: string;
  aliceId: string;
  bobId: string;
}

async function getSeedData(): Promise<SeedData> {
  const [skillsRes, devsRes] = await Promise.all([
    fetch(`${API}/api/skills`),
    fetch(`${API}/api/developers`),
  ]);
  const skills: { id: string; name: string }[] = await skillsRes.json();
  const devs: { id: string; name: string; skills: { id: string }[] }[] = await devsRes.json();

  const frontendSkill = skills.find(s => s.name === 'Frontend')!;
  const backendSkill = skills.find(s => s.name === 'Backend')!;
  const alice = devs.find(d => d.name === 'Alice')!;
  const bob = devs.find(d => d.name === 'Bob')!;

  return {
    frontendSkillId: frontendSkill.id,
    backendSkillId: backendSkill.id,
    aliceId: alice.id,
    bobId: bob.id,
  };
}

/** Create a task via the API and return its id. */
async function apiCreateTask(body: {
  title: string;
  skillIds: string[];
  parentId?: string | null;
  subtasks?: { title: string; skillIds: string[] }[];
}): Promise<string> {
  const res = await fetch(`${API}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtasks: [], ...body }),
  });
  const json = await res.json();
  return json.id;
}

/** Delete all tasks via the cleanup endpoint. */
async function deleteAllTasks(): Promise<void> {
  await fetch(`${API}/api/tasks`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.beforeEach(async () => {
  await deleteAllTasks();
});

// ---------------------------------------------------------------------------
// Test 1: Task list page loads
// ---------------------------------------------------------------------------
test('Task 1: Task List page loads and shows empty state', async ({ page }) => {
  await page.goto('/tasks');

  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  // Either the empty-state message or the Create Task button confirms the page rendered.
  const emptyOrCreate = page
    .getByText('No tasks yet')
    .or(page.getByRole('link', { name: 'Create Task' }));
  await expect(emptyOrCreate.first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2: Create a simple task
// ---------------------------------------------------------------------------
test('Task 2: Create a simple task with a skill', async ({ page }) => {
  const seed = await getSeedData();

  await page.goto('/tasks/new');
  await expect(page.getByRole('heading', { name: 'Create Task' })).toBeVisible();

  // Fill title
  await page.getByPlaceholder('Task title...').fill('Build responsive homepage');

  // Click the Frontend skill button
  await page.getByRole('button', { name: 'Frontend' }).click();

  // Save
  await page.getByRole('button', { name: 'Save' }).click();

  // Should redirect to /tasks
  await page.waitForURL('**/tasks');

  // Task title appears in the list
  await expect(page.getByText('Build responsive homepage')).toBeVisible();

  // Frontend skill badge appears
  await expect(page.locator('.bg-blue-100.text-blue-800', { hasText: 'Frontend' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 3: Create a task with subtasks (recursive form)
// ---------------------------------------------------------------------------
test('Task 3: Create a task with a subtask', async ({ page }) => {
  await page.goto('/tasks/new');

  // Fill root task title
  const inputs = page.getByPlaceholder('Task title...');
  await inputs.first().fill('User profile system');

  // Click "+ Subtask" button in the form (the button inside the form, not nav links)
  await page.getByRole('button', { name: '+ Subtask' }).click();

  // A second input should appear for the subtask
  await expect(inputs).toHaveCount(2);
  await inputs.nth(1).fill('Design profile layout');

  // Save
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForURL('**/tasks');

  // Both root and subtask appear
  await expect(page.getByText('User profile system')).toBeVisible();
  await expect(page.getByText('Design profile layout')).toBeVisible();

  // Subtask indented with ↳
  await expect(page.locator('span', { hasText: '↳' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4: Update task status
// ---------------------------------------------------------------------------
test('Task 4: Update task status from To-do to In Progress', async ({ page }) => {
  await apiCreateTask({ title: 'Status update task', skillIds: [] });

  await page.goto('/tasks');

  // Find the row containing our task, then its status <select>
  const taskRow = page.locator('tr', { hasText: 'Status update task' });
  const statusSelect = taskRow.locator('select').first();

  await expect(statusSelect).toHaveValue('TODO');

  // Change to IN_PROGRESS and wait for API response
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/tasks/') && res.request().method() === 'PATCH'),
    statusSelect.selectOption('IN_PROGRESS'),
  ]);

  // Re-fetch and confirm the select shows In Progress
  await page.reload();
  const refreshedRow = page.locator('tr', { hasText: 'Status update task' });
  await expect(refreshedRow.locator('select').first()).toHaveValue('IN_PROGRESS');
});

// ---------------------------------------------------------------------------
// Test 5: Assign a developer — happy path (skill guard)
// ---------------------------------------------------------------------------
test('Task 5: Assign Alice to a Frontend task', async ({ page }) => {
  const seed = await getSeedData();

  await apiCreateTask({ title: 'Alice assignment task', skillIds: [seed.frontendSkillId] });

  await page.goto('/tasks');

  const taskRow = page.locator('tr', { hasText: 'Alice assignment task' });
  // Assignee dropdown is the second <select> in the row (first is status)
  const assigneeSelect = taskRow.locator('select').nth(1);

  // Alice should be an option
  await expect(assigneeSelect.locator('option', { hasText: 'Alice' })).toHaveCount(1);

  // Select Alice and wait for PATCH
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/tasks/') && res.request().method() === 'PATCH'),
    assigneeSelect.selectOption({ label: 'Alice' }),
  ]);

  // After reload, Alice is still the selected assignee
  await page.reload();
  const refreshedRow = page.locator('tr', { hasText: 'Alice assignment task' });
  const refreshedSelect = refreshedRow.locator('select').nth(1);
  await expect(refreshedSelect.locator('option:checked')).toHaveText('Alice');
});

// ---------------------------------------------------------------------------
// Test 6: Skill guard — Bob not shown for Frontend task
// ---------------------------------------------------------------------------
test('Task 6: Skill guard — Bob not in assignee dropdown for Frontend task', async ({ page }) => {
  const seed = await getSeedData();

  await apiCreateTask({ title: 'Skill guard task', skillIds: [seed.frontendSkillId] });

  await page.goto('/tasks');

  const taskRow = page.locator('tr', { hasText: 'Skill guard task' });
  const assigneeSelect = taskRow.locator('select').nth(1);

  // Alice (Frontend skill) IS present
  await expect(assigneeSelect.locator('option', { hasText: 'Alice' })).toHaveCount(1);

  // Bob (Backend only) is NOT present
  await expect(assigneeSelect.locator('option', { hasText: 'Bob' })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Test 7: Status cascade guard — cannot mark parent Done with pending subtasks
// ---------------------------------------------------------------------------
test('Task 7: Cannot mark parent Done with pending subtasks', async ({ page }) => {
  const seed = await getSeedData();

  // Create parent task with a subtask (via API — subtask stays TODO)
  const parentId = await apiCreateTask({
    title: 'Cascade parent task',
    skillIds: [],
    subtasks: [{ title: 'Pending subtask', skillIds: [] }],
  });

  await page.goto('/tasks');

  // Find parent row (depth=0, no ↳ prefix)
  const parentRow = page.locator('tr').filter({
    has: page.locator('td').first().filter({ hasNotText: '↳' }).filter({ hasText: 'Cascade parent task' }),
  });
  const statusSelect = parentRow.locator('select').first();

  const initialValue = await statusSelect.inputValue();

  // Try to set to DONE — the API will return 400, frontend re-fetches → still old value
  await statusSelect.selectOption('DONE');

  // Give the app time to call the API and re-fetch
  await page.waitForTimeout(1500);

  // Status should NOT be DONE
  const afterValue = await statusSelect.inputValue();
  expect(afterValue).not.toBe('DONE');
  expect(afterValue).toBe(initialValue);
});

// ---------------------------------------------------------------------------
// Test 8: "+ Subtask" link navigates to /tasks/new?parentId=<id>
// ---------------------------------------------------------------------------
test('Task 8: Add Subtask link navigates with parentId and shows correct heading', async ({ page }) => {
  const taskId = await apiCreateTask({ title: 'Subtask nav task', skillIds: [] });

  await page.goto('/tasks');

  const taskRow = page.locator('tr', { hasText: 'Subtask nav task' });
  const subtaskLink = taskRow.locator('a', { hasText: '+ Subtask' });

  await subtaskLink.click();

  // URL should contain /tasks/new?parentId=<id>
  await page.waitForURL(`**/tasks/new?parentId=${taskId}`);

  // Heading should say "Add Subtask", not "Create Task"
  await expect(page.getByRole('heading', { name: 'Add Subtask' })).toBeVisible();
});
