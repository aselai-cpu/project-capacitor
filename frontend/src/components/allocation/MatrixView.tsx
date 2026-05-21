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
