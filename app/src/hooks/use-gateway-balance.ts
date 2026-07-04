'use client';

import { useEffect, useState } from 'react';

interface GatewayBalanceData {
  configured: boolean;
  sellerAddress?: string | null;
  gateway?: { available: string; pending: string };
  wallet?: { balance: string };
  network?: string;
  message?: string;
  error?: string;
}

interface UseGatewayBalanceResult {
  data: GatewayBalanceData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGatewayBalance(
  /** Auto-refresh interval in ms. 0 = no auto-refresh. */
  refreshIntervalMs = 30_000
): UseGatewayBalanceResult {
  const [data, setData] = useState<GatewayBalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetch('/api/gateway/balance')
      .then((r) => r.json())
      .then((json: GatewayBalanceData) => {
        if (!cancelled) {
          setData(json);
          setError(json.error ?? null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fetch failed');
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const id = setInterval(() => setTick((t) => t + 1), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  return {
    data,
    isLoading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
