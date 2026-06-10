import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export type TimeRange = '1min' | '5min' | '15min' | '1hr' | '24hr';

export interface PerformanceDataPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  eventsPerSec: number;
  networkIn: number;
  networkOut: number;
}

export interface CollectorMetrics {
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  eventsPerSec: number;
  totalEvents: number;
  errors: number;
}

export interface PerformanceStats {
  min: number;
  max: number;
  avg: number;
  current: number;
}

export interface PerformanceMetrics {
  cpu: PerformanceStats;
  memory: PerformanceStats;
  eventsPerSec: PerformanceStats;
  networkIn: PerformanceStats;
  networkOut: PerformanceStats;
  dataPoints: PerformanceDataPoint[];
}

export interface RealtimeMetrics {
  cpu: number;
  memory: number;
  memoryPercent: number;
  eventsPerSec: number;
  networkIn: number;
  networkOut: number;
  collectors: CollectorMetrics[];
  timestamp: number;
}

export function usePerformanceMetrics(timeRange: TimeRange) {
  return useQuery<PerformanceMetrics>({
    queryKey: ['performanceMetrics', timeRange],
    queryFn: async () => {
      const [system, component] = await Promise.all([
        invoke<{
          cpu_usage: number;
          memory_total_mb: number;
          memory_used_mb: number;
        }>('get_system_metrics'),
        invoke<{
          collectors: Array<{ events_per_second: number }>;
        }>('get_component_status').catch(() => ({ collectors: [] })),
      ]);

      const memoryPercent =
        system.memory_total_mb > 0 ? (system.memory_used_mb / system.memory_total_mb) * 100 : 0;
      const eventsPerSec = component.collectors.reduce(
        (sum, collector) => sum + collector.events_per_second,
        0
      );
      const point = {
        timestamp: Date.now(),
        cpu: system.cpu_usage,
        memory: memoryPercent,
        eventsPerSec,
        networkIn: 0,
        networkOut: 0,
      };
      const stat = (current: number): PerformanceStats => ({
        min: current,
        max: current,
        avg: current,
        current,
      });

      return {
        cpu: stat(point.cpu),
        memory: stat(point.memory),
        eventsPerSec: stat(point.eventsPerSec),
        networkIn: stat(0),
        networkOut: stat(0),
        dataPoints: [point],
      };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<RealtimeMetrics>('performance-metrics', (event) => {
      setMetrics(event.payload);
      setIsConnected(true);
    }).then((handler) => {
      if (disposed) {
        handler();
      } else {
        unlisten = handler;
      }
    }).catch(() => setIsConnected(false));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return { metrics, isConnected };
}

export function useSparklineData(
  metric: 'cpu' | 'memory' | 'eventsPerSec' | 'networkIn' | 'networkOut',
  maxPoints = 30
) {
  const [data, setData] = useState<number[]>([]);
  const { metrics } = useRealtimeMetrics();

  useEffect(() => {
    if (metrics) {
      setData((prev) => [...prev, metrics[metric]].slice(-maxPoints));
    }
  }, [metrics, metric, maxPoints]);

  return data;
}

export function useCollectorPerformance() {
  const { metrics } = useRealtimeMetrics();
  return {
    collectors: metrics?.collectors || [],
    isLoading: !metrics,
  };
}
