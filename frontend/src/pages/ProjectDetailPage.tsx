import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Project, GeneratedStory } from '../lib/types';
import { fetchProject, enrichProjectApi, generateStories, createTask } from '../lib/api';

const SPEC_TABS = ['Architecture', 'Domain', 'Requirements', 'Constraints', 'Stakeholders'] as const;
type SpecTab = typeof SPEC_TABS[number];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<SpecTab>('Architecture');

  // Story generation state
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [addingTasks, setAddingTasks] = useState(false);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setProject(await fetchProject(id));
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [id]);

  const handleEnrich = async () => {
    if (!id) return;
    setEnriching(true);
    try {
      const updated = await enrichProjectApi(id);
      setProject(updated);
    } catch {
      alert('AI enrichment failed — try again');
    } finally {
      setEnriching(false);
    }
  };

  const handleGenerate = async () => {
    if (!id) return;
    setGenerating(true);
    setSelected(new Set());
    try {
      const result = await generateStories(id);
      setStories(result.stories);
    } catch {
      alert('Story generation failed — try again');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (!project) return;
    setAddingTasks(true);
    const selectedStories = stories.filter((_, i) => selected.has(i));
    try {
      await Promise.all(selectedStories.map(story =>
        createTask({
          title: story.title,
          skillIds: [],
          projectId: project.id,
          acceptanceCriteria: story.acceptanceCriteria,
        })
      ));
      await loadProject();
      setStories([]);
      setSelected(new Set());
    } catch {
      alert('Failed to create some tasks');
    } finally {
      setAddingTasks(false);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-gray-500">Loading...</div>;
  if (!project) return <div className="max-w-4xl mx-auto p-6 text-red-600">Project not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-gray-600 mt-1">{project.description}</p>}
        </div>
        <button onClick={handleEnrich} disabled={enriching}
          className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
          {enriching ? '🤖 Refining...' : '🤖 Refine with AI'}
        </button>
      </div>

      {/* Tech Stack */}
      {project.techStack.length > 0 && (
        <div className="mb-4 flex gap-1 flex-wrap">
          {project.techStack.map((tech, i) => (
            <span key={i} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">{tech}</span>
          ))}
        </div>
      )}

      {/* Project Spec Tabs */}
      {(() => {
        const specFields: Record<SpecTab, string | null> = {
          Architecture: project.architecture,
          Domain: project.domain,
          Requirements: project.requirements,
          Constraints: project.constraints,
          Stakeholders: project.stakeholders,
        };
        const availableTabs = SPEC_TABS.filter(t => specFields[t]);
        if (availableTabs.length === 0) return null;
        const currentTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];
        return (
          <div className="mb-8">
            <div className="flex border-b">
              {availableTabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                    currentTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="border border-t-0 rounded-b-lg p-4">
              <p className="text-sm whitespace-pre-line">{specFields[currentTab]}</p>
            </div>
          </div>
        );
      })()}

      {/* Story Generation Panel */}
      <div className="border-t pt-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Generate User Stories</h2>
          <div className="flex gap-2">
            {stories.length > 0 && (
              <button onClick={handleGenerate} disabled={generating}
                className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50">
                {generating ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            )}
            <button onClick={handleGenerate} disabled={generating}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {generating ? '🤖 Generating...' : '🤖 Generate 10 Stories'}
            </button>
          </div>
        </div>

        {stories.length > 0 && (
          <>
            <div className="space-y-2 mb-4">
              {stories.map((story, i) => (
                <div key={i} className={`border rounded p-3 cursor-pointer transition ${selected.has(i) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => toggleSelect(i)}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                      className="mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{story.title}</p>
                      <details className="mt-1">
                        <summary className="text-xs text-gray-500 cursor-pointer">Acceptance Criteria</summary>
                        <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap bg-gray-50 p-2 rounded">{story.acceptanceCriteria}</pre>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleAddSelected} disabled={selected.size === 0 || addingTasks}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
              {addingTasks ? 'Adding...' : `Add ${selected.size} Selected as Tasks`}
            </button>
          </>
        )}
      </div>

      {/* Existing Tasks */}
      {project.tasks.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-lg font-bold mb-3">Project Tasks ({project.tasks.length})</h2>
          <div className="space-y-1">
            {project.tasks.map(task => (
              <div key={task.id} className="flex justify-between items-center text-sm border rounded px-3 py-2">
                <span>{task.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${task.status === 'DONE' ? 'bg-green-100 text-green-800' : task.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
          <Link to={`/tasks?projectId=${project.id}`} className="text-blue-600 text-sm hover:underline mt-2 inline-block">View all tasks →</Link>
        </div>
      )}
    </div>
  );
}
