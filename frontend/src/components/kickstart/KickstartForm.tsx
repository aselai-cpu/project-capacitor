import { useState, useEffect } from 'react';
import { fetchDevelopers } from '../../lib/api';
import type { Developer } from '../../lib/types';
import type { KickstartPayload } from '../../lib/api';

interface Props {
  onSubmit: (payload: KickstartPayload) => void;
}

interface NewMember {
  name: string;
  cvText: string;
  cvFile: File | null;
}

export default function KickstartForm({ onSubmit }: Props) {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDevIds, setSelectedDevIds] = useState<Set<string>>(new Set());
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);

  useEffect(() => {
    fetchDevelopers().then(setDevelopers).catch(() => {});
  }, []);

  const toggleDev = (id: string) => {
    setSelectedDevIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addNewMember = () => {
    setNewMembers(prev => [...prev, { name: '', cvText: '', cvFile: null }]);
  };

  const updateNewMember = (index: number, field: keyof NewMember, value: string | File | null) => {
    setNewMembers(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const removeNewMember = (index: number) => {
    setNewMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      existingDeveloperIds: Array.from(selectedDevIds),
      newMembers: newMembers.map(m => ({ name: m.name, ...(m.cvText ? { cvText: m.cvText } : {}) })),
      cvFiles: newMembers.map(m => m.cvFile).filter((f): f is File => f !== null),
    });
  };

  const canSubmit = name.trim() && description.trim() && (selectedDevIds.size > 0 || newMembers.some(m => m.name.trim()));

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Kickstart a Project</h1>
      <p className="text-gray-500 text-sm mb-6">Describe your project and add your team. The AI agent handles the rest.</p>

      <div className="mb-5">
        <label htmlFor="project-name" className="block text-sm font-semibold text-gray-700 mb-1">Project Name</label>
        <input id="project-name" type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Healthcare Data Platform" />
      </div>

      <div className="mb-5">
        <label htmlFor="project-desc" className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
        <textarea id="project-desc" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
          placeholder="Describe what this project is about in 1-3 sentences..." />
      </div>

      <div className="mb-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Team Members</div>

        {developers.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-3 mb-3">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Existing Team</div>
            <div className="flex flex-wrap gap-2">
              {developers.map(d => (
                <button key={d.id} type="button" onClick={() => toggleDev(d.id)}
                  className={`text-xs px-3 py-1 rounded-full transition ${
                    selectedDevIds.has(d.id)
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-500 border border-dashed border-gray-300'
                  }`}>
                  {selectedDevIds.has(d.id) && '✓ '}{d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-50 border rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Add New Members</div>
          {newMembers.map((m, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input type="text" value={m.name} onChange={e => updateNewMember(i, 'name', e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Name" />
              <input type="file" accept=".pdf" onChange={e => updateNewMember(i, 'cvFile', e.target.files?.[0] ?? null)}
                className="text-xs" />
              <button type="button" onClick={() => removeNewMember(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
          ))}
          <button type="button" onClick={addNewMember}
            className="text-sm text-purple-600 border border-dashed border-purple-300 px-3 py-1 rounded">
            + Add another
          </button>
        </div>
      </div>

      <button type="submit" disabled={!canSubmit}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-purple-700">
        Kickstart Project
      </button>
    </form>
  );
}
