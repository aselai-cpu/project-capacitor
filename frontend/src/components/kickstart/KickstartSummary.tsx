import { Link } from 'react-router-dom';
import type { TaskEvent, AssignmentEvent, DoneEvent } from '../../lib/kickstart-types';

interface Props {
  done: DoneEvent;
  tasks: TaskEvent[];
  assignments: AssignmentEvent[];
  elapsedMs: number;
}

export default function KickstartSummary({ done, tasks, assignments, elapsedMs }: Props) {
  const { summary, projectId } = done;
  const elapsedSec = Math.round(elapsedMs / 1000);

  // Build per-developer workload
  const devWorkload = new Map<string, { points: number; taskCount: number }>();
  for (const a of assignments) {
    const current = devWorkload.get(a.developer) ?? { points: 0, taskCount: 0 };
    devWorkload.set(a.developer, { points: current.points + a.points, taskCount: current.taskCount + 1 });
  }
  const maxPoints = Math.max(...Array.from(devWorkload.values()).map(w => w.points), 1);

  const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

  return (
    <div>
      {/* Success banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex justify-between items-center">
        <div>
          <div className="text-lg font-bold text-green-800">&#10003; Project is ready</div>
          <div className="text-sm text-green-600">
            {summary.taskCount} tasks &middot; {summary.totalPoints} points &middot; {summary.memberCount} members &middot; {elapsedSec}s
          </div>
        </div>
        <Link to={`/projects/${projectId}`}
          className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600">
          View Project &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Tasks */}
        <div>
          <h3 className="font-bold mb-3">Generated Tasks</h3>
          <div className="border rounded-lg overflow-hidden text-sm">
            {tasks.slice(0, 8).map((t, i) => (
              <div key={i} className="flex justify-between px-3 py-2 border-b last:border-b-0">
                <span className="truncate mr-2">{t.title}</span>
                <span className="text-purple-600 font-semibold whitespace-nowrap">{t.storyPoints} pts</span>
              </div>
            ))}
            {tasks.length > 8 && (
              <div className="px-3 py-2 text-gray-400 text-center">+ {tasks.length - 8} more tasks</div>
            )}
          </div>
        </div>

        {/* Right: Workload */}
        <div>
          <h3 className="font-bold mb-3">Team Workload</h3>
          <div className="space-y-3 text-sm">
            {Array.from(devWorkload.entries()).map(([devName, wl], i) => (
              <div key={devName}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">{devName}</span>
                  <span className="text-gray-500">{wl.points} pts ({wl.taskCount} tasks)</span>
                </div>
                <div className="bg-gray-200 rounded h-2 overflow-hidden">
                  <div className="h-full rounded" style={{
                    width: `${(wl.points / maxPoints) * 100}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <strong>Balance score:</strong> {Math.round(summary.balanceScore * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}
