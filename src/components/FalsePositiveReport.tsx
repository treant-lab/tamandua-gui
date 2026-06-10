import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, HelpCircle, Flag } from 'lucide-react';
import clsx from 'clsx';

interface FalsePositiveReportProps {
  alertId: string;
  alertTitle: string;
  onClose: () => void;
  onSubmit: (data: FPReportData) => Promise<void>;
}

export interface FPReportData {
  alert_id: string;
  classification: 'false_positive' | 'true_positive' | 'benign' | 'suspicious';
  reason?: string;
  reason_detail?: string;
  confidence: number;
  tags: string[];
}

const CLASSIFICATION_OPTIONS = [
  {
    value: 'false_positive',
    label: 'False Positive',
    description: 'This alert is incorrect - no threat exists',
    icon: X,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
  },
  {
    value: 'true_positive',
    label: 'True Positive',
    description: 'This alert correctly identified a threat',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
  },
  {
    value: 'benign',
    label: 'Benign',
    description: 'Activity is real but not malicious',
    icon: HelpCircle,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    value: 'suspicious',
    label: 'Suspicious',
    description: 'Requires further investigation',
    icon: Flag,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/30',
  },
];

const FP_REASONS = [
  { value: 'known_good_software', label: 'Known Good Software' },
  { value: 'authorized_activity', label: 'Authorized Activity' },
  { value: 'baseline_normal', label: 'Normal for this Environment' },
  { value: 'test_environment', label: 'Test/Development Environment' },
  { value: 'false_detection', label: 'Detection Error' },
  { value: 'rule_too_broad', label: 'Rule is Too Broad' },
  { value: 'expected_behavior', label: 'Expected Behavior' },
  { value: 'user_verified', label: 'User Verified Activity' },
  { value: 'other', label: 'Other' },
];

const COMMON_TAGS = [
  'scheduled_task',
  'auto_update',
  'admin_activity',
  'backup_software',
  'monitoring_tool',
  'legitimate_pentest',
  'developer_tools',
  'system_maintenance',
];

export function FalsePositiveReport({
  alertId,
  alertTitle,
  onClose,
  onSubmit,
}: FalsePositiveReportProps) {
  const [classification, setClassification] = useState<FPReportData['classification'] | null>(null);
  const [reason, setReason] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(1.0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!classification) {
      setError('Please select a classification');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        alert_id: alertId,
        classification,
        reason: reason || undefined,
        reason_detail: reasonDetail || undefined,
        confidence,
        tags: selectedTags,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag && !selectedTags.includes(customTag)) {
      setSelectedTags([...selectedTags, customTag]);
      setCustomTag('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <div>
              <h2 className="text-lg font-semibold">Report Alert Classification</h2>
              <p className="text-sm text-gray-400 truncate max-w-md">{alertTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Classification Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Classification *</label>
            <div className="grid grid-cols-2 gap-3">
              {CLASSIFICATION_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = classification === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setClassification(option.value as FPReportData['classification'])}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      isSelected
                        ? option.bgColor + ' border-current'
                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                    )}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <Icon className={clsx('w-5 h-5', isSelected ? option.color : 'text-gray-400')} />
                      <span className={clsx('font-medium', isSelected && option.color)}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason (for FP/Benign) */}
          {(classification === 'false_positive' || classification === 'benign') && (
            <div>
              <label className="block text-sm font-medium mb-2">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              >
                <option value="">Select a reason...</option>
                {FP_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Detailed Explanation */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Additional Details
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder="Provide any additional context about why you classified this alert..."
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 resize-none"
            />
          </div>

          {/* Confidence Slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Confidence Level: {Math.round(confidence * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={confidence * 100}
              onChange={(e) => setConfidence(parseInt(e.target.value) / 100)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Uncertain</span>
              <span>Very Confident</span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm transition-colors',
                    selectedTags.includes(tag)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  {tag.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add custom tag..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
              />
              <button
                onClick={addCustomTag}
                disabled={!customTag}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {selectedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 bg-primary-600/20 text-primary-400 rounded text-xs"
                  >
                    {tag}
                    <button
                      onClick={() => toggleTag(tag)}
                      className="ml-1 hover:text-primary-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!classification || isSubmitting}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              classification
                ? 'bg-primary-600 hover:bg-primary-500 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
