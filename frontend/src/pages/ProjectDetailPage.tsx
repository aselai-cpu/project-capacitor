import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Project, Developer, Skill, GeneratedTask, ProjectTasksPage } from '../lib/types';
import { fetchProject, enrichProjectApi, fetchProjectTasks, generateTasksFromHint, createTask, updateTask, fetchDevelopers, fetchSkills } from '../lib/api';

const SPEC_TABS = ['Architecture', 'Domain', 'Requirements', 'Constraints', 'Stakeholders'] as const;
type SpecTab = typeof SPEC_TABS[number];

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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<SpecTab>('Architecture');

  // Task list state
  const [taskData, setTaskData] = useState<ProjectTasksPage | null>(null);
  const [taskPage, setTaskPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDev, setFilterDev] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [taskLoading, setTaskLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Generate tasks state
  const [hint, setHint] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [selectedGen, setSelectedGen] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [addingGen, setAddingGen] = useState(false);

  // Inline task creation state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  // Reference data
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setProject(await fetchProject(id));
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [id]);

  const loadTasks = async () => {
    if (!id) return;
    setTaskLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterDev) filters.developerId = filterDev;
      const data = await fetchProjectTasks(id, { page: taskPage, limit: 10, sortBy, ...filters });
      setTaskData(data);
    } finally {
      setTaskLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, [id, taskPage, filterStatus, filterDev, sortBy]);

  // Load developers and skills once
  useEffect(() => {
    fetchDevelopers().then(setDevelopers).catch(() => {});
    fetchSkills().then(setSkills).catch(() => {});
  }, []);

  const handleEnrich = async () => {
    if (!id) return;
    setEnriching(true);
    try {
      const updated = await enrichProjectApi(id);
      setProject(updated);
    } catch {
      alert('AI enrichment failed — try again');
    } finally {
      setEnriching(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!id) return;
    setGenerating(true);
    setSelectedGen(new Set());
    try {
      const result = await generateTasksFromHint(id, hint);
      setGeneratedTasks(result.tasks);
    } catch {
      alert('Task generation failed — try again');
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
    if (!project) return;
    setAddingGen(true);
    const selected = generatedTasks.filter((_, i) => selectedGen.has(i));
    try {
      await Promise.all(selected.map(task => {
        const skillIds = task.skillNames
          .map(name => skills.find(s => s.name.toLowerCase() === name.toLowerCase())?.id)
          .filter((sid): sid is string => sid !== undefined);
        return createTask({
          title: task.title,
          skillIds,
          projectId: project.id,
          ...(task.description ? { description: task.description } : {}),
          ...(task.acceptanceCriteria ? { acceptanceCriteria: task.acceptanceCriteria } : {}),
          ...(task.storyPoints ? { storyPoints: task.storyPoints } : {}),
        });
      }));
      await loadTasks();
      setGeneratedTasks([]);
      setSelectedGen(new Set());
      setHint('');
    } catch {
      alert('Failed to create some tasks');
    } finally {
      setAddingGen(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !id) return;
    setCreatingTask(true);
    try {
      await createTask({
        title: newTaskTitle.trim(),
        skillIds: [],
        projectId: id,
        ...(newTaskDesc.trim() ? { description: newTaskDesc.trim() } : {}),
      });
      setNewTaskTitle('');
      setNewTaskDesc('');
      loadTasks();
    } catch {
      alert('Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleStoryPointsChange = async (taskId: string, points: number) => {
    await updateTask(taskId, { storyPoints: points });
    await loadTasks();
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!project) return <div className="max-w-4xl mx-auto p-6 text-red-600">Project not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-gray-600 mt-1">{project.description}</p>}
        </div>
        <button onClick={handleEnrich} disabled={enriching}
          className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
          {enriching ? '🤖 Refining...' : '🤖 Refine with AI'}
        </button>
      </div>

      {/* Tech Stack */}
      {project.techStack.length > 0 && (
        <div className="mb-4 flex gap-1 flex-wrap">
          {project.techStack.map((tech, i) => (
            <span key={i} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">{tech}</span>
          ))}
        </div>
      )}

      {/* Project Spec Tabs */}
      {(() => {
        const specFields: Record<SpecTab, string | null> = {
          Architecture: project.architecture,
          Domain: project.domain,
          Requirements: project.requirements,
          Constraints: project.constraints,
          Stakeholders: project.stakeholders,
        };
        const availableTabs = SPEC_TABS.filter(t => specFields[t]);
        if (availableTabs.length === 0) return null;
        const currentTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];
        return (
          <div className="mb-8">
            <div className="flex border-b">
              {availableTabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    currentTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="border border-t-0 rounded-b-lg p-4">
              <p className="text-sm whitespace-pre-line">{specFields[currentTab]}</p>
            </div>
          </div>
        );
      })()}

      {/* Task Management Section */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-bold mb-4">Task Management</h2>

        {/* Filter Bar */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            aria-label="Filter by status"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setTaskPage(1); }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To-do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          <select
            aria-label="Filter by assignee"
            value={filterDev}
            onChange={e => { setFilterDev(e.target.value); setTaskPage(1); }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {developers.map(dev => (
              <option key={dev.id} value={dev.id}>{dev.name}</option>
            ))}
          </select>

          <select
            aria-label="Sort tasks"
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setTaskPage(1); }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Task Rows */}
        {taskLoading ? (
          <p className="text-gray-500 text-sm py-4">Loading tasks...</p>
        ) : !taskData || taskData.tasks.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">No tasks found.</p>
        ) : (
          <div className="space-y-1 mb-4">
            {taskData.tasks.map(task => (
              <div key={task.id} className="border rounded">
                <button
                  type="button"
                  onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  className="w-full flex justify-between items-center text-sm px-3 py-2 hover:bg-gray-50 text-left"
                  aria-label={`Toggle details for ${task.title}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400">{expandedTaskId === task.id ? '▼' : '►'}</span>
                    <Link to={`/tasks/${task.id}`} className="hover:text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                      {task.title}
                    </Link>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                    <span className="text-xs text-gray-500">{task.developer?.name ?? '—'}</span>
                    {task.storyPoints != null && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{task.storyPoints}</span>
                    )}
                  </span>
                </button>

                {expandedTaskId === task.id && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-2 text-sm">
                    {task.description && (
                      <div>
                        <span className="font-medium text-gray-700">Description:</span>
                        <p className="text-gray-600 mt-0.5">{task.description}</p>
                      </div>
                    )}
                    {task.acceptanceCriteria && (
                      <div>
                        <span className="font-medium text-gray-700">Acceptance Criteria:</span>
                        <pre className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap bg-white p-2 rounded border">{task.acceptanceCriteria}</pre>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Story Points:</span>
                      <select
                        aria-label="Story points"
                        value={task.storyPoints ?? ''}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (val) handleStoryPointsChange(task.id, val);
                        }}
                        className="border rounded px-1.5 py-0.5 text-sm"
                      >
                        <option value="">—</option>
                        {FIBONACCI_POINTS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    {task.skills.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-gray-700">Skills:</span>
                        {task.skills.map(skill => (
                          <span key={skill.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{skill.name}</span>
                        ))}
                      </div>
                    )}
                    {task.developer && (
                      <div>
                        <span className="font-medium text-gray-700">Assignee:</span>{' '}
                        <span className="text-gray-600">{task.developer.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {taskData && taskData.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setTaskPage(p => Math.max(1, p - 1))}
              disabled={taskPage <= 1}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600">Page {taskData.page} of {taskData.totalPages}</span>
            <button
              onClick={() => setTaskPage(p => Math.min(taskData.totalPages, p + 1))}
              disabled={taskPage >= taskData.totalPages}
              className="text-sm px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {/* Generate Tasks */}
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h3 className="text-sm font-bold mb-3">Generate Tasks</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder="Describe what tasks to generate..."
              className="flex-1 border rounded px-3 py-1.5 text-sm"
              aria-label="Task generation hint"
            />
            <button
              onClick={handleGenerateTasks}
              disabled={generating}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Tasks'}
            </button>
          </div>

          {generatedTasks.length > 0 && (
            <>
              <div className="space-y-2 mb-3">
                {generatedTasks.map((task, i) => (
                  <div key={i} className={`border rounded p-3 bg-white cursor-pointer transition ${selectedGen.has(i) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleGenSelect(i)}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedGen.has(i)}
                        onChange={() => toggleGenSelect(i)}
                        className="mt-1"
                        aria-label={`Select ${task.title}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">Details</summary>
                          <div className="mt-1 space-y-1">
                            {task.description && (
                              <p className="text-xs text-gray-600">{task.description}</p>
                            )}
                            {task.acceptanceCriteria && (
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">{task.acceptanceCriteria}</pre>
                            )}
                            <div className="flex gap-2 text-xs text-gray-500">
                              {task.storyPoints > 0 && <span>SP: {task.storyPoints}</span>}
                              {task.skillNames.length > 0 && <span>Skills: {task.skillNames.join(', ')}</span>}
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
                {addingGen ? 'Adding...' : `Add ${selectedGen.size} Selected as Tasks`}
              </button>
            </>
          )}
        </div>

        {/* Inline Create Task Form */}
        <div className="border rounded-lg p-4 mt-4">
          <h3 className="text-sm font-semibold mb-2">Create Task</h3>
          <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
            placeholder="Task title..." className="w-full border rounded px-3 py-1.5 text-sm mb-2" />
          <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)}
            placeholder="Description (optional)..." rows={2}
            className="w-full border rounded px-3 py-1.5 text-sm mb-2" />
          <button onClick={handleCreateTask} disabled={!newTaskTitle.trim() || creatingTask}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {creatingTask ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
