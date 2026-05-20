import type { TaskFormState, Skill } from '../lib/types';

interface Props {
  node: TaskFormState;
  skills: Skill[];
  depth: number;
  onUpdate: (id: string, updater: (n: TaskFormState) => Partial<TaskFormState>) => void;
}

export default function TaskFormNode({ node, skills, depth, onUpdate }: Props) {
  return (
    <div className="border-l-2 border-gray-200 pl-4 my-2" style={{ marginLeft: `${depth * 16}px` }}>
      <div className="flex gap-2 items-center mb-2">
        <input
          aria-label="Task title"
          type="text"
          value={node.title}
          onChange={e => onUpdate(node.id, () => ({ title: e.target.value }))}
          placeholder="Task title..."
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        {skills.map(skill => {
          const active = node.skillIds.includes(skill.id);
          return (
            <button
              key={skill.id}
              aria-pressed={active}
              aria-label={`Toggle ${skill.name} skill`}
              type="button"
              onClick={() => onUpdate(node.id, n => ({
                skillIds: active ? n.skillIds.filter(id => id !== skill.id) : [...n.skillIds, skill.id],
              }))}
              className={`px-2 py-1 text-xs rounded ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {skill.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onUpdate(node.id, n => ({
            subtasks: [...n.subtasks, { id: crypto.randomUUID(), title: '', skillIds: [], subtasks: [] }],
          }))}
          className="text-xs bg-gray-800 text-white px-2 py-1 rounded"
        >
          + Subtask
        </button>
      </div>
      {node.subtasks.map(child => (
        <TaskFormNode key={child.id} node={child} skills={skills} depth={depth + 1} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
