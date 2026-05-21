import { Link, useLocation } from 'react-router-dom';

export default function NavBar() {
  const { pathname } = useLocation();
  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded text-sm ${pathname.startsWith(path) ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <nav className="border-b px-6 py-3 flex gap-2 items-center bg-white">
      <span className="font-bold text-lg mr-4">Capacitor</span>
      <Link to="/projects" className={linkClass('/projects')}>Projects</Link>
      <Link to="/tasks" className={linkClass('/tasks')}>Tasks</Link>
    </nav>
  );
}
