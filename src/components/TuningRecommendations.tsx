import { useState, useEffect } from 'react';
import {
  Lightbulb,
  Settings,
  Trash2,
  Edit,
  Check,
  X,
  AlertTriangle,
  TrendingDown,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe } from '../utils/dateUtils';

interface TuningRecommendation {
  id: string;
  recommendation_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  title: string;
  description: string;
  rationale: string;
  impact_assessment?: string;
  action_data: Record<string, unknown>;
  confidence: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_fp_reduction: number;
  status: string;
  expires_at?: string;
  created_at: string;
}

interface FPPattern {
  id: string;
  pattern_type: string;
  pattern_data: Record<string, unknown>;
  detection_source?: string;
  fp_count: number;
  tp_count: number;
  fp_confidence: number;
  status: string;
  suppression_created: boolean;
}

interface TuningRecommendationsProps {
  organizationId: string;
  onFetchRecommendations: () => Promise<TuningRecommendation[]>;
  onFetchPatterns: () => Promise<FPPattern[]>;
  onApplyRecommendation: (id: string) => Promise<void>;
  onConfirmPattern: (id: string, createSuppression: boolean) => Promise<void>;
  onRejectPattern: (id: string) => Promise<void>;
}

const PRIORITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: AlertTriangle },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: AlertTriangle },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Lightbulb },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: Lightbulb },
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Settings }> = {
  threshold_adjustment: { label: 'Threshold Adjustment', icon: Settings },
  exclusion_rule: { label: 'Exclusion Rule', icon: Shield },
  disable_rule: { label: 'Disable Rule', icon: Trash2 },
  modify_rule: { label: 'Modify Rule', icon: Edit },
  baseline_update: { label: 'Update Baseline', icon: TrendingDown },
};

const PATTERN_TYPE_LABELS: Record<string, string> = {
  process: 'Process Pattern',
  path: 'File Path Pattern',
  rule: 'Rule Pattern',
  user: 'User Pattern',
  host: 'Host Pattern',
  time: 'Time Pattern',
  combined: 'Combined Pattern',
};

export function TuningRecommendations({
  organizationId,
  onFetchRecommendations,
  onFetchPatterns,
  onApplyRecommendation,
  onConfirmPattern,
  onRejectPattern,
}: TuningRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<TuningRecommendation[]>([]);
  const [patterns, setPatterns] = useState<FPPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'patterns'>('recommendations');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [recs, pats] = await Promise.all([
        onFetchRecommendations(),
        onFetchPatterns(),
      ]);
      setRecommendations(recs);
      setPatterns(pats);
    } catch (error) {
      console.error('Failed to fetch tuning data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyRecommendation = async (id: string) => {
    setApplyingId(id);
    try {
      await onApplyRecommendation(id);
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'applied' } : r))
      );
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
    } finally {
      setApplyingId(null);
    }
  };

  const handleConfirmPattern = async (id: string, createSuppression: boolean) => {
    try {
      await onConfirmPattern(id, createSuppression);
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: 'confirmed', suppression_created: createSuppression } : p
        )
      );
    } catch (error) {
      console.error('Failed to confirm pattern:', error);
    }
  };

  const handleRejectPattern = async (id: string) => {
    try {
      await onRejectPattern(id);
      setPatterns((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'rejected' } : p))
      );
    } catch (error) {
      console.error('Failed to reject pattern:', error);
    }
  };

  const pendingRecommendations = recommendations.filter((r) => r.status === 'pending');
  const pendingPatterns = patterns.filter((p) => p.status === 'detected' && !p.suppression_created);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tuning Recommendations</h2>
          <p className="text-gray-400">AI-generated suggestions to reduce false positives</p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <Lightbulb className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="text-2xl font-bold">{pendingRecommendations.length}</div>
              <div className="text-sm text-gray-400">Pending Recommendations</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-2xl font-bold">{pendingPatterns.length}</div>
              <div className="text-sm text-gray-400">Detected Patterns</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <TrendingDown className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-2xl font-bold">
                {Math.round(
                  pendingRecommendations.reduce((sum, r) => sum + (r.estimated_fp_reduction || 0), 0) * 100
                )}%
              </div>
              <div className="text-sm text-gray-400">Potential FP Reduction</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('recommendations')}
          className={clsx(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'recommendations'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          Recommendations ({pendingRecommendations.length})
        </button>
        <button
          onClick={() => setActiveTab('patterns')}
          className={clsx(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'patterns'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          )}
        >
          FP Patterns ({pendingPatterns.length})
        </button>
      </div>

      {/* Recommendations List */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {pendingRecommendations.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending recommendations</p>
              <p className="text-sm">The system will analyze your alerts and generate suggestions</p>
            </div>
          ) : (
            pendingRecommendations.map((rec) => {
              const config = PRIORITY_CONFIG[rec.priority];
              const typeConfig = TYPE_CONFIG[rec.recommendation_type] || {
                label: rec.recommendation_type,
                icon: Settings,
              };
              const TypeIcon = typeConfig.icon;
              const isExpanded = expandedItems.has(rec.id);
              const isApplying = applyingId === rec.id;

              return (
                <div
                  key={rec.id}
                  className={clsx('card border-l-4', config.bg)}
                >
                  {/* Header */}
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleExpanded(rec.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <TypeIcon className={clsx('w-5 h-5 mt-0.5', config.color)} />
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={clsx('text-xs px-2 py-0.5 rounded', config.bg, config.color)}>
                            {rec.priority.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-400">{typeConfig.label}</span>
                        </div>
                        <h3 className="font-medium">{rec.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">{rec.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-sm text-green-400">
                          -{Math.round(rec.estimated_fp_reduction * 100)}% FPs
                        </div>
                        <div className="text-xs text-gray-400">
                          {Math.round(rec.confidence * 100)}% confidence
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                      {/* Rationale */}
                      {rec.rationale && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-1">Rationale</h4>
                          <p className="text-sm text-gray-400">{rec.rationale}</p>
                        </div>
                      )}

                      {/* Impact Assessment */}
                      {rec.impact_assessment && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-1">Impact</h4>
                          <p className="text-sm text-gray-400">{rec.impact_assessment}</p>
                        </div>
                      )}

                      {/* Action Data */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-1">Proposed Action</h4>
                        <pre className="text-xs bg-gray-800 rounded p-2 overflow-x-auto">
                          {JSON.stringify(rec.action_data, null, 2)}
                        </pre>
                      </div>

                      {/* Expiry */}
                      {rec.expires_at && (
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>Expires: {formatDateSafe(rec.expires_at, 'PP')}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-3 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyRecommendation(rec.id);
                          }}
                          disabled={isApplying}
                          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isApplying ? 'Applying...' : 'Apply'}</span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Patterns List */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          {pendingPatterns.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending FP patterns</p>
              <p className="text-sm">Patterns are detected from analyst feedback on alerts</p>
            </div>
          ) : (
            pendingPatterns.map((pattern) => {
              const confidencePct = Math.round(pattern.fp_confidence * 100);
              const isHighConfidence = pattern.fp_confidence >= 0.8;

              return (
                <div
                  key={pattern.id}
                  className={clsx(
                    'card border-l-4',
                    isHighConfidence
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-700/50 border-gray-600'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-600 rounded">
                          {PATTERN_TYPE_LABELS[pattern.pattern_type] || pattern.pattern_type}
                        </span>
                        {pattern.detection_source && (
                          <span className="text-xs px-2 py-0.5 bg-gray-600 rounded">
                            {pattern.detection_source}
                          </span>
                        )}
                        {isHighConfidence && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                            High Confidence
                          </span>
                        )}
                      </div>
                      <div className="text-sm mb-2">
                        <code className="bg-gray-800 px-2 py-1 rounded">
                          {JSON.stringify(pattern.pattern_data)}
                        </code>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>{pattern.fp_count} FPs</span>
                        <span>{pattern.tp_count} TPs</span>
                        <span className={isHighConfidence ? 'text-green-400' : ''}>
                          {confidencePct}% confidence
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleConfirmPattern(pattern.id, true)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>Create Suppression</span>
                      </button>
                      <button
                        onClick={() => handleRejectPattern(pattern.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
