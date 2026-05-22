// frontend/src/components/allocation/FocusView.tsx
import { useState, useEffect, useRef } from 'react';
import type { ScoredTask } from '../../lib/types';
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
        {/* Left panel: task list — fixed width, never collapses */}
        <div className="w-[320px] min-w-[320px] border rounded-lg overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-3 py-2 border-b font-semibold text-sm flex-shrink-0">
            Unassigned Tasks ({tasks.length})
          </div>
          <div className="overflow-y-auto flex-1">
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

        {/* Right panel: recommendations — takes remaining space, prevents overflow */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {!selectedTask ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a task to see AI recommendations
            </div>
          ) : (
            <div>
              <h3 className="font-semibold mb-1">{selectedTask.taskTitle}</h3>
              <div className="flex gap-1 mb-4 flex-wrap">
                {selectedTask.taskSkills.map(s => (
                  <span key={s} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>

              {eligible.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 overflow-hidden">
                  <p className="text-amber-800 font-medium text-sm">No developer has all required skills</p>
                  <div className="mt-2 text-xs text-amber-700 space-y-2">
                    {selectedTask.scores.slice(0, 3).map(s => (
                      <div key={s.developerId} className="py-1">
                        <span className="font-medium">{s.developerName}</span> ({s.matchPercent}%)
                        <div className="text-amber-600 mt-0.5 break-words">missing: {s.missingSkills.join(', ')}</div>
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
