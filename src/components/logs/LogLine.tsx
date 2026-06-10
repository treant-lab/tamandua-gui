import { memo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogEntry, getLogLevelColor, getLogLevelBorderColor } from '@/hooks/useLogs';

interface LogLineProps {
  log: LogEntry;
  style?: React.CSSProperties;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
}

// Parse and highlight JSON in message
function highlightJSON(text: string): React.ReactNode {
  // Match JSON objects/arrays in the text
  const jsonRegex = /(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\])/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = jsonRegex.exec(text)) !== null) {
    // Add text before JSON
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Try to parse and format JSON
    try {
      const parsed = JSON.parse(match[0]);
      parts.push(
        <span key={match.index} className="text-cyan-400">
          {JSON.stringify(parsed)}
        </span>
      );
    } catch {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
  try {
    return format(new Date(timestamp), 'HH:mm:ss.SSS');
  } catch {
    return '--:--:--.---';
  }
}

// Component for rendering structured fields with syntax highlighting
function FieldsDisplay({ fields }: { fields: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(fields, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fields]);

  return (
    <div className="mt-2 relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy JSON"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 text-gray-400" />
        )}
      </button>
      <pre className="text-xs bg-gray-900 rounded p-3 overflow-x-auto font-mono">
        {Object.entries(fields).map(([key, value], i) => (
          <div key={key}>
            <span className="text-purple-400">"{key}"</span>
            <span className="text-gray-400">: </span>
            <span className={
              typeof value === 'string' ? 'text-green-400' :
              typeof value === 'number' ? 'text-yellow-400' :
              typeof value === 'boolean' ? 'text-blue-400' :
              'text-gray-300'
            }>
              {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
            </span>
            {i < Object.entries(fields).length - 1 && <span className="text-gray-400">,</span>}
          </div>
        ))}
      </pre>
    </div>
  );
}

export const LogLine = memo(function LogLine({
  log,
  style,
  isExpanded,
  onToggleExpand,
}: LogLineProps) {
  const levelColor = getLogLevelColor(log.level);
  const borderColor = getLogLevelBorderColor(log.level);
  const hasDetails = log.fields || log.span || log.file;

  return (
    <div
      style={style}
      className={cn(
        'border-l-2 px-3 py-1.5 font-mono text-sm transition-colors',
        borderColor,
        isExpanded ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
      )}
    >
      {/* Main log line */}
      <div
        className={cn(
          'flex items-start gap-2',
          hasDetails && 'cursor-pointer'
        )}
        onClick={() => hasDetails && onToggleExpand?.(log.id)}
      >
        {/* Expand indicator */}
        {hasDetails && (
          <ChevronRight
            className={cn(
              'w-4 h-4 mt-0.5 text-gray-500 transition-transform flex-shrink-0',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        {!hasDetails && <div className="w-4" />}

        {/* Timestamp */}
        <span className="text-gray-500 flex-shrink-0 w-24">
          {formatTimestamp(log.timestamp)}
        </span>

        {/* Level badge */}
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 w-14 text-center',
            levelColor
          )}
        >
          {log.level}
        </span>

        {/* Module */}
        <span className="text-gray-400 flex-shrink-0 truncate max-w-[200px]" title={log.module}>
          [{log.module.split('::').slice(-2).join('::')}]
        </span>

        {/* Message */}
        <span className="text-gray-200 flex-1 break-words">
          {highlightJSON(log.message)}
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="ml-6 mt-2 space-y-2 text-xs">
          {/* Full module path */}
          <div className="flex gap-2">
            <span className="text-gray-500 w-16">Module:</span>
            <span className="text-gray-300">{log.module}</span>
          </div>

          {/* Target */}
          {log.target && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-16">Target:</span>
              <span className="text-gray-300">{log.target}</span>
            </div>
          )}

          {/* Span context */}
          {log.span && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-16">Span:</span>
              <span className="text-cyan-400">{log.span}</span>
            </div>
          )}

          {/* File location */}
          {log.file && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-16">Location:</span>
              <span className="text-gray-300">
                {log.file}
                {log.line && <span className="text-yellow-400">:{log.line}</span>}
              </span>
            </div>
          )}

          {/* Structured fields */}
          {log.fields && <FieldsDisplay fields={log.fields} />}
        </div>
      )}
    </div>
  );
});

// Compact version for virtual list
export const LogLineCompact = memo(function LogLineCompact({
  log,
  style,
  onClick,
}: {
  log: LogEntry;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const levelColor = getLogLevelColor(log.level);
  const borderColor = getLogLevelBorderColor(log.level);

  return (
    <div
      style={style}
      className={cn(
        'flex items-center gap-2 border-l-2 px-3 py-1 font-mono text-xs cursor-pointer hover:bg-gray-800/30 transition-colors',
        borderColor
      )}
      onClick={onClick}
    >
      <span className="text-gray-500 flex-shrink-0 w-20">
        {formatTimestamp(log.timestamp)}
      </span>
      <span
        className={cn(
          'px-1 py-0.5 rounded text-xs font-semibold flex-shrink-0 w-12 text-center',
          levelColor
        )}
      >
        {log.level}
      </span>
      <span className="text-gray-400 flex-shrink-0 truncate w-32" title={log.module}>
        {log.module.split('::').slice(-1)[0]}
      </span>
      <span className="text-gray-200 truncate flex-1">{log.message}</span>
      {log.fields && (
        <span className="text-cyan-400 flex-shrink-0">
          {'{...}'}
        </span>
      )}
    </div>
  );
});

export default LogLine;
