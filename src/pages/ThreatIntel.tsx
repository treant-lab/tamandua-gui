import { useState } from 'react';
import { Activity, Database, Radio, Search, ShieldAlert } from 'lucide-react';
import { IOCCard } from '../components/threatintel/IOCCard';
import {
  useIOCStats,
  useThreatIntelFeed,
  type ConfidenceLevel,
  type IOCFilter,
  type IOCType,
} from '../hooks/useThreatIntel';

const IOC_TYPES: IOCType[] = ['ip', 'domain', 'url', 'email', 'md5', 'sha1', 'sha256'];
const CONFIDENCE: ConfidenceLevel[] = ['critical', 'high', 'medium', 'low'];

export function ThreatIntel() {
  const [filter, setFilter] = useState<IOCFilter>({ limit: 100 });
  const { data: iocs = [], isLoading } = useThreatIntelFeed(filter);
  const { data: stats } = useIOCStats();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Threat Intelligence</h1>
          <p className="mt-1 text-gray-400">IOC feed, local matches and confidence triage.</p>
        </div>
        <div className="grid grid-cols-4 gap-3 text-right">
          <HeaderMetric icon={Database} label="IOCs" value={String(stats?.total ?? iocs.length)} />
          <HeaderMetric icon={Radio} label="Active" value={String(stats?.active_count ?? '-')} />
          <HeaderMetric icon={Activity} label="Matched" value={String(stats?.matched_count ?? '-')} />
          <HeaderMetric icon={ShieldAlert} label="24h" value={String(stats?.recent_24h ?? '-')} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={filter.search || ''}
              onChange={(event) =>
                setFilter({ ...filter, search: event.target.value || undefined })
              }
              placeholder="Search value, tag, source or description..."
              className="w-full rounded-lg border border-gray-600 bg-gray-900 py-2 pl-10 pr-3 text-sm text-gray-100 outline-none focus:border-primary-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={filter.has_matches || false}
              onChange={(event) =>
                setFilter({ ...filter, has_matches: event.target.checked || undefined })
              }
              className="h-4 w-4"
            />
            Matched only
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {IOC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleFilterValue(filter, setFilter, 'types', type)}
              className={`rounded-full border px-3 py-1 text-xs uppercase ${
                filter.types?.includes(type)
                  ? 'border-primary-500 bg-primary-600 text-white'
                  : 'border-gray-600 bg-gray-700 text-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
          {CONFIDENCE.map((confidence) => (
            <button
              key={confidence}
              onClick={() => toggleFilterValue(filter, setFilter, 'confidence_levels', confidence)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                filter.confidence_levels?.includes(confidence)
                  ? 'border-amber-500 bg-amber-600 text-white'
                  : 'border-gray-600 bg-gray-700 text-gray-300'
              }`}
            >
              {confidence}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-400">
            Loading threat intelligence...
          </div>
        ) : iocs.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-400">
            No IOCs match the current filters.
          </div>
        ) : (
          iocs.map((ioc) => <IOCCard key={ioc.id} ioc={ioc} />)
        )}
      </div>
    </div>
  );
}

function toggleFilterValue<K extends 'types' | 'confidence_levels'>(
  filter: IOCFilter,
  setFilter: (filter: IOCFilter) => void,
  key: K,
  value: NonNullable<IOCFilter[K]>[number]
) {
  const current = (filter[key] || []) as typeof value[];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  setFilter({ ...filter, [key]: next.length > 0 ? next : undefined });
}

function HeaderMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
      <Icon className="ml-auto h-4 w-4 text-gray-500" />
      <p className="mt-2 text-xl font-semibold text-gray-100">{value}</p>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
