import { invoke } from '@tauri-apps/api/tauri';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef, useState } from 'react';
import { useEventListener } from './useTauri';

function unsupportedCapability(feature: string): Promise<never> {
  return Promise.reject(new Error(`${feature} is unavailable on this endpoint build.`));
}

// Process types - matches backend ProcessInfo struct
export interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  exe_path: string | null;
  command_line: string | null;
  user: string | null;
  cpu_usage: number;
  memory_mb: number;
  status: string;
  start_time: string | null;
  threads: number;
  is_elevated: boolean;
  is_system: boolean;
  // Additional computed/optional fields for UI
  parent_pid?: number | null;
  working_directory?: string;
  handles?: number;
  started_at?: string;
  is_critical?: boolean;
  is_signed?: boolean;
  signer_name?: string | null;
  threat_score?: number | null;
}

export type ProcessStatus = 'running' | 'suspended' | 'stopped' | 'zombie';

export type ProcessType = 'system' | 'service' | 'user';

export type TrustLevel = 'trusted' | 'unknown' | 'suspicious';

export interface ProcessDetails extends ProcessInfo {
  network_connections: NetworkConnection[];
  open_handles: OpenHandle[];
  loaded_modules: LoadedModule[];
  memory_map: MemoryRegion[];
  parent_info: ParentProcessInfo | null;
}

export interface NetworkConnection {
  protocol: 'tcp' | 'udp';
  local_addr: string;
  local_port: number;
  remote_addr: string | null;
  remote_port: number | null;
  state: string;
}

export interface OpenHandle {
  handle_type: string;
  name: string;
}

export interface LoadedModule {
  name: string;
  path: string;
  base_address: string;
  size_bytes: number;
  is_signed: boolean;
}

export interface MemoryRegion {
  base_address: string;
  size_bytes: number;
  protection: string;
  state: string;
  region_type: string;
}

export interface ParentProcessInfo {
  pid: number;
  name: string;
  exe_path: string;
}

export interface ProcessFilter {
  search: string;
  status: ProcessStatus | 'all';
  trust: TrustLevel | 'all';
  type: ProcessType | 'all';
  user: string | null;
}

export interface ProcessTreeNode extends ProcessInfo {
  children: ProcessTreeNode[];
  depth: number;
  isExpanded: boolean;
}

// Build process tree from flat list
export function buildProcessTree(
  processes: ProcessInfo[],
  expandedPids: Set<number>
): ProcessTreeNode[] {
  const processMap = new Map<number, ProcessTreeNode>();
  const rootNodes: ProcessTreeNode[] = [];

  // Create nodes
  for (const proc of processes) {
    processMap.set(proc.pid, {
      ...proc,
      children: [],
      depth: 0,
      isExpanded: expandedPids.has(proc.pid),
    });
  }

  // Build tree structure
  for (const proc of processes) {
    const node = processMap.get(proc.pid)!;
    if (proc.parent_pid && processMap.has(proc.parent_pid)) {
      const parent = processMap.get(proc.parent_pid)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

// Flatten tree for display (respecting expansion state)
export function flattenProcessTree(
  nodes: ProcessTreeNode[]
): ProcessTreeNode[] {
  const result: ProcessTreeNode[] = [];

  function traverse(node: ProcessTreeNode, depth: number) {
    const nodeWithDepth = { ...node, depth };
    result.push(nodeWithDepth);

    if (node.isExpanded && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  }

  for (const node of nodes) {
    traverse(node, 0);
  }

  return result;
}

// Get process type
export function getProcessType(proc: ProcessInfo): ProcessType {
  const systemProcesses = [
    'system', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe',
    'lsass.exe', 'svchost.exe', 'winlogon.exe', 'dwm.exe', 'conhost.exe',
    'ntoskrnl.exe', 'systemd', 'init', 'kthreadd', 'launchd', 'kernel_task'
  ];

  const serviceLikePatterns = [
    'daemon', 'service', 'server', 'agent', 'worker', 'host'
  ];

  const lowerName = proc.name.toLowerCase();

  if (systemProcesses.includes(lowerName) || proc.pid <= 4) {
    return 'system';
  }

  if (proc.user === 'SYSTEM' || proc.user === 'root' || proc.user === 'LOCAL SERVICE' || proc.user === 'NETWORK SERVICE') {
    return 'service';
  }

  if (serviceLikePatterns.some(pattern => lowerName.includes(pattern))) {
    return 'service';
  }

  return 'user';
}

// Get trust level based on signature and threat score
export function getTrustLevel(proc: ProcessInfo): TrustLevel {
  if (proc.threat_score != null && proc.threat_score > 0.7) {
    return 'suspicious';
  }
  if (proc.is_signed && proc.signer_name) {
    return 'trusted';
  }
  if (proc.threat_score != null && proc.threat_score > 0.3) {
    return 'suspicious';
  }
  // System processes are generally trusted
  if (proc.is_system) {
    return 'trusted';
  }
  return 'unknown';
}

// Filter processes
export function filterProcesses(
  processes: ProcessInfo[],
  filter: ProcessFilter
): ProcessInfo[] {
  return processes.filter((proc) => {
    // Search filter
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const matchesName = proc.name.toLowerCase().includes(search);
      const matchesPid = proc.pid.toString().includes(search);
      const matchesUser = (proc.user ?? '').toLowerCase().includes(search);
      const matchesPath = (proc.exe_path ?? '').toLowerCase().includes(search);

      if (!matchesName && !matchesPid && !matchesUser && !matchesPath) {
        return false;
      }
    }

    // Status filter
    if (filter.status !== 'all' && proc.status !== filter.status) {
      return false;
    }

    // Trust filter
    if (filter.trust !== 'all' && getTrustLevel(proc) !== filter.trust) {
      return false;
    }

    // Type filter
    if (filter.type !== 'all' && getProcessType(proc) !== filter.type) {
      return false;
    }

    // User filter
    if (filter.user && proc.user !== filter.user) {
      return false;
    }

    return true;
  });
}

// Hooks

export function useProcesses(refreshInterval = 2000) {
  const previousProcesses = useRef<Map<number, ProcessInfo>>(new Map());
  const [newPids, setNewPids] = useState<Set<number>>(new Set());
  const [exitedPids, setExitedPids] = useState<Set<number>>(new Set());

  const query = useQuery<ProcessInfo[]>({
    queryKey: ['processes'],
    queryFn: () => invoke<ProcessInfo[]>('get_processes'),
    refetchInterval: refreshInterval,
  });

  // Track new and exited processes
  useEffect(() => {
    if (query.data) {
      const currentPids = new Set(query.data.map(p => p.pid));
      const previousPids = new Set(previousProcesses.current.keys());

      // Find new processes
      const newOnes = new Set<number>();
      for (const pid of currentPids) {
        if (!previousPids.has(pid)) {
          newOnes.add(pid);
        }
      }

      // Find exited processes
      const exited = new Set<number>();
      for (const pid of previousPids) {
        if (!currentPids.has(pid)) {
          exited.add(pid);
        }
      }

      if (newOnes.size > 0) {
        setNewPids(newOnes);
        // Clear after animation
        setTimeout(() => setNewPids(new Set()), 2000);
      }

      if (exited.size > 0) {
        setExitedPids(exited);
        // Clear after notification
        setTimeout(() => setExitedPids(new Set()), 3000);
      }

      // Update previous state
      previousProcesses.current = new Map(
        query.data.map(p => [p.pid, p])
      );
    }
  }, [query.data]);

  return {
    ...query,
    newPids,
    exitedPids,
  };
}

export function useProcessDetails(pid: number | null) {
  return useQuery<ProcessDetails>({
    queryKey: ['process-details', pid],
    queryFn: () => invoke<ProcessDetails>('get_process_details', { pid }),
    enabled: pid !== null,
    refetchInterval: 5000,
  });
}

export function useKillProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pid, force }: { pid: number; force: boolean }) => {
      return invoke('kill_process', { pid, force });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useSuspendProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pid: number) => unsupportedCapability(`Process suspend for PID ${pid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useResumeProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pid: number) => unsupportedCapability(`Process resume for PID ${pid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useScanProcess() {
  return useMutation({
    mutationFn: ({ pid, scanType }: { pid: number; scanType: 'yara' | 'ml' | 'both' }) =>
      unsupportedCapability(`Process ${scanType} scan for PID ${pid}`),
  });
}

export function useAddToTrustList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ path, trusted }: { path: string; trusted: boolean }) =>
      unsupportedCapability(`${trusted ? 'Trust' : 'Untrust'} process path ${path}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useCreateDetectionRule() {
  return useMutation({
    mutationFn: ({ pid, ruleType }: { pid: number; ruleType: 'yara' | 'sigma' }) =>
      unsupportedCapability(`Detection rule generation (${ruleType}) for PID ${pid}`),
  });
}

export function useOpenFileLocation() {
  return useMutation({
    mutationFn: (path: string) => unsupportedCapability(`Open file location for ${path}`),
  });
}

// Real-time events
export function useProcessExitListener(callback: (pid: number, name: string) => void) {
  useEventListener<{ pid: number; name: string }>('process-exit',
    useCallback((payload) => callback(payload.pid, payload.name), [callback])
  );
}

export function useProcessStartListener(callback: (process: ProcessInfo) => void) {
  useEventListener<ProcessInfo>('process-start', callback);
}

// Unique users for filtering
export function useProcessUsers(processes: ProcessInfo[] | undefined): string[] {
  if (!processes) return [];

  const users = new Set(processes.map(p => p.user).filter((user): user is string => Boolean(user)));
  return Array.from(users).sort();
}
