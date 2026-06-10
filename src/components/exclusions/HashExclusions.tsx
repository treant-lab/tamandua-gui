import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Hash,
  Upload,
  ExternalLink,
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
  Copy,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe } from '../../utils/dateUtils';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import {
  useExclusionsByType,
  useDeleteExclusion,
  useToggleExclusion,
  useBulkAddExclusions,
  useVirusTotalLookup,
  type HashExclusion,
  validateSha256,
} from '../../hooks/useExclusions';
import { ExclusionForm } from './ExclusionForm';
import { copyToClipboard } from '../../lib/utils';

interface HashExclusionsProps {
  onAdd: (data: any) => void;
  onEdit: (exclusion: HashExclusion) => void;
  addPending: boolean;
  editPending: boolean;
}

export function HashExclusions({
  onAdd,
  onEdit,
  addPending,
  editPending,
}: HashExclusionsProps) {
  const { data: exclusions, isLoading } = useExclusionsByType('hash');
  const deleteExclusion = useDeleteExclusion();
  const toggleExclusion = useToggleExclusion();
  const bulkAdd = useBulkAddExclusions();
  const virusTotalLookup = useVirusTotalLookup();
  const toast = useToast();
  const confirm = useConfirm();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState<HashExclusion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkContent, setBulkContent] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [lookingUpHash, setLookingUpHash] = useState<string | null>(null);

  const hashExclusions = (exclusions?.filter((e) => e.type === 'hash') || []) as HashExclusion[];

  const filteredExclusions = hashExclusions.filter((e) =>
    e.sha256.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.associated_filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = (data: any) => {
    onAdd(data);
    setShowAddForm(false);
  };

  const handleEdit = (data: any) => {
    onEdit(data);
    setEditingExclusion(null);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Hash Exclusion',
      message: 'Are you sure you want to delete this exclusion?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteExclusion.mutateAsync(id);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    await toggleExclusion.mutateAsync({ exclusionId: id, enabled: !currentEnabled });
  };

  const handleVirusTotalLookup = async (hash: string) => {
    setLookingUpHash(hash);
    try {
      const result = await virusTotalLookup.mutateAsync(hash);
      // Update the exclusion with VT result would be handled by the backend
      toast.success(
        'VirusTotal Result',
        `${result.result} - Detection: ${result.detection_ratio}`
      );
    } catch (error) {
      toast.error('VirusTotal lookup failed', String(error));
    } finally {
      setLookingUpHash(null);
    }
  };

  const handleCopyHash = useCallback(async (hash: string) => {
    await copyToClipboard(hash);
  }, []);

  const handleBulkImport = async () => {
    const lines = bulkContent.split('\n').map((l) => l.trim()).filter((l) => l);
    const hashes: { sha256: string; filename?: string }[] = [];

    for (const line of lines) {
      // Support formats:
      // - Just hash: abc123...
      // - Hash with filename: abc123... filename.exe
      // - Hash,filename: abc123...,filename.exe
      const parts = line.split(/[\s,]+/);
      const hash = parts[0];

      if (validateSha256(hash)) {
        hashes.push({
          sha256: hash.toLowerCase(),
          filename: parts[1] || undefined,
        });
      }
    }

    if (hashes.length === 0) {
      toast.warning('No valid hashes', 'No valid SHA256 hashes found in the input.');
      return;
    }

    const newExclusions = hashes.map((h) => ({
      type: 'hash' as const,
      sha256: h.sha256,
      associated_filename: h.filename,
      virustotal_checked: false,
      enabled: true,
      created_by: 'current_user',
      reason: bulkReason,
    }));

    await bulkAdd.mutateAsync(newExclusions);
    toast.success('Hashes imported', `Imported ${hashes.length} hash exclusion(s)`);
    setShowBulkImport(false);
    setBulkContent('');
    setBulkReason('');
  };

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBulkContent(event.target?.result as string || '');
    };
    reader.readAsText(file);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-gray-400">
            Allow specific files by their SHA256 hash. Useful for known-good files that trigger false positives.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk Import</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Hash</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search hashes or filenames..."
          className="w-full md:w-64 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Exclusions list */}
      {filteredExclusions.length > 0 ? (
        <div className="space-y-2">
          {filteredExclusions.map((exclusion) => {
            const isExpired = exclusion.expires_at && new Date(exclusion.expires_at) < new Date();
            const isExpiringSoon = exclusion.expires_at &&
              new Date(exclusion.expires_at) > new Date() &&
              new Date(exclusion.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const isLookingUp = lookingUpHash === exclusion.sha256;

            return (
              <div
                key={exclusion.id}
                className={clsx(
                  'p-4 bg-gray-700 rounded-lg border border-gray-600',
                  !exclusion.enabled && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <Hash className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <code className="font-mono text-sm break-all">
                          {exclusion.sha256}
                        </code>
                        <button
                          onClick={() => handleCopyHash(exclusion.sha256)}
                          className="p-1 hover:bg-gray-600 rounded flex-shrink-0"
                          title="Copy hash"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      {exclusion.associated_filename && (
                        <div className="flex items-center space-x-1 mt-1 text-sm text-gray-400">
                          <FileText className="w-4 h-4" />
                          <span>{exclusion.associated_filename}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* VirusTotal status */}
                        {exclusion.virustotal_checked && (
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs flex items-center space-x-1',
                            exclusion.virustotal_result === 'clean' && 'bg-green-900/30 text-green-400',
                            exclusion.virustotal_result === 'malicious' && 'bg-red-900/30 text-red-400',
                            exclusion.virustotal_result === 'unknown' && 'bg-gray-600 text-gray-300'
                          )}>
                            {exclusion.virustotal_result === 'clean' && (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                <span>VT Clean</span>
                              </>
                            )}
                            {exclusion.virustotal_result === 'malicious' && (
                              <>
                                <XCircle className="w-3 h-3" />
                                <span>VT Malicious</span>
                              </>
                            )}
                            {exclusion.virustotal_result === 'unknown' && (
                              <>
                                <HelpCircle className="w-3 h-3" />
                                <span>VT Unknown</span>
                              </>
                            )}
                          </span>
                        )}

                        {!exclusion.virustotal_checked && (
                          <button
                            onClick={() => handleVirusTotalLookup(exclusion.sha256)}
                            disabled={isLookingUp || virusTotalLookup.isPending}
                            className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs flex items-center space-x-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{isLookingUp ? 'Checking...' : 'Check VT'}</span>
                          </button>
                        )}

                        {exclusion.expires_at && !isExpired && (
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs flex items-center space-x-1',
                            isExpiringSoon ? 'bg-yellow-900/30 text-yellow-400' : 'bg-gray-600 text-gray-300'
                          )}>
                            <Clock className="w-3 h-3" />
                            <span>Expires {formatDateSafe(exclusion.expires_at, 'MMM d')}</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-2 py-0.5 bg-red-900/30 text-red-400 rounded text-xs">
                            Expired
                          </span>
                        )}
                      </div>

                      {exclusion.reason && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {exclusion.reason}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Added by {exclusion.created_by} on {formatDateSafe(exclusion.created_at, 'PPp')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleToggle(exclusion.id, exclusion.enabled)}
                      className="p-1 hover:bg-gray-600 rounded"
                      title={exclusion.enabled ? 'Disable' : 'Enable'}
                    >
                      {exclusion.enabled ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingExclusion(exclusion)}
                      className="p-1 hover:bg-gray-600 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(exclusion.id)}
                      className="p-1 hover:bg-gray-600 rounded text-red-400"
                      title="Delete"
                      disabled={deleteExclusion.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Hash className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hash exclusions configured</p>
          <p className="text-sm mt-1">Add SHA256 hashes of known-good files to allow</p>
        </div>
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <ExclusionForm
          type="hash"
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={addPending}
        />
      )}

      {/* Edit Form Modal */}
      {editingExclusion && (
        <ExclusionForm
          type="hash"
          initialData={editingExclusion}
          isEditing
          onSubmit={handleEdit}
          onCancel={() => setEditingExclusion(null)}
          isPending={editPending}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Bulk Import Hashes</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Import from file
                </label>
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileImport}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Or paste hashes (one per line)
                </label>
                <textarea
                  value={bulkContent}
                  onChange={(e) => setBulkContent(e.target.value)}
                  placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 myfile.exe&#10;abc123... another-file.dll"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-40 resize-none font-mono text-xs"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Supports: hash only, hash+filename (space or comma separated)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Why are these hashes being allowed?"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowBulkImport(false);
                  setBulkContent('');
                  setBulkReason('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={bulkAdd.isPending || !bulkContent.trim()}
                className="btn-primary"
              >
                {bulkAdd.isPending ? 'Importing...' : 'Import Hashes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
