import { useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useToast } from '../components/Toast';

// Safe date formatting helper
function formatDateSafe(dateValue: unknown, formatStr: string, fallback: string = 'N/A'): string {
  if (!dateValue) return fallback;
  try {
    const date = new Date(dateValue as string);
    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}
import {
  History,
  Download,
  BarChart3,
  RefreshCw,
  Calendar,
  Filter,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { open } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import clsx from 'clsx';

import {
  useEvents,
  useEventCount,
  useEventStatistics,
  useExportEvents,
  useFilterPresets,
  useSaveFilterPreset,
  useDeleteFilterPreset,
  EventFilter,
  EventFilterPreset,
  TelemetryEvent,
  getEventTypeLabel,
} from '../hooks/useEvents';
import { EventTimeline } from '../components/EventTimeline';
import { EventFilters } from '../components/EventFilters';
import { EventDetails } from '../components/EventDetails';

export function EventHistory() {
  const [filter, setFilter] = useState<EventFilter>({
    limit: 100,
  });
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const timelineHostRef = useRef<HTMLDivElement | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(520);
  const toast = useToast();

  useEffect(() => {
    const host = timelineHostRef.current;
    if (!host) return;

    const updateHeight = () => {
      setTimelineHeight(Math.max(240, Math.floor(host.getBoundingClientRect().height)));
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(host);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [showStats, selectedEvent]);

  // Data hooks
  const pagedFilter = { ...filter, limit: pageSize, offset: page * pageSize };
  const { data: events = [], isLoading } = useEvents(pagedFilter);
  const { data: eventCount = 0 } = useEventCount(filter);
  const { data: statistics } = useEventStatistics(filter);
  const { data: presets = [] } = useFilterPresets();
  const totalPages = Math.max(1, Math.ceil(eventCount / pageSize));
  const eventCountLabel = (() => {
    const count = eventCount.toLocaleString();
    if (filter.date_from && filter.date_to && statistics) {
      return `${count} events in the selected ${statistics.time_range_hours}h range`;
    }
    if (filter.date_from || filter.date_to) {
      return `${count} events in the selected range`;
    }
    return `${count} matching events`;
  })();

  // Mutation hooks
  const exportEvents = useExportEvents();
  const savePreset = useSaveFilterPreset();
  const deletePreset = useDeleteFilterPreset();

  // Handlers
  const handleFilterChange = useCallback((newFilter: EventFilter) => {
    setFilter({ ...newFilter, limit: 100 });
    setPage(0);
  }, []);

  const handleSelectEvent = useCallback((event: TelemetryEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleSavePreset = useCallback(
    async (name: string) => {
      try {
        await savePreset.mutateAsync({ name, filter });
        toast.success('Preset saved', `Filter preset "${name}" has been saved`);
      } catch (error) {
        console.error('Failed to save preset:', error);
        toast.error('Save failed', 'Failed to save filter preset');
      }
    },
    [filter, savePreset, toast]
  );

  const handleLoadPreset = useCallback(
    (preset: EventFilterPreset) => {
      handleFilterChange(preset.filter);
    },
    [handleFilterChange]
  );

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        await deletePreset.mutateAsync(presetId);
      } catch (error) {
        console.error('Failed to delete preset:', error);
      }
    },
    [deletePreset]
  );

  const handleExport = async (exportFormat: 'csv' | 'json' | 'evtx') => {
    try {
      const extensions: Record<string, string[]> = {
        csv: ['csv'],
        json: ['json'],
        evtx: ['evtx'],
      };

      const savePath = await open({
        defaultPath: `tamandua-events-${Date.now()}.${exportFormat}`,
        filters: [{ name: exportFormat.toUpperCase(), extensions: extensions[exportFormat] }],
      }) as string;

      if (!savePath) return;

      const data = await exportEvents.mutateAsync({
        format: exportFormat,
        filter,
        include_raw_data: exportFormat === 'json',
      });

      await writeTextFile(savePath, data);
      toast.success('Events exported', savePath);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed', String(error));
    }
  };

  // Chart colors using design tokens
  const CHART_COLORS = [
    'var(--emerald-400)',
    'var(--med)',
    'var(--sol-magenta)',
    'var(--high)',
    'var(--crit)',
    'var(--sol-cyan)',
    'var(--emerald-200)',
  ];

  return (
    <div className="h-full min-h-0 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="p-6"
        style={{
          borderBottom: '1px solid var(--hairline)',
          background: 'var(--surface)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="text-2xl font-bold flex items-center space-x-2"
              style={{ color: 'var(--fg)' }}
            >
              <History className="w-7 h-7" />
              <span>Event History</span>
            </h1>
            <p style={{ color: 'var(--muted)' }} className="mt-1">
              {statistics ? eventCountLabel : 'Loading...'}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center space-x-2 px-3 py-2 text-sm transition-colors"
              style={{
                borderRadius: 'var(--r-md)',
                background: showStats ? 'var(--emerald-600)' : 'var(--surface-2)',
                color: showStats ? 'white' : 'var(--fg-2)',
              }}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Statistics</span>
            </button>

            <div className="relative group">
              <button
                className="flex items-center space-x-2 px-3 py-2 text-sm transition-colors"
                style={{
                  borderRadius: 'var(--r-md)',
                  background: 'var(--emerald-600)',
                  color: 'white',
                }}
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <div
                className="absolute right-0 mt-2 w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--shadow-xl)',
                  zIndex: 'var(--z-dropdown)',
                }}
              >
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-3)]"
                  style={{
                    color: 'var(--fg-2)',
                    borderTopLeftRadius: 'var(--r-md)',
                    borderTopRightRadius: 'var(--r-md)',
                  }}
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-3)]"
                  style={{ color: 'var(--fg-2)' }}
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport('evtx')}
                  className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-3)]"
                  style={{
                    color: 'var(--fg-2)',
                    borderBottomLeftRadius: 'var(--r-md)',
                    borderBottomRightRadius: 'var(--r-md)',
                  }}
                >
                  Export as EVTX
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <EventFilters
          filter={filter}
          onFilterChange={handleFilterChange}
          presets={presets}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
        />
      </div>

      {/* Statistics Panel */}
      {showStats && statistics && (
        <div
          className="p-4"
          style={{
            borderBottom: '1px solid var(--hairline)',
            background: 'var(--bg-2)',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Events per Hour Chart */}
            <div
              className="p-4"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <h3
                className="text-sm font-medium mb-3 flex items-center space-x-2"
                style={{ color: 'var(--muted)' }}
              >
                <Calendar className="w-4 h-4" />
                <span>Events per Hour</span>
              </h3>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statistics.events_per_hour}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: 'var(--muted)', fontSize: 10 }}
                      tickFormatter={(v) => formatDateSafe(v, 'HH:mm', '--:--')}
                    />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} width={40} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 'var(--r-md)',
                        color: 'var(--fg)',
                      }}
                      labelFormatter={(v) => formatDateSafe(v, 'MMM d, HH:mm', 'Unknown')}
                    />
                    <Bar dataKey="count" fill="var(--emerald-400)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Event Type Distribution */}
            <div
              className="p-4"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <h3
                className="text-sm font-medium mb-3 flex items-center space-x-2"
                style={{ color: 'var(--muted)' }}
              >
                <Filter className="w-4 h-4" />
                <span>Event Types</span>
              </h3>
              <div className="h-32 flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={statistics.event_type_distribution}
                      dataKey="count"
                      nameKey="event_type"
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                    >
                      {statistics.event_type_distribution.map((entry, index) => (
                        <Cell
                          key={entry.event_type}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface-2)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 'var(--r-md)',
                        color: 'var(--fg)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {statistics.event_type_distribution.slice(0, 5).map((item, index) => (
                    <div key={item.event_type} className="flex items-center text-xs">
                      <div
                        className="w-3 h-3 mr-2"
                        style={{
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          borderRadius: 'var(--r-sm)',
                        }}
                      />
                      <span className="flex-1 truncate" style={{ color: 'var(--fg-2)' }}>
                        {getEventTypeLabel(item.event_type)}
                      </span>
                      <span style={{ color: 'var(--subtle)' }}>
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Processes */}
            <div
              className="p-4"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <h3
                className="text-sm font-medium mb-3 flex items-center space-x-2"
                style={{ color: 'var(--muted)' }}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Top Processes</span>
              </h3>
              <div className="space-y-2">
                {statistics.top_processes.slice(0, 5).map((proc, index) => (
                  <div key={proc.process_name} className="flex items-center text-sm">
                    <span style={{ color: 'var(--subtle)' }} className="w-5">
                      {index + 1}.
                    </span>
                    <span
                      className="flex-1 truncate text-xs"
                      style={{ fontFamily: 'var(--mono)', color: 'var(--fg-2)' }}
                    >
                      {proc.process_name}
                    </span>
                    <span className="ml-2" style={{ color: 'var(--muted)' }}>
                      {proc.count.toLocaleString()}
                    </span>
                  </div>
                ))}
                {statistics.top_processes.length === 0 && (
                  <div className="text-sm" style={{ color: 'var(--subtle)' }}>
                    No process data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Event Timeline */}
        <div
          ref={timelineHostRef}
          className={clsx('flex-1 min-h-0 overflow-hidden', selectedEvent && 'lg:w-3/5')}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div
                  className="animate-spin rounded-full h-12 w-12 mx-auto"
                  style={{
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: 'var(--hairline)',
                    borderBottomColor: 'var(--emerald-500)',
                  }}
                />
                <p className="mt-4" style={{ color: 'var(--muted)' }}>
                  Loading events...
                </p>
              </div>
            </div>
          ) : (
              <EventTimeline
                events={events}
                selectedEventId={selectedEvent?.id || null}
                onSelectEvent={handleSelectEvent}
                height={timelineHeight}
              />
          )}
        </div>

        {/* Event Details Panel */}
        {selectedEvent && (
          <div
            className="hidden lg:block w-2/5 overflow-hidden"
            style={{ borderLeft: '1px solid var(--hairline)' }}
          >
            <EventDetails
              event={selectedEvent}
              onClose={handleCloseDetails}
              onSelectRelatedEvent={handleSelectEvent}
            />
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-between gap-3 px-6 py-3"
        style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface)' }}
      >
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          {eventCount === 0
            ? 'No events'
            : `${(page * pageSize + 1).toLocaleString()}-${Math.min((page + 1) * pageSize, eventCount).toLocaleString()} of ${eventCount.toLocaleString()}`}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded px-2 py-1 text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)' }}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
            <option value={500}>500 / page</option>
          </select>
          <button
            className="sentinel-btn"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            Page {Math.min(page + 1, totalPages)} / {totalPages}
          </span>
          <button
            className="sentinel-btn"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {/* Mobile Event Details Modal */}
      {selectedEvent && (
        <div
          className="lg:hidden fixed inset-0"
          style={{
            zIndex: 'var(--z-modal)',
            background: 'rgba(10, 14, 16, 0.9)',
          }}
        >
          <div className="h-full overflow-auto">
            <EventDetails
              event={selectedEvent}
              onClose={handleCloseDetails}
              onSelectRelatedEvent={handleSelectEvent}
            />
          </div>
        </div>
      )}
    </div>
  );
}
