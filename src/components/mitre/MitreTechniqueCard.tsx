import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  MitreTechnique,
  TechniqueCoverage,
  CoverageStatus,
  getCoverageColorClass,
} from '@/hooks/useMitre';

export interface MitreTechniqueCardProps {
  technique: MitreTechnique;
  coverage?: TechniqueCoverage;
  isSelected?: boolean;
  onClick?: (technique: MitreTechnique) => void;
  compact?: boolean;
}

export function MitreTechniqueCard({
  technique,
  coverage,
  isSelected = false,
  onClick,
  compact = false,
}: MitreTechniqueCardProps) {
  const status: CoverageStatus = coverage?.status || 'none';
  const colorClass = getCoverageColorClass(status);

  const handleClick = React.useCallback(() => {
    onClick?.(technique);
  }, [onClick, technique]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.(technique);
      }
    },
    [onClick, technique]
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-all duration-150',
          'border border-transparent',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-neutral-900',
          colorClass,
          isSelected && 'ring-2 ring-primary-400 ring-offset-1 ring-offset-neutral-900',
          technique.isSubtechnique && 'ml-2 text-[10px]'
        )}
        title={`${technique.id}: ${technique.name}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-white">
            {technique.isSubtechnique ? technique.id.split('.')[1] : technique.id.replace('T', '')}
          </span>
          {coverage && coverage.recentDetections > 0 && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-all duration-150',
        'border',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900',
        colorClass,
        isSelected && 'ring-2 ring-primary-400 ring-offset-2 ring-offset-neutral-900'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-300">
              {technique.id}
            </span>
            {technique.isSubtechnique && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                Sub
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-white mt-1 truncate">
            {technique.name}
          </h4>
          <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
            {technique.description}
          </p>
        </div>
        {coverage && (
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {coverage.recentDetections > 0 && (
              <span className="text-xs font-medium text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {coverage.recentDetections}
              </span>
            )}
            <span className="text-[10px] text-neutral-500">
              {coverage.detectionRules.length} rules
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

export interface TechniqueGridProps {
  techniques: MitreTechnique[];
  coverage: Record<string, TechniqueCoverage>;
  selectedTechniqueId?: string | null;
  onSelectTechnique?: (technique: MitreTechnique) => void;
  compact?: boolean;
}

export function TechniqueGrid({
  techniques,
  coverage,
  selectedTechniqueId,
  onSelectTechnique,
  compact = false,
}: TechniqueGridProps) {
  if (techniques.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        No techniques found matching the current filter.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-2',
        compact
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      )}
    >
      {techniques.map((technique) => (
        <MitreTechniqueCard
          key={technique.id}
          technique={technique}
          coverage={coverage[technique.id]}
          isSelected={selectedTechniqueId === technique.id}
          onClick={onSelectTechnique}
          compact={compact}
        />
      ))}
    </div>
  );
}
