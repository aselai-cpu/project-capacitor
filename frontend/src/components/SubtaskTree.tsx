// frontend/src/components/SubtaskTree.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TaskTree } from '../lib/types';
import { deleteTask } from '../lib/api';

interface Props {
  subtasks: TaskTree[];
  depth?: number;
  onDeleted: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To-do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export default function SubtaskTree({ subtasks, depth = 0, onDeleted }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and all its subtasks?`)) return;
    try {
      await deleteTask(id);
      onDeleted();
    } catch {
      alert('Failed to delete subtask');
    }
  };

  if (subtasks.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-3' : ''}>
      {subtasks.map(task => {
        const isCollapsed = collapsed.has(task.id);
        const hasChildren = task.subtasks.length > 0;

        return (
          <div key={task.id} className="py-1.5">
            <div className="flex items-center gap-2 group">
              {/* Expand/collapse */}
              <button onClick={() => toggleCollapse(task.id)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs flex-shrink-0">
                {hasChildren ? (isCollapsed ? '►' : '▼') : '·'}
              </button>

              {/* Title link */}
              <Link to={`/tasks/${task.id}`}
                className="flex-1 text-sm hover:text-blue-600 hover:underline truncate">
                {task.title}
              </Link>

              {/* Status badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[task.status] || ''}`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>

              {/* Story points */}
              {task.storyPoints && (
                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded flex-shrink-0">
                  {task.storyPoints} pts
                </span>
              )}

              {/* Delete button */}
              <button onClick={() => handleDelete(task.id, task.title)}
                className="text-gray-300 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Delete subtask">
                🗑
              </button>
            </div>

            {/* Recursive children */}
            {hasChildren && !isCollapsed && (
              <SubtaskTree subtasks={task.subtasks} depth={depth + 1} onDeleted={onDeleted} />
            )}
          </div>
        );
      })}
    </div>
  );
}
