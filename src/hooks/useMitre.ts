import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

export const MITRE_TACTICS = [
  { id: 'TA0043', name: 'Reconnaissance', shortName: 'Recon' },
  { id: 'TA0042', name: 'Resource Development', shortName: 'Resource Dev' },
  { id: 'TA0001', name: 'Initial Access', shortName: 'Initial Access' },
  { id: 'TA0002', name: 'Execution', shortName: 'Execution' },
  { id: 'TA0003', name: 'Persistence', shortName: 'Persistence' },
  { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc' },
  { id: 'TA0005', name: 'Defense Evasion', shortName: 'Defense Evasion' },
  { id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access' },
  { id: 'TA0007', name: 'Discovery', shortName: 'Discovery' },
  { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Move' },
  { id: 'TA0009', name: 'Collection', shortName: 'Collection' },
  { id: 'TA0011', name: 'Command and Control', shortName: 'C2' },
  { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfil' },
  { id: 'TA0040', name: 'Impact', shortName: 'Impact' },
] as const;

export type TacticId = typeof MITRE_TACTICS[number]['id'];
export type CoverageStatus = 'full' | 'partial' | 'none';

export interface MitreTechnique {
  id: string;
  name: string;
  tacticIds: TacticId[];
  description: string;
  isSubtechnique: boolean;
  parentId?: string;
  platforms: string[];
  dataSources: string[];
  url: string;
}

export interface TechniqueCoverage {
  techniqueId: string;
  status: CoverageStatus;
  detectionRules: DetectionRule[];
  recentDetections: number;
  lastDetection?: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  type: 'yara' | 'sigma' | 'ml' | 'behavioral';
  enabled: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface MitreCoverageStats {
  totalTechniques: number;
  coveredFull: number;
  coveredPartial: number;
  notCovered: number;
  coveragePercentage: number;
}

export interface TechniqueDetails extends MitreTechnique {
  coverage: TechniqueCoverage;
  mitigations: Mitigation[];
  relatedTechniques: string[];
}

export interface Mitigation {
  id: string;
  name: string;
  description: string;
}

const EMPTY_COVERAGE = {
  techniques: [] as MitreTechnique[],
  coverage: {} as Record<string, TechniqueCoverage>,
  stats: {
    totalTechniques: 0,
    coveredFull: 0,
    coveredPartial: 0,
    notCovered: 0,
    coveragePercentage: 0,
  },
};

export function useMitreCoverage() {
  return useQuery({
    queryKey: ['mitre', 'coverage'],
    queryFn: async () => EMPTY_COVERAGE,
    staleTime: Infinity,
  });
}

export function useMitreTechnique(techniqueId: string | null) {
  return useQuery<TechniqueDetails | null>({
    queryKey: ['mitre', 'technique', techniqueId],
    queryFn: async () => null,
    enabled: !!techniqueId,
    staleTime: Infinity,
  });
}

export interface MitreFilterState {
  coverageStatus: CoverageStatus | 'all';
  tacticId: TacticId | 'all';
  searchQuery: string;
  showSubtechniques: boolean;
}

export function useMitreFilter(
  techniques: MitreTechnique[],
  coverage: Record<string, TechniqueCoverage>
) {
  const [filter, setFilter] = useState<MitreFilterState>({
    coverageStatus: 'all',
    tacticId: 'all',
    searchQuery: '',
    showSubtechniques: true,
  });

  const filteredTechniques = useMemo(() => {
    return techniques.filter((technique) => {
      if (!filter.showSubtechniques && technique.isSubtechnique) return false;
      if (filter.tacticId !== 'all' && !technique.tacticIds.includes(filter.tacticId)) return false;
      if (filter.coverageStatus !== 'all') {
        const status = coverage[technique.id]?.status || 'none';
        if (status !== filter.coverageStatus) return false;
      }
      if (!filter.searchQuery) return true;
      const query = filter.searchQuery.toLowerCase();
      return (
        technique.id.toLowerCase().includes(query) ||
        technique.name.toLowerCase().includes(query) ||
        technique.description.toLowerCase().includes(query)
      );
    });
  }, [techniques, coverage, filter]);

  const updateFilter = useCallback((updates: Partial<MitreFilterState>) => {
    setFilter((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter({
      coverageStatus: 'all',
      tacticId: 'all',
      searchQuery: '',
      showSubtechniques: true,
    });
  }, []);

  return { filter, filteredTechniques, updateFilter, resetFilter };
}

export function getTechniquesByTactic(
  techniques: MitreTechnique[],
  tacticId: TacticId
): MitreTechnique[] {
  return techniques.filter((technique) => technique.tacticIds.includes(tacticId));
}

export function getCoverageColorClass(status: CoverageStatus): string {
  switch (status) {
    case 'full':
      return 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500';
    case 'partial':
      return 'bg-amber-600 hover:bg-amber-500 border-amber-500';
    case 'none':
      return 'bg-neutral-700 hover:bg-neutral-600 border-neutral-600';
  }
}

export function getCoverageLabel(status: CoverageStatus): string {
  switch (status) {
    case 'full':
      return 'Full Coverage';
    case 'partial':
      return 'Partial Coverage';
    case 'none':
      return 'No Coverage';
  }
}
