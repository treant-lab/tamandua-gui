import { invoke } from '@tauri-apps/api/tauri';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type IOCType = 'ip' | 'domain' | 'md5' | 'sha1' | 'sha256' | 'url' | 'email';

export type ThreatType =
  | 'malware'
  | 'ransomware'
  | 'phishing'
  | 'c2'
  | 'botnet'
  | 'exploit'
  | 'apt'
  | 'spam'
  | 'suspicious'
  | 'unknown';

export type ConfidenceLevel = 'critical' | 'high' | 'medium' | 'low';

export interface IOC {
  id: string;
  type: IOCType;
  value: string;
  threat_type: ThreatType;
  confidence: ConfidenceLevel;
  confidence_score: number;
  source: string;
  first_seen: string;
  last_seen: string;
  description?: string;
  tags?: string[];
  related_iocs?: string[];
  mitre_tactics?: string[];
  is_active: boolean;
  matched_detections: number;
  metadata?: Record<string, unknown>;
}

export interface IOCFilter {
  search?: string;
  types?: IOCType[];
  threat_types?: ThreatType[];
  confidence_levels?: ConfidenceLevel[];
  sources?: string[];
  date_from?: string;
  date_to?: string;
  is_active?: boolean;
  has_matches?: boolean;
  limit?: number;
  offset?: number;
}

export interface IOCStats {
  total: number;
  by_type: Record<IOCType, number>;
  by_threat_type: Record<ThreatType, number>;
  by_confidence: Record<ConfidenceLevel, number>;
  recent_24h: number;
  recent_7d: number;
  active_count: number;
  matched_count: number;
}

export interface AddIOCRequest {
  type: IOCType;
  value: string;
  threat_type: ThreatType;
  confidence: ConfidenceLevel;
  confidence_score: number;
  source: string;
  description?: string;
  tags?: string[];
}

export interface IOCMatchResult {
  ioc: IOC;
  match_type: 'exact' | 'partial' | 'related';
  detection_ids: string[];
  last_match_time?: string;
}

function emptyStats(): IOCStats {
  return {
    total: 0,
    by_type: { ip: 0, domain: 0, md5: 0, sha1: 0, sha256: 0, url: 0, email: 0 },
    by_threat_type: {
      malware: 0,
      ransomware: 0,
      phishing: 0,
      c2: 0,
      botnet: 0,
      exploit: 0,
      apt: 0,
      spam: 0,
      suspicious: 0,
      unknown: 0,
    },
    by_confidence: { critical: 0, high: 0, medium: 0, low: 0 },
    recent_24h: 0,
    recent_7d: 0,
    active_count: 0,
    matched_count: 0,
  };
}

function applyLocalFilter(iocs: IOC[], filter: IOCFilter): IOC[] {
  let filtered = [...iocs];
  const search = filter.search?.trim().toLowerCase();

  if (search) {
    filtered = filtered.filter((ioc) =>
      ioc.value.toLowerCase().includes(search) ||
      ioc.description?.toLowerCase().includes(search) ||
      ioc.tags?.some((tag) => tag.toLowerCase().includes(search)) ||
      ioc.source.toLowerCase().includes(search)
    );
  }

  if (filter.types?.length) filtered = filtered.filter((ioc) => filter.types!.includes(ioc.type));
  if (filter.threat_types?.length) filtered = filtered.filter((ioc) => filter.threat_types!.includes(ioc.threat_type));
  if (filter.confidence_levels?.length) filtered = filtered.filter((ioc) => filter.confidence_levels!.includes(ioc.confidence));
  if (filter.sources?.length) filtered = filtered.filter((ioc) => filter.sources!.includes(ioc.source));
  if (filter.is_active !== undefined) filtered = filtered.filter((ioc) => ioc.is_active === filter.is_active);
  if (filter.has_matches !== undefined) filtered = filtered.filter((ioc) => (ioc.matched_detections > 0) === filter.has_matches);

  filtered.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
  const offset = filter.offset || 0;
  const limit = filter.limit || 50;
  return filtered.slice(offset, offset + limit);
}

function statsFromIOCs(iocs: IOC[]): IOCStats {
  const stats = emptyStats();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (const ioc of iocs) {
    stats.total += 1;
    stats.by_type[ioc.type] += 1;
    stats.by_threat_type[ioc.threat_type] += 1;
    stats.by_confidence[ioc.confidence] += 1;
    if (ioc.is_active) stats.active_count += 1;
    if (ioc.matched_detections > 0) stats.matched_count += 1;
    const firstSeen = new Date(ioc.first_seen).getTime();
    if (Number.isFinite(firstSeen) && now - firstSeen <= day) stats.recent_24h += 1;
    if (Number.isFinite(firstSeen) && now - firstSeen <= 7 * day) stats.recent_7d += 1;
  }

  return stats;
}

export function useThreatIntelFeed(filter: IOCFilter = {}) {
  return useQuery<IOC[]>({
    queryKey: ['threat-intel', 'feed', filter],
    queryFn: async () => {
      const iocs = await invoke<IOC[]>('get_threat_intel_feed', { filter });
      return applyLocalFilter(iocs, filter);
    },
    refetchInterval: 60000,
  });
}

export function useIOCStats() {
  return useQuery<IOCStats>({
    queryKey: ['threat-intel', 'stats'],
    queryFn: async () => {
      try {
        return await invoke<IOCStats>('get_ioc_stats');
      } catch {
        const iocs = await invoke<IOC[]>('get_threat_intel_feed', { filter: { limit: 10000 } });
        return statsFromIOCs(iocs);
      }
    },
    refetchInterval: 60000,
  });
}

export function useIOC(iocId: string | null) {
  return useQuery<IOC | null>({
    queryKey: ['threat-intel', 'ioc', iocId],
    queryFn: async () => {
      if (!iocId) return null;
      const iocs = await invoke<IOC[]>('get_threat_intel_feed', { filter: { limit: 10000 } });
      return iocs.find((ioc) => ioc.id === iocId) || null;
    },
    enabled: !!iocId,
  });
}

function unsupported(feature: string): Promise<never> {
  return Promise.reject(new Error(`${feature} is unavailable on this endpoint build.`));
}

export function useAddIOC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_request: AddIOCRequest): Promise<IOC> => unsupported('Adding IOCs'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threat-intel'] }),
  });
}

export function useDeleteIOC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_iocId: string): Promise<boolean> => unsupported('Deleting IOCs'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threat-intel'] }),
  });
}

export function useCheckIOC(value: string) {
  return useQuery<IOCMatchResult | null>({
    queryKey: ['threat-intel', 'check', value],
    queryFn: async () => null,
    enabled: value.length >= 3,
  });
}

export function useBulkCheckIOCs() {
  return useMutation({
    mutationFn: async (_values: string[]): Promise<IOCMatchResult[]> => unsupported('Bulk IOC checks'),
  });
}

export function useToggleIOCStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_args: { iocId: string; isActive: boolean }): Promise<boolean> => unsupported('IOC status changes'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threat-intel'] }),
  });
}

export function useExportIOCs() {
  return useMutation({
    mutationFn: async ({ format, filter }: { format: 'csv' | 'json' | 'stix'; filter: IOCFilter }): Promise<string> => {
      const iocs = applyLocalFilter(await invoke<IOC[]>('get_threat_intel_feed', { filter }), filter);
      if (format === 'json') return JSON.stringify(iocs, null, 2);
      if (format === 'csv') {
        const headers = ['Type', 'Value', 'Threat Type', 'Confidence', 'Source', 'First Seen', 'Last Seen', 'Description'];
        const rows = iocs.map((ioc) => [ioc.type, ioc.value, ioc.threat_type, ioc.confidence, ioc.source, ioc.first_seen, ioc.last_seen, ioc.description || '']);
        return [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
      }
      return JSON.stringify({ type: 'bundle', id: `bundle--${Date.now()}`, objects: [] }, null, 2);
    },
  });
}

export function useIOCSources() {
  return useQuery<string[]>({
    queryKey: ['threat-intel', 'sources'],
    queryFn: async () => {
      const iocs = await invoke<IOC[]>('get_threat_intel_feed', { filter: { limit: 10000 } });
      return Array.from(new Set(iocs.map((ioc) => ioc.source))).sort();
    },
  });
}

export function getIOCTypeLabel(type: IOCType): string {
  const labels: Record<IOCType, string> = {
    ip: 'IP Address',
    domain: 'Domain',
    md5: 'MD5 Hash',
    sha1: 'SHA1 Hash',
    sha256: 'SHA256 Hash',
    url: 'URL',
    email: 'Email',
  };
  return labels[type] || type;
}

export function getThreatTypeLabel(type: ThreatType): string {
  const labels: Record<ThreatType, string> = {
    malware: 'Malware',
    ransomware: 'Ransomware',
    phishing: 'Phishing',
    c2: 'C2 Server',
    botnet: 'Botnet',
    exploit: 'Exploit',
    apt: 'APT',
    spam: 'Spam',
    suspicious: 'Suspicious',
    unknown: 'Unknown',
  };
  return labels[type] || type;
}

export function getConfidenceColor(confidence: ConfidenceLevel): string {
  const colors: Record<ConfidenceLevel, string> = {
    critical: 'text-red-500 bg-red-900/30 border-red-700',
    high: 'text-orange-500 bg-orange-900/30 border-orange-700',
    medium: 'text-yellow-500 bg-yellow-900/30 border-yellow-700',
    low: 'text-blue-500 bg-blue-900/30 border-blue-700',
  };
  return colors[confidence] || 'text-gray-400 bg-gray-700';
}

export function getThreatTypeColor(type: ThreatType): string {
  const colors: Record<ThreatType, string> = {
    malware: 'text-red-400 bg-red-900/20',
    ransomware: 'text-purple-400 bg-purple-900/20',
    phishing: 'text-orange-400 bg-orange-900/20',
    c2: 'text-pink-400 bg-pink-900/20',
    botnet: 'text-indigo-400 bg-indigo-900/20',
    exploit: 'text-yellow-400 bg-yellow-900/20',
    apt: 'text-red-500 bg-red-900/30',
    spam: 'text-gray-400 bg-gray-700',
    suspicious: 'text-amber-400 bg-amber-900/20',
    unknown: 'text-gray-400 bg-gray-700',
  };
  return colors[type] || 'text-gray-400 bg-gray-700';
}

export function validateIOCValue(type: IOCType, value: string): { valid: boolean; error?: string } {
  if (!value.trim()) return { valid: false, error: 'Value is required' };
  if (type === 'sha256' && !/^[a-fA-F0-9]{64}$/.test(value)) return { valid: false, error: 'Invalid SHA256 hash' };
  if (type === 'sha1' && !/^[a-fA-F0-9]{40}$/.test(value)) return { valid: false, error: 'Invalid SHA1 hash' };
  if (type === 'md5' && !/^[a-fA-F0-9]{32}$/.test(value)) return { valid: false, error: 'Invalid MD5 hash' };
  return { valid: true };
}
