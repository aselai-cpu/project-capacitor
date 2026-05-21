import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProjectApi, enrichProjectApi } from '../lib/api';

export default function ProjectCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const handleSave = async (withAI: boolean) => {
    if (withAI) setEnriching(true); else setSaving(true);
    try {
      const project = await createProjectApi({ name, description: description || undefined });
      if (withAI) {
        await enrichProjectApi(project.id);
      }
      navigate(`/projects/${project.id}`);
    } catch {
      alert('Failed to create project');
    } finally {
      setSaving(false);
      setEnriching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Project</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., E-Commerce Platform"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description — the AI will expand this into a full spec..."
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            onClick={() => handleSave(false)}
            disabled={!name || saving || enriching}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={!name || saving || enriching}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {enriching ? '🤖 Refining with AI...' : '🤖 Save & Refine with AI'}
          </button>
        </div>
      </div>
    </div>
  );
}
