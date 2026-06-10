import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  MITRE_TACTICS,
  MitreTechnique,
  TechniqueCoverage,
  TacticId,
  getCoverageColorClass,
  getTechniquesByTactic,
} from '@/hooks/useMitre';

export interface MitreMatrixProps {
  techniques: MitreTechnique[];
  coverage: Record<string, TechniqueCoverage>;
  selectedTechniqueId?: string | null;
  onSelectTechnique?: (technique: MitreTechnique) => void;
  showSubtechniques?: boolean;
  highlightedTacticId?: TacticId | null;
}

interface TacticColumnProps {
  tacticId: TacticId;
  tacticName: string;
  shortName: string;
  techniques: MitreTechnique[];
  coverage: Record<string, TechniqueCoverage>;
  selectedTechniqueId?: string | null;
  onSelectTechnique?: (technique: MitreTechnique) => void;
  showSubtechniques?: boolean;
  isHighlighted?: boolean;
}

function TechniqueCell({
  technique,
  coverage,
  isSelected,
  onClick,
  isSubtechnique,
}: {
  technique: MitreTechnique;
  coverage?: TechniqueCoverage;
  isSelected: boolean;
  onClick: () => void;
  isSubtechnique: boolean;
}) {
  const status = coverage?.status || 'none';
  const colorClass = getCoverageColorClass(status);
  const hasRecentDetections = coverage && coverage.recentDetections > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full text-left px-2 py-1.5 rounded text-[11px] font-medium transition-all duration-150',
        'border border-transparent',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-neutral-900',
        colorClass,
        isSelected && 'ring-2 ring-primary-400 ring-offset-1 ring-offset-neutral-900',
        isSubtechnique && 'ml-2 opacity-90'
      )}
      title={`${technique.id}: ${technique.name}${hasRecentDetections ? ` (${coverage.recentDetections} recent detections)` : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-white">
          {isSubtechnique ? (
            <span className="opacity-70">.{technique.id.split('.')[1]}</span>
          ) : (
            technique.id.replace('T', '')
          )}
        </span>
        {hasRecentDetections && (
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        )}
      </div>
      {/* Tooltip on hover */}
      <div
        className={cn(
          'absolute z-50 hidden group-hover:block',
          'left-full ml-2 top-0',
          'w-48 p-2 rounded-md bg-neutral-800 border border-neutral-700 shadow-lg',
          'text-xs'
        )}
      >
        <p className="font-mono text-neutral-400 mb-1">{technique.id}</p>
        <p className="font-medium text-white mb-1">{technique.name}</p>
        {coverage && (
          <div className="flex items-center gap-2 text-neutral-400">
            <span>{coverage.detectionRules.length} rules</span>
            {hasRecentDetections && (
              <span className="text-red-400">{coverage.recentDetections} detections</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function TacticColumn({
  tacticId,
  tacticName,
  shortName,
  techniques,
  coverage,
  selectedTechniqueId,
  onSelectTechnique,
  showSubtechniques = true,
  isHighlighted = false,
}: TacticColumnProps) {
  // Group techniques: parent techniques first, then subtechniques under their parents
  const organizedTechniques = React.useMemo(() => {
    const parents = techniques.filter((t) => !t.isSubtechnique);
    const result: MitreTechnique[] = [];

    parents.forEach((parent) => {
      result.push(parent);
      if (showSubtechniques) {
        const subs = techniques.filter(
          (t) => t.isSubtechnique && t.parentId === parent.id
        );
        result.push(...subs);
      }
    });

    // Add orphan subtechniques (whose parents might not be in this tactic)
    if (showSubtechniques) {
      const orphanSubs = techniques.filter(
        (t) =>
          t.isSubtechnique &&
          !parents.some((p) => p.id === t.parentId)
      );
      result.push(...orphanSubs);
    }

    return result;
  }, [techniques, showSubtechniques]);

  // Calculate coverage stats for this tactic
  const stats = React.useMemo(() => {
    const parentTechniques = techniques.filter((t) => !t.isSubtechnique);
    let full = 0;
    let partial = 0;
    let none = 0;

    parentTechniques.forEach((t) => {
      const c = coverage[t.id];
      if (c?.status === 'full') full++;
      else if (c?.status === 'partial') partial++;
      else none++;
    });

    const total = parentTechniques.length;
    const coveragePercent = total > 0 ? Math.round(((full + partial * 0.5) / total) * 100) : 0;

    return { full, partial, none, total, coveragePercent };
  }, [techniques, coverage]);

  if (organizedTechniques.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col min-w-[140px] max-w-[180px]',
        isHighlighted && 'ring-2 ring-primary-500 rounded-lg'
      )}
    >
      {/* Tactic Header */}
      <div className="sticky top-0 bg-neutral-900 z-10 pb-2">
        <div className="px-2 py-2 bg-neutral-800 rounded-t-lg border border-neutral-700">
          <h3
            className="text-xs font-semibold text-white text-center truncate"
            title={tacticName}
          >
            {shortName}
          </h3>
          <p className="text-[10px] text-neutral-500 text-center mt-0.5">
            {tacticId}
          </p>
          {/* Coverage indicator */}
          <div className="flex items-center justify-center gap-1 mt-2">
            <div className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-[9px] text-neutral-400">{stats.full}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span className="text-[9px] text-neutral-400">{stats.partial}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-full bg-neutral-700" />
              <span className="text-[9px] text-neutral-400">{stats.none}</span>
            </div>
          </div>
          {/* Coverage bar */}
          <div className="mt-1.5 h-1 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${stats.coveragePercent}%` }}
            />
          </div>
          <p className="text-[9px] text-neutral-500 text-center mt-1">
            {stats.coveragePercent}% covered
          </p>
        </div>
      </div>

      {/* Technique Cells */}
      <div className="flex-1 space-y-1 px-1">
        {organizedTechniques.map((technique) => (
          <TechniqueCell
            key={technique.id}
            technique={technique}
            coverage={coverage[technique.id]}
            isSelected={selectedTechniqueId === technique.id}
            onClick={() => onSelectTechnique?.(technique)}
            isSubtechnique={technique.isSubtechnique}
          />
        ))}
      </div>
    </div>
  );
}

export function MitreMatrix({
  techniques,
  coverage,
  selectedTechniqueId,
  onSelectTechnique,
  showSubtechniques = true,
  highlightedTacticId,
}: MitreMatrixProps) {
  // Group techniques by tactic
  const tacticColumns = React.useMemo(() => {
    return MITRE_TACTICS.map((tactic) => ({
      ...tactic,
      techniques: getTechniquesByTactic(techniques, tactic.id),
    }));
  }, [techniques]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 pb-4 min-w-max">
        {tacticColumns.map((column) => (
          <TacticColumn
            key={column.id}
            tacticId={column.id}
            tacticName={column.name}
            shortName={column.shortName}
            techniques={column.techniques}
            coverage={coverage}
            selectedTechniqueId={selectedTechniqueId}
            onSelectTechnique={onSelectTechnique}
            showSubtechniques={showSubtechniques}
            isHighlighted={highlightedTacticId === column.id}
          />
        ))}
      </div>
    </div>
  );
}
