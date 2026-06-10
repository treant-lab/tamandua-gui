import { useState } from 'react';
import { format } from 'date-fns';
import { formatDateSafe } from '../utils/dateUtils';
import {
  Filter,
  Search,
  Calendar,
  Save,
  Trash2,
  ChevronDown,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  EventFilter,
  EventFilterPreset,
  EventType,
  EventSeverity,
  getEventTypeLabel,
} from '../hooks/useEvents';

interface EventFiltersProps {
  filter: EventFilter;
  onFilterChange: (filter: EventFilter) => void;
  presets: EventFilterPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: EventFilterPreset) => void;
  onDeletePreset: (presetId: string) => void;
}

const EVENT_TYPES: EventType[] = [
  'process',
  'file',
  'network',
  'registry',
  'alert',
  'response',
  'system',
];

const SEVERITIES: EventSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function EventFilters({
  filter,
  onFilterChange,
  presets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: EventFiltersProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleEventTypeToggle = (type: EventType) => {
    const current = filter.event_types || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFilterChange({ ...filter, event_types: updated.length > 0 ? updated : undefined });
  };

  const handleSeverityToggle = (severity: EventSeverity) => {
    const current = filter.severities || [];
    const updated = current.includes(severity)
      ? current.filter((s) => s !== severity)
      : [...current, severity];
    onFilterChange({ ...filter, severities: updated.length > 0 ? updated : undefined });
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

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      onSavePreset(newPresetName.trim());
      setNewPresetName('');
      setShowPresets(false);
    }
  };

  const hasActiveFilters =
    (filter.event_types && filter.event_types.length > 0) ||
    (filter.severities && filter.severities.length > 0) ||
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
          placeholder="Search events (message, process, path, IP...)"
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
      <div className="flex flex-wrap items-center gap-4">
        {/* Event Types */}
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Event Types
          </label>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleEventTypeToggle(type)}
                className={clsx(
                  'px-3 py-1 text-xs rounded-full border transition-colors',
                  filter.event_types?.includes(type)
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                )}
              >
                {getEventTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Severities */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Severity
          </label>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((severity) => {
              const colors: Record<EventSeverity, string> = {
                critical: 'bg-red-600 border-red-500',
                high: 'bg-orange-600 border-orange-500',
                medium: 'bg-yellow-600 border-yellow-500',
                low: 'bg-blue-600 border-blue-500',
                info: 'bg-gray-600 border-gray-500',
              };

              return (
                <button
                  key={severity}
                  onClick={() => handleSeverityToggle(severity)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-full border transition-colors capitalize',
                    filter.severities?.includes(severity)
                      ? `${colors[severity]} text-white`
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  {severity}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-4">
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

        {/* Presets */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm hover:bg-gray-600"
          >
            <Filter className="w-4 h-4" />
            <span>Presets</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showPresets && (
            <div className="absolute z-10 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
              {/* Saved Presets */}
              {presets.length > 0 && (
                <div className="p-2 border-b border-gray-700">
                  <p className="text-xs text-gray-400 px-2 mb-2">Saved Presets</p>
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-700"
                    >
                      <button
                        onClick={() => {
                          onLoadPreset(preset);
                          setShowPresets(false);
                        }}
                        className="flex-1 text-left text-sm"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => onDeletePreset(preset.id)}
                        className="p-1 text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save New Preset */}
              <div className="p-2">
                <p className="text-xs text-gray-400 px-2 mb-2">Save Current Filter</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Preset name..."
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim()}
                    className="p-1.5 bg-primary-600 rounded hover:bg-primary-500 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
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
          {filter.event_types?.map((type) => (
            <span
              key={type}
              className="px-2 py-0.5 text-xs bg-primary-900/30 text-primary-300 rounded-full"
            >
              {getEventTypeLabel(type)}
            </span>
          ))}
          {filter.severities?.map((severity) => (
            <span
              key={severity}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full capitalize"
            >
              {severity}
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
export function EventFiltersCompact({
  filter,
  onFilterChange,
}: {
  filter: EventFilter;
  onFilterChange: (filter: EventFilter) => void;
}) {
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
        value={filter.event_types?.[0] || ''}
        onChange={(e) =>
          onFilterChange({
            ...filter,
            event_types: e.target.value ? [e.target.value as EventType] : undefined,
          })
        }
        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
      >
        <option value="">All Types</option>
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {getEventTypeLabel(type)}
          </option>
        ))}
      </select>

      <select
        value={filter.severities?.[0] || ''}
        onChange={(e) =>
          onFilterChange({
            ...filter,
            severities: e.target.value ? [e.target.value as EventSeverity] : undefined,
          })
        }
        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm"
      >
        <option value="">All Severities</option>
        {SEVERITIES.map((severity) => (
          <option key={severity} value={severity}>
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
