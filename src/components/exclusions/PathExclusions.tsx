import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Folder,
  FolderTree,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe } from '../../utils/dateUtils';
import {
  useExclusionsByType,
  useDeleteExclusion,
  useToggleExclusion,
  type PathExclusion,
  isBroadExclusion,
  isProtectedPath,
} from '../../hooks/useExclusions';
import { ExclusionForm } from './ExclusionForm';

interface PathExclusionsProps {
  onAdd: (data: any) => void;
  onEdit: (exclusion: PathExclusion) => void;
  addPending: boolean;
  editPending: boolean;
}

export function PathExclusions({
  onAdd,
  onEdit,
  addPending,
  editPending,
}: PathExclusionsProps) {
  const { data: exclusions, isLoading } = useExclusionsByType('path');
  const deleteExclusion = useDeleteExclusion();
  const toggleExclusion = useToggleExclusion();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState<PathExclusion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const pathExclusions = (exclusions?.filter((e) => e.type === 'path') || []) as PathExclusion[];

  const filteredExclusions = pathExclusions.filter((e) =>
    e.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    if (confirm('Are you sure you want to delete this exclusion?')) {
      await deleteExclusion.mutateAsync(id);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    await toggleExclusion.mutateAsync({ exclusionId: id, enabled: !currentEnabled });
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            Exclude specific files and folders from scanning. Supports wildcards (* and **).
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Path</span>
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search paths..."
          className="w-full md:w-64 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Exclusions list */}
      {filteredExclusions.length > 0 ? (
        <div className="space-y-2">
          {filteredExclusions.map((exclusion) => {
            const isBroad = isBroadExclusion(exclusion.path);
            const isProtected = isProtectedPath(exclusion.path);
            const isExpired = exclusion.expires_at && new Date(exclusion.expires_at) < new Date();
            const isExpiringSoon = exclusion.expires_at &&
              new Date(exclusion.expires_at) > new Date() &&
              new Date(exclusion.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            return (
              <div
                key={exclusion.id}
                className={clsx(
                  'p-4 bg-gray-700 rounded-lg border',
                  !exclusion.enabled && 'opacity-60',
                  isBroad && 'border-orange-600',
                  isProtected && 'border-red-600',
                  !isBroad && !isProtected && 'border-gray-600'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    {exclusion.is_recursive ? (
                      <FolderTree className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Folder className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm truncate" title={exclusion.path}>
                        {exclusion.path}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {exclusion.is_recursive && (
                          <span className="px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-xs">
                            Recursive
                          </span>
                        )}
                        {exclusion.use_wildcards && (
                          <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs">
                            Wildcards
                          </span>
                        )}
                        {isBroad && (
                          <span className="px-2 py-0.5 bg-orange-900/30 text-orange-400 rounded text-xs flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Broad</span>
                          </span>
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
          <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No path exclusions configured</p>
          <p className="text-sm mt-1">Add paths that should be excluded from scanning</p>
        </div>
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <ExclusionForm
          type="path"
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={addPending}
        />
      )}

      {/* Edit Form Modal */}
      {editingExclusion && (
        <ExclusionForm
          type="path"
          initialData={editingExclusion}
          isEditing
          onSubmit={handleEdit}
          onCancel={() => setEditingExclusion(null)}
          isPending={editPending}
        />
      )}
    </div>
  );
}
