import { invoke } from '@tauri-apps/api/tauri';

export interface PrivilegeStatus {
  is_elevated: boolean;
  can_read_agent_token: boolean;
  platform: string;
  elevation_hint: string;
}

type ConfirmFn = (options: {
  title: string;
  message: string;
  confirmText: string;
  variant: 'warning' | 'danger';
}) => Promise<boolean>;

type ToastApi = {
  info: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
};

export async function getPrivilegeStatus(): Promise<PrivilegeStatus> {
  return invoke<PrivilegeStatus>('get_privilege_status');
}

export async function ensureElevatedForAgentAction(
  confirm: ConfirmFn,
  toast: ToastApi,
): Promise<boolean> {
  const status = await getPrivilegeStatus();

  if (status.is_elevated) {
    return true;
  }

  if (status.platform === 'macos') {
    toast.info('macOS Authorization', status.elevation_hint);
    return true;
  }

  const confirmed = await confirm({
    title: 'Administrator Required',
    message: status.elevation_hint,
    confirmText: 'Restart as Administrator',
    variant: 'warning',
  });

  if (!confirmed) {
    return false;
  }

  try {
    await invoke('relaunch_as_administrator', { exitCurrent: true });
    toast.info('Elevation Requested', status.platform === 'windows' ? 'Approve the UAC prompt to continue.' : status.elevation_hint);
  } catch (err) {
    toast.error('Elevation Failed', String(err));
  }

  return false;
}
