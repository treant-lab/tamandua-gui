import { invoke } from '@tauri-apps/api/tauri';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface QuarantinedFile {
  id: string;
  filename: string;
  original_path: string;
  quarantine_path: string;
  size_bytes: number;
  file_type: string;
  quarantined_at: string;
  expires_at: string;
  quarantined_by: string;
  threat_name: string;
  threat_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detection_rule: string;
  detection_source: 'yara' | 'sigma' | 'ml' | 'behavioral';
  confidence: number;
  hashes: FileHashes;
  mitre_attack: MitreMapping[];
  can_restore: boolean;
}

export interface FileHashes {
  md5: string;
  sha1: string;
  sha256: string;
}

export interface MitreMapping {
  tactic_id: string;
  tactic_name: string;
  technique_id: string;
  technique_name: string;
}

export interface QuarantineVaultStats {
  total_files: number;
  total_size_bytes: number;
  max_size_bytes: number;
  oldest_file_date: string | null;
  files_expiring_soon: number;
  files_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface QuarantineFilter {
  search?: string;
  severity?: string;
  threat_type?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface QuarantineTrend {
  date: string;
  count: number;
  size_bytes: number;
}

export interface ThreatFamilyStats {
  name: string;
  count: number;
  percentage: number;
}

export interface DetectionSourceStats {
  source: string;
  count: number;
  percentage: number;
}

export interface QuarantineStatistics {
  trends: QuarantineTrend[];
  threat_families: ThreatFamilyStats[];
  detection_sources: DetectionSourceStats[];
  average_days_in_quarantine: number;
  total_restored: number;
  total_deleted: number;
}

export interface RestoreOptions {
  file_id: string;
  restore_path?: string; // If not provided, restores to original location
  scan_after_restore: boolean;
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  errors: string[];
}

// Hooks
const EMPTY_VAULT_STATS: QuarantineVaultStats = {
  total_files: 0,
  total_size_bytes: 0,
  max_size_bytes: 0,
  oldest_file_date: null,
  files_expiring_soon: 0,
  files_by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
};

const EMPTY_QUARANTINE_STATISTICS: QuarantineStatistics = {
  trends: [],
  threat_families: [],
  detection_sources: [],
  average_days_in_quarantine: 0,
  total_restored: 0,
  total_deleted: 0,
};

function unsupportedQuarantine<T>(feature: string): Promise<T> {
  return Promise.reject(
    new Error(`${feature} is not wired to the local agent in this build.`)
  );
}

function applyQuarantineFilter(files: QuarantinedFile[], filter?: QuarantineFilter): QuarantinedFile[] {
  if (!filter) return files;
  const search = filter.search?.trim().toLowerCase();
  let filtered = files.filter((file) => {
    if (filter.severity && file.severity !== filter.severity) return false;
    if (filter.threat_type && file.threat_type !== filter.threat_type) return false;
    if (filter.date_from && new Date(file.quarantined_at) < new Date(filter.date_from)) return false;
    if (filter.date_to && new Date(file.quarantined_at) > new Date(filter.date_to)) return false;
    if (!search) return true;
    return file.filename.toLowerCase().includes(search) ||
      file.original_path.toLowerCase().includes(search) ||
      file.threat_name.toLowerCase().includes(search);
  });

  filtered = filtered.sort((a, b) => {
    const sortBy = filter.sort_by || 'quarantined_at';
    const direction = filter.sort_order === 'asc' ? 1 : -1;
    const aValue = String(a[sortBy as keyof QuarantinedFile] ?? '');
    const bValue = String(b[sortBy as keyof QuarantinedFile] ?? '');
    return aValue.localeCompare(bValue) * direction;
  });

  const offset = filter.offset || 0;
  const limit = filter.limit || filtered.length;
  return filtered.slice(offset, offset + limit);
}

function statsFromFiles(files: QuarantinedFile[]): QuarantineVaultStats {
  const stats: QuarantineVaultStats = {
    ...EMPTY_VAULT_STATS,
    files_by_severity: { ...EMPTY_VAULT_STATS.files_by_severity },
  };
  stats.total_files = files.length;
  for (const file of files) {
    stats.total_size_bytes += file.size_bytes || 0;
    stats.max_size_bytes = Math.max(stats.max_size_bytes, file.size_bytes || 0);
    stats.files_by_severity[file.severity] += 1;
    if (!stats.oldest_file_date || new Date(file.quarantined_at) < new Date(stats.oldest_file_date)) {
      stats.oldest_file_date = file.quarantined_at;
    }
  }
  return stats;
}

export function useQuarantineVaultStats() {
  return useQuery<QuarantineVaultStats>({
    queryKey: ['quarantine', 'stats'],
    queryFn: async () => statsFromFiles(await invoke<QuarantinedFile[]>('get_quarantined_files')),
    refetchInterval: 30000,
  });
}

export function useQuarantinedFiles(filter?: QuarantineFilter) {
  return useQuery<QuarantinedFile[]>({
    queryKey: ['quarantine', 'files', filter],
    queryFn: async () => applyQuarantineFilter(await invoke<QuarantinedFile[]>('get_quarantined_files'), filter),
    refetchInterval: 30000,
  });
}

export function useQuarantinedFile(fileId: string | null) {
  return useQuery<QuarantinedFile>({
    queryKey: ['quarantine', 'file', fileId],
    queryFn: async () => {
      const files = await invoke<QuarantinedFile[]>('get_quarantined_files');
      const file = files.find((candidate) => candidate.id === fileId);
      if (!file) throw new Error('Quarantined file not found.');
      return file;
    },
    enabled: !!fileId,
  });
}

export function useQuarantineStatistics(days: number = 30) {
  return useQuery<QuarantineStatistics>({
    queryKey: ['quarantine', 'statistics', days],
    queryFn: async () => EMPTY_QUARANTINE_STATISTICS,
    refetchInterval: 60000,
  });
}

export function useRestoreFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: RestoreOptions) =>
      unsupportedQuarantine<boolean>('Restoring quarantined files'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarantine'] });
    },
  });
}

export function useDeleteQuarantinedFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileId: string) =>
      unsupportedQuarantine<boolean>('Deleting quarantined files'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarantine'] });
    },
  });
}

export function useBulkDeleteQuarantined() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileIds: string[]) =>
      unsupportedQuarantine<BulkActionResult>('Bulk deleting quarantined files'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarantine'] });
    },
  });
}

export function useDeleteExpiredFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      unsupportedQuarantine<BulkActionResult>('Deleting expired quarantine entries'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarantine'] });
    },
  });
}

export function useSubmitToVirusTotal() {
  return useMutation({
    mutationFn: (fileId: string) =>
      unsupportedQuarantine<{ permalink: string; positives: number; total: number }>('VirusTotal submission'),
  });
}

export function useExportQuarantinedFile() {
  return useMutation({
    mutationFn: ({ fileId, exportPath }: { fileId: string; exportPath: string }) =>
      unsupportedQuarantine<boolean>('Exporting quarantined files'),
  });
}

export function useGetFileHexDump() {
  return useMutation({
    mutationFn: ({ fileId, offset, length }: { fileId: string; offset: number; length: number }) =>
      unsupportedQuarantine<{ hex: string; ascii: string }>('Quarantine hex dump'),
  });
}

export function useExportQuarantineReport() {
  return useMutation({
    mutationFn: ({ format, filter }: { format: 'csv' | 'json'; filter?: QuarantineFilter }) =>
      unsupportedQuarantine<string>('Quarantine report export'),
  });
}

export function useValidateRestorePath() {
  return useMutation({
    mutationFn: (path: string) =>
      Promise.resolve({ valid: path.trim().length > 0 }),
  });
}
