import { useState } from 'react';
import { updateTask } from '../../lib/api';

interface Props {
  taskId: string;
  taskTitle: string;
  developerId: string;
  developerName: string;
  matchPercent: number;
  onAssigned: () => void;
  onCancel: () => void;
}

export default function AssignConfirm({ taskId, taskTitle, developerId, developerName, matchPercent, onAssigned, onCancel }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async () => {
    setAssigning(true);
    setError(null);
    try {
      await updateTask(taskId, { developerId });
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-lg p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-2">Assign Developer</h3>
        <p className="text-sm text-gray-600 mb-1">
          Assign <strong>{developerName}</strong> to <strong>{taskTitle}</strong>?
        </p>
        <p className="text-xs text-gray-500 mb-4">Match: {matchPercent}%</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={handleAssign} disabled={assigning}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {assigning ? 'Assigning...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
