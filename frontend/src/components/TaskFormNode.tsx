import { useState } from 'react';
import type { TaskFormState, Skill } from '../lib/types';
import { createEmptyNode } from '../utils/treeUtils';
import { groupSkillsByCategory, filterTechnicalSkills } from '../lib/skillCategories';

interface Props {
  node: TaskFormState;
  skills: Skill[];
  depth: number;
  onUpdate: (id: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => void;
  classifiedSkillIds?: string[];
  classifying?: boolean;
  onTitleBlur?: () => void;
}

export default function TaskFormNode({ node, skills, depth, onUpdate, classifiedSkillIds, classifying, onTitleBlur }: Props) {
  const [showManual, setShowManual] = useState(false);
  const technicalSkills = filterTechnicalSkills(skills);
  const grouped = groupSkillsByCategory(technicalSkills);
  const hasAiSkills = classifiedSkillIds && classifiedSkillIds.length > 0;

  return (
    <div className="border-l-2 border-gray-200 pl-4 my-2" style={{ marginLeft: `${depth * 16}px` }}>
      <input
        aria-label="Task title"
        type="text"
        value={node.title}
        onChange={e => onUpdate(node.id, () => ({ title: e.target.value }))}
        onBlur={onTitleBlur}
        placeholder="Task title..."
        className="w-full border rounded px-3 py-1.5 text-sm mb-2"
      />

      {classifying && (
        <div className="text-xs text-purple-600 mb-2">Classifying skills...</div>
      )}
      {hasAiSkills && !classifying && (
        <div className="bg-green-50 border border-green-200 rounded px-3 py-2 mb-2">
          <span className="text-xs text-green-700 font-medium">AI classified: </span>
          {classifiedSkillIds.map(id => {
            const skill = skills.find(s => s.id === id);
            return skill ? (
              <span key={id} className="inline-block bg-green-500 text-white text-xs px-2 py-0.5 rounded mr-1">{skill.name}</span>
            ) : null;
          })}
        </div>
      )}

      <div className="mb-2">
        <button type="button" onClick={() => setShowManual(!showManual)}
          className="text-xs text-gray-500 hover:text-gray-700">
          {showManual ? 'Hide manual skills' : 'Refine skills manually'}
        </button>
      </div>

      {showManual && (
        <div className="bg-gray-50 rounded p-3 mb-2">
          {Object.entries(grouped).map(([category, catSkills]) => (
            <div key={category} className="mb-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{category}</div>
              <div className="flex flex-wrap gap-1">
                {catSkills.map(skill => {
                  const active = node.skillIds.includes(skill.id);
                  return (
                    <button key={skill.id} type="button" aria-pressed={active}
                      aria-label={`Toggle ${skill.name} skill`}
                      onClick={() => onUpdate(node.id, n => ({
                        skillIds: active ? n.skillIds.filter(id => id !== skill.id) : [...n.skillIds, skill.id],
                      }))}
                      className={`px-2 py-0.5 text-xs rounded-full border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                      {skill.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button"
        onClick={() => onUpdate(node.id, n => ({ subtasks: [...n.subtasks, createEmptyNode()] }))}
        className="text-xs bg-gray-800 text-white px-2 py-1 rounded">
        + Subtask
      </button>

      {node.subtasks.map(child => (
        <TaskFormNode key={child.id} node={child} skills={skills} depth={depth + 1} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
