import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Developer, Skill } from '../lib/types';
import { fetchDevelopers, fetchSkills, createDeveloper } from '../lib/api';

export default function DeveloperListPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devs, sk] = await Promise.all([fetchDevelopers(), fetchSkills()]);
      setDevelopers(devs);
      setSkills(sk);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createDeveloper({ name: name.trim(), skillIds: selectedSkillIds });
      setName('');
      setSelectedSkillIds([]);
      setShowForm(false);
      await loadData();
    } catch {
      alert('Failed to create developer');
    } finally {
      setCreating(false);
    }
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Developers</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          {showForm ? 'Cancel' : 'Create Developer'}
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Developer name" className="w-full border rounded px-3 py-2 mb-3" />
          {skills.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Skills (optional):</p>
              <div className="flex gap-2 flex-wrap">
                {skills.map(s => (
                  <button key={s.id} type="button" onClick={() => toggleSkill(s.id)}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      selectedSkillIds.includes(s.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleCreate} disabled={!name.trim() || creating}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
            Save
          </button>
        </div>
      )}

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
