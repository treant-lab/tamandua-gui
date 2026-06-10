import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export type ExclusionType = 'path' | 'process' | 'extension' | 'hash';

export interface BaseExclusion {
  id: string;
  type: ExclusionType;
  created_by: string;
  created_at: string;
  updated_at?: string;
  reason?: string;
  expires_at?: string;
  enabled: boolean;
}

export interface PathExclusion extends BaseExclusion {
  type: 'path';
  path: string;
  is_recursive: boolean;
  use_wildcards: boolean;
}

export interface ProcessExclusion extends BaseExclusion {
  type: 'process';
  process_name?: string;
  process_path?: string;
  publisher?: string;
  include_child_processes: boolean;
  exclude_network_activity: boolean;
}

export interface ExtensionExclusion extends BaseExclusion {
  type: 'extension';
  extension: string;
  is_risky: boolean;
}

export interface HashExclusion extends BaseExclusion {
  type: 'hash';
  sha256: string;
  associated_filename?: string;
  virustotal_checked: boolean;
  virustotal_result?: 'clean' | 'malicious' | 'unknown';
}

export type Exclusion = PathExclusion | ProcessExclusion | ExtensionExclusion | HashExclusion;

export interface ExclusionAuditEntry {
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled';
  exclusion_type: ExclusionType;
  exclusion_id: string;
  user: string;
  timestamp: string;
  details: string;
  previous_value?: string;
  new_value?: string;
}

export interface ExclusionValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SuggestedExclusion {
  type: ExclusionType;
  value: string;
  reason: string;
  software: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface RiskyExclusionWarning {
  exclusion_id: string;
  type: ExclusionType;
  value: string;
  risk_level: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ExclusionFilter {
  type?: ExclusionType;
  enabled?: boolean;
  search?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export interface VirusTotalResult {
  sha256: string;
  detection_ratio: string;
  result: 'clean' | 'malicious' | 'unknown';
  permalink?: string;
}

// Common extension presets
export const EXTENSION_PRESETS = {
  dev: ['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb'],
  office: ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt', '.odt', '.ods', '.odp', '.pdf'],
  media: ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.avi', '.mov', '.mkv'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
};

// Risky extensions that should warn users
export const RISKY_EXTENSIONS = [
  '.exe', '.dll', '.scr', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jse',
  '.wsf', '.wsh', '.msi', '.msp', '.msc', '.lnk', '.pif', '.com', '.gadget',
  '.jar', '.hta', '.cpl', '.inf', '.reg', '.scf',
];

// System paths that cannot be excluded
export const PROTECTED_PATHS = {
  windows: [
    'C:\\Windows\\System32',
    'C:\\Windows\\SysWOW64',
    'C:\\Windows\\Boot',
    'C:\\Program Files\\Windows Defender',
  ],
  linux: [
    '/boot',
    '/etc/passwd',
    '/etc/shadow',
    '/usr/bin',
    '/usr/sbin',
  ],
  macos: [
    '/System',
    '/usr/bin',
    '/usr/sbin',
    '/sbin',
  ],
};

// Hooks
function unsupportedExclusions<T>(feature: string): Promise<T> {
  return Promise.reject(
    new Error(`${feature} is not wired to the local agent in this build.`)
  );
}

function applyExclusionFilter(exclusions: Exclusion[], filter?: ExclusionFilter): Exclusion[] {
  if (!filter) return exclusions;
  const search = filter.search?.trim().toLowerCase();
  return exclusions.filter((exclusion) => {
    if (filter.type && exclusion.type !== filter.type) return false;
    if (filter.enabled !== undefined && exclusion.enabled !== filter.enabled) return false;
    if (!search) return true;
    return formatExclusionValue(exclusion).toLowerCase().includes(search) ||
      exclusion.reason?.toLowerCase().includes(search) ||
      exclusion.created_by.toLowerCase().includes(search);
  });
}

export function useExclusions(filter?: ExclusionFilter) {
  return useQuery<Exclusion[]>({
    queryKey: ['exclusions', filter],
    queryFn: async () => applyExclusionFilter([], filter),
    refetchInterval: 30000,
  });
}

export function useExclusionsByType(type: ExclusionType) {
  return useQuery<Exclusion[]>({
    queryKey: ['exclusions', type],
    queryFn: async () => [],
    refetchInterval: 30000,
  });
}

export function useAddExclusion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exclusion: Omit<Exclusion, 'id' | 'created_at' | 'updated_at'>) =>
      unsupportedExclusions<Exclusion>('Adding exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useUpdateExclusion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exclusion: Exclusion) =>
      unsupportedExclusions<Exclusion>('Updating exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useDeleteExclusion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exclusionId: string) =>
      unsupportedExclusions<void>('Deleting exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useToggleExclusion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exclusionId, enabled }: { exclusionId: string; enabled: boolean }) =>
      unsupportedExclusions<void>('Toggling exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useValidateExclusion() {
  return useMutation({
    mutationFn: async (exclusion: Partial<Exclusion>): Promise<ExclusionValidationResult> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      if (exclusion.type === 'path' && 'path' in exclusion && exclusion.path) {
        if (isProtectedPath(exclusion.path)) errors.push('Protected system paths cannot be excluded.');
        if (isBroadExclusion(exclusion.path)) warnings.push('Broad path exclusions reduce endpoint coverage.');
      }
      if (exclusion.type === 'hash' && 'sha256' in exclusion && exclusion.sha256 && !validateSha256(exclusion.sha256)) {
        errors.push('SHA-256 must contain 64 hexadecimal characters.');
      }
      if (exclusion.type === 'extension' && 'extension' in exclusion && exclusion.extension && isRiskyExtension(exclusion.extension)) {
        warnings.push('Executable or script extensions are high-risk exclusions.');
      }
      return { is_valid: errors.length === 0, errors, warnings };
    },
  });
}

export function useExclusionAuditLog(limit?: number) {
  return useQuery<ExclusionAuditEntry[]>({
    queryKey: ['exclusion-audit', limit],
    queryFn: async () => [],
  });
}

export function useSuggestedExclusions() {
  return useQuery<SuggestedExclusion[]>({
    queryKey: ['suggested-exclusions'],
    queryFn: async () => [],
    staleTime: 60000, // 1 minute
  });
}

export function useRiskyExclusions() {
  return useQuery<RiskyExclusionWarning[]>({
    queryKey: ['risky-exclusions'],
    queryFn: async () => [],
    refetchInterval: 60000,
  });
}

export function useExportExclusions() {
  return useMutation({
    mutationFn: (format: 'json' | 'csv') =>
      Promise.resolve(format === 'json' ? '[]' : ''),
  });
}

export function useImportExclusions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ content, format }: { content: string; format: 'json' | 'tamandua' | 'crowdstrike' | 'defender' }) =>
      unsupportedExclusions<ImportResult>('Importing exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useVirusTotalLookup() {
  return useMutation({
    mutationFn: (sha256: string) =>
      unsupportedExclusions<VirusTotalResult>('VirusTotal lookup'),
  });
}

export function useBulkAddExclusions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exclusions: Omit<Exclusion, 'id' | 'created_at' | 'updated_at'>[]) =>
      unsupportedExclusions<ImportResult>('Bulk adding exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useBulkDeleteExclusions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (exclusionIds: string[]) =>
      unsupportedExclusions<void>('Bulk deleting exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

export function useApplySuggestedExclusion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (suggestion: SuggestedExclusion) =>
      unsupportedExclusions<Exclusion>('Applying suggested exclusions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['suggested-exclusions'] });
      queryClient.invalidateQueries({ queryKey: ['exclusion-audit'] });
    },
  });
}

// Utility functions

export function isRiskyExtension(ext: string): boolean {
  const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return RISKY_EXTENSIONS.includes(normalized);
}

export function isProtectedPath(path: string): boolean {
  const platform = navigator.platform.toLowerCase();
  let protectedPaths: string[] = [];

  if (platform.includes('win')) {
    protectedPaths = PROTECTED_PATHS.windows;
  } else if (platform.includes('mac')) {
    protectedPaths = PROTECTED_PATHS.macos;
  } else {
    protectedPaths = PROTECTED_PATHS.linux;
  }

  const normalizedPath = path.toLowerCase().replace(/\//g, '\\');
  return protectedPaths.some((p) =>
    normalizedPath.startsWith(p.toLowerCase().replace(/\//g, '\\'))
  );
}

export function isBroadExclusion(path: string): boolean {
  const broadPatterns = [
    'C:\\',
    'C:/',
    'D:\\',
    'D:/',
    '/',
    '/*',
    'C:\\*',
    '**',
    '*.*',
  ];

  return broadPatterns.some((p) =>
    path === p || path === p.replace(/\\/g, '/')
  );
}

export function validateSha256(hash: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(hash);
}

export function normalizeExtension(ext: string): string {
  const trimmed = ext.trim().toLowerCase();
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

export function parseExtensionList(input: string): string[] {
  return input
    .split(/[,;\s]+/)
    .map((ext) => ext.trim())
    .filter((ext) => ext.length > 0)
    .map(normalizeExtension);
}

export function formatExclusionValue(exclusion: Exclusion): string {
  switch (exclusion.type) {
    case 'path':
      return exclusion.path;
    case 'process':
      return exclusion.process_path || exclusion.process_name || '';
    case 'extension':
      return exclusion.extension;
    case 'hash':
      return exclusion.sha256;
  }
}

export function getExclusionTypeLabel(type: ExclusionType): string {
  const labels: Record<ExclusionType, string> = {
    path: 'Path',
    process: 'Process',
    extension: 'Extension',
    hash: 'Hash',
  };
  return labels[type];
}
