import { useState } from 'react';
import { formatDateSafe } from '../../utils/dateUtils';
import {
  Search,
  Calendar,
  Filter,
  ChevronDown,
  X,
  Zap,
  FileX,
  Ban,
  WifiOff,
  RotateCcw,
  Wifi,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  ResponseActionFilter,
  ResponseActionType,
  ActionResult,
  ActionTrigger,
} from '../../hooks/useResponseActions';

interface ResponseFiltersProps {
  filter: ResponseActionFilter;
  onFilterChange: (filter: ResponseActionFilter) => void;
}

const ACTION_TYPES: { type: ResponseActionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'kill_process', label: 'Kill Process', icon: Zap },
  { type: 'quarantine_file', label: 'Quarantine', icon: FileX },
  { type: 'block_ip', label: 'Block IP', icon: Ban },
  { type: 'isolate_host', label: 'Isolate', icon: WifiOff },
  { type: 'restore_file', label: 'Restore', icon: RotateCcw },
  { type: 'unblock_ip', label: 'Unblock', icon: Wifi },
];

const RESULTS: { result: ActionResult; label: string }[] = [
  { result: 'success', label: 'Success' },
  { result: 'failed', label: 'Failed' },
  { result: 'pending', label: 'Pending' },
  { result: 'reverted', label: 'Reverted' },
];

const TRIGGERS: { trigger: ActionTrigger; label: string }[] = [
  { trigger: 'rule', label: 'Detection Rule' },
  { trigger: 'manual', label: 'Manual' },
  { trigger: 'automated', label: 'Automated' },
];

export function ResponseFilters({ filter, onFilterChange }: ResponseFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleActionTypeToggle = (type: ResponseActionType) => {
    const current = filter.action_types || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFilterChange({ ...filter, action_types: updated.length > 0 ? updated : undefined });
  };

  const handleResultToggle = (result: ActionResult) => {
    const current = filter.results || [];
    const updated = current.includes(result)
      ? current.filter((r) => r !== result)
      : [...current, result];
    onFilterChange({ ...filter, results: updated.length > 0 ? updated : undefined });
  };

  const handleTriggerToggle = (trigger: ActionTrigger) => {
    const current = filter.triggers || [];
    const updated = current.includes(trigger)
      ? current.filter((t) => t !== trigger)
      : [...current, trigger];
    onFilterChange({ ...filter, triggers: updated.length > 0 ? updated : undefined });
  };

  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filter, search: search || undefined });
  };

  const handleDateRangeChange = (from: string | undefined, to: string | undefined) => {
    onFilterChange({ ...filter, date_from: from, date_to: to });
  };

  const handleClearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters =
    (filter.action_types && filter.action_types.length > 0) ||
    (filter.results && filter.results.length > 0) ||
    (filter.triggers && filter.triggers.length > 0) ||
    filter.search ||
    filter.date_from ||
    filter.date_to;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by target, rule, or hostname..."
          value={filter.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {filter.search && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-start gap-4">
        {/* Action Types */}
        <div className="flex-1 min-w-[300px]">
          <label className="block text-xs font-medium text-gray-400 mb-2">Action Type</label>
          <div className="flex flex-wrap gap-2">
            {ACTION_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => handleActionTypeToggle(type)}
                className={clsx(
                  'flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors',
                  filter.action_types?.includes(type)
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-2">Result</label>
          <div className="flex flex-wrap gap-2">
            {RESULTS.map(({ result, label }) => {
              const colors: Record<ActionResult, string> = {
                success: 'bg-green-600 border-green-500',
                failed: 'bg-red-600 border-red-500',
                pending: 'bg-yellow-600 border-yellow-500',
                reverted: 'bg-blue-600 border-blue-500',
              };

              return (
                <button
                  key={result}
                  onClick={() => handleResultToggle(result)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-full border transition-colors',
                    filter.results?.includes(result)
                      ? `${colors[result]} text-white`
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Triggers */}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-2">Triggered By</label>
          <div className="flex flex-wrap gap-2">
            {TRIGGERS.map(({ trigger, label }) => (
              <button
                key={trigger}
                onClick={() => handleTriggerToggle(trigger)}
                className={clsx(
                  'px-3 py-1 text-xs rounded-full border transition-colors',
                  filter.triggers?.includes(trigger)
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Range & Clear */}
      <div className="flex items-center gap-4">
        {/* Date Range */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm hover:bg-gray-600"
          >
            <Calendar className="w-4 h-4" />
            <span>
              {filter.date_from || filter.date_to
                ? `${filter.date_from ? formatDateSafe(filter.date_from, 'MMM d', 'Start') : 'Start'} - ${filter.date_to ? formatDateSafe(filter.date_to, 'MMM d', 'End') : 'End'}`
                : 'Date Range'}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showDatePicker && (
            <div className="absolute z-10 mt-2 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From</label>
                  <input
                    type="datetime-local"
                    value={filter.date_from ? filter.date_from.slice(0, 16) : ''}
                    onChange={(e) =>
                      handleDateRangeChange(
                        e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        filter.date_to
                      )
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To</label>
                  <input
                    type="datetime-local"
                    value={filter.date_to ? filter.date_to.slice(0, 16) : ''}
                    onChange={(e) =>
                      handleDateRangeChange(
                        filter.date_from,
                        e.target.value ? new Date(e.target.value).toISOString() : undefined
                      )
                    }
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const now = new Date();
                      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
                      handleDateRangeChange(hourAgo.toISOString(), now.toISOString());
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    1h
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                      handleDateRangeChange(dayAgo.toISOString(), now.toISOString());
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    24h
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      handleDateRangeChange(weekAgo.toISOString(), now.toISOString());
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    7d
                  </button>
                  <button
                    onClick={() => handleDateRangeChange(undefined, undefined)}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Active Filter Summary */}
      {hasActiveFilters && (
        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-gray-700">
          <span className="text-xs text-gray-500">Active filters:</span>
          {filter.action_types?.map((type) => (
            <span
              key={type}
              className="px-2 py-0.5 text-xs bg-primary-900/30 text-primary-300 rounded-full"
            >
              {ACTION_TYPES.find((t) => t.type === type)?.label || type}
            </span>
          ))}
          {filter.results?.map((result) => (
            <span
              key={result}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full capitalize"
            >
              {result}
            </span>
          ))}
          {filter.triggers?.map((trigger) => (
            <span
              key={trigger}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full capitalize"
            >
              {trigger}
            </span>
          ))}
          {filter.search && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full">
              "{filter.search}"
            </span>
          )}
          {(filter.date_from || filter.date_to) && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full">
              Date range set
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Compact filter bar for inline use
export function ResponseFiltersCompact({
  filter,
  onFilterChange,
}: ResponseFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={filter.search || ''}
          onChange={(e) =>
            onFilterChange({ ...filter, search: e.target.value || undefined })
          }
          className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-1.5 text-sm"
        />
      </div>

      <select
        value={filter.action_types?.[0] || ''}
        onChange={(e) =>
          onFilterChange({
            ...filter,
            action_types: e.target.value ? [e.target.value as ResponseActionType] : undefined,
          })
        }
        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
      >
        <option value="">All Types</option>
        {ACTION_TYPES.map(({ type, label }) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={filter.results?.[0] || ''}
        onChange={(e) =>
          onFilterChange({
            ...filter,
            results: e.target.value ? [e.target.value as ActionResult] : undefined,
          })
        }
        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
      >
        <option value="">All Results</option>
        {RESULTS.map(({ result, label }) => (
          <option key={result} value={result}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
