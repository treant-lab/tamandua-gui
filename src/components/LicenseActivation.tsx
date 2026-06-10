import { useState } from 'react';
import {
  Key,
  Wifi,
  WifiOff,
  Smartphone,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Download,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';
import { useToast } from './Toast';
import {
  useActivateLicense,
  useValidateLicenseKey,
  useGenerateOfflineRequest,
  useCompleteOfflineActivation,
  useGenerateQRActivation,
  useDeactivateLicense,
  formatLicenseKey,
  LicenseType,
  getLicenseTypeLabel,
} from '../hooks/useLicense';
import { copyToClipboard } from '../lib/utils';

interface LicenseActivationProps {
  onSuccess?: () => void;
}

type ActivationMethod = 'online' | 'offline' | 'qr';

export function LicenseActivation({ onSuccess }: LicenseActivationProps) {
  const [method, setMethod] = useState<ActivationMethod>('online');
  const [licenseKey, setLicenseKey] = useState('');
  const [offlineResponse, setOfflineResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const activateLicense = useActivateLicense();
  const validateKey = useValidateLicenseKey();
  const generateOfflineRequest = useGenerateOfflineRequest();
  const completeOfflineActivation = useCompleteOfflineActivation();
  const generateQRActivation = useGenerateQRActivation();

  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    tier?: LicenseType;
    expires_at?: string;
    message: string;
  } | null>(null);

  const [offlineRequestCode, setOfflineRequestCode] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleKeyChange = (value: string) => {
    // Format the key as user types
    const formatted = formatLicenseKey(value, false);
    setLicenseKey(formatted);
    setValidationResult(null);
    setError(null);
  };

  const handleValidate = async () => {
    if (!licenseKey) return;

    try {
      const result = await validateKey.mutateAsync(licenseKey);
      setValidationResult(result);
      if (!result.valid) {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  const handleOnlineActivation = async () => {
    if (!licenseKey) return;

    try {
      setError(null);
      await activateLicense.mutateAsync({ license_key: licenseKey });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    }
  };

  const handleGenerateOfflineRequest = async () => {
    if (!licenseKey) return;

    try {
      setError(null);
      const requestCode = await generateOfflineRequest.mutateAsync(licenseKey);
      setOfflineRequestCode(requestCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate request');
    }
  };

  const handleCompleteOfflineActivation = async () => {
    if (!offlineResponse) return;

    try {
      setError(null);
      await completeOfflineActivation.mutateAsync(offlineResponse);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offline activation failed');
    }
  };

  const handleGenerateQR = async () => {
    if (!licenseKey) return;

    try {
      setError(null);
      const qr = await generateQRActivation.mutateAsync(licenseKey);
      setQrCode(qr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    await copyToClipboard(text);
    toast.success('Copied', 'Text copied to clipboard');
  };

  const handleDownloadRequest = () => {
    if (!offlineRequestCode) return;

    const blob = new Blob([offlineRequestCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tamandua-activation-request.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
        <Key className="w-5 h-5" />
        <span>License Activation</span>
      </h2>

      {/* License Key Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">License Key</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 font-mono text-lg tracking-wider uppercase"
            maxLength={19}
          />
          <button
            onClick={handleValidate}
            disabled={!licenseKey || validateKey.isPending}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm disabled:opacity-50"
          >
            {validateKey.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Validate'
            )}
          </button>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <div
            className={clsx(
              'mt-3 p-3 rounded-lg flex items-start space-x-2',
              validationResult.valid
                ? 'bg-green-900/30 text-green-300'
                : 'bg-red-900/30 text-red-300'
            )}
          >
            {validationResult.valid ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p>{validationResult.message}</p>
              {validationResult.tier && (
                <p className="text-sm mt-1">
                  Tier: <strong>{getLicenseTypeLabel(validationResult.tier)}</strong>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activation Method Tabs */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3">Activation Method</label>
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
          {[
            { id: 'online', label: 'Online', icon: Wifi },
            { id: 'offline', label: 'Offline', icon: WifiOff },
            { id: 'qr', label: 'QR Code', icon: Smartphone },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMethod(id as ActivationMethod)}
              className={clsx(
                'flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors',
                method === id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Online Activation */}
      {method === 'online' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Online activation requires an internet connection. The license will be validated
            against Tamandua licensing servers.
          </p>

          {error && (
            <div className="p-3 bg-red-900/30 text-red-300 rounded-lg flex items-center space-x-2">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleOnlineActivation}
            disabled={!licenseKey || activateLicense.isPending}
            className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
          >
            {activateLicense.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Wifi className="w-5 h-5" />
                <span>Activate Online</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Offline Activation */}
      {method === 'offline' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            For systems without internet access. Generate a request file, activate it on another
            device, and enter the response code here.
          </p>

          {!offlineRequestCode ? (
            <div className="space-y-4">
              <button
                onClick={handleGenerateOfflineRequest}
                disabled={!licenseKey || generateOfflineRequest.isPending}
                className="w-full btn-secondary flex items-center justify-center space-x-2 py-3"
              >
                {generateOfflineRequest.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Generate Activation Request</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Request Code */}
              <div className="p-4 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Activation Request Code</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyToClipboard(offlineRequestCode)}
                      className="p-1.5 text-gray-400 hover:text-gray-200"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleDownloadRequest}
                      className="p-1.5 text-gray-400 hover:text-gray-200"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {offlineRequestCode}
                </pre>
              </div>

              <div className="text-sm text-gray-400">
                <p className="mb-2">Steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy or download the request code above</li>
                  <li>Visit https://activate.treantlab.org on a device with internet</li>
                  <li>Paste the request code and get the response</li>
                  <li>Enter the response code below</li>
                </ol>
              </div>

              {/* Response Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Activation Response Code
                </label>
                <textarea
                  value={offlineResponse}
                  onChange={(e) => setOfflineResponse(e.target.value)}
                  placeholder="Paste the response code here..."
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 text-red-300 rounded-lg flex items-center space-x-2">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleCompleteOfflineActivation}
                disabled={!offlineResponse || completeOfflineActivation.isPending}
                className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
              >
                {completeOfflineActivation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Complete Activation</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR Code Activation */}
      {method === 'qr' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Scan the QR code with the Tamandua mobile app to complete activation.
          </p>

          {!qrCode ? (
            <button
              onClick={handleGenerateQR}
              disabled={!licenseKey || generateQRActivation.isPending}
              className="w-full btn-secondary flex items-center justify-center space-x-2 py-3"
            >
              {generateQRActivation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Smartphone className="w-5 h-5" />
                  <span>Generate QR Code</span>
                </>
              )}
            </button>
          ) : (
            <div className="text-center">
              <div className="inline-block p-4 bg-white rounded-lg">
                <img
                  src={qrCode}
                  alt="Activation QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="mt-4 text-sm text-gray-400">
                Scan this QR code with the Tamandua mobile app
              </p>
              <button
                onClick={() => setQrCode(null)}
                className="mt-2 text-sm text-primary-400 hover:text-primary-300"
              >
                Generate new QR code
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900/30 text-red-300 rounded-lg flex items-center space-x-2">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Deactivation component
export function LicenseDeactivation({ onSuccess }: { onSuccess?: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const deactivate = useDeactivateLicense();
  const toast = useToast();

  const handleDeactivate = async () => {
    if (confirmText !== 'DEACTIVATE') return;

    try {
      await deactivate.mutateAsync();
      onSuccess?.();
    } catch (error) {
      toast.error('Deactivation failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-red-900 p-6">
      <h3 className="text-lg font-semibold text-red-400 mb-4">Deactivate License</h3>
      <p className="text-sm text-gray-400 mb-4">
        Deactivating your license will allow you to transfer it to another system.
        All premium features will be disabled on this system.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Type "DEACTIVATE" to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
          />
        </div>
        <button
          onClick={handleDeactivate}
          disabled={confirmText !== 'DEACTIVATE' || deactivate.isPending}
          className="btn-danger w-full py-2 disabled:opacity-50"
        >
          {deactivate.isPending ? 'Deactivating...' : 'Deactivate License'}
        </button>
      </div>
    </div>
  );
}
