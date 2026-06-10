import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XCircle,
  Pause,
  Play,
  FolderOpen,
  Search,
  ShieldCheck,
  ShieldBan,
  FileCode,
  Loader2,
  AlertTriangle,
  Lock,
  Check,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ProcessInfo,
  useKillProcess,
  useSuspendProcess,
  useResumeProcess,
  useScanProcess,
  useAddToTrustList,
  useCreateDetectionRule,
  useOpenFileLocation,
} from '../../hooks/useProcesses';
import { useAuth } from '../../hooks/useAuth';

interface ProcessActionsProps {
  selectedProcesses: ProcessInfo[];
  onActionComplete: () => void;
}

export function ProcessActions({
  selectedProcesses,
  onActionComplete,
}: ProcessActionsProps) {
  const [confirmAction, setConfirmAction] = useState<{
    type: 'kill' | 'suspend' | 'trust' | 'untrust';
    requiresAuth: boolean;
  } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [scanType, setScanType] = useState<'yara' | 'ml' | 'both'>('both');
  const [ruleType, setRuleType] = useState<'yara' | 'sigma'>('yara');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [generatedRule, setGeneratedRule] = useState<{ rule: string; filename: string } | null>(null);

  const killProcess = useKillProcess();
  const suspendProcess = useSuspendProcess();
  const resumeProcess = useResumeProcess();
  const scanProcess = useScanProcess();
  const addToTrustList = useAddToTrustList();
  const createDetectionRule = useCreateDetectionRule();
  const openFileLocation = useOpenFileLocation();
  const { requireAuth } = useAuth();

  const singleProcess = selectedProcesses.length === 1 ? selectedProcesses[0] : null;
  const hasCritical = selectedProcesses.some((p) => p.is_critical);
  const hasMultiple = selectedProcesses.length > 1;
  const someSuspended = selectedProcesses.some((p) => p.status === 'suspended');

  const handleKill = async (force: boolean = false) => {
    // Require authentication for critical action
    const authed = await requireAuth();
    if (!authed) return;

    if (hasCritical && !force) {
      // Double confirmation for critical processes
      setConfirmAction({ type: 'kill', requiresAuth: true });
      return;
    }

    if (hasMultiple && !confirmAction) {
      setConfirmAction({ type: 'kill', requiresAuth: false });
      return;
    }

    try {
      for (const proc of selectedProcesses) {
        await killProcess.mutateAsync({ pid: proc.pid, force });
      }
      onActionComplete();
    } catch (error) {
      console.error('Failed to kill process:', error);
    } finally {
      setConfirmAction(null);
      setAuthPassword('');
    }
  };

  const handleSuspend = async () => {
    try {
      for (const proc of selectedProcesses) {
        if (proc.status !== 'suspended') {
          await suspendProcess.mutateAsync(proc.pid);
        }
      }
      onActionComplete();
    } catch (error) {
      console.error('Failed to suspend process:', error);
    }
  };

  const handleResume = async () => {
    try {
      for (const proc of selectedProcesses) {
        if (proc.status === 'suspended') {
          await resumeProcess.mutateAsync(proc.pid);
        }
      }
      onActionComplete();
    } catch (error) {
      console.error('Failed to resume process:', error);
    }
  };

  const handleScan = async () => {
    if (!singleProcess) return;

    try {
      const result = await scanProcess.mutateAsync({
        pid: singleProcess.pid,
        scanType,
      });
      console.log('Scan result:', result);
      onActionComplete();
    } catch (error) {
      console.error('Failed to scan process:', error);
    }
  };

  const handleTrustList = async (trusted: boolean) => {
    if (!singleProcess) return;
    if (!singleProcess.exe_path) return;

    try {
      await addToTrustList.mutateAsync({
        path: singleProcess.exe_path,
        trusted,
      });
      onActionComplete();
    } catch (error) {
      console.error('Failed to add to trust list:', error);
    }
  };

  const handleCreateRule = async () => {
    if (!singleProcess) return;

    try {
      const result = await createDetectionRule.mutateAsync({
        pid: singleProcess.pid,
        ruleType,
      });
      setGeneratedRule(result);
      setShowRuleModal(true);
    } catch (error) {
      console.error('Failed to create detection rule:', error);
    }
  };

  const handleOpenLocation = async () => {
    if (!singleProcess) return;
    if (!singleProcess.exe_path) return;

    try {
      await openFileLocation.mutateAsync(singleProcess.exe_path);
    } catch (error) {
      console.error('Failed to open file location:', error);
    }
  };

  if (selectedProcesses.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <p className="text-gray-500 text-sm text-center">
          Select a process to see available actions
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-300">Actions</h3>
          <span className="text-xs text-gray-500">
            {selectedProcesses.length} selected
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Kill Process */}
          <ActionButton
            icon={XCircle}
            label="Kill Process"
            onClick={() => handleKill()}
            disabled={hasCritical && selectedProcesses.every((p) => p.is_critical)}
            loading={killProcess.isPending}
            danger
            tooltip={hasCritical ? 'Contains critical process - requires confirmation' : undefined}
          />

          {/* Suspend/Resume */}
          {someSuspended ? (
            <ActionButton
              icon={Play}
              label="Resume"
              onClick={handleResume}
              loading={resumeProcess.isPending}
            />
          ) : (
            <ActionButton
              icon={Pause}
              label="Suspend"
              onClick={handleSuspend}
              loading={suspendProcess.isPending}
            />
          )}

          {/* Open File Location (single only) */}
          <ActionButton
            icon={FolderOpen}
            label="Open Location"
            onClick={handleOpenLocation}
            disabled={!singleProcess}
            loading={openFileLocation.isPending}
          />

          {/* Scan (single only) */}
          <div className="relative">
            <ActionButton
              icon={Search}
              label="Scan"
              onClick={handleScan}
              disabled={!singleProcess}
              loading={scanProcess.isPending}
            />
            {singleProcess && (
              <select
                value={scanType}
                onChange={(e) => setScanType(e.target.value as 'yara' | 'ml' | 'both')}
                className="absolute right-1 top-1 text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5"
              >
                <option value="both">Both</option>
                <option value="yara">YARA</option>
                <option value="ml">ML</option>
              </select>
            )}
          </div>

          {/* Add to Trusted */}
          <ActionButton
            icon={ShieldCheck}
            label="Trust"
            onClick={() => handleTrustList(true)}
            disabled={!singleProcess}
            loading={addToTrustList.isPending}
          />

          {/* Add to Untrusted */}
          <ActionButton
            icon={ShieldBan}
            label="Block"
            onClick={() => handleTrustList(false)}
            disabled={!singleProcess}
            loading={addToTrustList.isPending}
            warning
          />

          {/* Create Detection Rule */}
          <div className="relative col-span-2">
            <ActionButton
              icon={FileCode}
              label="Create Detection Rule"
              onClick={handleCreateRule}
              disabled={!singleProcess}
              loading={createDetectionRule.isPending}
              fullWidth
            />
            {singleProcess && (
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as 'yara' | 'sigma')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5"
              >
                <option value="yara">YARA</option>
                <option value="sigma">Sigma</option>
              </select>
            )}
          </div>
        </div>

        {/* Critical Process Warning */}
        {hasCritical && (
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700 rounded-lg flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-400 font-medium">Critical Process Selected</p>
              <p className="text-amber-200/70">
                Killing this process may cause system instability.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmAction && (
          <ConfirmationDialog
            action={confirmAction}
            processes={selectedProcesses}
            onConfirm={() => {
              if (confirmAction.type === 'kill') {
                handleKill(true);
              }
            }}
            onCancel={() => {
              setConfirmAction(null);
              setAuthPassword('');
            }}
            authPassword={authPassword}
            onAuthPasswordChange={setAuthPassword}
          />
        )}
      </AnimatePresence>

      {/* Generated Rule Modal */}
      <AnimatePresence>
        {showRuleModal && generatedRule && (
          <RuleModal
            rule={generatedRule}
            onClose={() => {
              setShowRuleModal(false);
              setGeneratedRule(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  warning?: boolean;
  tooltip?: string;
  fullWidth?: boolean;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  danger,
  warning,
  tooltip,
  fullWidth,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip}
      className={clsx(
        'flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        disabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : danger
          ? 'bg-red-900/50 text-red-400 hover:bg-red-800/50 border border-red-700'
          : warning
          ? 'bg-orange-900/50 text-orange-400 hover:bg-orange-800/50 border border-orange-700'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600',
        fullWidth && 'col-span-2'
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span>{label}</span>
    </button>
  );
}

interface ConfirmationDialogProps {
  action: { type: string; requiresAuth: boolean };
  processes: ProcessInfo[];
  onConfirm: () => void;
  onCancel: () => void;
  authPassword: string;
  onAuthPasswordChange: (value: string) => void;
}

function ConfirmationDialog({
  action,
  processes,
  onConfirm,
  onCancel,
  authPassword,
  onAuthPasswordChange,
}: ConfirmationDialogProps) {
  const hasCritical = processes.some((p) => p.is_critical);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-50"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-red-900/50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Confirm Action</h3>
            <p className="text-sm text-gray-400">
              {action.type === 'kill'
                ? `Kill ${processes.length} process${processes.length > 1 ? 'es' : ''}?`
                : action.type}
            </p>
          </div>
        </div>

        {hasCritical && (
          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
            <p className="text-sm text-amber-400">
              <strong>Warning:</strong> You are about to kill critical system
              process(es). This may cause system instability or crashes.
            </p>
          </div>
        )}

        <div className="mb-4 max-h-32 overflow-auto">
          <p className="text-xs text-gray-500 mb-2">Affected processes:</p>
          {processes.map((p) => (
            <div
              key={p.pid}
              className="flex items-center justify-between text-sm py-1"
            >
              <span className={p.is_critical ? 'text-amber-400' : ''}>
                {p.name}
              </span>
              <span className="text-gray-500">PID {p.pid}</span>
            </div>
          ))}
        </div>

        {action.requiresAuth && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              Enter admin password to confirm
            </label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => onAuthPasswordChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500"
              placeholder="Password"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={onConfirm}
            disabled={action.requiresAuth && !authPassword}
            className={clsx(
              'flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors',
              action.requiresAuth && !authPassword
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            )}
          >
            <Check className="w-4 h-4" />
            <span>Confirm</span>
          </button>
        </div>
      </motion.div>
    </>
  );
}

interface RuleModalProps {
  rule: { rule: string; filename: string };
  onClose: () => void;
}

function RuleModal({ rule, onClose }: RuleModalProps) {
  const copyRule = () => {
    navigator.clipboard.writeText(rule.rule);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-h-[80vh] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold">Generated Detection Rule</h3>
            <p className="text-sm text-gray-400">{rule.filename}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="bg-gray-900 rounded-lg p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap">
            {rule.rule}
          </pre>
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t border-gray-700">
          <button
            onClick={copyRule}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <span>Copy to Clipboard</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <span>Done</span>
          </button>
        </div>
      </motion.div>
    </>
  );
}
