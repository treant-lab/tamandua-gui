import { Search, Filter, X } from 'lucide-react';
import { ProcessFilter, ProcessStatus, ProcessType, TrustLevel } from '../../hooks/useProcesses';

interface ProcessFiltersProps {
  filter: ProcessFilter;
  onFilterChange: (filter: ProcessFilter) => void;
  users: string[];
  processCount: number;
}

export function ProcessFilters({
  filter,
  onFilterChange,
  users,
  processCount,
}: ProcessFiltersProps) {
  const hasActiveFilters =
    filter.search !== '' ||
    filter.status !== 'all' ||
    filter.trust !== 'all' ||
    filter.type !== 'all' ||
    filter.user !== null;

  const clearFilters = () => {
    onFilterChange({
      search: '',
      status: 'all',
      trust: 'all',
      type: 'all',
      user: null,
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          <span className="text-gray-500">|</span>
          <span>{processCount} processes</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center space-x-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, PID, user, path..."
              value={filter.search}
              onChange={(e) =>
                onFilterChange({ ...filter, search: e.target.value })
              }
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <select
            value={filter.status}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                status: e.target.value as ProcessStatus | 'all',
              })
            }
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="suspended">Suspended</option>
            <option value="stopped">Stopped</option>
            <option value="zombie">Zombie</option>
          </select>
        </div>

        {/* Trust Level */}
        <div>
          <select
            value={filter.trust}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                trust: e.target.value as TrustLevel | 'all',
              })
            }
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Trust</option>
            <option value="trusted">Trusted</option>
            <option value="unknown">Unknown</option>
            <option value="suspicious">Suspicious</option>
          </select>
        </div>

        {/* Type */}
        <div>
          <select
            value={filter.type}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                type: e.target.value as ProcessType | 'all',
              })
            }
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Types</option>
            <option value="system">System</option>
            <option value="service">Service</option>
            <option value="user">User App</option>
          </select>
        </div>
      </div>

      {/* User filter (if many users) */}
      {users.length > 3 && (
        <div className="mt-4">
          <select
            value={filter.user || ''}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                user: e.target.value || null,
              })
            }
            className="w-full md:w-64 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">All Users</option>
            {users.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
