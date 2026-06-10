import { useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  QUICK_ACTIONS,
  useKeyboardShortcuts,
  useQuickAction,
  useQuickActionsPanel,
  type QuickActionDefinition,
} from '@/hooks/useQuickActions';
import { QuickActionButton } from './QuickActionButton';
import { QuickActionConfirm } from './QuickActionConfirm';

function QuickActionExecutor({
  action,
  onDangerous,
}: {
  action: QuickActionDefinition;
  onDangerous: (action: QuickActionDefinition) => void;
}) {
  const { execute, isLoading } = useQuickAction(action.id);

  const run = () => {
    if (action.dangerous || action.requiresInput) {
      onDangerous(action);
      return;
    }
    execute(undefined);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const actionEvent = event as CustomEvent<string>;
      if (actionEvent.detail === action.id) {
        run();
      }
    };

    window.addEventListener('tamandua-quick-action', handler);
    return () => window.removeEventListener('tamandua-quick-action', handler);
  });

  return <QuickActionButton action={action} onClick={run} isLoading={isLoading} />;
}

export function QuickActionsPanel() {
  const panel = useQuickActionsPanel();
  const confirmAction = panel.confirmAction;
  const confirmedAction = useQuickAction(confirmAction?.id || 'quick_scan');

  useKeyboardShortcuts(
    QUICK_ACTIONS.map((action) => ({
      action: action.id,
      handler: () => {
        if (action.dangerous || action.requiresInput) {
          panel.requestConfirmation(action);
        } else {
          const event = new CustomEvent('tamandua-quick-action', { detail: action.id });
          window.dispatchEvent(event);
        }
      },
    }))
  );

  return (
    <>
      <button
        onClick={panel.toggle}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full',
          'bg-primary-600 text-white shadow-xl transition-colors hover:bg-primary-500',
          panel.isOpen && 'bg-primary-500'
        )}
        title="Quick actions"
        aria-label="Quick actions"
      >
        {panel.isOpen ? <X className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
      </button>

      {panel.isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-[min(28rem,calc(100vw-3rem))] rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Quick Actions</h2>
              <p className="text-xs text-gray-500">Common response and maintenance tasks</p>
            </div>
            <button
              onClick={panel.close}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100"
              aria-label="Close quick actions"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionExecutor
                key={action.id}
                action={action}
                onDangerous={panel.requestConfirmation}
              />
            ))}
          </div>
        </div>
      )}

      {confirmAction && (
        <QuickActionConfirm
          action={confirmAction}
          pidValue={panel.pidInput}
          onPidChange={panel.setPidInput}
          isLoading={confirmedAction.isLoading}
          onCancel={panel.cancelConfirmation}
          onConfirm={(params) => {
            confirmedAction.execute(params);
            panel.cancelConfirmation();
          }}
        />
      )}
    </>
  );
}
