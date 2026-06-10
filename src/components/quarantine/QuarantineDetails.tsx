import { useState } from 'react';
import {
  X,
  FileText,
  Hash,
  Shield,
  Clock,
  User,
  AlertTriangle,
  Copy,
  ExternalLink,
  RotateCcw,
  Trash2,
  Download,
  Eye,
  Send,
  CheckCircle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import clsx from 'clsx';
import { formatBytes, copyToClipboard } from '../../lib/utils';
import type { QuarantinedFile } from '../../hooks/useQuarantine';

interface QuarantineDetailsProps {
  file: QuarantinedFile;
  onClose: () => void;
  onRestore: (fileId: string, options: { path?: string; scanAfter: boolean }) => void;
  onDelete: (fileId: string) => void;
  onSubmitVT: (fileId: string) => void;
  onExport: (fileId: string) => void;
  onViewHex: (fileId: string) => void;
  isRestoring: boolean;
  isDeleting: boolean;
  isSubmittingVT: boolean;
}

export function QuarantineDetails({
  file,
  onClose,
  onRestore,
  onDelete,
  onSubmitVT,
  onExport,
  onViewHex,
  isRestoring,
  isDeleting,
  isSubmittingVT,
}: QuarantineDetailsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [restorePath, setRestorePath] = useState('');
  const [scanAfterRestore, setScanAfterRestore] = useState(true);
  const [restoreToOriginal, setRestoreToOriginal] = useState(true);

  const daysUntilExpiry = differenceInDays(parseISO(file.expires_at), new Date());

  const handleCopy = async (text: string, field: string) => {
    await copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRestoreConfirm = () => {
    onRestore(file.id, {
      path: restoreToOriginal ? undefined : restorePath,
      scanAfter: scanAfterRestore,
    });
    setShowRestoreDialog(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(file.id);
    setShowDeleteDialog(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={getSeverityIconClass(file.severity)}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{file.filename}</h2>
              <p className="text-sm text-gray-400">{file.threat_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Information */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              File Information
            </h3>
            <div className="bg-gray-750 rounded-lg p-4 space-y-3">
              <DetailRow
                icon={FileText}
                label="Original Path"
                value={file.original_path}
                onCopy={() => handleCopy(file.original_path, 'path')}
                copied={copiedField === 'path'}
              />
              <DetailRow
                icon={FileText}
                label="File Size"
                value={formatBytes(file.size_bytes)}
              />
              <DetailRow
                icon={FileText}
                label="File Type"
                value={file.file_type}
              />
            </div>
          </section>

          {/* Hashes */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              File Hashes
            </h3>
            <div className="bg-gray-750 rounded-lg p-4 space-y-3">
              <DetailRow
                icon={Hash}
                label="MD5"
                value={file.hashes.md5}
                onCopy={() => handleCopy(file.hashes.md5, 'md5')}
                copied={copiedField === 'md5'}
                mono
              />
              <DetailRow
                icon={Hash}
                label="SHA1"
                value={file.hashes.sha1}
                onCopy={() => handleCopy(file.hashes.sha1, 'sha1')}
                copied={copiedField === 'sha1'}
                mono
              />
              <DetailRow
                icon={Hash}
                label="SHA256"
                value={file.hashes.sha256}
                onCopy={() => handleCopy(file.hashes.sha256, 'sha256')}
                copied={copiedField === 'sha256'}
                mono
              />
            </div>
          </section>

          {/* Detection Details */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Detection Details
            </h3>
            <div className="bg-gray-750 rounded-lg p-4 space-y-3">
              <DetailRow
                icon={Shield}
                label="Rule Name"
                value={file.detection_rule}
              />
              <DetailRow
                icon={Shield}
                label="Detection Source"
                value={file.detection_source.toUpperCase()}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Confidence</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-700 rounded-full h-2">
                    <div
                      className={clsx(
                        'h-2 rounded-full',
                        file.confidence >= 90
                          ? 'bg-red-500'
                          : file.confidence >= 70
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                      )}
                      style={{ width: `${file.confidence}%` }}
                    />
                  </div>
                  <span className="text-white font-medium">{file.confidence}%</span>
                </div>
              </div>
            </div>
          </section>

          {/* MITRE ATT&CK */}
          {file.mitre_attack.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                MITRE ATT&CK Mapping
              </h3>
              <div className="bg-gray-750 rounded-lg p-4">
                <div className="flex flex-wrap gap-2">
                  {file.mitre_attack.map((mapping, index) => (
                    <a
                      key={index}
                      href={`https://attack.mitre.org/techniques/${mapping.technique_id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-3 py-1 bg-red-900/50 text-red-200 rounded hover:bg-red-900 transition-colors"
                    >
                      <span className="font-mono text-xs">{mapping.technique_id}</span>
                      <span className="text-xs">-</span>
                      <span className="text-xs">{mapping.technique_name}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Quarantine Information */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              Quarantine Information
            </h3>
            <div className="bg-gray-750 rounded-lg p-4 space-y-3">
              <DetailRow
                icon={Clock}
                label="Quarantined At"
                value={format(parseISO(file.quarantined_at), 'PPpp')}
              />
              <DetailRow
                icon={User}
                label="Quarantined By"
                value={file.quarantined_by}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Days Until Auto-Delete</span>
                </div>
                <span
                  className={clsx(
                    'font-medium',
                    daysUntilExpiry <= 0
                      ? 'text-red-500'
                      : daysUntilExpiry <= 7
                      ? 'text-orange-500'
                      : 'text-green-500'
                  )}
                >
                  {daysUntilExpiry <= 0 ? 'Expired' : `${daysUntilExpiry} days`}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-700 p-6">
          <div className="flex flex-wrap gap-3">
            {file.can_restore && (
              <button
                onClick={() => setShowRestoreDialog(true)}
                disabled={isRestoring}
                className="btn bg-green-700 hover:bg-green-600 text-white flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restore</span>
              </button>
            )}
            <button
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="btn-danger flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
            <button
              onClick={() => onSubmitVT(file.id)}
              disabled={isSubmittingVT}
              className="btn-secondary flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Submit to VT</span>
            </button>
            <button
              onClick={() => onExport(file.id)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={() => onViewHex(file.id)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>View Hex</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {showRestoreDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-orange-900/50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold">Restore File</h3>
            </div>

            <p className="text-gray-400 mb-4">
              Are you sure you want to restore this file? This action may pose a
              security risk if the file is malicious.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={restoreToOriginal}
                    onChange={() => setRestoreToOriginal(true)}
                    className="w-4 h-4"
                  />
                  <span>Restore to original location</span>
                </label>
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  {file.original_path}
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={!restoreToOriginal}
                    onChange={() => setRestoreToOriginal(false)}
                    className="w-4 h-4"
                  />
                  <span>Restore to safe location (Downloads)</span>
                </label>
                {!restoreToOriginal && (
                  <input
                    type="text"
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    placeholder="Custom path (optional)"
                    className="w-full mt-2 ml-6 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                )}
              </div>

              <label className="flex items-center space-x-2 p-3 bg-gray-750 rounded-lg">
                <input
                  type="checkbox"
                  checked={scanAfterRestore}
                  onChange={(e) => setScanAfterRestore(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Scan file after restore</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRestoreDialog(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                disabled={isRestoring}
                className="btn bg-green-700 hover:bg-green-600 text-white"
              >
                {isRestoring ? 'Restoring...' : 'Restore File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-900/50 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold">Delete Permanently</h3>
            </div>

            <p className="text-gray-400 mb-6">
              Are you sure you want to permanently delete this quarantined file?
              This action cannot be undone.
            </p>

            <div className="bg-gray-750 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300 font-medium">{file.filename}</p>
              <p className="text-xs text-gray-500 mt-1">{file.original_path}</p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn-danger"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
}

function DetailRow({ icon: Icon, label, value, onCopy, copied, mono }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">{label}</span>
      </div>
      <div className="flex items-center space-x-2">
        <span
          className={clsx(
            'text-white truncate max-w-[300px]',
            mono && 'font-mono text-sm'
          )}
          title={value}
        >
          {value}
        </span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 hover:bg-gray-600 rounded transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function getSeverityIconClass(severity: string): string {
  const classes = {
    critical: 'p-2 bg-red-900/50 rounded-lg text-red-500',
    high: 'p-2 bg-orange-900/50 rounded-lg text-orange-500',
    medium: 'p-2 bg-yellow-900/50 rounded-lg text-yellow-500',
    low: 'p-2 bg-blue-900/50 rounded-lg text-blue-500',
  };
  return classes[severity as keyof typeof classes] || classes.low;
}
