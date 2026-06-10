import { useState } from 'react';
import { format } from 'date-fns';
import { useToast } from './Toast';

// Safe date formatting helper
function formatDateSafe(dateValue: string | null | undefined, formatStr: string, fallback: string = 'N/A'): string {
  if (!dateValue) return fallback;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}
import {
  X,
  Copy,
  FileCode,
  Link2,
  Activity,
  FileText,
  Network,
  Server,
  AlertTriangle,
  Shield,
  Settings,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import clsx from 'clsx';
import {
  TelemetryEvent,
  EventType,
  useRelatedEvents,
  useCreateDetectionRule,
  getEventTypeLabel,
  getEventTypeColor,
  getSeverityColor,
} from '../hooks/useEvents';
import { copyToClipboard } from '../lib/utils';

interface EventDetailsProps {
  event: TelemetryEvent;
  onClose: () => void;
  onSelectRelatedEvent?: (event: TelemetryEvent) => void;
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

export function EventDetails({ event, onClose, onSelectRelatedEvent }: EventDetailsProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'raw'>('details');
  const [copied, setCopied] = useState<string | null>(null);
  const toast = useToast();

  const { data: relatedEvents, isLoading: loadingRelated } = useRelatedEvents(event.id);
  const createRule = useCreateDetectionRule();

  const Icon = EVENT_ICONS[event.event_type] || Activity;
  const formattedTimestamp = formatDateSafe(event.timestamp, 'PPpp', 'Unknown time');

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateRule = async (ruleType: 'yara' | 'sigma') => {
    try {
      const rule = await createRule.mutateAsync({ eventId: event.id, ruleType });
      await copyToClipboard(rule);
      toast.success(
        'Rule created',
        `${ruleType.toUpperCase()} rule copied to clipboard`
      );
    } catch (error) {
      console.error('Failed to create rule:', error);
      toast.error(`Failed to create ${ruleType} rule`, String(error));
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={clsx('p-2 rounded-lg', getEventTypeColor(event.event_type))}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span
                  className={clsx(
                    'px-2 py-0.5 text-xs font-medium rounded',
                    getSeverityColor(event.severity)
                  )}
                >
                  {event.severity.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                  {getEventTypeLabel(event.event_type)}
                </span>
              </div>
              <h3 className="font-semibold text-lg">{event.message}</h3>
              <div className="text-sm text-gray-400 mt-1">
                {formattedTimestamp}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['details', 'related', 'raw'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium capitalize',
              activeTab === tab
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            {tab}
            {tab === 'related' && relatedEvents && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-700 rounded">
                {relatedEvents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <Section title="Event Information">
              <InfoRow label="Event ID" value={event.id} copiable onCopy={handleCopy} copied={copied} />
              <InfoRow label="Agent ID" value={event.agent_id} copiable onCopy={handleCopy} copied={copied} />
              <InfoRow label="Hostname" value={event.hostname} />
              <InfoRow label="Timestamp" value={formattedTimestamp} />
            </Section>

            {/* Process Info */}
            {(event.process_name || event.process_id) && (
              <Section title="Process Information">
                {event.process_name && (
                  <InfoRow label="Process Name" value={event.process_name} />
                )}
                {event.process_id && (
                  <InfoRow label="PID" value={event.process_id.toString()} />
                )}
                {event.parent_process_id && (
                  <InfoRow label="Parent PID" value={event.parent_process_id.toString()} />
                )}
                {event.command_line && (
                  <InfoRow
                    label="Command Line"
                    value={event.command_line}
                    copiable
                    onCopy={handleCopy}
                    copied={copied}
                    multiline
                  />
                )}
                {event.exe_path && (
                  <InfoRow
                    label="Executable"
                    value={event.exe_path}
                    copiable
                    onCopy={handleCopy}
                    copied={copied}
                  />
                )}
                {event.user && <InfoRow label="User" value={event.user} />}
              </Section>
            )}

            {/* File Info */}
            {event.file_path && (
              <Section title="File Information">
                <InfoRow
                  label="File Path"
                  value={event.file_path}
                  copiable
                  onCopy={handleCopy}
                  copied={copied}
                />
                {event.file_action && <InfoRow label="Action" value={event.file_action} />}
                {event.file_hash && (
                  <InfoRow
                    label="Hash"
                    value={event.file_hash}
                    copiable
                    onCopy={handleCopy}
                    copied={copied}
                  />
                )}
              </Section>
            )}

            {/* Network Info */}
            {event.remote_ip && (
              <Section title="Network Information">
                <InfoRow label="Remote IP" value={event.remote_ip} copiable onCopy={handleCopy} copied={copied} />
                {event.remote_port && (
                  <InfoRow label="Remote Port" value={event.remote_port.toString()} />
                )}
                {event.local_port && (
                  <InfoRow label="Local Port" value={event.local_port.toString()} />
                )}
                {event.protocol && <InfoRow label="Protocol" value={event.protocol} />}
                {event.direction && <InfoRow label="Direction" value={event.direction} />}
              </Section>
            )}

            {/* Registry Info */}
            {event.registry_key && (
              <Section title="Registry Information">
                <InfoRow
                  label="Key"
                  value={event.registry_key}
                  copiable
                  onCopy={handleCopy}
                  copied={copied}
                />
                {event.registry_value && (
                  <InfoRow label="Value" value={event.registry_value} />
                )}
                {event.registry_action && (
                  <InfoRow label="Action" value={event.registry_action} />
                )}
              </Section>
            )}

            {/* Alert Info */}
            {event.alert_source && (
              <Section title="Alert Information">
                <InfoRow label="Source" value={event.alert_source} />
                {event.rule_name && <InfoRow label="Rule" value={event.rule_name} />}
                {event.mitre_tactics && event.mitre_tactics.length > 0 && (
                  <div className="py-2 border-b border-gray-700">
                    <span className="text-sm text-gray-400">MITRE ATT&CK</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {event.mitre_tactics.map((tactic) => (
                        <a
                          key={tactic}
                          href={`https://attack.mitre.org/techniques/${tactic.replace('.', '/')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50"
                        >
                          {tactic}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Actions */}
            <Section title="Actions">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCreateRule('sigma')}
                  disabled={createRule.isPending}
                  className="flex items-center space-x-2 px-3 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm"
                >
                  <FileCode className="w-4 h-4" />
                  <span>Create Sigma Rule</span>
                </button>
                <button
                  onClick={() => handleCreateRule('yara')}
                  disabled={createRule.isPending}
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm"
                >
                  <FileCode className="w-4 h-4" />
                  <span>Create YARA Rule</span>
                </button>
                <button
                  onClick={() => handleCopy(JSON.stringify(event, null, 2), 'event')}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copied === 'event' ? 'Copied!' : 'Copy Event'}</span>
                </button>
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'related' && (
          <div className="space-y-3">
            {loadingRelated ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : relatedEvents && relatedEvents.length > 0 ? (
              relatedEvents.map((relatedEvent) => {
                const RelatedIcon = EVENT_ICONS[relatedEvent.event_type] || Activity;
                return (
                  <div
                    key={relatedEvent.id}
                    onClick={() => onSelectRelatedEvent?.(relatedEvent)}
                    className="flex items-center p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
                  >
                    <div
                      className={clsx(
                        'p-2 rounded mr-3',
                        getEventTypeColor(relatedEvent.event_type)
                      )}
                    >
                      <RelatedIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{relatedEvent.message}</p>
                      <p className="text-xs text-gray-400">
                        {formatDateSafe(relatedEvent.timestamp, 'PPp', 'Unknown')}
                      </p>
                    </div>
                    <Link2 className="w-4 h-4 text-gray-500" />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No related events found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() =>
                  handleCopy(JSON.stringify(event.raw_data || event, null, 2), 'raw')
                }
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                <Copy className="w-4 h-4" />
                <span>{copied === 'raw' ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-4 bg-gray-900 rounded-lg overflow-auto text-sm text-gray-300 font-mono">
              {JSON.stringify(event.raw_data || event, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-300 mb-2">{title}</h4>
      <div className="bg-gray-700/50 rounded-lg">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  copiable,
  onCopy,
  copied,
  multiline,
}: {
  label: string;
  value: string;
  copiable?: boolean;
  onCopy?: (text: string, label: string) => void;
  copied?: string | null;
  multiline?: boolean;
}) {
  const isCopied = copied === label;

  return (
    <div className="flex items-start justify-between py-2 px-3 border-b border-gray-700 last:border-b-0">
      <span className="text-sm text-gray-400 flex-shrink-0 w-32">{label}</span>
      <div className="flex items-start flex-1 min-w-0 ml-4">
        <span
          className={clsx(
            'text-sm text-gray-200 flex-1',
            multiline ? 'whitespace-pre-wrap break-all' : 'truncate'
          )}
          title={value}
        >
          {value}
        </span>
        {copiable && onCopy && (
          <button
            onClick={() => onCopy(value, label)}
            className="ml-2 p-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            {isCopied ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
