import { invoke } from '@tauri-apps/api/tauri';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

export type FileType =
  | 'folder'
  | 'file'
  | 'document'
  | 'code'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'executable'
  | 'config'
  | 'data';

export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size_bytes: number;
  modified_at: string;
  created_at: string;
  is_hidden: boolean;
  is_readonly: boolean;
  is_system: boolean;
  extension: string | null;
  file_type: FileType;
  permissions: string;
  owner: string | null;
}

export interface FileProperties extends FileEntry {
  accessed_at: string;
  group: string | null;
  hashes: FileHashes | null;
  is_signed: boolean;
  signer: string | null;
  mime_type: string | null;
  children_count: number | null;
}

export interface FileHashes {
  md5: string;
  sha1: string;
  sha256: string;
}

export interface DirectoryListResult {
  path: string;
  entries: FileEntry[];
  parent_path: string | null;
  total_count: number;
  error: string | null;
}

export interface FileScanResult {
  path: string;
  status: 'clean' | 'threat' | 'error';
  threat_name: string | null;
  threat_type: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  detection_source: string | null;
}

export type ViewMode = 'list' | 'grid';
export type SortField = 'name' | 'size' | 'modified' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface FileBrowserState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  selectedFiles: Set<string>;
  viewMode: ViewMode;
  sortField: SortField;
  sortOrder: SortOrder;
  searchQuery: string;
  showHidden: boolean;
}

interface BackendFileEntry {
  name: string;
  path: string;
  entry_type: 'file' | 'directory';
  size?: number | null;
  modified?: string | null;
}

function classifyFileType(name: string, isDirectory: boolean): FileType {
  if (isDirectory) return 'folder';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cs', 'ex', 'exs'].includes(ext)) return 'code';
  if (['doc', 'docx', 'pdf', 'txt', 'md', 'xls', 'xlsx'].includes(ext)) return 'document';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['exe', 'dll', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'bin'].includes(ext)) return 'executable';
  if (['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf', 'cfg', 'env'].includes(ext)) return 'config';
  if (['db', 'sqlite', 'csv', 'sql', 'log', 'dat'].includes(ext)) return 'data';
  return 'file';
}

function mapBackendEntry(entry: BackendFileEntry): FileEntry {
  const isDirectory = entry.entry_type === 'directory';
  const extension = isDirectory || !entry.name.includes('.') ? null : entry.name.split('.').pop() || null;
  return {
    name: entry.name,
    path: entry.path,
    is_directory: isDirectory,
    size_bytes: entry.size || 0,
    modified_at: entry.modified || '',
    created_at: '',
    is_hidden: entry.name.startsWith('.'),
    is_readonly: false,
    is_system: false,
    extension,
    file_type: classifyFileType(entry.name, isDirectory),
    permissions: '',
    owner: null,
  };
}

function unsupportedFileAction(feature: string): Promise<never> {
  return Promise.reject(
    new Error(`${feature} is not wired to the local agent in this build.`)
  );
}

function dirname(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '');
  const slash = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
  if (slash <= 0) return getParentPath(path) || path;
  return normalized.slice(0, slash);
}

export function useFileList(path: string, options?: {
  showHidden?: boolean;
  sortField?: SortField;
  sortOrder?: SortOrder;
}) {
  return useQuery<DirectoryListResult>({
    queryKey: ['files', path, options],
    queryFn: async () => {
      const raw = await invoke<BackendFileEntry[]>('list_directory', { path });
      let entries = raw.map(mapBackendEntry);
      if (!options?.showHidden) entries = entries.filter((entry) => !entry.is_hidden);

      const sortField = options?.sortField || 'name';
      const sortOrder = options?.sortOrder || 'asc';
      entries.sort((a, b) => {
        const dirCompare = Number(b.is_directory) - Number(a.is_directory);
        if (dirCompare !== 0) return dirCompare;
        const av = sortField === 'size' ? a.size_bytes : sortField === 'modified' ? a.modified_at : sortField === 'type' ? a.file_type : a.name;
        const bv = sortField === 'size' ? b.size_bytes : sortField === 'modified' ? b.modified_at : sortField === 'type' ? b.file_type : b.name;
        return sortOrder === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });

      return {
        path,
        entries,
        parent_path: getParentPath(path),
        total_count: entries.length,
        error: null,
      };
    },
  });
}

export function useFileProperties(path: string | null) {
  return useQuery<FileProperties>({
    queryKey: ['file-properties', path],
    queryFn: async () => {
      if (!path) throw new Error('No file selected.');
      const raw = await invoke<BackendFileEntry[]>('list_directory', { path: dirname(path) });
      const entry = raw.map(mapBackendEntry).find((candidate) => candidate.path === path);
      if (!entry) throw new Error('File not found.');
      return {
        ...entry,
        accessed_at: '',
        group: null,
        hashes: null,
        is_signed: false,
        signer: null,
        mime_type: null,
        children_count: null,
      };
    },
    enabled: Boolean(path),
  });
}

export function useScanFile() {
  const queryClient = useQueryClient();
  return useMutation<FileScanResult, Error, string>({
    mutationFn: (path) => unsupportedFileAction('File scanning'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useQuarantineFileBrowser() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (path) => unsupportedFileAction('File quarantine'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
  });
}

export function useAddToExclusions() {
  return useMutation<boolean, Error, { path: string; type: 'file' | 'directory' }>({
    mutationFn: ({ path, type }) => unsupportedFileAction('File exclusions'),
  });
}

export function useBatchScan() {
  return useMutation<FileScanResult[], Error, string[]>({
    mutationFn: (paths) => unsupportedFileAction('Batch file scanning'),
  });
}

export function useFileBrowserState(initialPath?: string) {
  const defaultPath = initialPath || (navigator.platform.toLowerCase().includes('win') ? 'C:\\' : '/');
  const [state, setState] = useState<FileBrowserState>({
    currentPath: defaultPath,
    history: [defaultPath],
    historyIndex: 0,
    selectedFiles: new Set(),
    viewMode: 'list',
    sortField: 'name',
    sortOrder: 'asc',
    searchQuery: '',
    showHidden: false,
  });

  const navigateTo = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      currentPath: path,
      history: [...prev.history.slice(0, prev.historyIndex + 1), path],
      historyIndex: prev.historyIndex + 1,
      selectedFiles: new Set(),
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;
      return { ...prev, historyIndex: prev.historyIndex - 1, currentPath: prev.history[prev.historyIndex - 1], selectedFiles: new Set() };
    });
  }, []);

  const goForward = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      return { ...prev, historyIndex: prev.historyIndex + 1, currentPath: prev.history[prev.historyIndex + 1], selectedFiles: new Set() };
    });
  }, []);

  const goUp = useCallback(() => {
    const parent = getParentPath(state.currentPath);
    if (parent) navigateTo(parent);
  }, [state.currentPath, navigateTo]);

  const toggleFileSelection = useCallback((path: string) => {
    setState((prev) => {
      const selectedFiles = new Set(prev.selectedFiles);
      selectedFiles.has(path) ? selectedFiles.delete(path) : selectedFiles.add(path);
      return { ...prev, selectedFiles };
    });
  }, []);

  const clearSelection = useCallback(() => setState((prev) => ({ ...prev, selectedFiles: new Set() })), []);
  const setViewMode = useCallback((viewMode: ViewMode) => setState((prev) => ({ ...prev, viewMode })), []);
  const setSortField = useCallback((sortField: SortField) => setState((prev) => ({ ...prev, sortField })), []);
  const setSortOrder = useCallback((sortOrder: SortOrder) => setState((prev) => ({ ...prev, sortOrder })), []);
  const setSearchQuery = useCallback((searchQuery: string) => setState((prev) => ({ ...prev, searchQuery })), []);
  const setShowHidden = useCallback((showHidden: boolean) => setState((prev) => ({ ...prev, showHidden })), []);

  return {
    state,
    navigateTo,
    goBack,
    goForward,
    goUp,
    canGoBack: state.historyIndex > 0,
    canGoForward: state.historyIndex < state.history.length - 1,
    toggleFileSelection,
    clearSelection,
    setViewMode,
    setSortField,
    setSortOrder,
    setSearchQuery,
    setShowHidden,
  };
}

export function getPathBreadcrumbs(path: string): { name: string; path: string }[] {
  const separator = path.includes('\\') ? '\\' : '/';
  const parts = path.split(/[\\/]/).filter(Boolean);
  let current = path.startsWith(separator) ? separator : '';
  return parts.map((part) => {
    current = current ? `${current}${current.endsWith(separator) ? '' : separator}${part}` : part;
    return { name: part, path: current };
  });
}

export function filterFiles(files: FileEntry[], query: string): FileEntry[] {
  if (!query) return files;
  const needle = query.toLowerCase();
  return files.filter((file) =>
    file.name.toLowerCase().includes(needle) ||
    file.path.toLowerCase().includes(needle) ||
    file.extension?.toLowerCase().includes(needle)
  );
}

function getParentPath(path: string): string | null {
  const normalized = path.replace(/[\\/]$/, '');
  const index = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
  if (index <= 0) return null;
  return normalized.slice(0, index);
}
