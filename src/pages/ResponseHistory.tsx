import { useMemo, useState } from 'react';
import { RotateCcw, ShieldCheck, Timer } from 'lucide-react';
import {
  getActionTypeLabel,
  getResultColor,
  getTriggerLabel,
  useResponseActions,
  useResponseActionStats,
  useUndoAction,
  type ResponseActionFilter,
} from '../hooks/useResponseActions';
import { ResponseFilters } from '../components/response/ResponseFilters';
import { ResponseStats } from '../components/response/ResponseStats';
import { formatDateSafe } from '../utils/dateUtils';
import clsx from 'clsx';

export function ResponseHistory() {
  const [filter, setFilter] = useState<ResponseActionFilter>({ limit: 100 });
  const { data: actions = [], isLoading } = useResponseActions(filter);
  const { data: stats, isLoading: statsLoading } = useResponseActionStats(filter);
  const undoAction = useUndoAction();

  const reversibleCount = useMemo(
    () => actions.filter((action) => action.can_undo).length,
    [actions]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Response History</h1>
          <p className="mt-1 text-gray-400">Audit and undo endpoint response actions.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <HeaderMetric icon={ShieldCheck} label="Actions" value={String(actions.length)} />
          <HeaderMetric icon={RotateCcw} label="Reversible" value={String(reversibleCount)} />
          <HeaderMetric icon={Timer} label="Avg" value={stats ? `${stats.avg_response_time_ms}ms` : '-'} />
        </div>
      </div>

      <ResponseStats stats={stats} isLoading={statsLoading} />
      <ResponseFilters filter={filter} onFilterChange={(next) => setFilter({ ...next, limit: 100 })} />

      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
        <div className="border-b border-gray-700 bg-gray-900 px-4 py-3">
          <h2 className="font-semibold text-gray-100">Action Timeline</h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-gray-400">Loading response actions...</div>
        ) : actions.length === 0 ? (
          <div className="p-6 text-gray-400">No response actions match the current filters.</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {actions.map((action) => (
              <div key={action.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.3fr_1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-100">
                      {getActionTypeLabel(action.action_type)}
                    </span>
                    <span className={clsx('rounded px-2 py-0.5 text-xs', getResultColor(action.result))}>
                      {action.result}
                    </span>
                    <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                      {getTriggerLabel(action.triggered_by)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-sm text-gray-300">{action.target}</p>
                  {action.error_message && (
                    <p className="mt-1 text-sm text-red-400">{action.error_message}</p>
                  )}
                </div>

                <div className="text-sm text-gray-400">
                  <p className="text-gray-300">{action.hostname}</p>
                  <p>{formatDateSafe(action.timestamp, 'PPpp', 'Unknown time')}</p>
                  {action.triggered_rule && <p className="truncate">{action.triggered_rule}</p>}
                </div>

                <div className="flex items-center justify-end">
                  <button
                    disabled={!action.can_undo || undoAction.isPending}
                    onClick={() => undoAction.mutate(action.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Undo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
      <Icon className="ml-auto h-4 w-4 text-gray-500" />
      <p className="mt-2 text-xl font-semibold text-gray-100">{value}</p>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
