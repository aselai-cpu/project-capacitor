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
