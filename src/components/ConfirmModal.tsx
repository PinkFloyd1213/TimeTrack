import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'warning'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-600 dark:text-red-400',
      bg: 'from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20',
      border: 'border-red-200 dark:border-red-700',
      button: 'from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
    },
    warning: {
      icon: 'text-orange-600 dark:text-orange-400',
      bg: 'from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20',
      border: 'border-orange-200 dark:border-orange-700',
      button: 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700'
    },
    info: {
      icon: 'text-blue-600 dark:text-blue-400',
      bg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      border: 'border-blue-200 dark:border-blue-700',
      button: 'from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[60]">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden">
        <div className={`bg-gradient-to-r ${styles.bg} border-b-2 ${styles.border} p-5 sm:p-6`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertCircle className={`w-8 h-8 ${styles.icon}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex gap-3 pb-8 sm:pb-6">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-xl font-semibold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-all touch-manipulation min-h-[48px]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r ${styles.button} text-white shadow-lg hover:shadow-xl transition-all touch-manipulation min-h-[48px]`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
