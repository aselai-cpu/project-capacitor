import type { Task, Developer } from '../lib/types';
import { updateTask } from '../lib/api';
import type { UpdateTaskPayload } from '../lib/api';

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
    onUpdate();
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td style={{ paddingLeft: `${task.depth * 24 + 8}px` }} className="py-3 pr-4">
        {task.depth > 0 && <span className="text-gray-400 mr-1">↳</span>}
        {task.title}
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
        <select aria-label={`Assignee for ${task.title}`} value={task.developer?.id ?? ''} onChange={e => handleAssigneeChange(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          <option value="">Unassigned</option>
          {eligibleDevs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </td>
      <td className="py-3">
        <a href={`/tasks/new?parentId=${task.id}`} aria-label={`Add subtask to ${task.title}`} className="text-blue-600 text-sm hover:underline">
          + Subtask
        </a>
      </td>
    </tr>
  );
}
