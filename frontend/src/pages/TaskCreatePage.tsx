import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Skill, TaskFormState } from '../lib/types';
import { fetchSkills, createTask, classifyTaskSkills } from '../lib/api';
import TaskFormNode from '../components/TaskFormNode';
import { updateNodeInTree, createEmptyNode } from '../utils/treeUtils';

export default function TaskCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parentId');

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [rootTask, setRootTask] = useState<TaskFormState>(createEmptyNode());
  const [saving, setSaving] = useState(false);

  const [classifiedSkillIds, setClassifiedSkillIds] = useState<string[]>([]);
  const [classifying, setClassifying] = useState(false);
  const classifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => {})
      .finally(() => setSkillsLoading(false));
  }, []);

  const handleClassify = useCallback(async () => {
    const title = rootTask.title.trim();
    if (!title || title.length < 5) return;

    setClassifying(true);
    try {
      const result = await classifyTaskSkills(title);
      setClassifiedSkillIds(result.skillIds);
      if (rootTask.skillIds.length === 0 && result.skillIds.length > 0) {
        setRootTask(prev => ({ ...prev, skillIds: result.skillIds }));
      }
    } catch {
      // Fail silently
    } finally {
      setClassifying(false);
    }
  }, [rootTask.title, rootTask.skillIds.length]);

  const handleTitleBlur = useCallback(() => {
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    classifyTimer.current = setTimeout(handleClassify, 300);
  }, [handleClassify]);

  const handleUpdate = (targetId: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => {
    setRootTask(prev => updateNodeInTree(prev, targetId, updater));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTask({
        title: rootTask.title,
        skillIds: rootTask.skillIds,
        parentId: parentId,
        subtasks: parentId ? [] : rootTask.subtasks,
      });
      navigate('/tasks');
    } catch {
      alert('Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {parentId ? 'Add Subtask' : 'Create Task'}
      </h1>
      {skillsLoading && <p className="text-gray-400 text-sm mb-2">Loading skills...</p>}
      <form onSubmit={handleSubmit}>
        <TaskFormNode
          node={rootTask}
          skills={skills}
          depth={0}
          onUpdate={handleUpdate}
          classifiedSkillIds={classifiedSkillIds}
          classifying={classifying}
          onTitleBlur={handleTitleBlur}
        />
        <div className="flex justify-end mt-4 pt-4 border-t">
          <button type="submit" disabled={saving || !rootTask.title}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
