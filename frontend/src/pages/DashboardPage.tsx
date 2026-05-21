import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardData } from '../lib/types';
import { fetchDashboard } from '../lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!data) return <div className="max-w-6xl mx-auto p-6 text-red-600">Failed to load dashboard</div>;

  const maxTasks = Math.max(...data.workload.map(w => w.taskCount), 1);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Projects', value: data.activeProjects, color: 'text-blue-600' },
          { label: 'Unassigned Tasks', value: data.unassignedTasks, color: 'text-red-600' },
          { label: 'Team Members', value: data.teamMembers, color: 'text-green-600' },
          { label: 'In Progress', value: data.inProgressTasks, color: 'text-amber-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border rounded-xl p-5 text-center">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Allocation CTA */}
      {data.unassignedTasks > 0 && (
        <Link to="/allocate"
          className="block bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl px-6 py-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-white font-semibold">{data.unassignedTasks} tasks need developers</div>
              <div className="text-purple-200 text-sm">AI has pre-scored matches for your team</div>
            </div>
            <span className="bg-white text-purple-700 px-5 py-2 rounded-lg font-semibold text-sm">
              Start Allocating →
            </span>
          </div>
        </Link>
      )}

      {/* Two-column: projects + workload */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Projects</h2>
          {data.projects.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded">
              <span className="text-sm">{p.name}</span>
              {p.unassignedCount > 0 && (
                <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {p.unassignedCount} unassigned
                </span>
              )}
            </Link>
          ))}
          {data.projects.length === 0 && <p className="text-gray-400 text-sm">No projects yet</p>}
        </div>

        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Team Workload</h2>
          {data.workload.map(w => (
            <div key={w.developerId} className="flex items-center gap-3 py-1.5">
              <span className="text-sm w-16 truncate">{w.developerName}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 rounded-full h-2 transition-all"
                  style={{ width: `${(w.taskCount / maxTasks) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-12 text-right">{w.taskCount} tasks</span>
            </div>
          ))}
          {data.workload.length === 0 && <p className="text-gray-400 text-sm">No team members yet</p>}
        </div>
      </div>
    </div>
  );
}
