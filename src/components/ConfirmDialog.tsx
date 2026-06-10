import { useState, createContext, useContext, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    dialog?.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <ConfirmDialog
          {...dialog}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}

interface DialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: DialogProps) {
  const variantStyles = {
    danger: {
      icon: 'text-red-400 bg-red-500/20',
      button: 'bg-red-600 hover:bg-red-500 text-white',
    },
    warning: {
      icon: 'text-amber-400 bg-amber-500/20',
      button: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    default: {
      icon: 'text-primary-400 bg-primary-500/20',
      button: 'bg-primary-600 hover:bg-primary-500 text-white',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 fade-in duration-150">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={clsx('w-12 h-12 rounded-full flex items-center justify-center mb-4', styles.icon)}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Content */}
          <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
          <p className="text-gray-400 mb-6">{message}</p>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={clsx('px-4 py-2 rounded-lg font-medium transition-colors', styles.button)}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmProvider;
