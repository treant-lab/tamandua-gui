import { useState, useCallback } from 'react';
import {
  Shield,
  Download,
  Upload,
  History,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { formatDateSafe } from '../utils/dateUtils';
import { useToast } from '../components/Toast';
import {
  useExclusions,
  useAddExclusion,
  useUpdateExclusion,
  useExclusionAuditLog,
  useSuggestedExclusions,
  useRiskyExclusions,
  useExportExclusions,
  useImportExclusions,
  useApplySuggestedExclusion,
  type ExclusionType,
  type Exclusion,
  type SuggestedExclusion,
  getExclusionTypeLabel,
} from '../hooks/useExclusions';
import { ExclusionTabs } from '../components/exclusions/ExclusionTabs';
import { PathExclusions } from '../components/exclusions/PathExclusions';
import { ProcessExclusions } from '../components/exclusions/ProcessExclusions';
import { ExtensionExclusions } from '../components/exclusions/ExtensionExclusions';
import { HashExclusions } from '../components/exclusions/HashExclusions';
import { downloadFile } from '../lib/utils';

export function Exclusions() {
  const [activeTab, setActiveTab] = useState<ExclusionType>('path');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'tamandua' | 'crowdstrike' | 'defender'>('json');
  const isWindows = navigator.platform.toLowerCase().includes('win');
  const toast = useToast();

  const { data: allExclusions } = useExclusions();
  const { data: auditLog } = useExclusionAuditLog(50);
  const { data: suggestions } = useSuggestedExclusions();
  const { data: riskyExclusions } = useRiskyExclusions();

  const addExclusion = useAddExclusion();
  const updateExclusion = useUpdateExclusion();
  const exportExclusions = useExportExclusions();
  const importExclusions = useImportExclusions();
  const applySuggestion = useApplySuggestedExclusion();

  // Count exclusions by type
  const counts = {
    path: allExclusions?.filter((e) => e.type === 'path').length || 0,
    process: allExclusions?.filter((e) => e.type === 'process').length || 0,
    extension: allExclusions?.filter((e) => e.type === 'extension').length || 0,
    hash: allExclusions?.filter((e) => e.type === 'hash').length || 0,
  };

  const handleAddExclusion = useCallback(async (data: any) => {
    await addExclusion.mutateAsync(data);
  }, [addExclusion]);

  const handleUpdateExclusion = useCallback(async (data: Exclusion) => {
    await updateExclusion.mutateAsync(data);
  }, [updateExclusion]);

  const handleExport = useCallback(async () => {
    try {
      const content = await exportExclusions.mutateAsync('json');
      downloadFile(content, `tamandua-exclusions-${format(new Date(), 'yyyy-MM-dd')}.json`, 'application/json');
      toast.success('Exclusions exported', 'Downloaded exclusions file');
    } catch (error) {
      toast.error('Export failed', String(error));
    }
  }, [exportExclusions, toast]);

  const handleImport = useCallback(async () => {
    try {
      const result = await importExclusions.mutateAsync({ content: importContent, format: importFormat });
      toast.success(
        'Import complete',
        `${result.imported} imported, ${result.failed} failed`
      );
      setShowImport(false);
      setImportContent('');
    } catch (error) {
      toast.error('Import failed', String(error));
    }
  }, [importExclusions, importContent, importFormat, toast]);

  const handleApplySuggestion = useCallback(async (suggestion: SuggestedExclusion) => {
    try {
      await applySuggestion.mutateAsync(suggestion);
      toast.success('Exclusion added', `Applied suggestion for ${suggestion.value}`);
    } catch (error) {
      toast.error('Failed to apply suggestion', String(error));
    }
  }, [applySuggestion, toast]);

  return (
    <div className="p-8 space-y-6" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2" style={{ color: 'var(--fg)' }}>
            <Shield className="w-8 h-8" />
            <span>Exclusions Manager</span>
          </h1>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>
            Configure files, processes, extensions, and hashes to exclude from scanning
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSuggestions(true)}
            className="btn-secondary flex items-center space-x-2"
            title="View suggested exclusions"
          >
            <Lightbulb className="w-4 h-4" />
            <span>Suggestions</span>
            {suggestions && suggestions.length > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: 'var(--emerald-400)', color: 'var(--bg)' }}
              >
                {suggestions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowAuditLog(true)}
            className="btn-secondary flex items-center space-x-2"
            title="View audit log"
          >
            <History className="w-4 h-4" />
            <span>Audit Log</span>
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="btn-secondary flex items-center space-x-2"
            title="Import exclusions"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            disabled={exportExclusions.isPending}
            className="btn-secondary flex items-center space-x-2"
            title="Export exclusions"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Risky exclusions warning */}
      {riskyExclusions && riskyExclusions.length > 0 && (
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(251, 146, 60, 0.1)',
            border: '1px solid var(--orange-500)'
          }}
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--orange-500)' }} />
            <div className="flex-1">
              <h3 className="font-medium" style={{ color: 'var(--orange-400)' }}>Risky Exclusions Detected</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--orange-300)' }}>
                {riskyExclusions.length} exclusion(s) may reduce your security posture:
              </p>
              <ul className="mt-2 space-y-1">
                {riskyExclusions.slice(0, 3).map((warning) => (
                  <li key={warning.exclusion_id} className="text-sm" style={{ color: 'var(--orange-200)' }}>
                    <span className="font-medium">{getExclusionTypeLabel(warning.type)}:</span>{' '}
                    {warning.value} - {warning.reason}
                  </li>
                ))}
                {riskyExclusions.length > 3 && (
                  <li className="text-sm" style={{ color: 'var(--orange-300)' }}>
                    ...and {riskyExclusions.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Path Exclusions" value={counts.path} />
        <StatCard label="Process Exclusions" value={counts.process} />
        <StatCard label="Extension Exclusions" value={counts.extension} />
        <StatCard label="Hash Exclusions" value={counts.hash} />
      </div>

      {/* Tabs */}
      <div
        className="rounded-lg"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)'
        }}
      >
        <ExclusionTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={counts}
        />

        <div className="p-4">
          {activeTab === 'path' && (
            <PathExclusions
              onAdd={handleAddExclusion}
              onEdit={handleUpdateExclusion}
              addPending={addExclusion.isPending}
              editPending={updateExclusion.isPending}
            />
          )}
          {activeTab === 'process' && (
            <ProcessExclusions
              onAdd={handleAddExclusion}
              onEdit={handleUpdateExclusion}
              addPending={addExclusion.isPending}
              editPending={updateExclusion.isPending}
            />
          )}
          {activeTab === 'extension' && (
            <ExtensionExclusions
              onAdd={handleAddExclusion}
              onEdit={handleUpdateExclusion}
              addPending={addExclusion.isPending}
              editPending={updateExclusion.isPending}
            />
          )}
          {activeTab === 'hash' && (
            <HashExclusions
              onAdd={handleAddExclusion}
              onEdit={handleUpdateExclusion}
              addPending={addExclusion.isPending}
              editPending={updateExclusion.isPending}
            />
          )}
        </div>
      </div>

      {/* Audit Log Modal */}
      {showAuditLog && (
        <Modal title="Exclusion Audit Log" onClose={() => setShowAuditLog(false)}>
          <div className="max-h-96 overflow-y-auto">
            {auditLog && auditLog.length > 0 ? (
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--surface)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        entry.action === 'created' && 'bg-green-900/30 text-green-400',
                        entry.action === 'updated' && 'bg-blue-900/30 text-blue-400',
                        entry.action === 'deleted' && 'bg-red-900/30 text-red-400',
                        entry.action === 'enabled' && 'bg-green-900/30 text-green-400',
                        entry.action === 'disabled' && 'bg-gray-600 text-gray-300'
                      )}>
                        {entry.action.toUpperCase()}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {formatDateSafe(entry.timestamp, 'PPp')}
                      </span>
                    </div>
                    <p className="mt-1" style={{ color: 'var(--fg)' }}>{entry.details}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>By {entry.user}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8" style={{ color: 'var(--muted)' }}>No audit entries found</p>
            )}
          </div>
        </Modal>
      )}

      {/* Suggestions Modal */}
      {showSuggestions && (
        <Modal title="Suggested Exclusions" onClose={() => setShowSuggestions(false)}>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Based on installed software, these exclusions may reduce false positives:
          </p>
          <div className="max-h-96 overflow-y-auto">
            {suggestions && suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--surface)' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
                          >
                            {getExclusionTypeLabel(suggestion.type)}
                          </span>
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs',
                            suggestion.confidence === 'high' && 'bg-green-900/30 text-green-400',
                            suggestion.confidence === 'medium' && 'bg-yellow-900/30 text-yellow-400',
                            suggestion.confidence === 'low' && 'bg-gray-600 text-gray-300'
                          )}>
                            {suggestion.confidence} confidence
                          </span>
                        </div>
                        <p className="font-mono text-sm mt-2" style={{ color: 'var(--fg)' }}>{suggestion.value}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{suggestion.reason}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.7 }}>Software: {suggestion.software}</p>
                      </div>
                      <button
                        onClick={() => handleApplySuggestion(suggestion)}
                        disabled={applySuggestion.isPending}
                        className="text-sm px-3 py-1 ml-4 rounded transition-colors"
                        style={{
                          backgroundColor: 'var(--emerald-400)',
                          color: 'var(--bg)',
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8" style={{ color: 'var(--muted)' }}>
                No suggestions available. Suggestions are based on detected software.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal title="Import Exclusions" onClose={() => setShowImport(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg)' }}>Format</label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as any)}
                className="w-full rounded-lg px-3 py-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)'
                }}
              >
                <option value="json">Tamandua JSON</option>
                <option value="tamandua">Tamandua Config</option>
                <option value="crowdstrike">CrowdStrike</option>
                {isWindows && <option value="defender">Windows Defender</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--fg)' }}>Content</label>
              <textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder="Paste your exclusions here..."
                className="w-full rounded-lg px-3 py-2 h-48 resize-none font-mono text-sm"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)'
                }}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportContent('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importExclusions.isPending || !importContent.trim()}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--emerald-400)',
                  color: 'var(--bg)',
                }}
              >
                {importExclusions.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Helper components

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)'
      }}
    >
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: 'var(--fg)' }}>{value}</p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
