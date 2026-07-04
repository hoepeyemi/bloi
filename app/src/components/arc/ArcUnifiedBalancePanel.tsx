'use client';

/**
 * ArcUnifiedBalancePanel — Shows the connected wallet's USDC balance across
 * all Arc App Kit Unified Balance chains in a single aggregated view.
 *
 * Uses kit.unifiedBalance.getBalances({ sources: { address } }) — read-only,
 * no signing required. Refreshes every 30 seconds.
 */

import { RefreshCw } from 'lucide-react';
import { useArcUnifiedBalance } from '@/hooks/use-arc-unified-balance';

export function ArcUnifiedBalancePanel() {
  const { data, isLoading, error, refetch, isConnected } = useArcUnifiedBalance(30_000);

  if (!isConnected) {
    return (
      <div className="text-[12px] text-[#666666] p-3 rounded border border-[#1f1f1f] bg-[#0a0a0a]">
        Connect a wallet to view unified USDC balance.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Total */}
      <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-[#666666]">
            Total USDC (all chains)
          </span>
          <button
            onClick={() => void refetch()}
            disabled={isLoading}
            className="text-[#666666] hover:text-[#e5e5e5] transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {isLoading && !data ? (
          <div className="text-[12px] text-[#666666]">loading...</div>
        ) : error ? (
          <div className="text-[12px] text-[#ef4444]">{error}</div>
        ) : (
          <div className="font-mono text-[22px] text-[#10b981]">
            ${data?.totalConfirmedBalance ?? '—'}
            {data?.totalPendingBalance && parseFloat(data.totalPendingBalance) > 0 && (
              <span className="ml-2 text-[13px] text-[#666666]">
                (+${data.totalPendingBalance} pending)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Per-chain breakdown */}
      {data && data.breakdown.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-[#666666] mb-2">
            By chain
          </div>
          {data.breakdown.map((entry) => (
            <div
              key={entry.chain}
              className="flex items-center justify-between text-[12px] px-1"
            >
              <span className="text-[#666666]">{entry.chain}</span>
              <span className="font-mono text-[#e5e5e5]">
                ${entry.confirmedBalance}
                {entry.pendingBalance && parseFloat(entry.pendingBalance) > 0 && (
                  <span className="text-[#666666] ml-1">(+${entry.pendingBalance})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {data && data.breakdown.length === 0 && !isLoading && (
        <div className="text-[12px] text-[#666666]">
          No USDC balance found across supported chains.
        </div>
      )}
    </div>
  );
}
