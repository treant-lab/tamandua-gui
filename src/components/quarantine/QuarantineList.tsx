import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  Calendar,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import clsx from 'clsx';
import { formatBytes } from '../../lib/utils';
import type { QuarantinedFile, QuarantineFilter } from '../../hooks/useQuarantine';

interface QuarantineListProps {
  files: QuarantinedFile[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onFileSelect: (file: QuarantinedFile) => void;
  filter: QuarantineFilter;
  onFilterChange: (filter: QuarantineFilter) => void;
  isLoading: boolean;
}

type SortField = 'filename' | 'original_path' | 'size_bytes' | 'quarantined_at' | 'threat_name' | 'expires_at';

export function QuarantineList({
  files,
  selectedIds,
  onSelectionChange,
  onFileSelect,
  filter,
  onFilterChange,
  isLoading,
}: QuarantineListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('quarantined_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sort files locally
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      // Handle dates safely
      if (sortField === 'quarantined_at' || sortField === 'expires_at') {
        try {
          const dateA = new Date(aVal as string);
          const dateB = new Date(bVal as string);
          aVal = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
          bVal = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        } catch {
          aVal = 0;
          bVal = 0;
        }
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [files, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === files.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(files.map((f) => f.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-500" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary-500" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary-500" />
    );
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    try {
      const date = parseISO(expiresAt);
      if (isNaN(date.getTime())) return 0;
      return differenceInDays(date, new Date());
    } catch {
      return 0;
    }
  };

  const getExpiryClass = (expiresAt: string) => {
    const days = getDaysUntilExpiry(expiresAt);
    if (days <= 0) return 'text-red-500';
    if (days <= 7) return 'text-orange-500';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by filename, path, or threat..."
            value={filter.search || ''}
            onChange={(e) =>
              onFilterChange({ ...filter, search: e.target.value || undefined })
            }
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            'btn flex items-center space-x-2',
            showFilters ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300'
          )}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card bg-gray-750 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Severity */}
            <div>
              <label className="block text-sm font-medium mb-2">Severity</label>
              <select
                value={filter.severity || ''}
                onChange={(e) =>
                  onFilterChange({ ...filter, severity: e.target.value || undefined })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              >
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Threat Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Threat Type</label>
              <select
                value={filter.threat_type || ''}
                onChange={(e) =>
                  onFilterChange({ ...filter, threat_type: e.target.value || undefined })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
              >
                <option value="">All</option>
                <option value="trojan">Trojan</option>
                <option value="ransomware">Ransomware</option>
                <option value="worm">Worm</option>
                <option value="backdoor">Backdoor</option>
                <option value="dropper">Dropper</option>
                <option value="spyware">Spyware</option>
                <option value="adware">Adware</option>
                <option value="pup">PUP</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-2">Date From</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={filter.date_from || ''}
                  onChange={(e) =>
                    onFilterChange({ ...filter, date_from: e.target.value || undefined })
                  }
                  className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-2">Date To</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={filter.date_to || ''}
                  onChange={(e) =>
                    onFilterChange({ ...filter, date_to: e.target.value || undefined })
                  }
                  className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() =>
                onFilterChange({
                  limit: filter.limit,
                  offset: filter.offset,
                })
              }
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}

      {/* Selection Info */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary-900/30 border border-primary-700 rounded-lg px-4 py-3">
          <span className="text-primary-300">
            {selectedIds.size} file{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => onSelectionChange(new Set())}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="pb-3 px-4 w-12">
                <button
                  onClick={handleSelectAll}
                  className="text-gray-400 hover:text-white"
                >
                  {selectedIds.size === files.length && files.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-primary-500" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
              </th>
              <th className="pb-3 px-4">
                <button
                  onClick={() => handleSort('filename')}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white"
                >
                  <span>Filename</span>
                  {renderSortIcon('filename')}
                </button>
              </th>
              <th className="pb-3 px-4 hidden lg:table-cell">
                <button
                  onClick={() => handleSort('original_path')}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white"
                >
                  <span>Original Path</span>
                  {renderSortIcon('original_path')}
                </button>
              </th>
              <th className="pb-3 px-4">
                <button
                  onClick={() => handleSort('size_bytes')}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white"
                >
                  <span>Size</span>
                  {renderSortIcon('size_bytes')}
                </button>
              </th>
              <th className="pb-3 px-4">
                <button
                  onClick={() => handleSort('quarantined_at')}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white"
                >
                  <span>Quarantined</span>
                  {renderSortIcon('quarantined_at')}
                </button>
              </th>
              <th className="pb-3 px-4">
                <button
                  onClick={() => handleSort('threat_name')}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white"
                >
                  <span>Threat</span>
                  {renderSortIcon('threat_name')}
                </button>
              </th>
              <th className="pb-3 px-4">
                <button
                  onClick={() => handleSort('expires_at')}
                  className="flex items-center space-x-1 text-gray-300 hover:text-white"
                >
                  <span>Expires</span>
                  {renderSortIcon('expires_at')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
                  <p className="text-gray-400 mt-4">Loading files...</p>
                </td>
              </tr>
            ) : sortedFiles.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Trash2 className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No quarantined files found</p>
                </td>
              </tr>
            ) : (
              sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  onClick={() => onFileSelect(file)}
                  className={clsx(
                    'border-b border-gray-700 cursor-pointer transition-colors',
                    selectedIds.has(file.id)
                      ? 'bg-primary-900/20'
                      : 'hover:bg-gray-750'
                  )}
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOne(file.id);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      {selectedIds.has(file.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className={getSeverityBadgeClass(file.severity)}>
                        {file.severity.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium truncate max-w-[200px]">
                        {file.filename}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className="text-gray-400 truncate max-w-[300px] block">
                      {file.original_path}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    {formatBytes(file.size_bytes)}
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    {format(parseISO(file.quarantined_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-orange-400 truncate max-w-[150px] block">
                      {file.threat_name}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={getExpiryClass(file.expires_at)}>
                      {getDaysUntilExpiry(file.expires_at) <= 0
                        ? 'Expired'
                        : `${getDaysUntilExpiry(file.expires_at)}d`}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getSeverityBadgeClass(severity: string): string {
  const classes = {
    critical: 'w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-red-900 text-red-200',
    high: 'w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-orange-900 text-orange-200',
    medium: 'w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-yellow-900 text-yellow-200',
    low: 'w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-blue-900 text-blue-200',
  };
  return classes[severity as keyof typeof classes] || classes.low;
}
