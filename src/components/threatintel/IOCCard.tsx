import { useState } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  Globe,
  Hash,
  Mail,
  Link2,
  Server,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IOC,
  IOCType,
  ThreatType,
  ConfidenceLevel,
  getIOCTypeLabel,
  getThreatTypeLabel,
  getConfidenceColor,
  getThreatTypeColor,
} from '@/hooks/useThreatIntel';

interface IOCCardProps {
  ioc: IOC;
  onViewDetails?: (ioc: IOC) => void;
  onCheckMatches?: (ioc: IOC) => void;
  isCompact?: boolean;
}

// Icon mapping for IOC types
function getIOCTypeIcon(type: IOCType): React.ReactNode {
  const iconClass = 'w-4 h-4';
  const icons: Record<IOCType, React.ReactNode> = {
    ip: <Server className={iconClass} />,
    domain: <Globe className={iconClass} />,
    md5: <Hash className={iconClass} />,
    sha1: <Hash className={iconClass} />,
    sha256: <Hash className={iconClass} />,
    url: <Link2 className={iconClass} />,
    email: <Mail className={iconClass} />,
  };
  return icons[type] || <AlertTriangle className={iconClass} />;
}

// Get background color based on IOC type
function getIOCTypeBgColor(type: IOCType): string {
  const colors: Record<IOCType, string> = {
    ip: 'bg-purple-900/30 text-purple-400 border-purple-700',
    domain: 'bg-blue-900/30 text-blue-400 border-blue-700',
    md5: 'bg-amber-900/30 text-amber-400 border-amber-700',
    sha1: 'bg-amber-900/30 text-amber-400 border-amber-700',
    sha256: 'bg-amber-900/30 text-amber-400 border-amber-700',
    url: 'bg-cyan-900/30 text-cyan-400 border-cyan-700',
    email: 'bg-pink-900/30 text-pink-400 border-pink-700',
  };
  return colors[type] || 'bg-gray-700 text-gray-400';
}

export function IOCCard({ ioc, onViewDetails, onCheckMatches, isCompact = false }: IOCCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(ioc.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewDetails = () => {
    onViewDetails?.(ioc);
  };

  const handleCheckMatches = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckMatches?.(ioc);
  };

  // Format the IOC value for display (truncate if needed)
  const displayValue = ioc.value.length > 50 ? `${ioc.value.substring(0, 47)}...` : ioc.value;

  // Calculate time since last seen
  const lastSeenText = formatDistanceToNow(parseISO(ioc.last_seen), { addSuffix: true });

  if (isCompact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
          'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-700'
        )}
        onClick={handleViewDetails}
      >
        {/* Type Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded border',
            getIOCTypeBgColor(ioc.type)
          )}
        >
          {getIOCTypeIcon(ioc.type)}
        </div>

        {/* Value */}
        <div className="flex-1 min-w-0">
          <code className="text-sm font-mono text-gray-200 truncate block">{displayValue}</code>
        </div>

        {/* Confidence Badge */}
        <div
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded border',
            getConfidenceColor(ioc.confidence)
          )}
        >
          {ioc.confidence.charAt(0).toUpperCase() + ioc.confidence.slice(1)}
        </div>

        {/* Copy Button */}
        <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8">
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        'bg-gray-800 border-gray-700',
        expanded && 'border-gray-600'
      )}
    >
      {/* Main Row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-700 rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Type Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg border',
            getIOCTypeBgColor(ioc.type)
          )}
        >
          {getIOCTypeIcon(ioc.type)}
        </div>

        {/* IOC Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono text-gray-100 truncate">{displayValue}</code>
            <Button variant="ghost" size="icon" onClick={handleCopy} className="h-6 w-6">
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{getIOCTypeLabel(ioc.type)}</span>
            <span className="text-gray-600">|</span>
            <span>Source: {ioc.source}</span>
            <span className="text-gray-600">|</span>
            <span>Last seen {lastSeenText}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {/* Threat Type */}
          <div
            className={cn(
              'px-2 py-1 text-xs font-medium rounded',
              getThreatTypeColor(ioc.threat_type)
            )}
          >
            {getThreatTypeLabel(ioc.threat_type)}
          </div>

          {/* Confidence */}
          <div
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border',
              getConfidenceColor(ioc.confidence)
            )}
          >
            {ioc.confidence_score}%
          </div>

          {/* Matched Detections */}
          {ioc.matched_detections > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-900/30 text-red-400 border border-red-700">
              <Activity className="w-3 h-3" />
              <span>{ioc.matched_detections}</span>
            </div>
          )}

          {/* Active Status */}
          {!ioc.is_active && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}

          {/* Expand/Collapse */}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Left Column */}
            <div className="space-y-3">
              {/* Description */}
              {ioc.description && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Description
                  </label>
                  <p className="text-sm text-gray-300">{ioc.description}</p>
                </div>
              )}

              {/* Tags */}
              {ioc.tags && ioc.tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {ioc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* MITRE Tactics */}
              {ioc.mitre_tactics && ioc.mitre_tactics.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    MITRE ATT&CK
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {ioc.mitre_tactics.map((tactic) => (
                      <span
                        key={tactic}
                        className="px-2 py-0.5 text-xs bg-purple-900/30 text-purple-300 rounded border border-purple-700"
                      >
                        {tactic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Timeline */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">First Seen</label>
                  <p className="text-sm text-gray-300">
                    {format(parseISO(ioc.first_seen), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Last Seen</label>
                  <p className="text-sm text-gray-300">
                    {format(parseISO(ioc.last_seen), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Confidence Details */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Confidence Score
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        ioc.confidence_score >= 90
                          ? 'bg-red-500'
                          : ioc.confidence_score >= 70
                          ? 'bg-orange-500'
                          : ioc.confidence_score >= 50
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                      )}
                      style={{ width: `${ioc.confidence_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-300">{ioc.confidence_score}%</span>
                </div>
              </div>

              {/* Full Value (for long values) */}
              {ioc.value.length > 50 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Full Value</label>
                  <code className="text-xs font-mono text-gray-300 break-all bg-gray-900 p-2 rounded block">
                    {ioc.value}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700">
            <Button variant="outline" size="sm" onClick={handleViewDetails}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Details
            </Button>
            {onCheckMatches && (
              <Button variant="outline" size="sm" onClick={handleCheckMatches}>
                <Shield className="w-4 h-4 mr-2" />
                Check Matches
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" />
              {copied ? 'Copied!' : 'Copy IOC'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
