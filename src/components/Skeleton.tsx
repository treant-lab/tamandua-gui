import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <span
      className={clsx(
        'block bg-gray-700',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-none',
        variant === 'rounded' && 'rounded-lg',
        animation === 'pulse' && 'animate-pulse',
        animation === 'wave' && 'skeleton-wave',
        className
      )}
      style={style}
    />
  );
}

// Preset skeleton layouts for common use cases

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('p-4 space-y-3', className)}>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <table className="w-full">
        <thead className="bg-gray-800">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-900">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" animation="none" />
          <Skeleton className="h-8 w-16 mb-1" animation="none" />
          <Skeleton className="h-3 w-20" animation="none" />
        </div>
        <Skeleton variant="rounded" className="w-10 h-10" animation="none" />
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-4 border-b border-gray-700 last:border-0">
      <Skeleton variant="circular" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-8 w-20" variant="rounded" />
    </div>
  );
}

export function AlertCardSkeleton() {
  return (
    <div className="card border-l-4 border-gray-600 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-16" variant="rounded" animation="none" />
            <Skeleton className="h-5 w-12" variant="rounded" animation="none" />
          </div>
          <Skeleton className="h-5 w-2/3" animation="none" />
          <Skeleton className="h-4 w-full" animation="none" />
          <div className="flex space-x-4">
            <Skeleton className="h-3 w-32" animation="none" />
            <Skeleton className="h-3 w-24" animation="none" />
          </div>
        </div>
        <div className="flex flex-col space-y-2 ml-4">
          <Skeleton className="h-8 w-20" variant="rounded" animation="none" />
          <Skeleton className="h-8 w-20" variant="rounded" animation="none" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Hero Skeleton */}
      <div className="rounded-2xl border border-gray-700 p-6 bg-gray-800/50">
        <div className="flex items-center gap-4">
          <Skeleton variant="rounded" className="w-16 h-16" animation="none" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" animation="none" />
            <Skeleton className="h-4 w-64" animation="none" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <CardSkeleton className="rounded-xl border border-gray-700 bg-gray-800/50" />
          <CardSkeleton className="rounded-xl border border-gray-700 bg-gray-800/50" />
        </div>
        <div className="xl:col-span-1">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 space-y-3">
            <Skeleton className="h-5 w-32" animation="none" />
            {Array.from({ length: 3 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
