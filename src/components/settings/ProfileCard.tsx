import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Scale, Leaf, Cpu, Check } from 'lucide-react';

export type PerformanceProfile = 'aggressive' | 'balanced' | 'lightweight';

export interface ProfileInfo {
  profile: PerformanceProfile;
  cpu_target: string;
  description: string;
  collectors_enabled: string[];
  features: string[];
}

interface ProfileCardProps {
  profile: ProfileInfo;
  isSelected: boolean;
  isCurrent: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const profileIcons: Record<PerformanceProfile, React.ReactNode> = {
  aggressive: <Zap className="w-6 h-6 text-red-500" />,
  balanced: <Scale className="w-6 h-6 text-blue-500" />,
  lightweight: <Leaf className="w-6 h-6 text-green-500" />,
};

const profileColors: Record<PerformanceProfile, string> = {
  aggressive: 'border-red-500/50 hover:border-red-500',
  balanced: 'border-blue-500/50 hover:border-blue-500',
  lightweight: 'border-green-500/50 hover:border-green-500',
};

const profileSelectedColors: Record<PerformanceProfile, string> = {
  aggressive: 'border-red-500 ring-2 ring-red-500/20 bg-red-500/5',
  balanced: 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5',
  lightweight: 'border-green-500 ring-2 ring-green-500/20 bg-green-500/5',
};

const profileNames: Record<PerformanceProfile, string> = {
  aggressive: 'Aggressive',
  balanced: 'Balanced',
  lightweight: 'Lightweight',
};

export function ProfileCard({
  profile,
  isSelected,
  isCurrent,
  onClick,
  disabled = false,
}: ProfileCardProps) {
  const profileType = profile.profile;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all border-2',
        isSelected || isCurrent
          ? profileSelectedColors[profileType]
          : profileColors[profileType],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && onClick()}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">{profileIcons[profileType]}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg">
                {profileNames[profileType]}
              </span>
              {isCurrent && (
                <Badge variant="default" className="text-xs">
                  Current
                </Badge>
              )}
              {profileType === 'balanced' && !isCurrent && (
                <Badge variant="secondary" className="text-xs">
                  Recommended
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {profile.description}
            </p>

            {/* CPU Target */}
            <div className="flex items-center gap-2 text-sm mb-3">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">CPU Target:</span>
              <span className="font-medium">{profile.cpu_target}</span>
            </div>

            {/* Collectors */}
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1.5">
                Active Collectors ({profile.collectors_enabled.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.collectors_enabled.slice(0, 6).map((collector) => (
                  <Badge
                    key={collector}
                    variant="outline"
                    className="text-xs capitalize"
                  >
                    {collector}
                  </Badge>
                ))}
                {profile.collectors_enabled.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{profile.collectors_enabled.length - 6} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="space-y-1">
              {profile.features.slice(0, 3).map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3 h-3 text-green-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selection indicator */}
          {isCurrent && (
            <div className="flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
