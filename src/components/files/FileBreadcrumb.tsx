import { ChevronRight, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface FileBreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  className?: string;
}

export function FileBreadcrumb({ items, onNavigate, className }: FileBreadcrumbProps) {
  return (
    <nav
      className={cn(
        'flex items-center gap-1 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700 overflow-x-auto',
        className
      )}
      aria-label="File path breadcrumb"
    >
      {items.map((item, index) => (
        <div key={item.path} className="flex items-center gap-1 shrink-0">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
          )}
          <button
            onClick={() => onNavigate(item.path)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors',
              index === items.length - 1
                ? 'bg-primary-600/20 text-primary-400 font-medium'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            )}
            disabled={index === items.length - 1}
          >
            {index === 0 && <HardDrive className="w-4 h-4" />}
            <span className="truncate max-w-32">{item.name}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
