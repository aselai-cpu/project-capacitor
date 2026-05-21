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
