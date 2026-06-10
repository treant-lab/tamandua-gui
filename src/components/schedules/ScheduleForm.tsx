import { useState } from 'react';
import {
  Schedule,
  ScheduleConfig,
  ScheduleFrequency,
  ScanOptions,
  DetectionAction,
  defaultScanOptions,
  getWeekdayOptions,
} from '../../hooks/useSchedules';
import { open } from '@tauri-apps/api/dialog';
import {
  FolderOpen,
  Plus,
  X,
  Zap,
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';

interface ScheduleFormProps {
  schedule?: Schedule | null;
  onSubmit: (config: ScheduleConfig) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ScheduleForm({
  schedule,
  onSubmit,
  onCancel,
  isLoading,
}: ScheduleFormProps) {
  const [name, setName] = useState(schedule?.name || '');
  const [scanType, setScanType] = useState<'quick' | 'full' | 'custom'>(
    schedule?.scan_type || 'quick'
  );
  const [frequencyType, setFrequencyType] = useState<
    'once' | 'daily' | 'weekly' | 'monthly' | 'cron'
  >(() => {
    if (schedule?.frequency) {
      return schedule.frequency.type;
    }
    return 'daily';
  });
  const [time, setTime] = useState(() => {
    if (schedule?.frequency) {
      if ('time' in schedule.frequency) {
        return schedule.frequency.time;
      }
    }
    return '12:00';
  });
  const [datetime, setDatetime] = useState(() => {
    if (schedule?.frequency && schedule.frequency.type === 'once') {
      return schedule.frequency.datetime;
    }
    return new Date().toISOString().slice(0, 16);
  });
  const [weekdays, setWeekdays] = useState<string[]>(() => {
    if (schedule?.frequency && schedule.frequency.type === 'weekly') {
      return schedule.frequency.days;
    }
    return ['Monday'];
  });
  const [monthDay, setMonthDay] = useState(() => {
    if (schedule?.frequency && schedule.frequency.type === 'monthly') {
      return schedule.frequency.day;
    }
    return 1;
  });
  const [cronExpression, setCronExpression] = useState(() => {
    if (schedule?.frequency && schedule.frequency.type === 'cron') {
      return schedule.frequency.expression;
    }
    return '0 12 * * *';
  });
  const [paths, setPaths] = useState<string[]>(schedule?.paths || []);
  const [options, setOptions] = useState<ScanOptions>(
    schedule?.options || defaultScanOptions
  );
  const [detectionAction, setDetectionAction] = useState<DetectionAction>(
    schedule?.detection_action || { type: 'alert' }
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleAddPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
      });

      if (selected) {
        const newPaths = Array.isArray(selected) ? selected : [selected];
        setPaths([...paths, ...newPaths.filter((p) => !paths.includes(p))]);
      }
    } catch (err) {
      console.error('Failed to select path:', err);
    }
  };

  const handleRemovePath = (index: number) => {
    setPaths(paths.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let frequency: ScheduleFrequency;
    switch (frequencyType) {
      case 'once':
        frequency = { type: 'once', datetime };
        break;
      case 'daily':
        frequency = { type: 'daily', time };
        break;
      case 'weekly':
        frequency = { type: 'weekly', days: weekdays, time };
        break;
      case 'monthly':
        frequency = { type: 'monthly', day: monthDay, time };
        break;
      case 'cron':
        frequency = { type: 'cron', expression: cronExpression };
        break;
    }

    const config: ScheduleConfig = {
      name,
      scan_type: scanType,
      frequency,
      paths,
      options,
      detection_action: detectionAction,
    };

    onSubmit(config);
  };

  const toggleWeekday = (day: string) => {
    if (weekdays.includes(day)) {
      setWeekdays(weekdays.filter((d) => d !== day));
    } else {
      setWeekdays([...weekdays, day]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Schedule Name */}
      <div>
        <label className="block text-sm font-medium mb-2">Schedule Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Daily Quick Scan"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
          required
        />
      </div>

      {/* Scan Type */}
      <div>
        <label className="block text-sm font-medium mb-2">Scan Type</label>
        <div className="grid grid-cols-3 gap-4">
          <ScanTypeOption
            value="quick"
            selected={scanType === 'quick'}
            onSelect={() => setScanType('quick')}
            icon={Zap}
            title="Quick Scan"
            description="Common threat locations"
          />
          <ScanTypeOption
            value="full"
            selected={scanType === 'full'}
            onSelect={() => setScanType('full')}
            icon={Shield}
            title="Full Scan"
            description="Entire system"
          />
          <ScanTypeOption
            value="custom"
            selected={scanType === 'custom'}
            onSelect={() => setScanType('custom')}
            icon={FolderOpen}
            title="Custom Scan"
            description="Selected paths"
          />
        </div>
      </div>

      {/* Custom Paths (for custom scan) */}
      {scanType === 'custom' && (
        <div>
          <label className="block text-sm font-medium mb-2">Scan Paths</label>
          <div className="space-y-2">
            {paths.map((path, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 bg-gray-700 rounded-lg px-3 py-2"
              >
                <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm truncate">{path}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePath(index)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddPath}
              className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
            >
              <Plus className="w-4 h-4" />
              <span>Add Path</span>
            </button>
          </div>
          {paths.length === 0 && (
            <p className="text-sm text-yellow-500 mt-2">
              Please add at least one path to scan
            </p>
          )}
        </div>
      )}

      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium mb-2">Frequency</label>
        <div className="space-y-4">
          {/* Frequency Type Selection */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'once', label: 'Once' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'cron', label: 'Custom (Cron)' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setFrequencyType(option.value as typeof frequencyType)
                }
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm transition-colors',
                  frequencyType === option.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Frequency Configuration */}
          <div className="bg-gray-800 rounded-lg p-4">
            {frequencyType === 'once' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Date and Time
                </label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
                />
              </div>
            )}

            {frequencyType === 'daily' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
                />
              </div>
            )}

            {frequencyType === 'weekly' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Days of the Week
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {getWeekdayOptions().map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={clsx(
                          'px-3 py-1 rounded text-sm transition-colors',
                          weekdays.includes(day.value)
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        )}
                      >
                        {day.label.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {frequencyType === 'monthly' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Day of Month
                  </label>
                  <select
                    value={monthDay}
                    onChange={(e) => setMonthDay(Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {frequencyType === 'cron' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Cron Expression
                </label>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 12 * * *"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Format: minute hour day month weekday (e.g., 0 12 * * * = daily
                  at noon)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detection Action */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Action on Detection
        </label>
        <div className="space-y-2">
          <label className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750">
            <input
              type="radio"
              name="detection_action"
              checked={detectionAction.type === 'alert'}
              onChange={() => setDetectionAction({ type: 'alert' })}
              className="w-4 h-4 text-primary-500"
            />
            <div>
              <div className="font-medium">Alert Only</div>
              <div className="text-sm text-gray-400">
                Send notification but take no action
              </div>
            </div>
          </label>
          <label className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750">
            <input
              type="radio"
              name="detection_action"
              checked={detectionAction.type === 'quarantine'}
              onChange={() => setDetectionAction({ type: 'quarantine' })}
              className="w-4 h-4 text-primary-500"
            />
            <div>
              <div className="font-medium">Quarantine Automatically</div>
              <div className="text-sm text-gray-400">
                Move detected threats to quarantine immediately
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Advanced Options</span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 bg-gray-800 rounded-lg p-4">
            {/* Scan Archives */}
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={options.scan_archives}
                onChange={(e) =>
                  setOptions({ ...options, scan_archives: e.target.checked })
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
              <div>
                <div className="font-medium">Scan Archive Files</div>
                <div className="text-sm text-gray-400">
                  Scan inside ZIP, TAR, 7z, and other archives
                </div>
              </div>
            </label>

            {/* Follow Symlinks */}
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={options.follow_symlinks}
                onChange={(e) =>
                  setOptions({ ...options, follow_symlinks: e.target.checked })
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
              <div>
                <div className="font-medium">Follow Symbolic Links</div>
                <div className="text-sm text-gray-400">
                  Follow symlinks when scanning directories
                </div>
              </div>
            </label>

            {/* CPU Priority */}
            <div>
              <label className="block text-sm font-medium mb-2">
                CPU Priority
              </label>
              <select
                value={options.cpu_priority}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    cpu_priority: e.target.value as 'low' | 'normal' | 'high',
                  })
                }
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-primary-500 focus:outline-none"
              >
                <option value="low">Low - Minimal system impact</option>
                <option value="normal">Normal - Balanced performance</option>
                <option value="high">High - Faster scans</option>
              </select>
            </div>

            {/* Skip if on Battery */}
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={options.skip_if_on_battery}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    skip_if_on_battery: e.target.checked,
                  })
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
              <div>
                <div className="font-medium">Skip if on Battery</div>
                <div className="text-sm text-gray-400">
                  Don't run scan when laptop is on battery power
                </div>
              </div>
            </label>

            {/* Wake to Scan */}
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={options.wake_to_scan}
                onChange={(e) =>
                  setOptions({ ...options, wake_to_scan: e.target.checked })
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
              <div>
                <div className="font-medium">Wake from Sleep</div>
                <div className="text-sm text-gray-400">
                  Wake computer from sleep to run scheduled scan
                </div>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={
            isLoading ||
            !name ||
            (scanType === 'custom' && paths.length === 0) ||
            (frequencyType === 'weekly' && weekdays.length === 0)
          }
        >
          {isLoading
            ? 'Saving...'
            : schedule
              ? 'Update Schedule'
              : 'Create Schedule'}
        </button>
      </div>
    </form>
  );
}

interface ScanTypeOptionProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function ScanTypeOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: ScanTypeOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'p-4 rounded-lg border-2 transition-colors text-left',
        selected
          ? 'border-primary-500 bg-primary-900/20'
          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
      )}
    >
      <Icon className={clsx('w-6 h-6 mb-2', selected ? 'text-primary-400' : 'text-gray-400')} />
      <div className="font-medium">{title}</div>
      <div className="text-sm text-gray-400">{description}</div>
    </button>
  );
}
