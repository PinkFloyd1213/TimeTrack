import { X, Sparkles } from 'lucide-react';
import { CHANGELOG, APP_VERSION } from '../lib/changelog';

interface ChangelogModalProps {
  onClose: () => void;
}

export function ChangelogModal({ onClose }: ChangelogModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[88vh] sm:max-h-[85vh]">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Nouveautés — v{APP_VERSION}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Voici ce qui a changé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-8">
          {CHANGELOG.map((entry, entryIndex) => (
            <div key={entry.version}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-lg font-bold ${entryIndex === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  v{entry.version}
                </span>
                <span className="text-sm font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-lg">
                  {entry.title}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{entry.date}</span>
              </div>
              <ul className="space-y-3">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5 shrink-0">{item.emoji}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
              {entryIndex < CHANGELOG.length - 1 && (
                <div className="mt-6 border-t border-gray-100 dark:border-slate-700" />
              )}
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-slate-700 shrink-0 pb-6 sm:pb-6">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl sm:hover:scale-[1.02] active:scale-[0.98] transition-all touch-manipulation min-h-[48px]"
          >
            C'est parti !
          </button>
        </div>
      </div>
    </div>
  );
}
