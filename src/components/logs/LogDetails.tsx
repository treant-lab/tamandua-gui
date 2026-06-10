import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  X,
  Copy,
  Check,
  Clock,
  Tag,
  Code,
  FileText,
  MapPin,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LogEntry, getLogLevelColor } from '@/hooks/useLogs';

interface LogDetailsProps {
  log: LogEntry;
  onClose: () => void;
  className?: string;
}

// Syntax highlighting for JSON
function SyntaxHighlightedJSON({ data }: { data: unknown }) {
  const jsonString = JSON.stringify(data, null, 2);

  // Simple syntax highlighting
  const highlighted = jsonString
    .replace(/"([^"]+)":/g, '<span class="text-purple-400">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="text-green-400">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="text-yellow-400">$1</span>')
    .replace(/: (true|false)/g, ': <span class="text-blue-400">$1</span>')
    .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>');

  return (
    <pre
      className="text-xs bg-gray-900 rounded-lg p-4 overflow-auto max-h-96 font-mono"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// Copy button with feedback
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 gap-1.5 text-xs"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-green-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label}
        </>
      )}
    </Button>
  );
}

// Format timestamp with full precision
function formatFullTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return format(date, 'yyyy-MM-dd HH:mm:ss.SSS');
  } catch {
    return timestamp;
  }
}

export function LogDetails({ log, onClose, className }: LogDetailsProps) {
  const levelColor = getLogLevelColor(log.level);

  // Generate full log line for copying
  const fullLogLine = `[${log.timestamp}] [${log.level}] [${log.module}] ${log.message}${
    log.fields ? ' ' + JSON.stringify(log.fields) : ''
  }`;

  return (
    <div className={cn('bg-gray-800 rounded-lg border border-gray-700 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'px-2 py-1 rounded text-sm font-semibold',
              levelColor
            )}
          >
            {log.level}
          </span>
          <span className="text-sm text-gray-400">Log Details</span>
        </div>

        <div className="flex items-center gap-2">
          <CopyButton text={fullLogLine} label="Copy" />
          <CopyButton text={JSON.stringify(log, null, 2)} label="Copy JSON" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Message */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Message</h4>
          <p className="text-sm text-gray-200 bg-gray-900 rounded-lg p-3 font-mono break-words">
            {log.message}
          </p>
        </section>

        {/* Metadata Grid */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Metadata</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Timestamp */}
            <div className="flex items-start gap-2 p-3 bg-gray-900 rounded-lg">
              <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
              <div>
                <div className="text-xs text-gray-500">Timestamp</div>
                <div className="text-sm text-gray-200 font-mono">
                  {formatFullTimestamp(log.timestamp)}
                </div>
              </div>
            </div>

            {/* Module */}
            <div className="flex items-start gap-2 p-3 bg-gray-900 rounded-lg">
              <Layers className="w-4 h-4 text-gray-500 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Module</div>
                <div className="text-sm text-gray-200 font-mono truncate" title={log.module}>
                  {log.module}
                </div>
              </div>
            </div>

            {/* Target */}
            {log.target && (
              <div className="flex items-start gap-2 p-3 bg-gray-900 rounded-lg">
                <Tag className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Target</div>
                  <div className="text-sm text-gray-200 font-mono">{log.target}</div>
                </div>
              </div>
            )}

            {/* File Location */}
            {log.file && (
              <div className="flex items-start gap-2 p-3 bg-gray-900 rounded-lg">
                <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">Source Location</div>
                  <div className="text-sm text-gray-200 font-mono flex items-center gap-1">
                    <span className="truncate" title={log.file}>{log.file}</span>
                    {log.line && (
                      <span className="text-yellow-400 flex-shrink-0">:{log.line}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Span Context */}
            {log.span && (
              <div className="flex items-start gap-2 p-3 bg-gray-900 rounded-lg md:col-span-2">
                <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Span Context</div>
                  <div className="text-sm text-cyan-400 font-mono">{log.span}</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Structured Fields */}
        {log.fields && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1.5">
                <Code className="w-3 h-3" />
                Structured Fields
              </h4>
              <CopyButton text={JSON.stringify(log.fields, null, 2)} label="Copy" />
            </div>
            <SyntaxHighlightedJSON data={log.fields} />
          </section>
        )}

        {/* Raw Log Entry */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase">Raw Entry</h4>
            <CopyButton text={JSON.stringify(log, null, 2)} label="Copy" />
          </div>
          <SyntaxHighlightedJSON data={log} />
        </section>

        {/* Quick Actions */}
        <section className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              // Filter by this module
              window.dispatchEvent(new CustomEvent('log-filter', {
                detail: { modules: [log.module] }
              }));
            }}
          >
            <Layers className="w-3 h-3" />
            Filter by Module
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              // Filter by this level
              window.dispatchEvent(new CustomEvent('log-filter', {
                detail: { levels: [log.level] }
              }));
            }}
          >
            <Tag className="w-3 h-3" />
            Filter by Level
          </Button>
          {log.fields && Object.keys(log.fields).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                // Search for similar fields
                const searchKey = Object.keys(log.fields!)[0];
                window.dispatchEvent(new CustomEvent('log-filter', {
                  detail: { search: searchKey }
                }));
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Find Related
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}

// Inline details preview for virtual list
export function LogDetailsInline({ log }: { log: LogEntry }) {
  return (
    <div className="px-4 py-2 bg-gray-800/50 border-l-2 border-gray-600 ml-4">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Module: </span>
          <span className="text-gray-300 font-mono">{log.module}</span>
        </div>
        {log.target && (
          <div>
            <span className="text-gray-500">Target: </span>
            <span className="text-gray-300 font-mono">{log.target}</span>
          </div>
        )}
        {log.file && (
          <div>
            <span className="text-gray-500">File: </span>
            <span className="text-gray-300 font-mono">
              {log.file}{log.line && `:${log.line}`}
            </span>
          </div>
        )}
        {log.span && (
          <div>
            <span className="text-gray-500">Span: </span>
            <span className="text-cyan-400 font-mono">{log.span}</span>
          </div>
        )}
      </div>
      {log.fields && (
        <div className="mt-2">
          <pre className="text-xs bg-gray-900 rounded p-2 overflow-x-auto font-mono">
            {JSON.stringify(log.fields, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default LogDetails;
