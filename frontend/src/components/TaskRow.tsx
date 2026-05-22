import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task, Developer } from '../lib/types';
import { updateTask, recommendAssignee, deleteTask } from '../lib/api';
import type { UpdateTaskPayload, Recommendation } from '../lib/api';

interface Props {
  task: Task;
  developers: Developer[];
  onUpdate: () => void;
}

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
const STATUS_LABELS: Record<string, string> = {
  TODO: 'To-do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export default function TaskRow({ task, developers, onUpdate }: Props) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  const eligibleDevs = developers.filter(dev => {
    const devSkillIds = new Set(dev.skills.map(s => s.id));
    return task.skills.every(s => devSkillIds.has(s.id));
  });

  const handleStatusChange = async (status: string) => {
    try {
      await updateTask(task.id, { status: status as UpdateTaskPayload['status'] });
    } catch {
      // API rejected (e.g., cascade guard) — re-fetch to revert
    }
    onUpdate();
  };

  const handleAssigneeChange = async (developerId: string) => {
    try {
      await updateTask(task.id, { developerId: developerId || null });
    } catch {
      // API rejected (e.g., skill guard) — re-fetch to revert
    }
    setRecommendation(null);
    onUpdate();
  };

  const handleRecommend = async () => {
    setLoadingRec(true);
    const rec = await recommendAssignee(task.id);
    setRecommendation(rec);
    setLoadingRec(false);
  };

  const handleDeleteTask = async () => {
    if (!confirm(`Delete "${task.title}" and all its subtasks?`)) return;
    try {
      await deleteTask(task.id);
    } catch {
      // ignore — refresh will show current state
    }
    onUpdate();
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td style={{ paddingLeft: `${task.depth * 24 + 8}px` }} className="py-3 pr-4">
        {task.depth > 0 && <span className="text-gray-400 mr-1">↳</span>}
        <Link to={`/tasks/${task.id}`} className="hover:text-blue-600 hover:underline">
          {task.title}
        </Link>
      </td>
      <td className="py-3 pr-4">
        {task.skills.map(s => (
          <span key={s.id} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">
            {s.name}
          </span>
        ))}
        {task.skills.length === 0 && <span className="text-gray-400 text-xs">—</span>}
      </td>
      <td className="py-3 pr-4">
        <select aria-label={`Status for ${task.title}`} value={task.status} onChange={e => handleStatusChange(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-1">
          <select aria-label={`Assignee for ${task.title}`} value={task.developer?.id ?? ''} onChange={e => handleAssigneeChange(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="">Unassigned</option>
            {eligibleDevs.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}{recommendation?.developerId === d.id ? ' ★' : ''}
              </option>
            ))}
          </select>
          {!task.developer && task.skills.length > 0 && !recommendation && (
            <button
              onClick={handleRecommend}
              disabled={loadingRec}
              className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded hover:bg-purple-200 whitespace-nowrap"
              title="Ask AI to recommend a developer"
            >
              {loadingRec ? '...' : '🤖'}
            </button>
          )}
        </div>
        {recommendation && (
          <div className="mt-1 text-xs text-purple-600 max-w-48">
            <span className="font-medium">AI: </span>
            {recommendation.reason}
          </div>
        )}
      </td>
      <td className="py-3">
        <Link to={`/tasks/${task.id}`} aria-label={`View details for ${task.title}`} className="text-blue-600 text-sm hover:underline">
          Details
        </Link>
        <button onClick={handleDeleteTask} className="text-red-400 hover:text-red-600 text-sm ml-2" title="Delete task">
          🗑
        </button>
      </td>
    </tr>
  );
}
