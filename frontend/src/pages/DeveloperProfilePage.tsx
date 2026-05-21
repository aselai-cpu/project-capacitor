import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Developer, ExtractedSkill } from '../lib/types';
import { fetchDeveloper, uploadCV, extractSkillsFromText, updateDeveloper, deleteDeveloper } from '../lib/api';

export default function DeveloperProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<ExtractedSkill[]>([]);
  const [cvText, setCvText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDeveloper(id).then(dev => {
      setDeveloper(dev);
      setEditName(dev.name);
      setEditBio(dev.bio || '');
    }).finally(() => setLoading(false));
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setExtracting(true);
    try {
      const result = await uploadCV(id, file);
      setDeveloper(result);
      setExtractedSkills(result.extractedSkills);
    } catch {
      alert('CV upload failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleTextExtract = async () => {
    if (!id || !cvText.trim()) return;
    setExtracting(true);
    try {
      const result = await extractSkillsFromText(id, cvText);
      setDeveloper(result);
      setExtractedSkills(result.extractedSkills);
    } catch {
      alert('Skill extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateDeveloper(id, { name: editName.trim(), bio: editBio.trim() || undefined });
      setDeveloper(updated);
      setEditing(false);
    } catch {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this developer?')) return;
    try {
      await deleteDeveloper(id);
      navigate('/team');
    } catch {
      alert('Delete failed');
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!developer) return <div className="max-w-4xl mx-auto p-6 text-red-600">Developer not found</div>;

  const levelColors: Record<string, string> = {
    expert: 'bg-purple-100 text-purple-800',
    advanced: 'bg-blue-100 text-blue-800',
    intermediate: 'bg-green-100 text-green-800',
    beginner: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/team" className="text-blue-600 text-sm hover:underline">← Back to Team</Link>

      {/* Header with edit/delete */}
      <div className="flex justify-between items-start mt-2">
        {editing ? (
          <div className="flex-1 mr-4">
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className="text-2xl font-bold border rounded px-2 py-1 w-full mb-2" />
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
              placeholder="Bio (optional)" rows={2}
              className="w-full border rounded px-2 py-1 text-sm" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSaveEdit} disabled={saving || !editName.trim()}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                Save
              </button>
              <button onClick={() => { setEditing(false); setEditName(developer.name); setEditBio(developer.bio || ''); }}
                className="border px-3 py-1 rounded text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold">{developer.name}</h1>
            {developer.bio && <p className="text-gray-600 mt-1">{developer.bio}</p>}
            {developer.cvFileName && <p className="text-xs text-gray-400 mt-1">CV: {developer.cvFileName}</p>}
          </div>
        )}
        {!editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)}
              className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
              Edit
            </button>
            <button onClick={handleDelete}
              className="border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Current Skills */}
      <div className="my-6">
        <h2 className="text-lg font-semibold mb-2">Skills</h2>
        {developer.skills.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {developer.skills.map(s => (
              <span key={s.id} className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">{s.name}</span>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No skills yet — upload a CV to extract skills</p>
        )}
      </div>

      {/* Extracted Skills Result */}
      {extractedSkills.length > 0 && (
        <div className="mb-6 border rounded-lg p-4 bg-green-50">
          <h3 className="text-sm font-semibold text-green-800 mb-2">Extracted {extractedSkills.length} skills from CV</h3>
          <div className="flex gap-2 flex-wrap">
            {extractedSkills.map((s, i) => (
              <span key={i} className={`inline-block text-xs px-2 py-1 rounded-full ${levelColors[s.level] || 'bg-gray-100 text-gray-600'}`}>
                {s.name} <span className="opacity-60">({s.level})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CV Upload Section */}
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Upload CV / Resume</h2>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded text-sm ${activeTab === 'upload' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            Upload PDF
          </button>
          <button onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded text-sm ${activeTab === 'paste' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            Paste Text
          </button>
        </div>

        {activeTab === 'upload' ? (
          <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition">
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={extracting} />
            <p className="text-gray-500">{extracting ? 'Extracting skills...' : 'Click to upload PDF (max 5MB)'}</p>
          </label>
        ) : (
          <div>
            <textarea value={cvText} onChange={e => setCvText(e.target.value)}
              placeholder="Paste your CV/resume text here..." rows={8}
              className="w-full border rounded px-3 py-2 text-sm mb-3" />
            <button onClick={handleTextExtract} disabled={extracting || !cvText.trim()}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
              {extracting ? 'Extracting skills...' : 'Extract Skills'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
