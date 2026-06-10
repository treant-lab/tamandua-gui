import { CheckCircle, ExternalLink, Clock, Coins } from 'lucide-react';
import clsx from 'clsx';

export interface BlockchainBadgeProps {
  /** Transaction signature on Solana */
  txSignature?: string | null;
  /** Timestamp when attested */
  attestedAt?: string | null;
  /** Bounty paid (in SOL) */
  bountyAmount?: number | null;
  /** Bounty transaction signature */
  bountyTxSignature?: string | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show full details or just badge */
  variant?: 'badge' | 'card';
}

/**
 * BlockchainBadge shows Solana attestation status for security incidents.
 *
 * Key features:
 * - Shows "Verified on Solana" badge with checkmark
 * - Links to Solscan for transaction verification
 * - Shows bounty payment info if applicable
 *
 * Part of the "Private Telemetry, Public Proof" concept.
 */
export function BlockchainBadge({
  txSignature,
  attestedAt,
  bountyAmount,
  bountyTxSignature,
  size = 'md',
  variant = 'badge',
}: BlockchainBadgeProps) {
  const isAttested = !!txSignature;
  const hasBounty = !!bountyTxSignature && bountyAmount != null && bountyAmount > 0;

  // Generate Solscan URL (devnet for hackathon)
  const solscanUrl = txSignature
    ? `https://solscan.io/tx/${txSignature}?cluster=devnet`
    : null;

  const bountySolscanUrl = bountyTxSignature
    ? `https://solscan.io/tx/${bountyTxSignature}?cluster=devnet`
    : null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Badge variant - simple inline badge
  if (variant === 'badge') {
    if (!isAttested) {
      return (
        <span
          className={clsx(
            'inline-flex items-center space-x-1 rounded-full',
            'bg-gray-700/50 text-gray-400',
            sizeClasses[size]
          )}
        >
          <Clock className={iconSizes[size]} />
          <span>Pending Attestation</span>
        </span>
      );
    }

    return (
      <a
        href={solscanUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          'inline-flex items-center space-x-1 rounded-full',
          'bg-gradient-to-r from-purple-600/30 to-violet-600/30',
          'border border-purple-500/50',
          'text-purple-300 hover:text-purple-200',
          'transition-colors duration-200',
          sizeClasses[size]
        )}
        title={`View on Solscan: ${txSignature}`}
      >
        <CheckCircle className={clsx(iconSizes[size], 'text-green-400')} />
        <span>Verified on Solana</span>
        <ExternalLink className={clsx(iconSizes[size], 'opacity-70')} />
      </a>
    );
  }

  // Card variant - detailed view with bounty info
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wide">
          Blockchain Attestation
        </h4>
        {isAttested ? (
          <span className="inline-flex items-center space-x-1 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Verified</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 text-gray-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>Pending</span>
          </span>
        )}
      </div>

      {isAttested && (
        <>
          {/* Attestation Transaction */}
          <div className="space-y-1">
            <div className="text-xs text-gray-400">Attestation TX</div>
            <a
              href={solscanUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-400 hover:text-purple-300 font-mono flex items-center space-x-1"
            >
              <span>{truncateSignature(txSignature!)}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Timestamp */}
          {attestedAt && (
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Attested At</div>
              <div className="text-sm text-gray-200">
                {formatTimestamp(attestedAt)}
              </div>
            </div>
          )}

          {/* Bounty Info */}
          {hasBounty && (
            <div className="pt-2 border-t border-gray-700 space-y-2">
              <div className="flex items-center space-x-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-400">
                  Detection Bounty Paid
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">
                  {bountyAmount.toFixed(2)} SOL
                </span>
                <a
                  href={bountySolscanUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300 font-mono flex items-center space-x-1"
                >
                  <span>{truncateSignature(bountyTxSignature!)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* Private Telemetry Badge */}
      <div className="pt-2 border-t border-gray-700">
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Private Telemetry, Public Proof</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline badge for lists/tables
 */
export function BlockchainBadgeInline({
  txSignature,
}: {
  txSignature?: string | null;
}) {
  if (!txSignature) {
    return null;
  }

  const solscanUrl = `https://solscan.io/tx/${txSignature}?cluster=devnet`;

  return (
    <a
      href={solscanUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center space-x-1 text-purple-400 hover:text-purple-300 text-xs"
      title="Verified on Solana"
    >
      <CheckCircle className="w-3 h-3 text-green-400" />
      <span className="font-mono">{truncateSignature(txSignature, 4)}</span>
    </a>
  );
}

// Helper functions

function truncateSignature(sig: string, chars: number = 6): string {
  if (sig.length <= chars * 2 + 3) return sig;
  return `${sig.slice(0, chars)}...${sig.slice(-chars)}`;
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString();
  } catch {
    return ts;
  }
}

export default BlockchainBadge;
