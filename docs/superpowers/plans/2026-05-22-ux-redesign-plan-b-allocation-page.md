# UX Redesign Plan B: Allocation Page (Matrix, Kanban, Focus Views)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Allocation page at `/allocate` with three switchable views (Matrix, Kanban, Focus) that let a PM assign developers to tasks using AI-scored skill matching.

**Architecture:** One parent `AllocationPage` component manages shared state (scores data, project filter, selected view). Three view components render the same data differently. Each view calls `updateTask` via the existing API to assign developers. The `fetchAllocationScores` and `fetchAllocationReason` API functions from Plan A provide data. No new backend work needed.

**Tech Stack:** React, React Router, Tailwind CSS (frontend); Vitest + React Testing Library (tests)

**Spec:** `docs/superpowers/specs/2026-05-22-ux-redesign-allocation-copilot.md` — Section 3 (Allocation Page)

**Depends on:** Plan A (complete) — all backend endpoints and frontend API functions are in place.

---

## File Map

### New Files
- `frontend/src/pages/AllocationPage.tsx` — Parent page with view switcher, project filter, data loading
- `frontend/src/components/allocation/MatrixView.tsx` — Tasks × Developers score grid
- `frontend/src/components/allocation/KanbanView.tsx` — Board with Unassigned + per-developer columns
- `frontend/src/components/allocation/FocusView.tsx` — Split panel: task list + AI recommendations
- `frontend/src/components/allocation/AssignConfirm.tsx` — Shared confirmation popover for assignment
- `frontend/src/__tests__/AllocationPage.test.tsx` — Integration tests

### Modified Files
- `frontend/src/App.tsx` — Add `/allocate` route

---

## Task 1: AssignConfirm Popover Component

**Files:**
- Create: `frontend/src/components/allocation/AssignConfirm.tsx`

- [ ] **Step 1: Create the shared confirmation popover**

```tsx
// frontend/src/components/allocation/AssignConfirm.tsx
import { useState } from 'react';
import { updateTask } from '../../lib/api';

interface Props {
  taskId: string;
  taskTitle: string;
  developerId: string;
  developerName: string;
  matchPercent: number;
  onAssigned: () => void;
  onCancel: () => void;
}

export default function AssignConfirm({ taskId, taskTitle, developerId, developerName, matchPercent, onAssigned, onCancel }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async () => {
    setAssigning(true);
    setError(null);
    try {
      await updateTask(taskId, { developerId });
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-lg p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-2">Assign Developer</h3>
        <p className="text-sm text-gray-600 mb-1">
          Assign <strong>{developerName}</strong> to <strong>{taskTitle}</strong>?
        </p>
        <p className="text-xs text-gray-500 mb-4">Match: {matchPercent}%</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleAssign} disabled={assigning}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {assigning ? 'Assigning...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/allocation/AssignConfirm.tsx
git commit -m "feat: add AssignConfirm popover component for allocation views

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Matrix View Component

**Files:**
- Create: `frontend/src/components/allocation/MatrixView.tsx`

- [ ] **Step 1: Create the Matrix View**

```tsx
// frontend/src/components/allocation/MatrixView.tsx
import { useState } from 'react';
import type { ScoredTask } from '../../lib/types';
import AssignConfirm from './AssignConfirm';

interface Props {
  tasks: ScoredTask[];
  onAssigned: () => void;
}

function scoreColor(pct: number): string {
  if (pct === 100) return 'bg-green-500 text-white cursor-pointer hover:bg-green-600';
  if (pct >= 50) return 'bg-yellow-400 text-yellow-900 cursor-default';
  return 'bg-red-500 text-white cursor-default';
}

export default function MatrixView({ tasks, onAssigned }: Props) {
  const [confirm, setConfirm] = useState<{
    taskId: string; taskTitle: string; developerId: string; developerName: string; matchPercent: number;
  } | null>(null);

  // Collect unique developers from all scores
  const devMap = new Map<string, { name: string; taskCount: number }>();
  for (const task of tasks) {
    for (const score of task.scores) {
      if (!devMap.has(score.developerId)) {
        devMap.set(score.developerId, { name: score.developerName, taskCount: score.currentTaskCount });
      }
    }
  }
  const developers = Array.from(devMap.entries()).map(([id, d]) => ({ id, ...d }));

  if (tasks.length === 0) {
    return <p className="text-gray-500 mt-4">No unassigned tasks. All tasks have been allocated.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border-b-2 border-gray-200 min-w-[200px]">Task</th>
              {developers.map(dev => (
                <th key={dev.id} className="p-3 border-b-2 border-gray-200 text-center min-w-[90px]">
                  <div className="font-semibold">{dev.name}</div>
                  <div className="font-normal text-xs text-gray-500">{dev.taskCount} tasks</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const scoreMap = new Map(task.scores.map(s => [s.developerId, s]));
              return (
                <tr key={task.taskId} className="border-b hover:bg-gray-50/50">
                  <td className="p-3">
                    <div className="font-medium">{task.taskTitle}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {task.taskSkills.map(s => (
                        <span key={s} className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </td>
                  {developers.map(dev => {
                    const score = scoreMap.get(dev.id);
                    if (!score) return <td key={dev.id} className="p-3 text-center">—</td>;
                    const isClickable = score.matchPercent === 100;
                    return (
                      <td key={dev.id} className="p-3 text-center">
                        <button
                          disabled={!isClickable}
                          onClick={() => isClickable && setConfirm({
                            taskId: task.taskId,
                            taskTitle: task.taskTitle,
                            developerId: dev.id,
                            developerName: dev.name,
                            matchPercent: score.matchPercent,
                          })}
                          title={score.missingSkills.length > 0 ? `Missing: ${score.missingSkills.join(', ')}` : 'Click to assign'}
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${scoreColor(score.matchPercent)} ${score.isTopPick ? 'ring-2 ring-green-300 ring-offset-1' : ''}`}>
                          {score.matchPercent}%
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1 align-middle" />100% — click to assign</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1 align-middle" />Partial — hover for gaps</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1 align-middle" />Weak match</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-300 mr-1 align-middle" />AI top pick</span>
      </div>
      {confirm && (
        <AssignConfirm
          taskId={confirm.taskId}
          taskTitle={confirm.taskTitle}
          developerId={confirm.developerId}
          developerName={confirm.developerName}
          matchPercent={confirm.matchPercent}
          onAssigned={() => { setConfirm(null); onAssigned(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/allocation/MatrixView.tsx
git commit -m "feat: add Matrix view — tasks x developers score grid with click-to-assign

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Kanban View Component

**Files:**
- Create: `frontend/src/components/allocation/KanbanView.tsx`

- [ ] **Step 1: Create the Kanban View**

The Kanban view shows an "Unassigned" column and one column per developer. Since drag-and-drop library choice is out of scope, we use click-to-assign: click a task card in Unassigned, then it shows the assign confirmation dialog. Each task card in the Unassigned column shows the top 2 recommended developers as small badges.

```tsx
// frontend/src/components/allocation/KanbanView.tsx
import { useState, useEffect } from 'react';
import type { ScoredTask, Task, Developer } from '../../lib/types';
import { fetchTasks, fetchDevelopers } from '../../lib/api';
import AssignConfirm from './AssignConfirm';

interface Props {
  scoredTasks: ScoredTask[];
  projectId?: string;
  onAssigned: () => void;
}

export default function KanbanView({ scoredTasks, projectId, onAssigned }: Props) {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{
    taskId: string; taskTitle: string; developerId: string; developerName: string; matchPercent: number;
  } | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchTasks(projectId ? { projectId } : undefined),
      fetchDevelopers(),
    ]).then(([t, d]) => { setAllTasks(t); setDevelopers(d); })
      .finally(() => setLoading(false));
  }, [projectId, scoredTasks]);

  if (loading) return <p className="text-gray-500">Loading board...</p>;

  // Group assigned tasks by developer
  const assignedByDev = new Map<string, Task[]>();
  for (const dev of developers) {
    assignedByDev.set(dev.id, []);
  }
  for (const task of allTasks) {
    if (task.developer) {
      const existing = assignedByDev.get(task.developer.id) || [];
      existing.push(task);
      assignedByDev.set(task.developer.id, existing);
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    TODO: 'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    DONE: 'bg-green-100 text-green-800',
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Unassigned column */}
        <div className="min-w-[260px] max-w-[300px] flex-shrink-0">
          <div className="bg-red-50 rounded-t-lg px-3 py-2 border border-red-200">
            <span className="font-semibold text-red-800 text-sm">Unassigned</span>
            <span className="ml-2 text-xs text-red-600">{scoredTasks.length}</span>
          </div>
          <div className="border border-t-0 border-red-200 rounded-b-lg p-2 space-y-2 min-h-[200px] bg-red-50/30">
            {scoredTasks.map(st => {
              const top2 = st.scores.filter(s => s.matchPercent === 100).slice(0, 2);
              const isSelected = selectedTask === st.taskId;
              return (
                <div key={st.taskId}
                  className={`bg-white rounded-lg border p-3 cursor-pointer transition ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                  onClick={() => setSelectedTask(isSelected ? null : st.taskId)}>
                  <div className="font-medium text-sm">{st.taskTitle}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {st.taskSkills.map(s => (
                      <span key={s} className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                  {top2.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {top2.map(s => (
                        <button key={s.developerId}
                          onClick={e => { e.stopPropagation(); setConfirm({
                            taskId: st.taskId, taskTitle: st.taskTitle,
                            developerId: s.developerId, developerName: s.developerName,
                            matchPercent: s.matchPercent,
                          }); }}
                          className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full hover:bg-green-200">
                          {s.developerName} {s.matchPercent}%
                        </button>
                      ))}
                    </div>
                  )}
                  {top2.length === 0 && (
                    <div className="mt-2 text-xs text-gray-400">No eligible developer</div>
                  )}
                </div>
              );
            })}
            {scoredTasks.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">All allocated</p>
            )}
          </div>
        </div>

        {/* Developer columns */}
        {developers.map(dev => {
          const devTasks = assignedByDev.get(dev.id) || [];
          return (
            <div key={dev.id} className="min-w-[220px] max-w-[260px] flex-shrink-0">
              <div className="bg-blue-50 rounded-t-lg px-3 py-2 border border-blue-200">
                <span className="font-semibold text-blue-800 text-sm">{dev.name}</span>
                <span className="ml-2 text-xs text-blue-600">{devTasks.length} tasks</span>
              </div>
              <div className="border border-t-0 border-blue-200 rounded-b-lg p-2 space-y-2 min-h-[200px] bg-blue-50/30">
                {devTasks.map(task => (
                  <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="text-sm">{task.title}</div>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${STATUS_COLORS[task.status] || ''}`}>
                      {task.status === 'IN_PROGRESS' ? 'In Progress' : task.status === 'DONE' ? 'Done' : 'To-do'}
                    </span>
                  </div>
                ))}
                {devTasks.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confirm && (
        <AssignConfirm
          taskId={confirm.taskId} taskTitle={confirm.taskTitle}
          developerId={confirm.developerId} developerName={confirm.developerName}
          matchPercent={confirm.matchPercent}
          onAssigned={() => { setConfirm(null); onAssigned(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/allocation/KanbanView.tsx
git commit -m "feat: add Kanban view — board with unassigned and per-developer columns

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Focus View Component

**Files:**
- Create: `frontend/src/components/allocation/FocusView.tsx`

- [ ] **Step 1: Create the Focus View**

```tsx
// frontend/src/components/allocation/FocusView.tsx
import { useState, useEffect, useRef } from 'react';
import type { ScoredTask, TaskScore } from '../../lib/types';
import { fetchAllocationReason } from '../../lib/api';
import AssignConfirm from './AssignConfirm';

interface Props {
  tasks: ScoredTask[];
  onAssigned: () => void;
}

export default function FocusView({ tasks, onAssigned }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Map<string, string>>(new Map());
  const [loadingReasons, setLoadingReasons] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{
    taskId: string; taskTitle: string; developerId: string; developerName: string; matchPercent: number;
  } | null>(null);
  const reasonCache = useRef<Map<string, string>>(new Map());

  const selectedTask = tasks.find(t => t.taskId === selectedTaskId);
  const eligible = selectedTask?.scores.filter(s => s.matchPercent === 100).slice(0, 3) || [];

  // Load reasons lazily for eligible developers when task is selected
  useEffect(() => {
    if (!selectedTaskId || eligible.length === 0) return;

    for (const score of eligible) {
      const cacheKey = `${selectedTaskId}:${score.developerId}`;
      if (reasonCache.current.has(cacheKey)) {
        setReasons(prev => new Map(prev).set(cacheKey, reasonCache.current.get(cacheKey)!));
        continue;
      }
      if (loadingReasons.has(cacheKey)) continue;

      setLoadingReasons(prev => new Set(prev).add(cacheKey));
      fetchAllocationReason(selectedTaskId, score.developerId)
        .then(({ reason }) => {
          reasonCache.current.set(cacheKey, reason);
          setReasons(prev => new Map(prev).set(cacheKey, reason));
        })
        .catch(() => {
          setReasons(prev => new Map(prev).set(cacheKey, 'AI reasoning unavailable.'));
        })
        .finally(() => {
          setLoadingReasons(prev => {
            const next = new Set(prev);
            next.delete(cacheKey);
            return next;
          });
        });
    }
  }, [selectedTaskId]);

  if (tasks.length === 0) {
    return <p className="text-gray-500 mt-4">No unassigned tasks. All tasks have been allocated.</p>;
  }

  return (
    <>
      <div className="flex gap-6 min-h-[400px]">
        {/* Left panel: task list */}
        <div className="w-1/3 border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b font-semibold text-sm">
            Unassigned Tasks ({tasks.length})
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            {tasks.map(task => (
              <button key={task.taskId}
                onClick={() => setSelectedTaskId(task.taskId === selectedTaskId ? null : task.taskId)}
                className={`w-full text-left px-3 py-3 border-b transition ${
                  task.taskId === selectedTaskId ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                }`}>
                <div className="font-medium text-sm">{task.taskTitle}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {task.taskSkills.map(s => (
                    <span key={s} className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {task.scores.filter(s => s.matchPercent === 100).length} eligible developers
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel: recommendations */}
        <div className="flex-1">
          {!selectedTask ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a task to see AI recommendations
            </div>
          ) : (
            <div>
              <h3 className="font-semibold mb-1">{selectedTask.taskTitle}</h3>
              <div className="flex gap-1 mb-4">
                {selectedTask.taskSkills.map(s => (
                  <span key={s} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>

              {eligible.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 font-medium text-sm">No developer has all required skills</p>
                  <div className="mt-2 text-xs text-amber-700">
                    {selectedTask.scores.slice(0, 3).map(s => (
                      <div key={s.developerId} className="py-1">
                        <span className="font-medium">{s.developerName}</span> ({s.matchPercent}%) — missing: {s.missingSkills.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {eligible.map((score, i) => {
                    const cacheKey = `${selectedTask.taskId}:${score.developerId}`;
                    const reason = reasons.get(cacheKey);
                    const isLoading = loadingReasons.has(cacheKey);

                    return (
                      <div key={score.developerId}
                        className={`border rounded-lg p-4 ${i === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-semibold">{score.developerName}</span>
                            <span className="text-xs text-gray-500 ml-2">{score.currentTaskCount} current tasks</span>
                          </div>
                          {score.isTopPick && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Best Match</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          {isLoading ? (
                            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                          ) : reason ? (
                            <p className="italic">{reason}</p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => setConfirm({
                            taskId: selectedTask.taskId,
                            taskTitle: selectedTask.taskTitle,
                            developerId: score.developerId,
                            developerName: score.developerName,
                            matchPercent: score.matchPercent,
                          })}
                          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700">
                          Assign {score.developerName}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <AssignConfirm
          taskId={confirm.taskId} taskTitle={confirm.taskTitle}
          developerId={confirm.developerId} developerName={confirm.developerName}
          matchPercent={confirm.matchPercent}
          onAssigned={() => { setConfirm(null); onAssigned(); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/allocation/FocusView.tsx
git commit -m "feat: add Focus view — split panel with lazy-loaded AI reasoning per developer

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: AllocationPage — Parent Component

**Files:**
- Create: `frontend/src/pages/AllocationPage.tsx`

- [ ] **Step 1: Create the AllocationPage**

```tsx
// frontend/src/pages/AllocationPage.tsx
import { useState, useEffect } from 'react';
import type { ScoredTask, Project } from '../lib/types';
import { fetchAllocationScores, fetchProjects } from '../lib/api';
import MatrixView from '../components/allocation/MatrixView';
import KanbanView from '../components/allocation/KanbanView';
import FocusView from '../components/allocation/FocusView';

type ViewMode = 'matrix' | 'kanban' | 'focus';

export default function AllocationPage() {
  const [view, setView] = useState<ViewMode>('matrix');
  const [scores, setScores] = useState<ScoredTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetchAllocationScores(projectId || undefined),
        fetchProjects(),
      ]);
      setScores(s);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleAssigned = () => { loadData(); };

  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'matrix', label: 'Matrix' },
    { key: 'kanban', label: 'Kanban' },
    { key: 'focus', label: 'Focus' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Allocate Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {scores.length} unassigned {scores.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {/* View switcher */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {viewTabs.map(tab => (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  view === tab.key ? 'bg-white shadow font-medium' : 'text-gray-600 hover:text-gray-900'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          {/* Project filter */}
          <select aria-label="Filter by project" value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading scores...</p>
      ) : (
        <>
          {view === 'matrix' && <MatrixView tasks={scores} onAssigned={handleAssigned} />}
          {view === 'kanban' && <KanbanView scoredTasks={scores} projectId={projectId || undefined} onAssigned={handleAssigned} />}
          {view === 'focus' && <FocusView tasks={scores} onAssigned={handleAssigned} />}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AllocationPage.tsx
git commit -m "feat: add AllocationPage with view switcher (Matrix, Kanban, Focus) and project filter

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire AllocationPage into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add the /allocate route**

In `frontend/src/App.tsx`:

Add import:
```tsx
import AllocationPage from './pages/AllocationPage';
```

Add route before the backward-compat redirects:
```tsx
<Route path="/allocate" element={<AllocationPage />} />
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire /allocate route to AllocationPage

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: AllocationPage Tests

**Files:**
- Create: `frontend/src/__tests__/AllocationPage.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
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
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npx vitest run src/__tests__/AllocationPage.test.tsx`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `cd frontend && npx vitest run && cd ../backend && npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__/AllocationPage.test.tsx
git commit -m "test: add AllocationPage tests for view switching, scores rendering, task count

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: All pass

- [ ] **Step 2: Run all frontend tests**

Run: `cd frontend && npx vitest run`
Expected: All pass

- [ ] **Step 3: TypeScript compile check**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Build check**

Run: `cd frontend && npm run build`
Expected: Clean build
