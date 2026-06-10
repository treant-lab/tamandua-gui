import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  FileType,
  AlertTriangle,
  Clock,
  Package,
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
  type ExtensionExclusion,
  EXTENSION_PRESETS,
  isRiskyExtension,
  normalizeExtension,
  parseExtensionList,
} from '../../hooks/useExclusions';
import { ExclusionForm } from './ExclusionForm';

interface ExtensionExclusionsProps {
  onAdd: (data: any) => void;
  onEdit: (exclusion: ExtensionExclusion) => void;
  addPending: boolean;
  editPending: boolean;
}

export function ExtensionExclusions({
  onAdd,
  onEdit,
  addPending,
  editPending,
}: ExtensionExclusionsProps) {
  const { data: exclusions, isLoading } = useExclusionsByType('extension');
  const deleteExclusion = useDeleteExclusion();
  const toggleExclusion = useToggleExclusion();
  const bulkAdd = useBulkAddExclusions();
  const toast = useToast();
  const confirm = useConfirm();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState<ExtensionExclusion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkExtensions, setBulkExtensions] = useState('');
  const [bulkReason, setBulkReason] = useState('');

  const extensionExclusions = (exclusions?.filter((e) => e.type === 'extension') || []) as ExtensionExclusion[];

  const filteredExclusions = extensionExclusions.filter((e) =>
    e.extension.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by risky status
  const riskyExclusions = filteredExclusions.filter((e) => isRiskyExtension(e.extension));
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
      title: 'Delete Extension Exclusion',
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

  const handleBulkAdd = async () => {
    const extensions = parseExtensionList(bulkExtensions);
    if (extensions.length === 0) return;

    const newExclusions = extensions.map((ext) => ({
      type: 'extension' as const,
      extension: ext,
      is_risky: isRiskyExtension(ext),
      enabled: true,
      created_by: 'current_user',
      reason: bulkReason,
    }));

    await bulkAdd.mutateAsync(newExclusions);
    setShowBulkAdd(false);
    setBulkExtensions('');
    setBulkReason('');
  };

  const handleAddPreset = async (presetName: keyof typeof EXTENSION_PRESETS) => {
    const extensions = EXTENSION_PRESETS[presetName];
    const existingExtensions = extensionExclusions.map((e) => normalizeExtension(e.extension));

    const newExtensions = extensions.filter((ext) => !existingExtensions.includes(ext));

    if (newExtensions.length === 0) {
      toast.info('Already excluded', `All ${presetName} extensions are already excluded.`);
      return;
    }

    const newExclusions = newExtensions.map((ext) => ({
      type: 'extension' as const,
      extension: ext,
      is_risky: isRiskyExtension(ext),
      enabled: true,
      created_by: 'current_user',
      reason: `${presetName.charAt(0).toUpperCase() + presetName.slice(1)} preset`,
    }));

    await bulkAdd.mutateAsync(newExclusions);
    toast.success('Preset added', `Added ${newExtensions.length} ${presetName} extensions`);
  };

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
            Skip scanning files with specific extensions. Use presets for common file types.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBulkAdd(true)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Package className="w-4 h-4" />
            <span>Bulk Add</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Extension</span>
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">Quick presets:</span>
        {Object.keys(EXTENSION_PRESETS).map((presetName) => (
          <button
            key={presetName}
            onClick={() => handleAddPreset(presetName as keyof typeof EXTENSION_PRESETS)}
            disabled={bulkAdd.isPending}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm capitalize"
          >
            {presetName}
          </button>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search extensions..."
          className="w-full md:w-64 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Risky extensions warning */}
      {riskyExclusions.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-400">Risky Extensions Excluded</p>
              <p className="text-sm text-orange-300 mt-1">
                You have {riskyExclusions.length} risky extension(s) excluded that are commonly
                associated with executable files. This may allow malware to bypass detection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exclusions list */}
      {filteredExclusions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredExclusions.map((exclusion) => {
            const risky = isRiskyExtension(exclusion.extension);
            const isExpired = exclusion.expires_at && new Date(exclusion.expires_at) < new Date();
            const isExpiringSoon = exclusion.expires_at &&
              new Date(exclusion.expires_at) > new Date() &&
              new Date(exclusion.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            return (
              <div
                key={exclusion.id}
                className={clsx(
                  'p-3 bg-gray-700 rounded-lg border',
                  !exclusion.enabled && 'opacity-60',
                  risky ? 'border-orange-600' : 'border-gray-600'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileType className={clsx(
                      'w-5 h-5',
                      risky ? 'text-orange-500' : 'text-blue-500'
                    )} />
                    <span className="font-mono font-medium">
                      {exclusion.extension}
                    </span>
                    {risky && (
                      <span title="Risky extension">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleToggle(exclusion.id, exclusion.enabled)}
                      className="p-1 hover:bg-gray-600 rounded"
                      title={exclusion.enabled ? 'Disable' : 'Enable'}
                    >
                      {exclusion.enabled ? (
                        <ToggleRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingExclusion(exclusion)}
                      className="p-1 hover:bg-gray-600 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(exclusion.id)}
                      className="p-1 hover:bg-gray-600 rounded text-red-400"
                      title="Delete"
                      disabled={deleteExclusion.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {(exclusion.reason || exclusion.expires_at) && (
                  <div className="mt-2 space-y-1">
                    {exclusion.reason && (
                      <p className="text-xs text-gray-400 truncate">
                        {exclusion.reason}
                      </p>
                    )}
                    {exclusion.expires_at && !isExpired && (
                      <span className={clsx(
                        'inline-flex items-center space-x-1 text-xs',
                        isExpiringSoon ? 'text-yellow-400' : 'text-gray-500'
                      )}>
                        <Clock className="w-3 h-3" />
                        <span>Expires {formatDateSafe(exclusion.expires_at, 'MMM d')}</span>
                      </span>
                    )}
                    {isExpired && (
                      <span className="text-xs text-red-400">Expired</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <FileType className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No extension exclusions configured</p>
          <p className="text-sm mt-1">Add file extensions that should be skipped during scanning</p>
        </div>
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <ExclusionForm
          type="extension"
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={addPending}
        />
      )}

      {/* Edit Form Modal */}
      {editingExclusion && (
        <ExclusionForm
          type="extension"
          initialData={editingExclusion}
          isEditing
          onSubmit={handleEdit}
          onCancel={() => setEditingExclusion(null)}
          isPending={editPending}
        />
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Bulk Add Extensions</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Extensions (comma or space separated)
                </label>
                <textarea
                  value={bulkExtensions}
                  onChange={(e) => setBulkExtensions(e.target.value)}
                  placeholder=".log, .tmp, .bak, .cache"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-32 resize-none font-mono"
                />
                {bulkExtensions && (
                  <p className="text-xs text-gray-400 mt-1">
                    Will add: {parseExtensionList(bulkExtensions).join(', ')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Why are these extensions being excluded?"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowBulkAdd(false);
                  setBulkExtensions('');
                  setBulkReason('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAdd}
                disabled={bulkAdd.isPending || parseExtensionList(bulkExtensions).length === 0}
                className="btn-primary"
              >
                {bulkAdd.isPending ? 'Adding...' : 'Add Extensions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
