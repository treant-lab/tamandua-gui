import { useState } from 'react';
import {
  Schedule,
  ScheduleConfig,
  useCreateSchedule,
  useUpdateSchedule,
} from '../hooks/useSchedules';
import {
  ScheduleList,
  ScheduleForm,
  ScheduleStatus,
  QuickSchedules,
} from '../components/schedules';
import { Calendar, Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '../components/Toast';

type ViewMode = 'list' | 'create' | 'edit' | 'status';

export function ScheduledScans() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(
    null
  );
  const toast = useToast();

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  const handleCreate = () => {
    setSelectedSchedule(null);
    setViewMode('create');
  };

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setViewMode('edit');
  };

  const handleBack = () => {
    setSelectedSchedule(null);
    setViewMode('list');
  };

  const handleSubmit = async (config: ScheduleConfig) => {
    try {
      if (viewMode === 'edit' && selectedSchedule) {
        await updateSchedule.mutateAsync({
          scheduleId: selectedSchedule.id,
          config,
        });
        toast.success('Schedule updated', `Updated "${config.name}"`);
      } else {
        await createSchedule.mutateAsync(config);
        toast.success('Schedule created', `Created "${config.name}"`);
      }
      handleBack();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      toast.error('Failed to save schedule', String(err));
    }
  };

  return (
    <div className="p-8 space-y-6" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {viewMode !== 'list' && (
            <button
              onClick={handleBack}
              className="p-2 rounded-lg transition-colors"
              style={{ background: 'var(--surface)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--fg)' }} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Calendar className="w-8 h-8" style={{ color: 'var(--emerald-400)' }} />
              <span style={{ color: 'var(--fg)' }}>
                {viewMode === 'list' && 'Scheduled Scans'}
                {viewMode === 'create' && 'Create Schedule'}
                {viewMode === 'edit' && 'Edit Schedule'}
                {viewMode === 'status' && selectedSchedule?.name}
              </span>
            </h1>
            <p className="mt-1" style={{ color: 'var(--muted)' }}>
              {viewMode === 'list' &&
                'Automate your malware scanning with scheduled tasks'}
              {viewMode === 'create' &&
                'Configure a new scheduled scan'}
              {viewMode === 'edit' &&
                'Modify your scheduled scan settings'}
              {viewMode === 'status' &&
                'View scan progress and history'}
            </p>
          </div>
        </div>

        {viewMode === 'list' && (
          <button
            onClick={handleCreate}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              background: 'var(--emerald-500)',
              color: '#042012',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--emerald-400)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--emerald-500)')}
          >
            <Plus className="w-5 h-5" />
            <span>New Schedule</span>
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* Quick Schedules */}
          <QuickSchedules onCreated={() => {}} />

          {/* Schedule List */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--fg)' }}
            >
              All Schedules
            </h3>
            <ScheduleList onEdit={handleEdit} onCreate={handleCreate} />
          </div>
        </div>
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <div
          className="max-w-3xl rounded-xl p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
          }}
        >
          <ScheduleForm
            schedule={selectedSchedule}
            onSubmit={handleSubmit}
            onCancel={handleBack}
            isLoading={createSchedule.isPending || updateSchedule.isPending}
          />
        </div>
      )}

      {viewMode === 'status' && selectedSchedule && (
        <ScheduleStatus schedule={selectedSchedule} />
      )}
    </div>
  );
}
