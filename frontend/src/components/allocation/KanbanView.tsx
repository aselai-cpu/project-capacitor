// frontend/src/components/allocation/KanbanView.tsx
import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { ScoredTask, Task, Developer } from '../../lib/types';
import { fetchTasks, fetchDevelopers } from '../../lib/api';
import AssignConfirm from './AssignConfirm';

interface Props {
  scoredTasks: ScoredTask[];
  projectId?: string;
  onAssigned: () => void;
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

// --- Draggable task card (unassigned) ---
function DraggableCard({ task }: { task: ScoredTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.taskId,
    data: { task },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing transition ${isDragging ? 'opacity-30' : ''}`}>
      <div className="font-medium text-sm">{task.taskTitle}</div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {task.taskSkills.map(s => (
          <span key={s} className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">{s}</span>
        ))}
      </div>
      {task.scores.filter(s => s.matchPercent === 100).length > 0 ? (
        <div className="mt-2 flex gap-1 flex-wrap">
          {task.scores.filter(s => s.matchPercent === 100).slice(0, 2).map(s => (
            <span key={s.developerId} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              {s.developerName} {s.matchPercent}%
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-400">No eligible developer</div>
      )}
    </div>
  );
}

// --- Drag overlay (follows cursor) ---
function CardOverlay({ task }: { task: ScoredTask }) {
  return (
    <div className="bg-white rounded-lg border-2 border-blue-400 p-3 shadow-lg w-[250px] rotate-2">
      <div className="font-medium text-sm">{task.taskTitle}</div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {task.taskSkills.map(s => (
          <span key={s} className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">{s}</span>
        ))}
      </div>
    </div>
  );
}

// --- Droppable developer lane ---
function DevLane({ dev, tasks, isOver }: { dev: Developer; tasks: Task[]; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: dev.id });

  return (
    <div className="min-w-[250px] w-[250px] flex-shrink-0 flex flex-col">
      <div className="bg-blue-50 rounded-t-lg px-3 py-2 border border-blue-200">
        <span className="font-semibold text-blue-800 text-sm">{dev.name}</span>
        <span className="ml-2 text-xs text-blue-600">{tasks.length} tasks</span>
      </div>
      <div ref={setNodeRef}
        className={`border border-t-0 border-blue-200 rounded-b-lg p-2 space-y-2 flex-1 transition-colors ${
          isOver ? 'bg-blue-100/60 border-blue-400' : 'bg-blue-50/30'
        }`}>
        {tasks.map(task => (
          <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-sm">{task.title}</div>
            <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${STATUS_COLORS[task.status] || ''}`}>
              {STATUS_LABELS[task.status] || task.status}
            </span>
          </div>
        ))}
        {tasks.length === 0 && !isOver && (
          <p className="text-gray-400 text-sm text-center py-8">No tasks</p>
        )}
        {isOver && (
          <div className="border-2 border-dashed border-blue-400 rounded-lg p-4 text-center text-xs text-blue-600">
            Drop to assign
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanView({ scoredTasks, projectId, onAssigned }: Props) {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<ScoredTask | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    taskId: string; taskTitle: string; developerId: string; developerName: string; matchPercent: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  const handleDragStart = (event: DragStartEvent) => {
    const task = scoredTasks.find(t => t.taskId === event.active.id);
    setActiveTask(task || null);
    setError(null);
  };

  const handleDragOver = (event: DragEndEvent) => {
    setOverLaneId(event.over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setOverLaneId(null);

    const taskId = event.active.id as string;
    const developerId = event.over?.id as string;
    if (!taskId || !developerId) return;

    const task = scoredTasks.find(t => t.taskId === taskId);
    const dev = developers.find(d => d.id === developerId);
    if (!task || !dev) return;

    // Check skill eligibility
    const score = task.scores.find(s => s.developerId === developerId);
    if (!score || score.matchPercent < 100) {
      const missing = score?.missingSkills.join(', ') || 'unknown skills';
      setError(`Cannot assign ${dev.name} to "${task.taskTitle}" — missing: ${missing}`);
      return;
    }

    setConfirm({
      taskId, taskTitle: task.taskTitle,
      developerId, developerName: dev.name,
      matchPercent: score.matchPercent,
    });
  };

  return (
    <>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg ml-4">&times;</button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex min-h-[500px]">
          {/* Frozen unassigned column */}
          <div className="min-w-[270px] w-[270px] flex-shrink-0 flex flex-col sticky left-0 z-10 bg-white pr-3">
            <div className="bg-red-50 rounded-t-lg px-3 py-2 border border-red-200">
              <span className="font-semibold text-red-800 text-sm">Unassigned</span>
              <span className="ml-2 text-xs text-red-600">{scoredTasks.length}</span>
            </div>
            <div className="border border-t-0 border-red-200 rounded-b-lg p-2 space-y-2 flex-1 overflow-y-auto bg-red-50/30">
              {scoredTasks.map(st => (
                <DraggableCard key={st.taskId} task={st} />
              ))}
              {scoredTasks.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">All allocated</p>
              )}
            </div>
          </div>

          {/* Scrollable developer lanes */}
          <div className="flex gap-3 overflow-x-auto flex-1 pl-1 pb-2">
            {developers.map(dev => (
              <DevLane
                key={dev.id}
                dev={dev}
                tasks={assignedByDev.get(dev.id) || []}
                isOver={overLaneId === dev.id}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? <CardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

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
