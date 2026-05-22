import { useState, useCallback, useRef } from 'react';
import KickstartForm from '../components/kickstart/KickstartForm';
import KickstartProgress from '../components/kickstart/KickstartProgress';
import KickstartSummary from '../components/kickstart/KickstartSummary';
import { kickstartProject } from '../lib/api';
import type { KickstartPayload } from '../lib/api';
import type { KickstartState, StepEvent, TaskEvent, MemberEvent, AssignmentEvent, DoneEvent, ErrorEvent } from '../lib/kickstart-types';

export default function KickstartPage() {
  const [state, setState] = useState<KickstartState>('form');
  const [projectName, setProjectName] = useState('');
  const [steps, setSteps] = useState<Record<string, StepEvent>>({});
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [members, setMembers] = useState<MemberEvent[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEvent[]>([]);
  const [doneData, setDoneData] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<ErrorEvent | null>(null);
  const startTime = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const handleSubmit = useCallback((payload: KickstartPayload) => {
    setState('running');
    setProjectName(payload.name);
    startTime.current = Date.now();

    kickstartProject(payload, (event, data) => {
      switch (event) {
        case 'step':
          setSteps(prev => ({ ...prev, [(data as StepEvent).step]: data as StepEvent }));
          break;
        case 'task':
          setTasks(prev => [...prev, data as TaskEvent]);
          break;
        case 'member':
          setMembers(prev => [...prev, data as MemberEvent]);
          break;
        case 'assignment':
          setAssignments(prev => [...prev, data as AssignmentEvent]);
          break;
        case 'done':
          setDoneData(data as DoneEvent);
          setElapsedMs(Date.now() - startTime.current);
          setState('done');
          break;
        case 'error':
          setError(data as ErrorEvent);
          setState('error');
          break;
      }
    });
  }, []);

  return (
    <main className="p-6">
      {state === 'form' && <KickstartForm onSubmit={handleSubmit} />}

      {state === 'running' && (
        <KickstartProgress
          projectName={projectName}
          steps={steps}
          tasks={tasks}
          members={members}
          assignments={assignments}
        />
      )}

      {state === 'done' && doneData && (
        <KickstartSummary done={doneData} tasks={tasks} assignments={assignments} elapsedMs={elapsedMs} />
      )}

      {state === 'error' && error && (
        <div className="max-w-xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="font-bold text-red-800">Pipeline failed</div>
            <div className="text-sm text-red-600 mt-1">{error.error}</div>
            {error.partialProjectId && (
              <a href={`/projects/${error.partialProjectId}`} className="text-sm text-blue-600 underline mt-2 inline-block">
                View partial results →
              </a>
            )}
            <button onClick={() => { setState('form'); setSteps({}); setTasks([]); setMembers([]); setAssignments([]); setError(null); }}
              className="mt-3 text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200">
              Try again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
