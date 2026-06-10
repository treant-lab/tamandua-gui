import { useState } from 'react';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import {
  getFeatureComparison,
  LicenseType,
  getLicenseTypeLabel,
} from '../hooks/useLicense';

interface FeatureComparisonProps {
  currentTier?: LicenseType;
  onUpgrade?: (tier: LicenseType) => void;
}

type TierKey = 'community' | 'professional' | 'enterprise';

export function FeatureComparison({ currentTier, onUpgrade }: FeatureComparisonProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));
  const features = getFeatureComparison();

  // Group features by category
  const categories = [
    { id: 'protection', name: 'Protection', indices: [0, 1, 2, 3] },
    { id: 'response', name: 'Response Actions', indices: [4, 5, 6, 7] },
    { id: 'analysis', name: 'Analysis', indices: [8, 9, 10] },
    { id: 'integration', name: 'Integration', indices: [11, 12, 13] },
    { id: 'enterprise', name: 'Enterprise', indices: [14, 15, 16] },
    { id: 'support', name: 'Support', indices: [17, 18, 19] },
  ];

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderValue = (value: boolean | string) => {
    if (value === true) {
      return <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />;
    }
    if (value === false) {
      return <XCircle className="w-5 h-5 text-gray-600 mx-auto" />;
    }
    return <span className="text-sm text-gray-300">{value}</span>;
  };

  const tierPricing: Record<TierKey, { price: string; period: string }> = {
    community: { price: 'Free', period: 'forever' },
    professional: { price: '$15', period: '/endpoint/month' },
    enterprise: { price: 'Contact', period: 'sales' },
  };

  const tiers: TierKey[] = ['community', 'professional', 'enterprise'];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-semibold">Feature Comparison</h2>
        <p className="text-gray-400 mt-1">Compare features across license tiers</p>
      </div>

      {/* Tier Headers */}
      <div className="grid grid-cols-4 bg-gray-900">
        <div className="p-4"></div>
        {tiers.map((tier) => (
          <div
            key={tier}
            className={clsx(
              'p-4 text-center',
              tier === currentTier && 'bg-primary-900/30'
            )}
          >
            <div className="text-lg font-semibold">{getLicenseTypeLabel(tier)}</div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{tierPricing[tier].price}</span>
              <span className="text-sm text-gray-400 ml-1">{tierPricing[tier].period}</span>
            </div>
            {tier === currentTier ? (
              <div className="mt-3">
                <span className="px-3 py-1 text-xs bg-primary-600 text-white rounded-full">
                  Current Plan
                </span>
              </div>
            ) : onUpgrade && tier !== 'community' && (
              <button
                onClick={() => onUpgrade(tier)}
                className={clsx(
                  'mt-3 px-4 py-2 text-sm rounded-lg flex items-center justify-center space-x-1 mx-auto',
                  tier === 'enterprise'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                )}
              >
                <span>Upgrade</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Feature Categories */}
      <div className="divide-y divide-gray-700">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has('all') || expandedCategories.has(category.id);
          const categoryFeatures = category.indices.map((i) => features[i]).filter(Boolean);

          return (
            <div key={category.id}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full grid grid-cols-4 bg-gray-800/50 hover:bg-gray-700/50"
              >
                <div className="p-3 text-left font-medium text-gray-300">
                  {category.name}
                </div>
                <div className="p-3 col-span-3"></div>
              </button>

              {/* Category Features */}
              {isExpanded && (
                <div className="divide-y divide-gray-700/50">
                  {categoryFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-4 hover:bg-gray-700/30"
                    >
                      <div className="p-3 pl-6">
                        <div className="text-sm">{feature.feature}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {feature.description}
                        </div>
                      </div>
                      <div
                        className={clsx(
                          'p-3 flex items-center justify-center',
                          currentTier === 'community' && 'bg-primary-900/10'
                        )}
                      >
                        {renderValue(feature.community)}
                      </div>
                      <div
                        className={clsx(
                          'p-3 flex items-center justify-center',
                          currentTier === 'professional' && 'bg-primary-900/10'
                        )}
                      >
                        {renderValue(feature.professional)}
                      </div>
                      <div
                        className={clsx(
                          'p-3 flex items-center justify-center',
                          currentTier === 'enterprise' && 'bg-primary-900/10'
                        )}
                      >
                        {renderValue(feature.enterprise)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-6 bg-gray-900 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Need a custom plan or have questions?
          </div>
          <a
            href="mailto:contato@treantlab.org"
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </div>
  );
}

// Compact feature list for sidebars
export function FeatureList({
  features,
  title,
  showDisabled = false,
}: {
  features: { name: string; enabled: boolean; description?: string }[];
  title?: string;
  showDisabled?: boolean;
}) {
  const displayFeatures = showDisabled
    ? features
    : features.filter((f) => f.enabled);

  return (
    <div className="space-y-2">
      {title && <h4 className="text-sm font-medium text-gray-400 mb-3">{title}</h4>}
      {displayFeatures.map((feature) => (
        <div
          key={feature.name}
          className="flex items-center space-x-2 text-sm"
        >
          {feature.enabled ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-600 flex-shrink-0" />
          )}
          <span className={clsx(!feature.enabled && 'text-gray-500')}>
            {feature.description || feature.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// Upgrade prompt banner
export function UpgradeBanner({
  feature,
  requiredTier,
  onUpgrade,
}: {
  feature: string;
  requiredTier: LicenseType;
  onUpgrade?: () => void;
}) {
  return (
    <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-700/50">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{feature}</div>
          <div className="text-sm text-gray-400 mt-1">
            This feature requires {getLicenseTypeLabel(requiredTier)} or higher
          </div>
        </div>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium flex items-center space-x-2"
          >
            <span>Upgrade</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
