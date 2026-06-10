import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, File, Folder, HardDrive, RefreshCw, Search, Shield } from 'lucide-react';
import { useStartScan } from '../hooks/useTauri';

interface FileBrowserEntry {
  id: string;
  name: string;
  path: string;
  entry_type: 'file' | 'directory';
  size?: number | null;
  modified?: string | null;
}

const defaultPath = navigator.platform.toLowerCase().includes('win') ? 'C:\\' : '/';

export function Files() {
  const [currentPath, setCurrentPath] = useState(defaultPath);
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const scan = useStartScan();

  const { data: entries = [], isLoading, error, refetch } = useQuery<FileBrowserEntry[]>({
    queryKey: ['directory', currentPath],
    queryFn: () => invoke<FileBrowserEntry[]>('list_directory', { path: currentPath }),
  });

  const filteredEntries = useMemo(() => {
    const needle = search.toLowerCase();
    return entries.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [entries, search]);

  const parentPath = useMemo(() => {
    const normalized = currentPath.replace(/[\\/]$/, '');
    const index = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
    if (index <= 0) return defaultPath;
    return normalized.slice(0, index + 1);
  }, [currentPath]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">File Browser</h1>
          <p className="mt-1 text-gray-400">Browse the local filesystem and launch real agent scans.</p>
        </div>
        <button
          onClick={() => selectedPath && scan.mutate({ path: selectedPath, recursive: false, scanType: 'custom' })}
          disabled={!selectedPath || scan.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          Scan Selected
        </button>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
            <HardDrive className="h-4 w-4 text-gray-500" />
            <input
              value={currentPath}
              onChange={(event) => setCurrentPath(event.target.value)}
              className="flex-1 bg-transparent font-mono text-sm text-gray-100 outline-none"
            />
          </div>
          <button
            onClick={() => setCurrentPath(parentPath)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            <ArrowUp className="h-4 w-4" />
            Up
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search current directory..."
            className="flex-1 bg-transparent text-sm text-gray-100 outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
        <div className="border-b border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-400">
          {filteredEntries.length} entries
        </div>
        {error ? (
          <div className="p-6 text-red-300">Failed to read directory: {String(error)}</div>
        ) : isLoading ? (
          <div className="p-6 text-gray-400">Loading directory...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-6 text-gray-400">No files found.</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredEntries.map((entry) => (
              <button
                key={entry.id}
                onDoubleClick={() => entry.entry_type === 'directory' && setCurrentPath(entry.path)}
                onClick={() => setSelectedPath(entry.path)}
                className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-left hover:bg-gray-700 ${
                  selectedPath === entry.path ? 'bg-gray-700' : ''
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {entry.entry_type === 'directory' ? (
                    <Folder className="h-4 w-4 flex-shrink-0 text-amber-400" />
                  ) : (
                    <File className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  )}
                  <span className="truncate text-gray-100">{entry.name}</span>
                </span>
                <span className="font-mono text-sm text-gray-400">{formatSize(entry.size)}</span>
                <span className="hidden text-sm text-gray-500 md:inline">
                  {entry.modified ? new Date(entry.modified).toLocaleString() : '-'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
