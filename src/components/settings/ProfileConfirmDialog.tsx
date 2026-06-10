import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Lock,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Loader2,
  Zap,
  Scale,
  Leaf,
} from 'lucide-react';
import type { ProfileInfo, PerformanceProfile } from './ProfileCard';

interface ProfileConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProfile: PerformanceProfile;
  selectedProfile: ProfileInfo | null;
  onConfirm: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const profileNames: Record<PerformanceProfile, string> = {
  aggressive: 'Aggressive',
  balanced: 'Balanced',
  lightweight: 'Lightweight',
};

const profileIcons: Record<PerformanceProfile, React.ReactNode> = {
  aggressive: <Zap className="w-5 h-5 text-red-500" />,
  balanced: <Scale className="w-5 h-5 text-blue-500" />,
  lightweight: <Leaf className="w-5 h-5 text-green-500" />,
};

export function ProfileConfirmDialog({
  open,
  onOpenChange,
  currentProfile,
  selectedProfile,
  onConfirm,
  loading,
  error,
}: ProfileConfirmDialogProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setShowDetails(false);
    }
  }, [open]);

  if (!selectedProfile) return null;

  // Calculate collector differences
  const currentCollectors = new Set(getCollectorsForProfile(currentProfile));
  const newCollectors = new Set(selectedProfile.collectors_enabled);

  const addedCollectors = selectedProfile.collectors_enabled.filter(
    (c) => !currentCollectors.has(c)
  );
  const removedCollectors = Array.from(currentCollectors).filter(
    (c) => !newCollectors.has(c)
  );

  const isDowngrade = selectedProfile.profile === 'lightweight' && currentProfile !== 'lightweight';
  const isUpgrade = selectedProfile.profile === 'aggressive' && currentProfile !== 'aggressive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Collection Performance Profile
          </DialogTitle>
          <DialogDescription>
            This change requires authentication and affects collector coverage and resource usage. It does not change the prevention policy or auto-blocking rules.
          </DialogDescription>
        </DialogHeader>

        {/* Profile transition */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="flex flex-col items-center gap-1">
            {profileIcons[currentProfile]}
            <span className="text-sm font-medium">{profileNames[currentProfile]}</span>
            <Badge variant="outline" className="text-xs">Current</Badge>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          <div className="flex flex-col items-center gap-1">
            {profileIcons[selectedProfile.profile]}
            <span className="text-sm font-medium">{profileNames[selectedProfile.profile]}</span>
            <Badge variant="default" className="text-xs">New</Badge>
          </div>
        </div>

        {/* Warning for downgrade */}
        {isDowngrade && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Switching to Lightweight mode will disable some collectors, reducing detection coverage.
            </AlertDescription>
          </Alert>
        )}

        {/* Info for upgrade */}
        {isUpgrade && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Aggressive mode will increase CPU usage to 15-25% for maximum detection coverage.
            </AlertDescription>
          </Alert>
        )}

        {/* Collector changes toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-primary hover:underline text-left"
        >
          {showDetails ? 'Hide' : 'Show'} collector changes ({addedCollectors.length + removedCollectors.length})
        </button>

        {/* Collector changes detail */}
        {showDetails && (
          <div className="space-y-3 text-sm">
            {addedCollectors.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500" />
                  Collectors to be enabled:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {addedCollectors.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs capitalize bg-green-500/10 text-green-700 border-green-500/30">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {removedCollectors.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <X className="w-3 h-3 text-red-500" />
                  Collectors to be disabled:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {removedCollectors.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs capitalize bg-red-500/10 text-red-700 border-red-500/30">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {addedCollectors.length === 0 && removedCollectors.length === 0 && (
              <div className="text-muted-foreground text-xs">
                No collector changes. Only interval adjustments will be applied.
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-2">Features in {profileNames[selectedProfile.profile]} mode:</div>
          <ul className="space-y-1">
            {selectedProfile.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-3 h-3 text-primary flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Auth notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <Lock className="w-3 h-3" />
          <span>Authentication required to change endpoint collection settings</span>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Authenticate & Apply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to get collectors for a profile (used for comparison)
function getCollectorsForProfile(profile: PerformanceProfile): string[] {
  switch (profile) {
    case 'aggressive':
      return [
        'process', 'file', 'network', 'dns', 'registry', 'usb',
        'ransomware_canary', 'health', 'etw', 'persistence', 'fim',
      ];
    case 'balanced':
      return [
        'process', 'file', 'network', 'dns', 'registry', 'usb',
        'ransomware_canary', 'health', 'persistence', 'fim', 'etw',
      ];
    case 'lightweight':
      return [
        'process', 'file', 'network', 'dns', 'registry', 'usb',
        'ransomware_canary', 'health',
      ];
    default:
      return [];
  }
}
