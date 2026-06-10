import { useState } from 'react';
import { X, AlertTriangle, Calendar } from 'lucide-react';
import clsx from 'clsx';
import type { ExclusionType } from '../../hooks/useExclusions';

interface ExclusionFormProps {
  type: ExclusionType;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  isEditing?: boolean;
  isPending?: boolean;
  validationErrors?: string[];
  validationWarnings?: string[];
}

export function ExclusionForm({
  type,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  isPending = false,
  validationErrors = [],
  validationWarnings = [],
}: ExclusionFormProps) {
  const [formData, setFormData] = useState(
    initialData || getDefaultFormData(type)
  );
  const [useTemporaryExpiry, setUseTemporaryExpiry] = useState(
    !!initialData?.expires_at
  );
  const [expiryDays, setExpiryDays] = useState(7);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      type,
      expires_at: useTemporaryExpiry
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    };

    onSubmit(data);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Edit' : 'Add'} {getTypeLabel(type)} Exclusion
          </h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type-specific fields */}
          {type === 'path' && (
            <PathFormFields formData={formData} updateField={updateField} />
          )}
          {type === 'process' && (
            <ProcessFormFields formData={formData} updateField={updateField} />
          )}
          {type === 'extension' && (
            <ExtensionFormFields formData={formData} updateField={updateField} />
          )}
          {type === 'hash' && (
            <HashFormFields formData={formData} updateField={updateField} />
          )}

          {/* Common fields */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Reason / Note
            </label>
            <textarea
              value={formData.reason || ''}
              onChange={(e) => updateField('reason', e.target.value)}
              placeholder="Why is this exclusion needed?"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-20 resize-none"
            />
          </div>

          {/* Temporary exclusion */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={useTemporaryExpiry}
                onChange={(e) => setUseTemporaryExpiry(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Temporary exclusion (expires automatically)</span>
            </label>

            {useTemporaryExpiry && (
              <div className="flex items-center space-x-3 ml-6">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">Expires after</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                />
                <span className="text-sm text-gray-400">days</span>
              </div>
            )}
          </div>

          {/* Enabled toggle */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.enabled !== false}
                onChange={(e) => updateField('enabled', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Enabled</span>
            </label>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">Validation Errors</p>
                  <ul className="text-sm text-red-300 mt-1 space-y-1">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Validation warnings */}
          {validationWarnings.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-400">Warnings</p>
                  <ul className="text-sm text-yellow-300 mt-1 space-y-1">
                    {validationWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending || validationErrors.length > 0}
            >
              {isPending ? 'Saving...' : isEditing ? 'Update' : 'Add'} Exclusion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Path form fields
function PathFormFields({
  formData,
  updateField,
}: {
  formData: any;
  updateField: (field: string, value: any) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">
          Path <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.path || ''}
          onChange={(e) => updateField('path', e.target.value)}
          placeholder="C:\Program Files\MyApp or /opt/myapp"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          Supports wildcards: * (single level), ** (recursive)
        </p>
      </div>

      <div className="flex space-x-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_recursive || false}
            onChange={(e) => updateField('is_recursive', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Include subdirectories</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.use_wildcards || false}
            onChange={(e) => updateField('use_wildcards', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Use wildcards</span>
        </label>
      </div>
    </>
  );
}

// Process form fields
function ProcessFormFields({
  formData,
  updateField,
}: {
  formData: any;
  updateField: (field: string, value: any) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">
          Process Name
        </label>
        <input
          type="text"
          value={formData.process_name || ''}
          onChange={(e) => updateField('process_name', e.target.value)}
          placeholder="myapp.exe"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Process Path
        </label>
        <input
          type="text"
          value={formData.process_path || ''}
          onChange={(e) => updateField('process_path', e.target.value)}
          placeholder="C:\Program Files\MyApp\myapp.exe"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
        />
        <p className="text-xs text-gray-400 mt-1">
          Specify either name or full path (or both for stricter matching)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Publisher / Signer
        </label>
        <input
          type="text"
          value={formData.publisher || ''}
          onChange={(e) => updateField('publisher', e.target.value)}
          placeholder="Microsoft Corporation"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
        />
        <p className="text-xs text-gray-400 mt-1">
          Only trust if signed by this publisher
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.include_child_processes || false}
            onChange={(e) => updateField('include_child_processes', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Include child processes</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.exclude_network_activity || false}
            onChange={(e) => updateField('exclude_network_activity', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Exclude network activity monitoring</span>
        </label>
      </div>
    </>
  );
}

// Extension form fields
function ExtensionFormFields({
  formData,
  updateField,
}: {
  formData: any;
  updateField: (field: string, value: any) => void;
}) {
  const RISKY_EXTENSIONS = [
    '.exe', '.dll', '.scr', '.bat', '.cmd', '.ps1', '.vbs', '.js',
  ];

  const isRisky = formData.extension && RISKY_EXTENSIONS.some(
    (ext) => formData.extension.toLowerCase().includes(ext)
  );

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">
          Extension <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.extension || ''}
          onChange={(e) => updateField('extension', e.target.value)}
          placeholder=".txt or txt"
          className={clsx(
            'w-full bg-gray-700 border rounded-lg px-3 py-2',
            isRisky ? 'border-orange-500' : 'border-gray-600'
          )}
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          Enter with or without leading dot
        </p>
      </div>

      {isRisky && (
        <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-400">Risky Extension</p>
              <p className="text-sm text-orange-300 mt-1">
                This extension is commonly associated with executable files.
                Excluding it may allow malware to bypass detection.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Hash form fields
function HashFormFields({
  formData,
  updateField,
}: {
  formData: any;
  updateField: (field: string, value: any) => void;
}) {
  const isValidSha256 = formData.sha256 && /^[a-fA-F0-9]{64}$/.test(formData.sha256);

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-2">
          SHA256 Hash <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.sha256 || ''}
          onChange={(e) => updateField('sha256', e.target.value.trim())}
          placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          className={clsx(
            'w-full bg-gray-700 border rounded-lg px-3 py-2 font-mono text-sm',
            formData.sha256 && !isValidSha256
              ? 'border-red-500'
              : 'border-gray-600'
          )}
          required
        />
        {formData.sha256 && !isValidSha256 && (
          <p className="text-xs text-red-400 mt-1">
            Invalid SHA256 hash (must be 64 hexadecimal characters)
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Associated Filename
        </label>
        <input
          type="text"
          value={formData.associated_filename || ''}
          onChange={(e) => updateField('associated_filename', e.target.value)}
          placeholder="myfile.exe"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
        />
        <p className="text-xs text-gray-400 mt-1">
          Optional: helps identify the file this hash belongs to
        </p>
      </div>
    </>
  );
}

function getTypeLabel(type: ExclusionType): string {
  const labels: Record<ExclusionType, string> = {
    path: 'Path',
    process: 'Process',
    extension: 'Extension',
    hash: 'Hash',
  };
  return labels[type];
}

function getDefaultFormData(type: ExclusionType): any {
  const base = {
    enabled: true,
    reason: '',
    created_by: 'current_user', // Will be set by backend
  };

  switch (type) {
    case 'path':
      return {
        ...base,
        path: '',
        is_recursive: false,
        use_wildcards: false,
      };
    case 'process':
      return {
        ...base,
        process_name: '',
        process_path: '',
        publisher: '',
        include_child_processes: false,
        exclude_network_activity: false,
      };
    case 'extension':
      return {
        ...base,
        extension: '',
      };
    case 'hash':
      return {
        ...base,
        sha256: '',
        associated_filename: '',
      };
  }
}
