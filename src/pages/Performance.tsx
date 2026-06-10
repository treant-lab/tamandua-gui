import { Activity, Cpu, HardDrive, MemoryStick, Server } from 'lucide-react';
import { useComponentStatus, useSystemMetrics } from '../hooks/useTauri';

export function Performance() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useSystemMetrics();
  const { data: componentStatus, isLoading: componentLoading } = useComponentStatus();
  const collectors = componentStatus?.collectors || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Performance Metrics</h1>
        <p className="mt-1 text-gray-400">Live system and collector metrics from IPC.</p>
      </div>

      {metricsError && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          Failed to load system metrics: {String(metricsError)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          icon={Cpu}
          label="CPU"
          value={metricsLoading ? '-' : `${metrics?.cpu_usage.toFixed(1) ?? 0}%`}
        />
        <MetricCard
          icon={MemoryStick}
          label="Memory"
          value={
            metricsLoading
              ? '-'
              : `${metrics?.memory_used_mb.toFixed(0) ?? 0} / ${metrics?.memory_total_mb.toFixed(0) ?? 0} MB`
          }
        />
        <MetricCard
          icon={Activity}
          label="Processes"
          value={metricsLoading ? '-' : String(metrics?.active_processes ?? 0)}
        />
        <MetricCard
          icon={Server}
          label="Collectors"
          value={componentLoading ? '-' : `${collectors.filter((c) => c.running).length}/${collectors.length}`}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
        <div className="border-b border-gray-700 bg-gray-900 px-4 py-3">
          <h2 className="font-semibold text-gray-100">Collectors</h2>
        </div>
        {componentLoading ? (
          <div className="p-6 text-gray-400">Loading collectors...</div>
        ) : collectors.length === 0 ? (
          <div className="p-6 text-gray-400">No collector metrics reported by the agent.</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {collectors.map((collector) => (
              <div key={collector.name} className="grid gap-4 px-4 py-3 md:grid-cols-[1fr_auto_auto_auto]">
                <div>
                  <p className="font-medium text-gray-100">{collector.name}</p>
                  {collector.last_error && <p className="text-sm text-red-400">{collector.last_error}</p>}
                </div>
                <span className={collector.running ? 'text-green-400' : 'text-gray-500'}>
                  {collector.running ? 'running' : 'stopped'}
                </span>
                <span className="text-gray-300">{collector.events_per_second.toFixed(1)} evt/s</span>
                <span className="text-gray-300">{(collector.memory_bytes / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
        <div className="border-b border-gray-700 bg-gray-900 px-4 py-3">
          <h2 className="font-semibold text-gray-100">Disks</h2>
        </div>
        <div className="divide-y divide-gray-700">
          {(metrics?.disk_usage || []).map((disk) => (
            <div key={disk.mount_point} className="grid gap-4 px-4 py-3 md:grid-cols-[1fr_auto_auto]">
              <div className="flex items-center gap-2 text-gray-100">
                <HardDrive className="h-4 w-4 text-gray-500" />
                {disk.mount_point}
              </div>
              <span className="text-gray-300">{disk.used_gb.toFixed(1)} / {disk.total_gb.toFixed(1)} GB</span>
              <span className="text-gray-300">{disk.usage_percent.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <Icon className="h-5 w-5 text-emerald-400" />
      <p className="mt-3 text-2xl font-semibold text-gray-100">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
