import { useState, useCallback } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LogLevel, LogFilter, useLogModules } from '@/hooks/useLogs';

interface LogFiltersProps {
  filter: LogFilter;
  onFilterChange: (filter: Partial<LogFilter>) => void;
  className?: string;
}

const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: 'bg-gray-500',
  INFO: 'bg-blue-500',
  WARN: 'bg-yellow-500',
  ERROR: 'bg-red-500',
};

export function LogFilters({ filter, onFilterChange, className }: LogFiltersProps) {
  const [searchValue, setSearchValue] = useState(filter.search || '');
  const [showModules, setShowModules] = useState(false);
  const { data: availableModules } = useLogModules();

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    const timeoutId = setTimeout(() => {
      onFilterChange({ search: value || undefined });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [onFilterChange]);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    onFilterChange({ search: undefined });
  }, [onFilterChange]);

  const handleLevelToggle = useCallback((level: LogLevel, checked: boolean) => {
    const currentLevels = filter.levels || [];
    let newLevels: LogLevel[];

    if (checked) {
      newLevels = [...currentLevels, level];
    } else {
      newLevels = currentLevels.filter(l => l !== level);
    }

    onFilterChange({ levels: newLevels.length > 0 ? newLevels : undefined });
  }, [filter.levels, onFilterChange]);

  const handleModuleToggle = useCallback((module: string, checked: boolean) => {
    const currentModules = filter.modules || [];
    let newModules: string[];

    if (checked) {
      newModules = [...currentModules, module];
    } else {
      newModules = currentModules.filter(m => m !== module);
    }

    onFilterChange({ modules: newModules.length > 0 ? newModules : undefined });
  }, [filter.modules, onFilterChange]);

  const handleClearAllFilters = useCallback(() => {
    setSearchValue('');
    onFilterChange({
      levels: undefined,
      modules: undefined,
      search: undefined,
    });
  }, [onFilterChange]);

  const hasActiveFilters = (filter.levels && filter.levels.length > 0) ||
    (filter.modules && filter.modules.length > 0) ||
    filter.search;

  // Group modules by top-level namespace
  const groupedModules = (availableModules || []).reduce((acc, module) => {
    const topLevel = module.split('::')[0];
    if (!acc[topLevel]) {
      acc[topLevel] = [];
    }
    acc[topLevel].push(module);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search and Level Filters Row */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search logs..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8 bg-gray-800 border-gray-700"
          />
          {searchValue && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-2">
          {LOG_LEVELS.map((level) => {
            const isActive = !filter.levels || filter.levels.length === 0 || filter.levels.includes(level);
            return (
              <button
                key={level}
                onClick={() => handleLevelToggle(level, !filter.levels?.includes(level))}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all',
                  filter.levels?.includes(level)
                    ? 'bg-gray-700 ring-2 ring-primary-500/50'
                    : 'bg-gray-800 hover:bg-gray-700 opacity-60 hover:opacity-100'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', LEVEL_COLORS[level])} />
                {level}
              </button>
            );
          })}
        </div>

        {/* Module Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModules(!showModules)}
          className={cn(
            'gap-1.5',
            (filter.modules && filter.modules.length > 0) && 'ring-2 ring-primary-500/50'
          )}
        >
          <Filter className="w-4 h-4" />
          Modules
          {filter.modules && filter.modules.length > 0 && (
            <span className="bg-primary-500 text-white text-xs px-1.5 rounded-full">
              {filter.modules.length}
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 transition-transform', showModules && 'rotate-180')} />
        </Button>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllFilters}
            className="text-gray-400 hover:text-gray-200"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Module Filter Panel */}
      {showModules && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-200">Filter by Module</h4>
            {filter.modules && filter.modules.length > 0 && (
              <button
                onClick={() => onFilterChange({ modules: undefined })}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Clear modules
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto">
            {Object.entries(groupedModules).map(([namespace, modules]) => (
              <div key={namespace}>
                <h5 className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                  {namespace}
                </h5>
                <div className="space-y-1.5">
                  {modules.map((module) => {
                    const shortName = module.split('::').slice(-1)[0];
                    const isChecked = filter.modules?.includes(module) || false;

                    return (
                      <div key={module} className="flex items-center space-x-2">
                        <Checkbox
                          id={module}
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            handleModuleToggle(module, checked === true)
                          }
                        />
                        <Label
                          htmlFor={module}
                          className="text-xs text-gray-300 cursor-pointer truncate"
                          title={module}
                        >
                          {shortName}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {(!availableModules || availableModules.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">
              No modules available
            </p>
          )}
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filter.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200">
              Search: "{filter.search}"
              <button
                onClick={handleClearSearch}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filter.modules?.map((module) => (
            <span
              key={module}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-200"
            >
              {module.split('::').slice(-1)[0]}
              <button
                onClick={() => handleModuleToggle(module, false)}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact inline filter for toolbar
export function LogFiltersCompact({
  filter,
  onFilterChange,
  className,
}: LogFiltersProps) {
  const [searchValue, setSearchValue] = useState(filter.search || '');

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    const timeoutId = setTimeout(() => {
      onFilterChange({ search: value || undefined });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [onFilterChange]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
        <Input
          type="text"
          placeholder="Filter..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-7 h-8 w-48 text-xs bg-gray-800 border-gray-700"
        />
      </div>

      {LOG_LEVELS.map((level) => (
        <button
          key={level}
          onClick={() => {
            const currentLevels = filter.levels || [];
            const isActive = currentLevels.includes(level);
            onFilterChange({
              levels: isActive
                ? currentLevels.filter(l => l !== level)
                : [...currentLevels, level]
            });
          }}
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all',
            filter.levels?.includes(level)
              ? 'ring-2 ring-white/30'
              : 'opacity-40 hover:opacity-100',
            LEVEL_COLORS[level]
          )}
          title={level}
        >
          {level[0]}
        </button>
      ))}
    </div>
  );
}

export default LogFilters;
