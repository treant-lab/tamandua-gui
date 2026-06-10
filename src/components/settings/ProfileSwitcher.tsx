import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sliders, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProfileManager, type PerformanceProfile } from '../../hooks/useProfile';
import { ProfileCard, type ProfileInfo } from './ProfileCard';
import { ProfileConfirmDialog } from './ProfileConfirmDialog';
import { cn } from '@/lib/utils';

export type { PerformanceProfile } from '../../hooks/useProfile';

export function ProfileSwitcher() {
  const { requireAuth } = useAuth();
  const {
    currentProfile,
    profilesInfo,
    isLoading,
    isChanging,
    error: mutationError,
    changeProfile,
    refetch,
  } = useProfileManager();

  const [selectedProfile, setSelectedProfile] = useState<ProfileInfo | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleProfileSelect = (profile: ProfileInfo) => {
    if (profile.profile !== currentProfile) {
      setSelectedProfile(profile);
      setError(null);
      setSuccessMessage(null);
      setConfirmDialogOpen(true);
    }
  };

  const handleConfirmChange = useCallback(async () => {
    if (!selectedProfile) return;

    // Require authentication for security-sensitive profile changes
    const authed = await requireAuth();
    if (!authed) {
      setError('Authentication required to change performance profile');
      return;
    }

    setError(null);

    try {
      const result = await changeProfile(selectedProfile.profile);
      setConfirmDialogOpen(false);
      setSuccessMessage(
        `Profile changed to ${result.new_profile}. ` +
        `Affected collectors: ${result.collectors_affected.join(', ')}`
      );
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedProfile, requireAuth, changeProfile]);

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            Collection Performance Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="w-5 h-5" />
                Collection Performance Profile
              </CardTitle>
              <CardDescription className="mt-1.5">
                Balances collector frequency and resource usage on this endpoint.
                Prevention and automatic blocking are controlled by server-side policies.
              </CardDescription>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Refresh profile status"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Success message */}
          {successMessage && (
            <Alert className="mb-4 border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Profile cards */}
          <div className="space-y-3">
            {profilesInfo?.map((profile) => (
              <ProfileCard
                key={profile.profile}
                profile={profile}
                isSelected={selectedProfile?.profile === profile.profile}
                isCurrent={currentProfile === profile.profile}
                onClick={() => handleProfileSelect(profile)}
                disabled={isChanging}
              />
            ))}
          </div>

          {/* Current profile indicator */}
          {currentProfile && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Profile:</span>
                <span
                  className={cn(
                    'font-medium capitalize',
                    currentProfile === 'aggressive' && 'text-red-500',
                    currentProfile === 'balanced' && 'text-blue-500',
                    currentProfile === 'lightweight' && 'text-green-500'
                  )}
                >
                  {currentProfile}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">CPU Target:</span>
                <span className="font-medium">
                  {profilesInfo?.find((p) => p.profile === currentProfile)?.cpu_target}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <ProfileConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        currentProfile={currentProfile || 'balanced'}
        selectedProfile={selectedProfile}
        onConfirm={handleConfirmChange}
        loading={isChanging}
        error={error || mutationError}
      />
    </>
  );
}
