import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Filter,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDateSafe } from '../utils/dateUtils';

interface RuleQuality {
  rule_id: string;
  rule_name: string;
  detection_source: string;
  score: number | null;
  grade: string;
  total_alerts: number;
  fp_count: number;
  tp_count: number;
  breakdown: {
    precision: { score: number; value: number | null };
    volume: { score: number; alerts_per_day: number | null };
    trend: { score: number; direction: string };
  };
  recommendations: Array<{
    type: string;
    priority: string;
    message: string;
  }>;
}

interface QualityDashboardData {
  summary: {
    total_rules: number;
    average_score: number | null;
    overall_grade: string;
    grade_distribution: Record<string, number>;
  };
  by_source: Array<{
    source: string;
    rule_count: number;
    average_score: number | null;
    grade: string;
  }>;
  rules_needing_attention: RuleQuality[];
  all_rules: RuleQuality[];
}

interface RuleQualityDashboardProps {
  organizationId: string;
  onFetchDashboard: () => Promise<QualityDashboardData>;
  onFetchTrend: (days: number) => Promise<Array<{ date: string; fp_rate: number; precision: number | null }>>;
}

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
  'N/A': '#6b7280',
};

const SOURCE_COLORS: Record<string, string> = {
  yara: '#3b82f6',
  sigma: '#8b5cf6',
  ml: '#06b6d4',
  behavioral: '#f59e0b',
  ioc: '#ec4899',
};

export function RuleQualityDashboard({
  organizationId,
  onFetchDashboard,
  onFetchTrend,
}: RuleQualityDashboardProps) {
  const [dashboardData, setDashboardData] = useState<QualityDashboardData | null>(null);
  const [trendData, setTrendData] = useState<Array<{ date: string; fp_rate: number; precision: number | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  useEffect(() => {
    fetchTrendData();
  }, [organizationId, trendDays]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await onFetchDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendData = async () => {
    try {
      const data = await onFetchTrend(trendDays);
      setTrendData(data);
    } catch (error) {
      console.error('Failed to fetch trend data:', error);
    }
  };

  const getGradeColor = (grade: string) => GRADE_COLORS[grade] || GRADE_COLORS['N/A'];

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'degrading':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredRules = selectedSource
    ? dashboardData?.all_rules.filter((r) => r.detection_source === selectedSource)
    : dashboardData?.all_rules;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12 text-gray-400">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <p>Failed to load quality dashboard</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  const gradeDistributionData = Object.entries(dashboardData.summary.grade_distribution).map(
    ([grade, count]) => ({ name: grade, value: count, color: GRADE_COLORS[grade] })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Rule Quality Dashboard</h2>
          <p className="text-gray-400">Monitor and improve detection rule performance</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Grade */}
        <div className="card">
          <div className="text-sm text-gray-400 mb-2">Overall Grade</div>
          <div className="flex items-center space-x-3">
            <span
              className="text-4xl font-bold"
              style={{ color: getGradeColor(dashboardData.summary.overall_grade) }}
            >
              {dashboardData.summary.overall_grade}
            </span>
            <div className="text-sm text-gray-400">
              {dashboardData.summary.average_score
                ? `${Math.round(dashboardData.summary.average_score * 100)}%`
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Total Rules */}
        <div className="card">
          <div className="text-sm text-gray-400 mb-2">Rules Analyzed</div>
          <div className="text-3xl font-bold">{dashboardData.summary.total_rules}</div>
        </div>

        {/* Rules Needing Attention */}
        <div className="card">
          <div className="text-sm text-gray-400 mb-2">Needs Attention</div>
          <div className="flex items-center space-x-2">
            <span className="text-3xl font-bold text-orange-400">
              {dashboardData.rules_needing_attention.length}
            </span>
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
        </div>

        {/* Top Source */}
        <div className="card">
          <div className="text-sm text-gray-400 mb-2">Best Performing Source</div>
          {dashboardData.by_source.length > 0 ? (
            <div className="text-lg font-semibold">
              {[...dashboardData.by_source].sort((a, b) => (b.average_score || 0) - (a.average_score || 0))[0]?.source}
            </div>
          ) : (
            <div className="text-gray-400">No data</div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={gradeDistributionData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {gradeDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quality by Source */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Quality by Detection Source</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dashboardData.by_source}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="source" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip
                formatter={(value: number) => `${Math.round(value * 100)}%`}
                contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
              />
              <Bar dataKey="average_score" name="Quality Score">
                {dashboardData.by_source.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SOURCE_COLORS[entry.source] || '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FP Rate Trend */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">False Positive Rate Trend</h3>
          <select
            value={trendDays}
            onChange={(e) => setTrendDays(parseInt(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tickFormatter={(date) => formatDateSafe(date, 'MM/dd')}
            />
            <YAxis stroke="#9ca3af" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip
              formatter={(value: number) => `${Math.round(value * 100)}%`}
              labelFormatter={(date) => formatDateSafe(date, 'PP')}
              contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
            />
            <Line type="monotone" dataKey="fp_rate" stroke="#ef4444" name="FP Rate" strokeWidth={2} />
            <Line type="monotone" dataKey="precision" stroke="#22c55e" name="Precision" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rules Needing Attention */}
      {dashboardData.rules_needing_attention.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span>Rules Needing Attention</span>
          </h3>
          <div className="space-y-3">
            {dashboardData.rules_needing_attention.slice(0, 5).map((rule) => (
              <div
                key={`${rule.detection_source}-${rule.rule_id}`}
                className="p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span
                      className="text-lg font-bold px-2 py-1 rounded"
                      style={{
                        color: getGradeColor(rule.grade),
                        backgroundColor: `${getGradeColor(rule.grade)}20`,
                      }}
                    >
                      {rule.grade}
                    </span>
                    <div>
                      <div className="font-medium">{rule.rule_name || rule.rule_id}</div>
                      <div className="text-sm text-gray-400">{rule.detection_source}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={clsx('text-lg font-semibold', getScoreColor(rule.score))}>
                      {rule.score ? `${Math.round(rule.score * 100)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {rule.fp_count} FPs / {rule.total_alerts} total
                    </div>
                  </div>
                </div>
                {rule.recommendations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    {rule.recommendations.slice(0, 2).map((rec, i) => (
                      <div key={i} className="text-sm text-gray-400 flex items-start space-x-2">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-xs',
                          rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        )}>
                          {rec.priority}
                        </span>
                        <span>{rec.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Rules Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">All Rules</h3>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedSource || ''}
              onChange={(e) => setSelectedSource(e.target.value || null)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-sm"
            >
              <option value="">All Sources</option>
              <option value="yara">YARA</option>
              <option value="sigma">Sigma</option>
              <option value="ml">ML</option>
              <option value="behavioral">Behavioral</option>
              <option value="ioc">IOC</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-2">Grade</th>
                <th className="pb-2">Rule</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Precision</th>
                <th className="pb-2">Trend</th>
                <th className="pb-2">Alerts</th>
                <th className="pb-2">FPs</th>
              </tr>
            </thead>
            <tbody>
              {(filteredRules || []).slice(0, 20).map((rule) => (
                <tr
                  key={`${rule.detection_source}-${rule.rule_id}`}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30"
                >
                  <td className="py-2">
                    <span
                      className="font-bold"
                      style={{ color: getGradeColor(rule.grade) }}
                    >
                      {rule.grade}
                    </span>
                  </td>
                  <td className="py-2 max-w-xs truncate">{rule.rule_name || rule.rule_id}</td>
                  <td className="py-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${SOURCE_COLORS[rule.detection_source] || '#6b7280'}20`,
                        color: SOURCE_COLORS[rule.detection_source] || '#6b7280',
                      }}
                    >
                      {rule.detection_source}
                    </span>
                  </td>
                  <td className={clsx('py-2', getScoreColor(rule.score))}>
                    {rule.score ? `${Math.round(rule.score * 100)}%` : 'N/A'}
                  </td>
                  <td className="py-2">
                    {rule.breakdown.precision.value
                      ? `${Math.round(rule.breakdown.precision.value * 100)}%`
                      : 'N/A'}
                  </td>
                  <td className="py-2">{getTrendIcon(rule.breakdown.trend.direction)}</td>
                  <td className="py-2">{rule.total_alerts}</td>
                  <td className="py-2 text-red-400">{rule.fp_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
