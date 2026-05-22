import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { TaskTree, GeneratedTask, Skill } from '../lib/types';
import { fetchTask, updateTask, deleteTask, generateSubtasks, createTask, fetchSkills } from '../lib/api';
import SubtaskTree from '../components/SubtaskTree';

const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21] as const;
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

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<TaskTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Generate subtasks
  const [hint, setHint] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedGen, setSelectedGen] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [addingGen, setAddingGen] = useState(false);

  const loadTask = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setTask(await fetchTask(id));
    } catch {
      // task not found or network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTask(); }, [id]);

  useEffect(() => {
    fetchSkills().then(setSkills).catch(() => {});
  }, []);

  const handleStoryPointsChange = async (points: number) => {
    if (!id) return;
    await updateTask(id, { storyPoints: points });
    await loadTask();
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(`Delete "${task.title}" and all its subtasks?`)) return;
    try {
      await deleteTask(task.id);
      if (task.project) {
        navigate(`/projects/${task.project.id}`);
      } else {
        navigate('/tasks');
      }
    } catch {
      alert('Failed to delete task');
    }
  };

  const handleGenerateSubtasks = async () => {
    if (!id) return;
    setGenerating(true);
    setSelectedGen(new Set());
    try {
      const result = await generateSubtasks(id, hint);
      setGeneratedTasks(result.tasks);
    } catch {
      alert('AI subtask generation failed — try again later');
    } finally {
      setGenerating(false);
    }
  };

  const toggleGenSelect = (index: number) => {
    setSelectedGen(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const handleAddGenerated = async () => {
    if (!task) return;
    setAddingGen(true);
    const selected = generatedTasks.filter((_, i) => selectedGen.has(i));
    try {
      await Promise.all(selected.map(gen => {
        const skillIds = gen.skillNames
          .map(name => skills.find(s => s.name.toLowerCase() === name.toLowerCase())?.id)
          .filter((sid): sid is string => sid !== undefined);
        return createTask({
          title: gen.title,
          skillIds,
          parentId: task.id,
          ...(task.project ? { projectId: task.project.id } : {}),
          ...(gen.description ? { description: gen.description } : {}),
          ...(gen.acceptanceCriteria ? { acceptanceCriteria: gen.acceptanceCriteria } : {}),
          ...(gen.storyPoints ? { storyPoints: gen.storyPoints } : {}),
        });
      }));
      await loadTask();
      setGeneratedTasks([]);
      setSelectedGen(new Set());
      setHint('');
    } catch {
      alert('Failed to create some subtasks');
    } finally {
      setAddingGen(false);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!task) return <div className="max-w-4xl mx-auto p-6 text-red-600">Task not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          {task.project && (
            <Link to={`/projects/${task.project.id}`} className="text-blue-600 text-sm hover:underline">
              {task.project.name}
            </Link>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
            <span className="text-sm text-gray-600">
              {task.developer?.name ?? 'Unassigned'}
            </span>
            <select
              aria-label="Story points"
              value={task.storyPoints ?? ''}
              onChange={e => {
                const val = Number(e.target.value);
                if (val) handleStoryPointsChange(val);
              }}
              className="border rounded px-1.5 py-0.5 text-sm"
            >
              <option value="">SP —</option>
              {FIBONACCI_POINTS.map(p => (
                <option key={p} value={p}>{p} pts</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700"
        >
          Delete Task
        </button>
      </div>

      {/* Details Section */}
      <div className="mb-8 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-1">Description</h2>
          <p className="text-sm text-gray-600">{task.description ?? 'No description'}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-1">Acceptance Criteria</h2>
          {task.acceptanceCriteria ? (
            <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded border">{task.acceptanceCriteria}</pre>
          ) : (
            <p className="text-sm text-gray-400">No acceptance criteria</p>
          )}
        </div>
        {task.skills.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-sm font-medium text-gray-700 mr-1">Skills:</span>
            {task.skills.map(skill => (
              <span key={skill.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{skill.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Subtasks Section */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-bold mb-4">Subtasks ({task.subtasks.length})</h2>

        {task.subtasks.length > 0 ? (
          <SubtaskTree subtasks={task.subtasks} onDeleted={loadTask} />
        ) : (
          <p className="text-sm text-gray-400 mb-4">No subtasks yet. Generate some below.</p>
        )}

        {/* Generate Subtasks Panel */}
        <div className="border rounded-lg p-4 mt-4 bg-gray-50">
          <h3 className="text-sm font-bold mb-3">Generate Subtasks</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder="Describe what subtasks to generate..."
              className="flex-1 border rounded px-3 py-1.5 text-sm"
              aria-label="Subtask generation hint"
            />
            <button
              onClick={handleGenerateSubtasks}
              disabled={generating}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Subtasks'}
            </button>
          </div>

          {generatedTasks.length > 0 && (
            <>
              <div className="space-y-2 mb-3">
                {generatedTasks.map((gen, i) => (
                  <div key={i} className={`border rounded p-3 bg-white cursor-pointer transition ${selectedGen.has(i) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleGenSelect(i)}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedGen.has(i)}
                        onChange={() => toggleGenSelect(i)}
                        className="mt-1"
                        aria-label={`Select ${gen.title}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{gen.title}</p>
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">Details</summary>
                          <div className="mt-1 space-y-1">
                            {gen.description && (
                              <p className="text-xs text-gray-600">{gen.description}</p>
                            )}
                            {gen.acceptanceCriteria && (
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">{gen.acceptanceCriteria}</pre>
                            )}
                            <div className="flex gap-2 text-xs text-gray-500">
                              {gen.storyPoints > 0 && <span>SP: {gen.storyPoints}</span>}
                              {gen.skillNames.length > 0 && <span>Skills: {gen.skillNames.join(', ')}</span>}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddGenerated}
                disabled={selectedGen.size === 0 || addingGen}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {addingGen ? 'Adding...' : `Add ${selectedGen.size} Selected`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
