import type { StepEvent, TaskEvent, MemberEvent, AssignmentEvent } from '../../lib/kickstart-types';

interface Props {
  projectName: string;
  steps: Record<string, StepEvent>;
  tasks: TaskEvent[];
  members: MemberEvent[];
  assignments: AssignmentEvent[];
}

const STEP_CONFIG = [
  { key: 'enrich', label: 'Enrich project description' },
  { key: 'parallel', label: null },
  { key: 'assign', label: 'Assign & balance workload' },
] as const;

function StepIcon({ status }: { status?: string }) {
  if (status === 'done') return <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-sm">✓</div>;
  if (status === 'running' || status === 'retrying')
    return <div className="w-7 h-7 rounded-full border-[2.5px] border-blue-500 border-t-transparent animate-spin" />;
  return <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-sm">○</div>;
}

function ParallelSteps({ steps, tasks, members }: Pick<Props, 'steps' | 'tasks' | 'members'>) {
  return (
    <div className="flex gap-3 ml-[14px]">
      <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex gap-2 items-center mb-2">
          <StepIcon status={steps['generate-tasks']?.status} />
          <span className="font-semibold text-sm text-blue-800">Generate tasks</span>
        </div>
        <div className="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
          {tasks.map((t, i) => (
            <div key={i} className="text-green-600">✓ {t.title} <span className="text-gray-400">({t.storyPoints} pts)</span></div>
          ))}
          {steps['generate-tasks']?.status === 'running' && <div className="text-blue-500">● Generating...</div>}
        </div>
      </div>
      <div className="flex-1 bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex gap-2 items-center mb-2">
          <StepIcon status={steps['process-team']?.status} />
          <span className="font-semibold text-sm text-purple-800">Process team</span>
        </div>
        <div className="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
          {members.map((m, i) => (
            <div key={i} className="text-green-600">✓ {m.name} <span className="text-gray-400">({m.isNew ? 'new' : 'existing'}, {m.skills.length} skills)</span></div>
          ))}
          {steps['process-team']?.status === 'running' && <div className="text-purple-500">● Processing CVs...</div>}
        </div>
      </div>
    </div>
  );
}

export default function KickstartProgress({ projectName, steps, tasks, members, assignments }: Props) {
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-lg font-bold mb-1">Setting up your project...</h2>
      <p className="text-gray-500 text-sm mb-5">{projectName}</p>

      {/* Step 1: Enrich */}
      <div className="flex gap-3 items-start mb-2">
        <StepIcon status={steps.enrich?.status} />
        <div>
          <div className={`font-semibold text-sm ${steps.enrich?.status === 'done' ? 'text-green-700' : 'text-gray-700'}`}>
            Enrich project description
          </div>
          {steps.enrich?.status === 'done' && steps.enrich.result && (
            <div className="text-xs text-gray-500 mt-0.5">
              {(steps.enrich.result.techStack as string[])?.join(', ')}
            </div>
          )}
          {steps.enrich?.status === 'retrying' && (
            <div className="text-xs text-amber-600">Retrying (attempt {steps.enrich.attempt})...</div>
          )}
        </div>
      </div>

      {/* Parallel: Steps 2 & 3 */}
      <div className="my-3">
        <ParallelSteps steps={steps} tasks={tasks} members={members} />
      </div>

      {/* Step 4: Assign */}
      <div className="flex gap-3 items-start mt-2">
        <StepIcon status={steps.assign?.status} />
        <div>
          <div className={`font-semibold text-sm ${steps.assign?.status === 'done' ? 'text-green-700' : steps.assign?.status ? 'text-gray-700' : 'text-gray-400'}`}>
            Assign & balance workload
          </div>
          {steps.assign?.status === 'running' && (
            <div className="text-xs text-gray-500 space-y-0.5 mt-1">
              {assignments.map((a, i) => (
                <div key={i} className="text-green-600">✓ {a.task} → {a.developer}</div>
              ))}
            </div>
          )}
          {!steps.assign?.status && <div className="text-xs text-gray-400">Waiting for tasks and team...</div>}
        </div>
      </div>
    </div>
  );
}
