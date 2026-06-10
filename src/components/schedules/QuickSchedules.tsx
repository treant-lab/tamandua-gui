import {
  useSchedules,
  useCreateQuickSchedule,
  QuickSchedulePreset,
} from '../../hooks/useSchedules';
import { Zap, Calendar, Check, Loader } from 'lucide-react';
import clsx from 'clsx';

interface QuickSchedulesProps {
  onCreated?: () => void;
}

export function QuickSchedules({ onCreated }: QuickSchedulesProps) {
  const { data: schedules } = useSchedules();
  const createQuickSchedule = useCreateQuickSchedule();

  const hasDailyQuickScan = schedules?.some(
    (s) => s.name === 'Daily Quick Scan'
  );
  const hasWeeklyFullScan = schedules?.some(
    (s) => s.name === 'Weekly Full Scan'
  );

  const handleCreatePreset = async (preset: QuickSchedulePreset) => {
    try {
      await createQuickSchedule.mutateAsync(preset);
      onCreated?.();
    } catch (err) {
      console.error('Failed to create quick schedule:', err);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Quick Schedules</h3>
      <p className="text-sm text-gray-400 mb-6">
        Get started quickly with these recommended scan schedules
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Quick Scan */}
        <QuickScheduleCard
          icon={Zap}
          title="Daily Quick Scan"
          description="Scan common threat locations daily at 12:00 PM"
          features={[
            'Downloads, Desktop, Temp folders',
            'Quick and lightweight',
            'Minimal system impact',
          ]}
          enabled={hasDailyQuickScan}
          isLoading={createQuickSchedule.isPending}
          onEnable={() => handleCreatePreset('daily_quick_scan')}
        />

        {/* Weekly Full Scan */}
        <QuickScheduleCard
          icon={Calendar}
          title="Weekly Full Scan"
          description="Full system scan every Sunday at 3:00 AM"
          features={[
            'Complete system coverage',
            'Runs during off-hours',
            'Auto-quarantine threats',
          ]}
          enabled={hasWeeklyFullScan}
          isLoading={createQuickSchedule.isPending}
          onEnable={() => handleCreatePreset('weekly_full_scan')}
        />
      </div>
    </div>
  );
}

interface QuickScheduleCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  features: string[];
  enabled: boolean | undefined;
  isLoading: boolean;
  onEnable: () => void;
}

function QuickScheduleCard({
  icon: Icon,
  title,
  description,
  features,
  enabled,
  isLoading,
  onEnable,
}: QuickScheduleCardProps) {
  return (
    <div
      className={clsx(
        'p-6 rounded-lg border-2 transition-colors',
        enabled
          ? 'border-green-800 bg-green-900/10'
          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-gray-700 rounded-lg">
          <Icon className="w-6 h-6 text-primary-400" />
        </div>
        {enabled && (
          <span className="badge bg-green-900 text-green-200">
            <Check className="w-3 h-3 mr-1" />
            Active
          </span>
        )}
      </div>

      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-sm text-gray-400 mb-4">{description}</p>

      <ul className="space-y-2 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center text-sm text-gray-300">
            <Check className="w-4 h-4 mr-2 text-green-400" />
            {feature}
          </li>
        ))}
      </ul>

      {!enabled && (
        <button
          onClick={onEnable}
          className="w-full btn-primary flex items-center justify-center space-x-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <span>Enable {title}</span>
          )}
        </button>
      )}

      {enabled && (
        <div className="text-center text-sm text-gray-500">
          Schedule is active - view in schedule list
        </div>
      )}
    </div>
  );
}
