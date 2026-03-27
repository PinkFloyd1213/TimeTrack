import { X, Pencil as Edit2, Trash2, Check } from 'lucide-react';
import { WorkSession } from '../lib/supabase';

interface EditedSession {
  id: string;
  clockIn: string;
  clockOut: string;
}

interface SessionRowProps {
  session: WorkSession;
  isEditing: boolean;
  isDeleted: boolean;
  edited: EditedSession | undefined;
  isPlanned: boolean;
  onEdit: (session: WorkSession) => void;
  onCancelEdit: (sessionId: string) => void;
  onClockInChange: (sessionId: string, value: string) => void;
  onClockOutChange: (sessionId: string, value: string) => void;
  onDelete: (sessionId: string) => void;
  formatDuration: (minutes: number) => string;
}

export function SessionRow({
  session,
  isEditing,
  isDeleted,
  edited,
  isPlanned,
  onEdit,
  onCancelEdit,
  onClockInChange,
  onClockOutChange,
  onDelete,
  formatDuration,
}: SessionRowProps) {
  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all ${
        isDeleted
          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 opacity-50'
          : isEditing
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
          : isPlanned
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 border-dashed'
          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
      }`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Heure d'arrivée
              </label>
              <input
                type="time"
                value={edited?.clockIn || ''}
                onChange={(e) => onClockInChange(session.id, e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 transition-all outline-none text-base"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Heure de départ
              </label>
              <input
                type="time"
                value={edited?.clockOut || ''}
                onChange={(e) => onClockOutChange(session.id, e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 transition-all outline-none text-base"
              />
            </div>
          </div>
          {edited?.clockIn && edited?.clockOut && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Durée: {(() => {
                const [inHours, inMinutes] = edited.clockIn.split(':');
                const [outHours, outMinutes] = edited.clockOut.split(':');
                const inTime = new Date();
                inTime.setHours(parseInt(inHours), parseInt(inMinutes), 0, 0);
                const outTime = new Date();
                outTime.setHours(parseInt(outHours), parseInt(outMinutes), 0, 0);
                const durationMinutes = (outTime.getTime() - inTime.getTime()) / (1000 * 60);
                return formatDuration(durationMinutes);
              })()}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onCancelEdit(session.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all font-medium"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-medium text-gray-800 dark:text-gray-100">
              {new Date(session.clock_in).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {session.clock_out && (
                <>
                  {' → '}
                  {new Date(session.clock_out).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </div>
            {session.clock_out && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Durée: {formatDuration(
                  (new Date(session.clock_out).getTime() -
                    new Date(session.clock_in).getTime()) /
                    (1000 * 60)
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(session)}
              disabled={isDeleted}
              className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all shrink-0"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(session.id)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all shrink-0 ${
                isDeleted
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'
              } text-white`}
            >
              {isDeleted ? <Check className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
