import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Task, Developer, Project } from '../lib/types';
import { fetchTasks, fetchDevelopers, fetchProjects } from '../lib/api';
import TaskRow from '../components/TaskRow';

export default function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = searchParams.get('projectId') || '';
  const status = searchParams.get('status') || '';
  const developerId = searchParams.get('developerId') || '';

  const activeProject = projects.find(p => p.id === projectId);

  const setFilter = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        ...(projectId && { projectId }),
        ...(status && { status }),
        ...(developerId && { developerId }),
      };
      const [tasksData, devsData, projsData] = await Promise.all([
        fetchTasks(Object.keys(filters).length > 0 ? filters : undefined),
        fetchDevelopers(),
        fetchProjects(),
      ]);
      setTasks(tasksData);
      setDevelopers(devsData);
      setProjects(projsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId, status, developerId]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Project banner when filtered */}
      {activeProject && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 flex justify-between items-center">
          <span className="text-sm text-blue-800">
            Showing tasks for <strong>{activeProject.name}</strong>
          </span>
          <button onClick={() => setFilter('projectId', '')}
            className="text-blue-600 text-sm hover:underline">Clear filter</button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link to="/tasks/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create Task
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select aria-label="Filter by project" value={projectId} onChange={e => setFilter('projectId', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={e => setFilter('status', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="TODO">To-do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
        <select aria-label="Filter by assignee" value={developerId} onChange={e => setFilter('developerId', e.target.value)}
          className="border rounded px-3 py-1.5 text-sm">
          <option value="">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {(projectId || status || developerId) && (
          <button onClick={() => setSearchParams({})}
            className="text-gray-500 text-sm hover:text-gray-700">
            Clear all
          </button>
        )}
      </div>

      {loading && <p className="text-gray-500 mt-4">Loading...</p>}
      {error && (
        <div className="mt-4">
          <p className="text-red-600">{error}</p>
          <button type="button" onClick={() => { void loadData(); }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b font-semibold text-sm text-gray-600">
                <th className="py-2 pr-4">Task Title</th>
                <th className="py-2 pr-4">Skills</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Assignee</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} developers={developers} onUpdate={loadData} />
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && <p className="text-gray-500 mt-4">No tasks match the current filters.</p>}
        </>
      )}
    </div>
  );
}
