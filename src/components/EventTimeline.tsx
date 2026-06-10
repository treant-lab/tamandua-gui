import { useCallback, useRef, memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';
import {
  Activity,
  FileText,
  Network,
  Server,
  AlertTriangle,
  Shield,
  Settings,
  ChevronRight,
} from 'lucide-react';
import {
  TelemetryEvent,
  EventType,
  getEventTypeLabel,
  getEventTypeColor,
  getSeverityColor,
} from '../hooks/useEvents';

interface EventTimelineProps {
  events: TelemetryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: TelemetryEvent) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  height?: number;
}

const EVENT_ICONS: Record<EventType, React.ComponentType<{ className?: string }>> = {
  process: Activity,
  file: FileText,
  network: Network,
  registry: Server,
  alert: AlertTriangle,
  response: Shield,
  system: Settings,
};

// Safe date parsing helper
function parseTimestampSafe(timestamp: string | null | undefined): Date | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatRelativeTimeSafe(timestamp: string | null | undefined): string {
  const date = parseTimestampSafe(timestamp);
  if (!date) return 'Unknown';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

function formatTimeSafe(timestamp: string | null | undefined, formatStr: string): string {
  const date = parseTimestampSafe(timestamp);
  if (!date) return '--:--:--';
  try {
    return format(date, formatStr);
  } catch {
    return '--:--:--';
  }
}

// Memoized event row component
const EventRow = memo(function EventRow({
  event,
  isSelected,
  onSelect,
  style,
}: {
  event: TelemetryEvent;
  isSelected: boolean;
  onSelect: (event: TelemetryEvent) => void;
  style: React.CSSProperties;
}) {
  const Icon = EVENT_ICONS[event.event_type] || Activity;
  const relativeTime = formatRelativeTimeSafe(event.timestamp);

  return (
    <div
      style={style}
      className={clsx(
        'flex items-center px-4 py-3 border-b border-gray-700 cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary-900/30 border-l-4 border-l-primary-500'
          : 'hover:bg-gray-800'
      )}
      onClick={() => onSelect(event)}
    >
      {/* Event Type Icon */}
      <div className={clsx('p-2 rounded-lg mr-4', getEventTypeColor(event.event_type))}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {/* Event Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          {/* Severity Badge */}
          <span
            className={clsx(
              'px-2 py-0.5 text-xs font-medium rounded',
              getSeverityColor(event.severity)
            )}
          >
            {event.severity.toUpperCase()}
          </span>

          {/* Event Type Badge */}
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
            {getEventTypeLabel(event.event_type)}
          </span>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-200 truncate">{event.message}</p>

        {/* Context Line */}
        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
          {event.process_name && (
            <span className="truncate max-w-[150px]">
              {event.process_name}
              {event.process_id && ` (${event.process_id})`}
            </span>
          )}
          {event.file_path && (
            <span className="truncate max-w-[200px]">{event.file_path}</span>
          )}
          {event.remote_ip && (
            <span>
              {event.remote_ip}
              {event.remote_port && `:${event.remote_port}`}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-right ml-4">
        <div className="text-sm text-gray-400">{relativeTime}</div>
        <div className="text-xs text-gray-500">{formatTimeSafe(event.timestamp, 'HH:mm:ss')}</div>
      </div>

      {/* Expand Indicator */}
      <ChevronRight
        className={clsx(
          'w-5 h-5 ml-2 text-gray-500 transition-transform',
          isSelected && 'rotate-90'
        )}
      />
    </div>
  );
});

export function EventTimeline({
  events,
  selectedEventId,
  onSelectEvent,
  onLoadMore,
  hasMore,
  isLoadingMore,
  height = 600,
}: EventTimelineProps) {
  const listRef = useRef<List>(null);

  // Handle scroll to load more
  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }) => {
      if (
        onLoadMore &&
        hasMore &&
        !isLoadingMore &&
        visibleStopIndex >= events.length - 10
      ) {
        onLoadMore();
      }
    },
    [events.length, hasMore, isLoadingMore, onLoadMore]
  );

  // Render individual row
  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      // Loading indicator at the end
      if (index === events.length) {
        return (
          <div
            style={style}
            className="flex items-center justify-center px-4 py-3 text-gray-500"
          >
            {isLoadingMore ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
                <span>Loading more events...</span>
              </div>
            ) : hasMore ? (
              <button
                onClick={onLoadMore}
                className="text-primary-400 hover:text-primary-300"
              >
                Load more events
              </button>
            ) : (
              <span>No more events</span>
            )}
          </div>
        );
      }

      const event = events[index];
      return (
        <EventRow
          event={event}
          isSelected={event.id === selectedEventId}
          onSelect={onSelectEvent}
          style={style}
        />
      );
    },
    [events, selectedEventId, onSelectEvent, hasMore, isLoadingMore, onLoadMore]
  );

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Activity className="w-12 h-12 mb-4 opacity-50" />
        <p>No events found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <List
        ref={listRef}
        height={height}
        itemCount={events.length + (hasMore || isLoadingMore ? 1 : 0)}
        itemSize={88}
        width="100%"
        onItemsRendered={handleItemsRendered}
        overscanCount={5}
      >
        {Row}
      </List>
    </div>
  );
}

// Compact timeline variant for sidebars
export function EventTimelineCompact({
  events,
  onSelectEvent,
  maxItems = 10,
}: {
  events: TelemetryEvent[];
  onSelectEvent: (event: TelemetryEvent) => void;
  maxItems?: number;
}) {
  const displayEvents = events.slice(0, maxItems);

  return (
    <div className="space-y-2">
      {displayEvents.map((event) => {
        const Icon = EVENT_ICONS[event.event_type] || Activity;
        const relativeTime = formatRelativeTimeSafe(event.timestamp);

        return (
          <div
            key={event.id}
            className="flex items-center p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
            onClick={() => onSelectEvent(event)}
          >
            <div
              className={clsx(
                'p-1.5 rounded mr-3',
                getEventTypeColor(event.event_type)
              )}
            >
              <Icon className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{event.message}</p>
              <p className="text-xs text-gray-500">{relativeTime}</p>
            </div>
            <span
              className={clsx(
                'px-1.5 py-0.5 text-xs rounded ml-2',
                getSeverityColor(event.severity)
              )}
            >
              {event.severity.charAt(0).toUpperCase()}
            </span>
          </div>
        );
      })}
      {events.length > maxItems && (
        <div className="text-center text-sm text-gray-500 py-2">
          +{events.length - maxItems} more events
        </div>
      )}
    </div>
  );
}
