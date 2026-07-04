'use client';

/**
 * useArcAppKit — React hook for Arc App Kit operations.
 *
 * Bridges the connected wagmi wallet to a Circle Arc viem adapter so the app
 * can call kit.send(), kit.estimateSend(), and kit.bridge() without the user
 * managing adapters manually.
 *
 * All operations run on Base Sepolia (Arc chain id: "Base_Sepolia").
 */

import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import type { SendParams, BridgeParams } from '@circle-fin/app-kit';
import { getAppKit, ARC_CHAIN_BASE_SEPOLIA, DEFAULT_TOKEN } from '@/lib/arc-appkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArcSendRequest {
  to: string;
  amount: string;
  token?: string;
}

export interface ArcBridgeRequest {
  /** Arc chain identifier to bridge FROM (e.g. "Ethereum_Sepolia") */
  fromChain: string;
  amount: string;
  /** Recipient on Base Sepolia. Defaults to connected wallet address. */
  toAddress?: string;
}

export interface ArcOperationResult {
  name: string;
  state: 'success' | 'pending' | 'failed';
  txHash?: string;
  explorerUrl?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useArcAppKit() {
  const { connector, address, isConnected } = useAccount();
  const [isPending, setIsPending] = useState(false);
  const [lastResult, setLastResult] = useState<ArcOperationResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  /** Lazily create a viem adapter from the connected wagmi wallet's EIP-1193 provider */
  const getAdapter = useCallback(async () => {
    if (!connector) throw new Error('No wallet connected');

    const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');
    // wagmi connector exposes the underlying EIP-1193 provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = await connector.getProvider() as any;
    return createViemAdapterFromProvider({ provider });
  }, [connector]);

  /**
   * Estimate fees for a USDC send on Base Sepolia before submitting.
   */
  const estimateSend = useCallback(async (req: ArcSendRequest) => {
    const kit = getAppKit();
    const adapter = await getAdapter();
    const params: SendParams = {
      from: { adapter, chain: ARC_CHAIN_BASE_SEPOLIA },
      to: req.to,
      amount: req.amount,
      token: req.token ?? DEFAULT_TOKEN,
    };
    return kit.estimateSend(params);
  }, [getAdapter]);

  /**
   * Send USDC to another address on Base Sepolia.
   */
  const send = useCallback(async (req: ArcSendRequest): Promise<ArcOperationResult> => {
    if (!isConnected) throw new Error('Wallet not connected');
    setIsPending(true);
    setLastError(null);
    try {
      const kit = getAppKit();
      const adapter = await getAdapter();
      const params: SendParams = {
        from: { adapter, chain: ARC_CHAIN_BASE_SEPOLIA },
        to: req.to,
        amount: req.amount,
        token: req.token ?? DEFAULT_TOKEN,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await kit.send(params) as any;
      const out: ArcOperationResult = {
        name: result.name ?? 'send',
        state: result.state ?? 'success',
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
      };
      setLastResult(out);
      return out;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [isConnected, getAdapter]);

  /**
   * Bridge USDC from another chain into Base Sepolia (CCTP-backed).
   * The destination is always Base Sepolia; the recipient defaults to the
   * connected wallet address.
   */
  const bridge = useCallback(async (req: ArcBridgeRequest): Promise<ArcOperationResult> => {
    if (!isConnected) throw new Error('Wallet not connected');
    if (!address && !req.toAddress) throw new Error('No recipient address');
    setIsPending(true);
    setLastError(null);
    try {
      const kit = getAppKit();
      const adapter = await getAdapter();
      const params: BridgeParams = {
        from: { adapter, chain: req.fromChain },
        to: { adapter, chain: ARC_CHAIN_BASE_SEPOLIA },
        amount: req.amount,
        ...(req.toAddress ? { toAddress: req.toAddress } : {}),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await kit.bridge(params) as any;
      const out: ArcOperationResult = {
        name: result.name ?? 'bridge',
        state: result.state ?? 'success',
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
      };
      setLastResult(out);
      return out;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [isConnected, address, getAdapter]);

  return {
    send,
    bridge,
    estimateSend,
    isPending,
    lastResult,
    lastError,
    isConnected,
    address,
  };
}
