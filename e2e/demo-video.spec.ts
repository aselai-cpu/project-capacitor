import { test, expect } from '@playwright/test';

const APP = 'http://localhost:3000';
const GRAFANA = 'http://localhost:3001';
const LANGFUSE = 'http://localhost:3002';

// Slow, visible pace for demo recording
const PAUSE = 1500;
const SHORT = 800;

test.use({
  viewport: { width: 1440, height: 900 },
  video: { mode: 'on', size: { width: 1440, height: 900 } },
  launchOptions: { slowMo: 200 },
});

test('Capacitor — Full Feature Demo', async ({ page }) => {
  test.setTimeout(180_000); // 3 min max

  // ─── 1. Dashboard ───
  await page.goto(`${APP}/dashboard`);
  await page.waitForSelector('text=Dashboard', { timeout: 10000 });
  await page.waitForTimeout(PAUSE);

  // ─── 2. Projects ───
  await page.click('nav >> text=Projects');
  await page.waitForTimeout(SHORT);

  // Click the first project in the list
  const projectLink = page.locator('a[href^="/projects/"]').first();
  if (await projectLink.isVisible()) {
    await projectLink.click();
    await page.waitForTimeout(PAUSE);

    // Scroll down to see tasks if present
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(SHORT);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(SHORT);
  }

  // ─── 3. Tasks ───
  await page.click('nav >> text=Tasks');
  await page.waitForTimeout(PAUSE);

  // Scroll through the task list
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(SHORT);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(SHORT);

  // ─── 4. Task Detail ───
  const detailLink = page.locator('text=Details').first();
  if (await detailLink.isVisible()) {
    await detailLink.click();
    await page.waitForTimeout(PAUSE);

    // Scroll to see description / acceptance criteria
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(SHORT);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(SHORT);
  }

  // ─── 5. Team ───
  await page.click('nav >> text=Team');
  await page.waitForTimeout(PAUSE);

  // Click into first developer profile
  const devLink = page.locator('a[href^="/team/"]').first();
  if (await devLink.isVisible()) {
    await devLink.click();
    await page.waitForTimeout(PAUSE);

    // Scroll to see skills
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(SHORT);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(SHORT);
  }

  // ─── 6. Allocation — Three Views ───
  await page.click('nav >> text=Allocate');
  await page.waitForTimeout(PAUSE);

  // Matrix view (default)
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(SHORT);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(SHORT);

  // Switch to Kanban
  const kanbanTab = page.locator('button', { hasText: /kanban/i });
  if (await kanbanTab.isVisible()) {
    await kanbanTab.click();
    await page.waitForTimeout(PAUSE);
  }

  // Switch to Focus
  const focusTab = page.locator('button', { hasText: /focus/i });
  if (await focusTab.isVisible()) {
    await focusTab.click();
    await page.waitForTimeout(PAUSE);
  }

  // ─── 7. Kickstart ───
  await page.click('nav >> text=Kickstart');
  await page.waitForTimeout(SHORT);

  // Fill the form (but don't submit — LLM calls take minutes)
  const nameInput = page.locator('#project-name');
  if (await nameInput.isVisible()) {
    await nameInput.fill('E-Commerce Platform');
    await page.waitForTimeout(SHORT);

    const descInput = page.locator('#project-desc');
    await descInput.fill('Build a modern e-commerce platform with product catalog, shopping cart, checkout with Stripe payments, user accounts, and an admin dashboard for inventory management.');
    await page.waitForTimeout(SHORT);

    // Select some existing team members (click chips)
    const chips = page.locator('form button[type="button"]').filter({ hasNotText: /add|✕/i });
    const chipCount = await chips.count();
    for (let i = 0; i < Math.min(chipCount, 3); i++) {
      await chips.nth(i).click();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(PAUSE);
  }

  // ─── 8. Grafana / Loki Logs ───
  await page.goto(GRAFANA);
  await page.waitForTimeout(PAUSE);

  // Navigate to Explore
  await page.goto(`${GRAFANA}/explore`);
  await page.waitForTimeout(PAUSE);

  // Select Loki datasource if dropdown visible
  const dsSelect = page.locator('[data-testid="data-source-picker"]').or(page.locator('button:has-text("Loki")')).or(page.locator('label:has-text("Loki")'));
  if (await dsSelect.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await dsSelect.first().click();
    await page.waitForTimeout(SHORT);
    const lokiOption = page.locator('text=Loki').first();
    if (await lokiOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lokiOption.click();
      await page.waitForTimeout(SHORT);
    }
  }

  // Type a LogQL query
  const queryInput = page.locator('[aria-label="Code editor"]').or(page.locator('textarea').first()).or(page.locator('[role="textbox"]').first());
  if (await queryInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await queryInput.first().click();
    await page.keyboard.type('{app="capacitor-backend"}', { delay: 50 });
    await page.waitForTimeout(SHORT);

    // Click Run query
    const runBtn = page.locator('button:has-text("Run query")');
    if (await runBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(PAUSE * 2);
    }
  }

  // Scroll to see log results
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(PAUSE);

  // ─── 9. Langfuse LLM Traces ───
  await page.goto(LANGFUSE);
  await page.waitForTimeout(PAUSE);

  // Login if needed
  const emailInput = page.locator('input[name="email"]').or(page.locator('input[type="email"]'));
  if (await emailInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.first().fill('admin@capacitor.dev');
    const pwInput = page.locator('input[name="password"]').or(page.locator('input[type="password"]'));
    await pwInput.first().fill('admin123');
    await page.waitForTimeout(SHORT);
    const signInBtn = page.locator('button[type="submit"]').or(page.locator('button:has-text("Sign in")'));
    await signInBtn.first().click();
    await page.waitForTimeout(PAUSE);
  }

  // Navigate to traces
  const tracesLink = page.locator('a:has-text("Traces")').first();
  if (await tracesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tracesLink.click();
    await page.waitForTimeout(PAUSE);
  }

  // Click into first trace to see detail
  const traceRow = page.locator('table tbody tr').first().or(page.locator('[data-testid="trace-row"]').first());
  if (await traceRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await traceRow.click();
    await page.waitForTimeout(PAUSE);

    // Scroll to see trace spans
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE);
  }

  // Final pause before video ends
  await page.waitForTimeout(PAUSE);
});
