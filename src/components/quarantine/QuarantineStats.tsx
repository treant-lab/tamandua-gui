import { useState } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { QuarantineStatistics } from '../../hooks/useQuarantine';

interface QuarantineStatsProps {
  statistics: QuarantineStatistics | undefined;
  isLoading: boolean;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export function QuarantineStats({ statistics, isLoading }: QuarantineStatsProps) {
  const [timeRange, setTimeRange] = useState<7 | 14 | 30 | 90>(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="text-center py-12 text-gray-400">
        No statistics available
      </div>
    );
  }

  // Filter trends based on selected time range
  const filteredTrends = statistics.trends.slice(-timeRange);

  // Format trend data for chart
  const trendData = filteredTrends.map((t) => ({
    ...t,
    date: format(parseISO(t.date), 'MMM d'),
    size_mb: t.size_bytes / (1024 * 1024),
  }));

  // Calculate trend direction
  const recentCount = filteredTrends.slice(-7).reduce((sum, t) => sum + t.count, 0);
  const previousCount = filteredTrends.slice(-14, -7).reduce((sum, t) => sum + t.count, 0);
  const trendDirection = recentCount > previousCount ? 'up' : recentCount < previousCount ? 'down' : 'stable';

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <div className="flex bg-gray-750 rounded-lg p-1">
          {([7, 14, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                timeRange === days
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Trend"
          value={trendDirection === 'up' ? 'Increasing' : trendDirection === 'down' ? 'Decreasing' : 'Stable'}
          icon={trendDirection === 'up' ? TrendingUp : TrendingDown}
          color={trendDirection === 'up' ? 'red' : trendDirection === 'down' ? 'green' : 'gray'}
        />
        <SummaryCard
          title="Avg. Days in Quarantine"
          value={`${statistics.average_days_in_quarantine.toFixed(1)}`}
          icon={Clock}
          color="blue"
        />
        <SummaryCard
          title="Total Restored"
          value={statistics.total_restored.toString()}
          icon={RotateCcw}
          color="green"
        />
        <SummaryCard
          title="Total Deleted"
          value={statistics.total_deleted.toString()}
          icon={Trash2}
          color="orange"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quarantine Trends Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Quarantine Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  name="Files"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="size_mb"
                  name="Size (MB)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Threat Families Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Threat Families</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statistics.threat_families}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
                  labelLine={{ stroke: '#6b7280' }}
                >
                  {statistics.threat_families.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Source Breakdown */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Detection Source Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statistics.detection_sources}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} (${props.payload.percentage.toFixed(1)}%)`,
                    'Count',
                  ]}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Threat Families Table */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Threat Family Details</h3>
          <div className="overflow-y-auto max-h-64">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="pb-2 text-sm font-medium text-gray-400">Family</th>
                  <th className="pb-2 text-sm font-medium text-gray-400 text-right">Count</th>
                  <th className="pb-2 text-sm font-medium text-gray-400 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {statistics.threat_families.map((family, index) => (
                  <tr key={family.name} className="border-b border-gray-750">
                    <td className="py-2">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm">{family.name}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-sm text-gray-300">
                      {family.count}
                    </td>
                    <td className="py-2 text-right text-sm text-gray-300">
                      {family.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'red' | 'green' | 'blue' | 'orange' | 'gray';
}

function SummaryCard({ title, value, icon: Icon, color }: SummaryCardProps) {
  const colorClasses = {
    red: 'bg-red-900/20 text-red-500 border-red-800',
    green: 'bg-green-900/20 text-green-500 border-green-800',
    blue: 'bg-blue-900/20 text-blue-500 border-blue-800',
    orange: 'bg-orange-900/20 text-orange-500 border-orange-800',
    gray: 'bg-gray-700/20 text-gray-400 border-gray-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
