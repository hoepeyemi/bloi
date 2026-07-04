'use client';

/**
 * useArcUnifiedBalance — Read the connected wallet's USDC balance across
 * all Unified Balance chains via Arc App Kit.
 *
 * Uses kit.unifiedBalance.getBalances() with the connected address (no
 * adapter required for reads). Returns total + per-chain breakdown.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { getAppKit } from '@/lib/arc-appkit';

export interface ChainBalance {
  chain: string;
  confirmedBalance: string;
  pendingBalance?: string;
}

export interface UnifiedBalanceData {
  totalConfirmedBalance: string;
  totalPendingBalance?: string;
  breakdown: ChainBalance[];
}

export function useArcUnifiedBalance(refreshIntervalMs = 30_000) {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<UnifiedBalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const kit = getAppKit();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await kit.unifiedBalance.getBalances({
        token: 'USDC',
        sources: { address },
      });
      setData({
        totalConfirmedBalance: result.totalConfirmedBalance ?? '0',
        totalPendingBalance: result.totalPendingBalance,
        breakdown: (result.breakdown ?? []).map((entry: {
          chain?: string; confirmedBalance?: string; pendingBalance?: string;
        }) => ({
          chain: entry.chain ?? '—',
          confirmedBalance: entry.confirmedBalance ?? '0',
          pendingBalance: entry.pendingBalance,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch unified balance');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) void fetch();
  }, [isConnected, address, fetch]);

  useEffect(() => {
    if (!refreshIntervalMs || !isConnected) return;
    const id = setInterval(() => void fetch(), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs, isConnected, fetch]);

  return { data, isLoading, error, refetch: fetch, isConnected };
}
