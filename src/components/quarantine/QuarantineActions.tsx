import { useState } from 'react';
import {
  Trash2,
  Download,
  FileJson,
  FileSpreadsheet,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';

interface QuarantineActionsProps {
  selectedCount: number;
  expiredCount: number;
  onDeleteSelected: () => void;
  onDeleteExpired: () => void;
  onExportReport: (format: 'csv' | 'json') => void;
  isDeletingSelected: boolean;
  isDeletingExpired: boolean;
  isExporting: boolean;
}

export function QuarantineActions({
  selectedCount,
  expiredCount,
  onDeleteSelected,
  onDeleteExpired,
  onExportReport,
  isDeletingSelected,
  isDeletingExpired,
  isExporting,
}: QuarantineActionsProps) {
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);
  const [showDeleteExpiredDialog, setShowDeleteExpiredDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleDeleteSelectedConfirm = () => {
    onDeleteSelected();
    setShowDeleteSelectedDialog(false);
  };

  const handleDeleteExpiredConfirm = () => {
    onDeleteExpired();
    setShowDeleteExpiredDialog(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {/* Delete Selected */}
        <button
          onClick={() => setShowDeleteSelectedDialog(true)}
          disabled={selectedCount === 0 || isDeletingSelected}
          className={clsx(
            'btn flex items-center space-x-2',
            selectedCount > 0
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Selected ({selectedCount})</span>
        </button>

        {/* Delete Expired */}
        <button
          onClick={() => setShowDeleteExpiredDialog(true)}
          disabled={expiredCount === 0 || isDeletingExpired}
          className={clsx(
            'btn flex items-center space-x-2',
            expiredCount > 0
              ? 'bg-orange-700 hover:bg-orange-600 text-white'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          )}
        >
          <Clock className="w-4 h-4" />
          <span>Delete Expired ({expiredCount})</span>
        </button>

        {/* Export Report */}
        <button
          onClick={() => setShowExportDialog(true)}
          disabled={isExporting}
          className="btn-secondary flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export Report</span>
        </button>
      </div>

      {/* Delete Selected Dialog */}
      {showDeleteSelectedDialog && (
        <ConfirmDialog
          title="Delete Selected Files"
          icon={Trash2}
          iconColor="red"
          message={`Are you sure you want to permanently delete ${selectedCount} selected file${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`}
          confirmLabel={isDeletingSelected ? 'Deleting...' : 'Delete Files'}
          confirmVariant="danger"
          onConfirm={handleDeleteSelectedConfirm}
          onCancel={() => setShowDeleteSelectedDialog(false)}
          isLoading={isDeletingSelected}
        />
      )}

      {/* Delete Expired Dialog */}
      {showDeleteExpiredDialog && (
        <ConfirmDialog
          title="Delete Expired Files"
          icon={Clock}
          iconColor="orange"
          message={`Are you sure you want to permanently delete ${expiredCount} expired file${expiredCount > 1 ? 's' : ''}? These files have exceeded their retention period.`}
          confirmLabel={isDeletingExpired ? 'Deleting...' : 'Delete Expired'}
          confirmVariant="danger"
          onConfirm={handleDeleteExpiredConfirm}
          onCancel={() => setShowDeleteExpiredDialog(false)}
          isLoading={isDeletingExpired}
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          onExport={(format) => {
            onExportReport(format);
            setShowExportDialog(false);
          }}
          onCancel={() => setShowExportDialog(false)}
          isLoading={isExporting}
        />
      )}
    </>
  );
}

interface ConfirmDialogProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: 'red' | 'orange' | 'yellow';
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ConfirmDialog({
  title,
  icon: Icon,
  iconColor,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  const iconColorClasses = {
    red: 'bg-red-900/50 text-red-500',
    orange: 'bg-orange-900/50 text-orange-500',
    yellow: 'bg-yellow-900/50 text-yellow-500',
  };

  const confirmClasses = {
    danger: 'btn-danger',
    warning: 'btn bg-orange-600 hover:bg-orange-500 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-lg ${iconColorClasses[iconColor]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>

        <p className="text-gray-400 mb-6">{message}</p>

        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmClasses[confirmVariant]}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExportDialogProps {
  onExport: (format: 'csv' | 'json') => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ExportDialog({ onExport, onCancel, isLoading }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-900/50 rounded-lg">
            <Download className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold">Export Quarantine Report</h3>
        </div>

        <p className="text-gray-400 mb-4">
          Select the format for your quarantine report export.
        </p>

        <div className="space-y-3 mb-6">
          <label
            className={clsx(
              'flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors',
              selectedFormat === 'csv'
                ? 'bg-primary-900/30 border-primary-600'
                : 'bg-gray-750 border-gray-600 hover:border-gray-500'
            )}
          >
            <input
              type="radio"
              checked={selectedFormat === 'csv'}
              onChange={() => setSelectedFormat('csv')}
              className="w-4 h-4"
            />
            <FileSpreadsheet className="w-6 h-6 text-green-500" />
            <div>
              <p className="font-medium">CSV Format</p>
              <p className="text-sm text-gray-400">
                Spreadsheet compatible, good for Excel/Google Sheets
              </p>
            </div>
          </label>

          <label
            className={clsx(
              'flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors',
              selectedFormat === 'json'
                ? 'bg-primary-900/30 border-primary-600'
                : 'bg-gray-750 border-gray-600 hover:border-gray-500'
            )}
          >
            <input
              type="radio"
              checked={selectedFormat === 'json'}
              onChange={() => setSelectedFormat('json')}
              className="w-4 h-4"
            />
            <FileJson className="w-6 h-6 text-orange-500" />
            <div>
              <p className="font-medium">JSON Format</p>
              <p className="text-sm text-gray-400">
                Structured data, good for programmatic processing
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => onExport(selectedFormat)}
            disabled={isLoading}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{isLoading ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
