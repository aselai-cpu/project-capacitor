import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Task, Developer } from '../lib/types';
import { fetchTasks, fetchDevelopers } from '../lib/api';
import TaskRow from '../components/TaskRow';

export default function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, devsData] = await Promise.all([fetchTasks(), fetchDevelopers()]);
      setTasks(tasksData);
      setDevelopers(devsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <Link to="/tasks/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create Task
        </Link>
      </div>
      {loading && <p className="text-gray-500 mt-4">Loading...</p>}
      {error && (
        <div className="mt-4">
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => { void loadData(); }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
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
          {tasks.length === 0 && <p className="text-gray-500 mt-4">No tasks yet. Create one to get started.</p>}
        </>
      )}
    </div>
  );
}
