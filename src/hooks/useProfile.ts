import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import {
  usePerformanceProfile as usePerformanceProfileQuery,
  usePerformanceProfilesInfo as usePerformanceProfilesInfoQuery,
  useSetPerformanceProfile as useSetPerformanceProfileMutation,
  type PerformanceProfile,
  type ProfileInfo,
  type ProfileChangeResult,
} from './useTauri';

// Re-export types for convenience
export type { PerformanceProfile, ProfileInfo, ProfileChangeResult };

export interface ProfileChangeEvent {
  old: PerformanceProfile;
  new: PerformanceProfile;
  collectors_affected: string[];
}

/**
 * Get the current performance profile
 */
export function usePerformanceProfile() {
  return usePerformanceProfileQuery();
}

/**
 * Get detailed information about all available profiles
 */
export function usePerformanceProfilesInfo() {
  return usePerformanceProfilesInfoQuery();
}

/**
 * Set performance profile (requires authentication)
 */
export function useSetPerformanceProfile() {
  return useSetPerformanceProfileMutation();
}

/**
 * Listen for profile change events from the agent
 */
export function useProfileChangeListener(
  callback: (change: ProfileChangeEvent) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlisten = listen<ProfileChangeEvent>('profile-changed', (event) => {
      // Update cache when profile changes
      queryClient.setQueryData(['performanceProfile'], event.payload.new);
      // Call user callback
      callback(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [callback, queryClient]);
}

/**
 * Get profile display information
 */
export function getProfileDisplayInfo(profile: PerformanceProfile) {
  const info: Record<PerformanceProfile, { name: string; color: string; icon: string }> = {
    aggressive: {
      name: 'Aggressive',
      color: 'red',
      icon: 'zap',
    },
    balanced: {
      name: 'Balanced',
      color: 'blue',
      icon: 'scale',
    },
    lightweight: {
      name: 'Lightweight',
      color: 'green',
      icon: 'leaf',
    },
  };
  return info[profile];
}

/**
 * Calculate collectors that will be affected by a profile change
 */
export function getAffectedCollectors(
  currentProfile: PerformanceProfile,
  newProfile: PerformanceProfile,
  profilesInfo: ProfileInfo[]
): { enabled: string[]; disabled: string[] } {
  const current = profilesInfo.find((p) => p.profile === currentProfile);
  const target = profilesInfo.find((p) => p.profile === newProfile);

  if (!current || !target) {
    return { enabled: [], disabled: [] };
  }

  const currentSet = new Set(current.collectors_enabled);
  const targetSet = new Set(target.collectors_enabled);

  const enabled = target.collectors_enabled.filter((c) => !currentSet.has(c));
  const disabled = current.collectors_enabled.filter((c) => !targetSet.has(c));

  return { enabled, disabled };
}

/**
 * Combined hook for profile management with real-time updates
 */
export function useProfileManager() {
  const currentProfile = usePerformanceProfile();
  const profilesInfo = usePerformanceProfilesInfo();
  const setProfile = useSetPerformanceProfile();
  const queryClient = useQueryClient();

  // Listen for external profile changes
  useProfileChangeListener(
    useCallback((change) => {
      // Profile already updated via query invalidation
      console.log('Profile changed externally:', change);
    }, [])
  );

  return {
    currentProfile: currentProfile.data,
    profilesInfo: profilesInfo.data,
    isLoading: currentProfile.isLoading || profilesInfo.isLoading,
    isChanging: setProfile.isPending,
    error: setProfile.error?.message || null,
    changeProfile: setProfile.mutateAsync,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceProfile'] });
    },
  };
}
