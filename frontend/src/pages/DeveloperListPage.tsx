import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Developer } from '../lib/types';
import { fetchDevelopers } from '../lib/api';

export default function DeveloperListPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevelopers().then(setDevelopers).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Developers</h1>
      <div className="grid gap-3">
        {developers.map(dev => (
          <Link key={dev.id} to={`/developers/${dev.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50 transition">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">{dev.name}</h2>
                {dev.bio && <p className="text-gray-500 text-sm mt-0.5">{dev.bio}</p>}
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {dev.skills.map(s => (
                  <span key={s.id} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
