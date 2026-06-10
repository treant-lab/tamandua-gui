import * as React from 'react';
import { X, ExternalLink, Shield, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TechniqueDetails,
  DetectionRule,
  useMitreTechnique,
  getCoverageLabel,
  getCoverageColorClass,
  CoverageStatus,
} from '@/hooks/useMitre';

export interface MitreDetailsProps {
  techniqueId: string | null;
  onClose: () => void;
  onSelectTechnique?: (techniqueId: string) => void;
}

function getRuleTypeColor(type: DetectionRule['type']): string {
  switch (type) {
    case 'yara':
      return 'bg-purple-600/20 text-purple-400 border-purple-600/30';
    case 'sigma':
      return 'bg-blue-600/20 text-blue-400 border-blue-600/30';
    case 'ml':
      return 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30';
    case 'behavioral':
      return 'bg-amber-600/20 text-amber-400 border-amber-600/30';
    default:
      return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/30';
  }
}

function getConfidenceColor(confidence: DetectionRule['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'text-emerald-400';
    case 'medium':
      return 'text-amber-400';
    case 'low':
      return 'text-red-400';
    default:
      return 'text-neutral-400';
  }
}

function CoverageStatusBadge({ status }: { status: CoverageStatus }) {
  const colorClass = getCoverageColorClass(status);
  const label = getCoverageLabel(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        colorClass
      )}
    >
      {status === 'full' && <Shield className="w-3 h-3 mr-1" />}
      {status === 'partial' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
}

function formatLastDetection(dateString: string | undefined): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function DetectionRuleCard({ rule }: { rule: DetectionRule }) {
  return (
    <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border',
            getRuleTypeColor(rule.type)
          )}
        >
          {rule.type}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{rule.name}</p>
          <p className="text-xs text-neutral-500 font-mono">{rule.id}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-xs font-medium', getConfidenceColor(rule.confidence))}>
          {rule.confidence}
        </span>
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            rule.enabled ? 'bg-emerald-500' : 'bg-neutral-600'
          )}
          title={rule.enabled ? 'Enabled' : 'Disabled'}
        />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-6 w-32 bg-neutral-800 rounded animate-pulse" />
      <div className="h-4 w-48 bg-neutral-800 rounded animate-pulse" />
      <div className="space-y-2 mt-6">
        <div className="h-20 bg-neutral-800 rounded animate-pulse" />
        <div className="h-20 bg-neutral-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Shield className="w-12 h-12 text-neutral-600 mb-4" />
      <p className="text-neutral-400">Select a technique to view details</p>
      <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">
        Close
      </Button>
    </div>
  );
}

function ErrorState({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <p className="text-red-400">{error}</p>
      <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">
        Close
      </Button>
    </div>
  );
}

export function MitreDetails({
  techniqueId,
  onClose,
  onSelectTechnique,
}: MitreDetailsProps) {
  const { data: technique, isLoading, error } = useMitreTechnique(techniqueId);

  if (!techniqueId) {
    return <EmptyState onClose={onClose} />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !technique) {
    return <ErrorState error="Failed to load technique details" onClose={onClose} />;
  }

  const { coverage } = technique;

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-neutral-400">{technique.id}</span>
            {technique.isSubtechnique && (
              <Badge variant="secondary" className="text-[10px]">
                Sub-technique
              </Badge>
            )}
          </div>
          <h2 className="text-lg font-semibold text-white">{technique.name}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Coverage Status */}
        <div className="flex items-center justify-between">
          <CoverageStatusBadge status={coverage.status} />
          <a
            href={technique.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            MITRE ATT&CK
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Description
          </h3>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {technique.description}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-neutral-800/50 border-neutral-700">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-neutral-400 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">Recent Detections</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {coverage.recentDetections}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-neutral-800/50 border-neutral-700">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-neutral-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Last Detection</span>
              </div>
              <p className="text-sm font-medium text-white">
                {formatLastDetection(coverage.lastDetection)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Platforms */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Platforms
          </h3>
          <div className="flex flex-wrap gap-2">
            {technique.platforms.map((platform) => (
              <Badge key={platform} variant="outline" className="text-xs">
                {platform}
              </Badge>
            ))}
          </div>
        </div>

        {/* Data Sources */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Data Sources
          </h3>
          <div className="flex flex-wrap gap-2">
            {technique.dataSources.map((source) => (
              <Badge key={source} variant="secondary" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        </div>

        {/* Detection Rules */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Detection Rules ({coverage.detectionRules.length})
          </h3>
          {coverage.detectionRules.length > 0 ? (
            <div className="space-y-2">
              {coverage.detectionRules.map((rule) => (
                <DetectionRuleCard key={rule.id} rule={rule} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 italic">
              No detection rules configured for this technique.
            </p>
          )}
        </div>

        {/* Mitigations */}
        {technique.mitigations.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Mitigations
            </h3>
            <div className="space-y-2">
              {technique.mitigations.map((mitigation) => (
                <div
                  key={mitigation.id}
                  className="p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-neutral-500">
                      {mitigation.id}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {mitigation.name}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {mitigation.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Techniques */}
        {technique.relatedTechniques.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Related Techniques
            </h3>
            <div className="flex flex-wrap gap-2">
              {technique.relatedTechniques.map((relatedId) => (
                <button
                  key={relatedId}
                  type="button"
                  onClick={() => onSelectTechnique?.(relatedId)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-primary-400 bg-primary-900/20 rounded hover:bg-primary-900/40 transition-colors"
                >
                  {relatedId}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
