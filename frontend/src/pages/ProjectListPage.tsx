import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../lib/types';
import { fetchProjects } from '../lib/api';

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="max-w-6xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (error) return (
    <div className="max-w-6xl mx-auto p-6">
      <p className="text-red-600">{error}</p>
      <button onClick={loadData} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">Retry</button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link to="/projects/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4">
          {projects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}
              className="block border rounded-lg p-4 hover:bg-gray-50 transition">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold">{project.name}</h2>
                  {project.description && (
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{project.description}</p>
                  )}
                </div>
                <span className="text-sm text-gray-500">{project.tasks.length} tasks</span>
              </div>
              {project.techStack.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {project.techStack.map((tech, i) => (
                    <span key={i} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
