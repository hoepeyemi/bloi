'use client';

/**
 * ArcSwapPanel — Swap tokens on Arc Testnet via Arc App Kit.
 *
 * Uses kit.swap() with the connected wagmi wallet's viem adapter.
 * Runs on Arc_Testnet (App Kit's testnet-capable swap chain).
 * kit.estimateSwap() shows expected output and fees before confirmation.
 */

import { useState } from 'react';
import { ArrowLeftRight, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useArcAppKit } from '@/hooks/use-arc-appkit';

const SUPPORTED_TOKENS = ['USDC', 'USDT', 'ETH', 'WETH'] as const;

interface SwapEstimate {
  amountOut?: string;
  minimumAmountOut?: string;
  feeAmount?: string;
  feeToken?: string;
}

export function ArcSwapPanel() {
  const { swap, estimateSwap, isPending, isConnected } = useArcAppKit();

  const [tokenIn, setTokenIn] = useState<string>('USDC');
  const [tokenOut, setTokenOut] = useState<string>('USDT');
  const [amountIn, setAmountIn] = useState('');
  const [estimate, setEstimate] = useState<SwapEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [result, setResult] = useState<{ txHash?: string; explorerUrl?: string; state?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');

  const isValid = parseFloat(amountIn) > 0 && tokenIn !== tokenOut;

  const handleEstimate = async () => {
    if (!isValid) return;
    setIsEstimating(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const est = await estimateSwap({ tokenIn, tokenOut, amountIn }) as any;
      setEstimate({
        amountOut: est?.amountOut ?? est?.estimatedAmountOut,
        minimumAmountOut: est?.minimumAmountOut,
        feeAmount: est?.feeAmount ?? est?.fee?.amount,
        feeToken: est?.feeToken ?? est?.fee?.token ?? tokenOut,
      });
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Estimate failed');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSwap = async () => {
    setError(null);
    try {
      const res = await swap({ tokenIn, tokenOut, amountIn });
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    }
  };

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setEstimate(null);
    setStep('form');
  };

  const reset = () => {
    setAmountIn('');
    setEstimate(null);
    setResult(null);
    setError(null);
    setStep('form');
  };

  if (!isConnected) {
    return (
      <div className="text-[12px] text-[#666666] p-3 rounded border border-[#1f1f1f] bg-[#0a0a0a]">
        Connect a wallet to swap tokens.
      </div>
    );
  }

  if (step === 'done' && result) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[#10b981]">
          <CheckCircle className="w-4 h-4" />
          <span className="text-[13px] font-semibold">
            Swapped {amountIn} {tokenIn} → {tokenOut}
          </span>
        </div>
        {result.txHash && (
          <div className="text-[11px] font-mono text-[#666666] break-all">{result.txHash}</div>
        )}
        {result.explorerUrl && (
          <a
            href={result.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-[#10b981] hover:underline"
          >
            View on explorer <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <Button variant="secondary" size="sm" onClick={reset}>
          Swap again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === 'form' && (
        <>
          {/* Token pair selector */}
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-[#666666]">From</label>
              <select
                value={tokenIn}
                onChange={(e) => { setTokenIn(e.target.value); setEstimate(null); }}
                className="w-full rounded border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-[12px] text-[#e5e5e5] focus:outline-none focus:border-[#10b981]/40"
              >
                {SUPPORTED_TOKENS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <button
              onClick={flipTokens}
              className="mt-5 p-1.5 rounded border border-[#1f1f1f] text-[#666666] hover:text-[#e5e5e5] hover:border-[#10b981]/40 transition-colors"
              title="Flip tokens"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-[#666666]">To</label>
              <select
                value={tokenOut}
                onChange={(e) => { setTokenOut(e.target.value); setEstimate(null); }}
                className="w-full rounded border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-[12px] text-[#e5e5e5] focus:outline-none focus:border-[#10b981]/40"
              >
                {SUPPORTED_TOKENS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-[#666666]">Amount</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="font-mono text-[12px] bg-[#0a0a0a] border-[#1f1f1f]"
            />
          </div>

          <div className="text-[11px] text-[#666666] px-1">
            Network: <span className="text-[#e5e5e5]">Arc Testnet</span>
            <span className="mx-1">·</span>
            via Arc App Kit swap
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[11px] text-[#ef4444]">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            size="sm"
            disabled={!isValid || isEstimating}
            onClick={handleEstimate}
          >
            {isEstimating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Getting quote...</>
            ) : (
              <>Get quote</>
            )}
          </Button>
        </>
      )}

      {step === 'confirm' && estimate && (
        <>
          <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#666666]">You pay</span>
              <span className="font-mono">{amountIn} {tokenIn}</span>
            </div>
            {estimate.amountOut && (
              <div className="flex justify-between">
                <span className="text-[#666666]">You receive</span>
                <span className="font-mono text-[#10b981]">~{estimate.amountOut} {tokenOut}</span>
              </div>
            )}
            {estimate.minimumAmountOut && (
              <div className="flex justify-between">
                <span className="text-[#666666]">Minimum (slippage)</span>
                <span className="font-mono">{estimate.minimumAmountOut} {tokenOut}</span>
              </div>
            )}
            {estimate.feeAmount && (
              <div className="flex justify-between">
                <span className="text-[#666666]">Fee</span>
                <span className="font-mono">{estimate.feeAmount} {estimate.feeToken}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#666666]">Network</span>
              <span className="text-[#e5e5e5]">Arc Testnet</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[11px] text-[#ef4444]">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={handleSwap}>
              {isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Swapping...</>
              ) : (
                <><ArrowLeftRight className="w-3.5 h-3.5" /> Confirm swap</>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={reset} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
