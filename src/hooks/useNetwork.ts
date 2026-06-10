import { invoke } from '@tauri-apps/api/tauri';
import { useQuery } from '@tanstack/react-query';

export type ConnectionProtocol = 'TCP' | 'UDP' | 'tcp' | 'udp' | (string & {});
export type DomainCandidate = string | { domain?: string | null; name?: string | null; value?: string | null };
export type CertificateRisk =
  | string
  | {
      level?: string | null;
      score?: number | null;
      reason?: string | null;
      summary?: string | null;
    };
export type NetworkReputation =
  | string
  | {
      verdict?: string | null;
      reputation?: string | null;
      risk?: string | null;
      score?: number | null;
      confidence?: number | null;
      source?: string | null;
      malicious?: boolean | null;
      categories?: string[] | null;
      category?: string | null;
      [key: string]: unknown;
    }
  | null;
export type NetworkEnrichment = Record<string, unknown> | null;

// Network connection type matching the shared GUI contract. Most fields are
// optional because Windows and Linux collectors expose different detail levels.
export interface NetworkConnection {
  pid?: number | null;
  process_name?: string | null;
  process?: string | null;
  protocol?: ConnectionProtocol | null;
  local_address?: string | null;
  local_addr?: string | null;
  local_ip?: string | null;
  local_port?: number | null;
  remote_address?: string | null;
  remote_ip?: string | null;
  remote_addr?: string | null;
  remote_port?: number | null;
  state?: ConnectionState | null;
  domain?: string | string[] | null;
  domain_candidates?: DomainCandidate[] | null;
  is_encrypted?: boolean | null;
  encrypted?: boolean | null;
  sni?: string | null;
  tls_sni?: string | null;
  tls_version?: string | null;
  ja3?: string | null;
  ja3s?: string | null;
  certificate_risk?: CertificateRisk | null;
  reputation?: NetworkReputation;
  enrichment?: NetworkEnrichment;
  // Geolocation data (optional, resolved by backend or lookup service)
  country_code?: string | null;
  country_name?: string | null;
  city?: string | null;
  asn?: string | null;
  org?: string | null;
}

export type ConnectionState =
  | 'ESTABLISHED'
  | 'LISTENING'
  | 'TIME_WAIT'
  | 'CLOSE_WAIT'
  | 'SYN_SENT'
  | 'SYN_RECEIVED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'LAST_ACK'
  | 'CLOSING'
  | 'CLOSED'
  | 'UNKNOWN'
  | (string & {});

export interface NetworkFilter {
  search: string;
  protocol: 'TCP' | 'UDP' | 'all';
  state: ConnectionState | 'all';
}

export interface NetworkStats {
  total: number;
  established: number;
  listening: number;
  tcp: number;
  udp: number;
  encrypted: number;
  tls: number;
  withReputation: number;
  certRisk: number;
  uniqueCountries: number;
}

// Fetch network connections from the agent
async function fetchNetworkConnections(): Promise<NetworkConnection[]> {
  return invoke<NetworkConnection[]>('get_network_connections');
}

// Calculate stats from connections
export function calculateNetworkStats(connections: NetworkConnection[]): NetworkStats {
  const countries = new Set(
    connections
      .map((c) => c.country_code)
      .filter((code): code is string => Boolean(code))
  );

  return {
    total: connections.length,
    established: connections.filter((c) => normalizeState(c.state) === 'ESTABLISHED').length,
    listening: connections.filter((c) => normalizeState(c.state) === 'LISTENING').length,
    tcp: connections.filter((c) => normalizeProtocol(c.protocol) === 'TCP').length,
    udp: connections.filter((c) => normalizeProtocol(c.protocol) === 'UDP').length,
    encrypted: connections.filter((c) => getEncryptionState(c) === true).length,
    tls: connections.filter((c) => Boolean(c.tls_version || getSni(c) || c.ja3 || c.ja3s)).length,
    withReputation: connections.filter((c) => Boolean(c.reputation || c.enrichment)).length,
    certRisk: connections.filter((c) => getCertificateRiskLabel(c.certificate_risk) !== null).length,
    uniqueCountries: countries.size,
  };
}

// Filter connections based on filter criteria
export function filterConnections(
  connections: NetworkConnection[],
  filter: NetworkFilter
): NetworkConnection[] {
  return connections.filter((conn) => {
    // Search filter
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const haystack = getConnectionSearchText(conn).toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    // Protocol filter
    if (filter.protocol !== 'all' && normalizeProtocol(conn.protocol) !== filter.protocol) {
      return false;
    }

    // State filter
    if (filter.state !== 'all' && normalizeState(conn.state) !== filter.state) {
      return false;
    }

    return true;
  });
}

// Main hook for fetching network connections
export function useNetworkConnections(refreshInterval = 5000) {
  return useQuery<NetworkConnection[]>({
    queryKey: ['networkConnections'],
    queryFn: fetchNetworkConnections,
    refetchInterval: refreshInterval,
  });
}

// Get unique process names for filtering
export function useNetworkProcesses(connections: NetworkConnection[] | undefined): string[] {
  if (!connections) return [];

  const processes = new Set(connections.map(getProcessName));
  return Array.from(processes).sort();
}

// Get unique countries for display
export function useNetworkCountries(
  connections: NetworkConnection[] | undefined
): { code: string; name: string; count: number }[] {
  if (!connections) return [];

  const countryMap = new Map<string, { name: string; count: number }>();

  for (const conn of connections) {
    if (conn.country_code && conn.country_name) {
      const existing = countryMap.get(conn.country_code);
      if (existing) {
        existing.count++;
      } else {
        countryMap.set(conn.country_code, { name: conn.country_name, count: 1 });
      }
    }
  }

  return Array.from(countryMap.entries())
    .map(([code, { name, count }]) => ({ code, name, count }))
    .sort((a, b) => b.count - a.count);
}

export function normalizeProtocol(protocol: ConnectionProtocol | null | undefined): 'TCP' | 'UDP' | 'UNKNOWN' {
  const normalized = String(protocol ?? '').toUpperCase();
  if (normalized === 'TCP' || normalized === 'UDP') return normalized;
  return 'UNKNOWN';
}

export function normalizeState(state: ConnectionState | null | undefined): ConnectionState {
  return String(state ?? 'UNKNOWN').toUpperCase() as ConnectionState;
}

export function getProcessName(connection: NetworkConnection): string {
  return connection.process_name || connection.process || 'Unknown process';
}

export function getPid(connection: NetworkConnection): number | null {
  return typeof connection.pid === 'number' ? connection.pid : null;
}

export function getLocalAddress(connection: NetworkConnection): string | null {
  return connection.local_address || connection.local_ip || connection.local_addr || null;
}

export function getRemoteAddress(connection: NetworkConnection): string | null {
  return connection.remote_address || connection.remote_ip || connection.remote_addr || null;
}

export function getSni(connection: NetworkConnection): string | null {
  return connection.sni || connection.tls_sni || null;
}

export function getEncryptionState(connection: NetworkConnection): boolean | null {
  if (typeof connection.is_encrypted === 'boolean') return connection.is_encrypted;
  if (typeof connection.encrypted === 'boolean') return connection.encrypted;
  if (connection.tls_version || getSni(connection) || connection.ja3 || connection.ja3s) return true;
  return null;
}

export function getDomainCandidates(connection: NetworkConnection): string[] {
  const values = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) values.add(value.trim());
  };

  if (Array.isArray(connection.domain)) {
    connection.domain.forEach(push);
  } else {
    push(connection.domain);
  }

  for (const candidate of connection.domain_candidates ?? []) {
    if (typeof candidate === 'string') {
      push(candidate);
    } else {
      push(candidate.domain);
      push(candidate.name);
      push(candidate.value);
    }
  }

  return Array.from(values);
}

export function getPrimaryDomain(connection: NetworkConnection): string | null {
  return getDomainCandidates(connection)[0] ?? getSni(connection);
}

export function getCertificateRiskLabel(risk: CertificateRisk | null | undefined): string | null {
  if (!risk) return null;
  if (typeof risk === 'string') return risk;
  return risk.level || risk.summary || (typeof risk.score === 'number' ? `Score ${risk.score}` : null);
}

export function getReputationLabel(reputation: NetworkReputation | undefined): string | null {
  if (!reputation) return null;
  if (typeof reputation === 'string') return reputation;
  if (reputation.malicious === true) return 'malicious';
  if (reputation.malicious === false) return 'benign';
  return (
    reputation.verdict ||
    reputation.reputation ||
    reputation.risk ||
    reputation.category ||
    (typeof reputation.score === 'number' ? `score ${reputation.score}` : null)
  );
}

export function getConnectionSearchText(connection: NetworkConnection): string {
  const enrichmentValues = Object.values(connection.enrichment ?? {})
    .filter((value) => value !== null && value !== undefined)
    .map((value) => (Array.isArray(value) ? value.join(' ') : String(value)));

  return [
    getProcessName(connection),
    getPid(connection),
    normalizeProtocol(connection.protocol),
    getLocalAddress(connection),
    connection.local_port,
    getRemoteAddress(connection),
    connection.remote_port,
    normalizeState(connection.state),
    ...getDomainCandidates(connection),
    getSni(connection),
    connection.tls_version,
    connection.ja3,
    connection.ja3s,
    getCertificateRiskLabel(connection.certificate_risk),
    getReputationLabel(connection.reputation),
    connection.country_code,
    connection.country_name,
    connection.city,
    connection.asn,
    connection.org,
    ...enrichmentValues,
  ]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ');
}
