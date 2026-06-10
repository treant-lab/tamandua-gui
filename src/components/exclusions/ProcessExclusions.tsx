import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Cpu,
  Network,
  GitBranch,
  Shield,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe } from '../../utils/dateUtils';
import {
  useExclusionsByType,
  useDeleteExclusion,
  useToggleExclusion,
  type ProcessExclusion,
} from '../../hooks/useExclusions';
import { ExclusionForm } from './ExclusionForm';

interface ProcessExclusionsProps {
  onAdd: (data: any) => void;
  onEdit: (exclusion: ProcessExclusion) => void;
  addPending: boolean;
  editPending: boolean;
}

export function ProcessExclusions({
  onAdd,
  onEdit,
  addPending,
  editPending,
}: ProcessExclusionsProps) {
  const { data: exclusions, isLoading } = useExclusionsByType('process');
  const deleteExclusion = useDeleteExclusion();
  const toggleExclusion = useToggleExclusion();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExclusion, setEditingExclusion] = useState<ProcessExclusion | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const processExclusions = (exclusions?.filter((e) => e.type === 'process') || []) as ProcessExclusion[];

  const filteredExclusions = processExclusions.filter((e) =>
    e.process_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.process_path?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.publisher?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            Trust specific processes by name, path, or publisher. Can exclude child processes and network activity.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Process</span>
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search processes..."
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
                    <Cpu className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium truncate">
                          {exclusion.process_name || exclusion.process_path?.split(/[/\\]/).pop()}
                        </p>
                        {exclusion.publisher && (
                          <span className="flex items-center space-x-1 text-xs text-gray-400">
                            <Shield className="w-3 h-3" />
                            <span>{exclusion.publisher}</span>
                          </span>
                        )}
                      </div>
                      {exclusion.process_path && (
                        <p className="font-mono text-xs text-gray-400 truncate mt-1" title={exclusion.process_path}>
                          {exclusion.process_path}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {exclusion.include_child_processes && (
                          <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs flex items-center space-x-1">
                            <GitBranch className="w-3 h-3" />
                            <span>Child Processes</span>
                          </span>
                        )}
                        {exclusion.exclude_network_activity && (
                          <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs flex items-center space-x-1">
                            <Network className="w-3 h-3" />
                            <span>Network Excluded</span>
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
          <Cpu className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No process exclusions configured</p>
          <p className="text-sm mt-1">Add processes that should be trusted</p>
        </div>
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <ExclusionForm
          type="process"
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={addPending}
        />
      )}

      {/* Edit Form Modal */}
      {editingExclusion && (
        <ExclusionForm
          type="process"
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
