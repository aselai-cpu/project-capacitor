import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchDashboard } from '../lib/api';

export default function NavBar() {
  const { pathname } = useLocation();
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    fetchDashboard()
      .then(data => setUnassignedCount(data.unassignedTasks))
      .catch(() => {});
  }, [pathname]);

  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded text-sm ${pathname.startsWith(path) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <nav className="border-b px-6 py-3 flex gap-2 items-center bg-white">
      <Link to="/dashboard" className="font-bold text-lg mr-4">Capacitor</Link>
      <Link to="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
      <Link to="/team" className={linkClass('/team')}>Team</Link>
      <Link to="/projects" className={linkClass('/projects')}>Projects</Link>
      <Link to="/tasks" className={linkClass('/tasks')}>
        Tasks
        {unassignedCount > 0 && (
          <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
        )}
      </Link>
      <Link to="/allocate"
        className={`px-3 py-1.5 rounded text-sm font-semibold ${pathname.startsWith('/allocate') ? 'bg-purple-700 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
        Allocate
        {unassignedCount > 0 && (
          <span className="ml-1.5 bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
        )}
      </Link>
      <Link to="/kickstart"
        className={`px-3 py-1.5 rounded text-sm font-semibold ${pathname.startsWith('/kickstart') ? 'bg-purple-700 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
        Kickstart
      </Link>
    </nav>
  );
}
