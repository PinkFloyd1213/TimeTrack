import { X, Plus } from 'lucide-react';

interface NewEntryForm {
  date: string;
  clockIn: string;
  clockOut: string;
}

interface NewEntryModalProps {
  newEntry: NewEntryForm;
  onEntryChange: (entry: NewEntryForm) => void;
  onAdd: () => void;
  onClose: () => void;
}

function calcDuration(entry: NewEntryForm): string | null {
  if (!entry.clockIn || !entry.clockOut) return null;
  const [inH, inM] = entry.clockIn.split(':');
  const [outH, outM] = entry.clockOut.split(':');
  const inTime = new Date();
  inTime.setHours(parseInt(inH), parseInt(inM), 0, 0);
  const outTime = new Date();
  outTime.setHours(parseInt(outH), parseInt(outM), 0, 0);
  const minutes = (outTime.getTime() - inTime.getTime()) / (1000 * 60);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

export function NewEntryModal({ newEntry, onEntryChange, onAdd, onClose }: NewEntryModalProps) {
  const duration = calcDuration(newEntry);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[60]">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 pb-8 sm:pb-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Plus className="w-6 h-6 text-green-600" />
            Ajouter une entrée
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jour
            </label>
            <input
              type="date"
              value={newEntry.date}
              onChange={(e) => onEntryChange({ ...newEntry, date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-4 focus:ring-green-500/20 transition-all outline-none text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Heure d'arrivée
              </label>
              <input
                type="time"
                value={newEntry.clockIn}
                onChange={(e) => onEntryChange({ ...newEntry, clockIn: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-4 focus:ring-green-500/20 transition-all outline-none text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Heure de départ
              </label>
              <input
                type="time"
                value={newEntry.clockOut}
                onChange={(e) => onEntryChange({ ...newEntry, clockOut: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-4 focus:ring-green-500/20 transition-all outline-none text-base"
              />
            </div>
          </div>

          {duration && (
            <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-3">
              Durée : <span className="font-semibold text-gray-800 dark:text-gray-100">{duration}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-semibold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onAdd}
            disabled={!newEntry.date || !newEntry.clockIn || !newEntry.clockOut || !duration}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
