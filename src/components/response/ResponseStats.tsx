import {
  Activity,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Zap,
  Shield,
  Ban,
  FileX,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import type { ResponseActionStats, ResponseActionType } from '../../hooks/useResponseActions';

interface ResponseStatsProps {
  stats: ResponseActionStats | undefined;
  isLoading: boolean;
}

const ACTION_TYPE_ICONS: Record<ResponseActionType, React.ComponentType<{ className?: string }>> = {
  kill_process: Zap,
  quarantine_file: FileX,
  block_ip: Ban,
  block_domain: Ban,
  isolate_host: WifiOff,
  restore_file: RotateCcw,
  unblock_ip: Wifi,
  unblock_domain: Wifi,
  unisolate_host: Wifi,
};

const ACTION_TYPE_LABELS: Record<ResponseActionType, string> = {
  kill_process: 'Kill Process',
  quarantine_file: 'Quarantine',
  block_ip: 'Block IP',
  block_domain: 'Block Domain',
  isolate_host: 'Isolate',
  restore_file: 'Restore',
  unblock_ip: 'Unblock',
  unblock_domain: 'Unblock Domain',
  unisolate_host: 'Unisolate',
};

export function ResponseStats({ stats, isLoading }: ResponseStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-8 bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No statistics available</p>
      </div>
    );
  }

  const trendIcon =
    stats.recent_trend === 'increasing'
      ? TrendingUp
      : stats.recent_trend === 'decreasing'
        ? TrendingDown
        : Minus;

  const trendColor =
    stats.recent_trend === 'increasing'
      ? 'text-red-400'
      : stats.recent_trend === 'decreasing'
        ? 'text-green-400'
        : 'text-gray-400';

  // Get top 4 action types by count
  const topActionTypes = Object.entries(stats.by_type)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Actions"
          value={stats.total_actions.toString()}
          icon={Activity}
          color="primary"
        />
        <StatCard
          title="Success Rate"
          value={`${stats.success_rate.toFixed(1)}%`}
          icon={CheckCircle}
          color="green"
          subtitle={`${stats.success_count} successful`}
        />
        <StatCard
          title="Failed"
          value={stats.failed_count.toString()}
          icon={XCircle}
          color="red"
          subtitle={
            stats.total_actions > 0
              ? `${((stats.failed_count / stats.total_actions) * 100).toFixed(1)}% failure rate`
              : undefined
          }
        />
        <StatCard
          title="Avg Response Time"
          value={formatDuration(stats.avg_response_time_ms)}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Action Types Breakdown */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Actions by Type</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(stats.by_type).map(([type, count]) => {
            const actionType = type as ResponseActionType;
            const Icon = ACTION_TYPE_ICONS[actionType] || Shield;
            const label = ACTION_TYPE_LABELS[actionType] || type;
            const percentage =
              stats.total_actions > 0 ? ((count / stats.total_actions) * 100).toFixed(0) : '0';

            return (
              <div
                key={type}
                className="flex items-center space-x-2 p-2 bg-gray-700 rounded-lg"
              >
                <div className="p-1.5 rounded bg-gray-700">
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 truncate">{label}</p>
                  <p className="text-sm font-semibold">
                    {count}
                    <span className="text-xs text-gray-500 ml-1">({percentage}%)</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trigger Source Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Triggered By</h3>
          <div className="space-y-2">
            {Object.entries(stats.by_trigger).map(([trigger, count]) => {
              const percentage =
                stats.total_actions > 0 ? (count / stats.total_actions) * 100 : 0;

              return (
                <div key={trigger} className="flex items-center space-x-3">
                  <span className="text-sm text-gray-400 w-24 capitalize">{trigger}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        trigger === 'rule'
                          ? 'bg-primary-500'
                          : trigger === 'manual'
                            ? 'bg-gray-500'
                            : 'bg-cyan-500'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-300 w-16 text-right">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Trend</h3>
          <div className="flex items-center justify-center h-24">
            <div className="text-center">
              {React.createElement(trendIcon, {
                className: clsx('w-12 h-12 mx-auto mb-2', trendColor),
              })}
              <p className={clsx('text-lg font-semibold capitalize', trendColor)}>
                {stats.recent_trend}
              </p>
              <p className="text-sm text-gray-500">Response activity trend</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'green' | 'red' | 'blue' | 'orange' | 'gray';
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-900/20 text-primary-500 border-primary-800',
    green: 'bg-green-900/20 text-green-500 border-green-800',
    red: 'bg-red-900/20 text-red-500 border-red-800',
    blue: 'bg-blue-900/20 text-blue-500 border-blue-800',
    orange: 'bg-orange-900/20 text-orange-500 border-orange-800',
    gray: 'bg-gray-700/20 text-gray-400 border-gray-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-lg border', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Need to import React for createElement
import * as React from 'react';
