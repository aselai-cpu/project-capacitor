import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Developer, ExtractedSkill } from '../lib/types';
import { fetchDeveloper, uploadCV, extractSkillsFromText } from '../lib/api';

export default function DeveloperProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [developer, setDeveloper] = useState<Developer | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<ExtractedSkill[]>([]);
  const [cvText, setCvText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDeveloper(id).then(setDeveloper).finally(() => setLoading(false));
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
      <Link to="/developers" className="text-blue-600 text-sm hover:underline">← Back to Developers</Link>
      <h1 className="text-2xl font-bold mt-2">{developer.name}</h1>
      {developer.bio && <p className="text-gray-600 mt-1">{developer.bio}</p>}
      {developer.cvFileName && <p className="text-xs text-gray-400 mt-1">CV: {developer.cvFileName}</p>}

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
          <h3 className="text-sm font-semibold text-green-800 mb-2">✓ Extracted {extractedSkills.length} skills from CV</h3>
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
            📄 Upload PDF
          </button>
          <button onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded text-sm ${activeTab === 'paste' ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            📋 Paste Text
          </button>
        </div>

        {activeTab === 'upload' ? (
          <label className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition">
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={extracting} />
            <p className="text-gray-500">{extracting ? '🤖 Extracting skills...' : 'Click to upload PDF (max 5MB)'}</p>
          </label>
        ) : (
          <div>
            <textarea value={cvText} onChange={e => setCvText(e.target.value)}
              placeholder="Paste your CV/resume text here..." rows={8}
              className="w-full border rounded px-3 py-2 text-sm mb-3" />
            <button onClick={handleTextExtract} disabled={extracting || !cvText.trim()}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
              {extracting ? '🤖 Extracting skills...' : '🤖 Extract Skills'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
