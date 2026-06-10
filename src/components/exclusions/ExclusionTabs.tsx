import clsx from 'clsx';
import { Folder, Cpu, FileType, Hash } from 'lucide-react';
import type { ExclusionType } from '../../hooks/useExclusions';

interface ExclusionTabsProps {
  activeTab: ExclusionType;
  onTabChange: (tab: ExclusionType) => void;
  counts: {
    path: number;
    process: number;
    extension: number;
    hash: number;
  };
}

const tabs: {
  id: ExclusionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    id: 'path',
    label: 'Paths',
    icon: Folder,
    description: 'Files and folders to exclude from scanning',
  },
  {
    id: 'process',
    label: 'Processes',
    icon: Cpu,
    description: 'Process names and paths to trust',
  },
  {
    id: 'extension',
    label: 'Extensions',
    icon: FileType,
    description: 'File extensions to skip',
  },
  {
    id: 'hash',
    label: 'Hashes',
    icon: Hash,
    description: 'Specific file hashes to allow',
  },
];

export function ExclusionTabs({ activeTab, onTabChange, counts }: ExclusionTabsProps) {
  return (
    <div className="border-b border-gray-700">
      <nav className="flex space-x-1" aria-label="Exclusion types">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                'flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors',
                isActive
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              )}
              title={tab.description}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={clsx(
                    'ml-1 px-2 py-0.5 rounded-full text-xs',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
