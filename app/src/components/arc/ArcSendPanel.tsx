'use client';

/**
 * ArcSendPanel — Send USDC on Base Sepolia via Arc App Kit
 *
 * Uses kit.send() with a viem adapter created from the connected wagmi wallet.
 * Shows fee estimate before the user confirms, then renders the tx explorer link.
 */

import { useState } from 'react';
import { ExternalLink, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useArcAppKit } from '@/hooks/use-arc-appkit';

interface Estimate {
  gas?: bigint;
  fee?: string;
}

export function ArcSendPanel() {
  const { send, estimateSend, isPending, isConnected } = useArcAppKit();

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [result, setResult] = useState<{ txHash?: string; explorerUrl?: string; state?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');

  const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(to);
  const isValidAmount = parseFloat(amount) > 0;

  const handleEstimate = async () => {
    if (!isValidAddress || !isValidAmount) return;
    setIsEstimating(true);
    setError(null);
    try {
      const est = await estimateSend({ to, amount });
      setEstimate(est as Estimate);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Estimate failed');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSend = async () => {
    setError(null);
    try {
      const res = await send({ to, amount });
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
      setStep('confirm');
    }
  };

  const reset = () => {
    setTo('');
    setAmount('');
    setEstimate(null);
    setResult(null);
    setError(null);
    setStep('form');
  };

  if (!isConnected) {
    return (
      <div className="text-[12px] text-[#666666] p-3 rounded border border-[#1f1f1f] bg-[#0a0a0a]">
        Connect a wallet to send USDC.
      </div>
    );
  }

  if (step === 'done' && result) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[#10b981]">
          <CheckCircle className="w-4 h-4" />
          <span className="text-[13px] font-semibold">Sent {amount} USDC</span>
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
          Send again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === 'form' && (
        <>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666666]">
              Recipient address
            </label>
            <Input
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="font-mono text-[12px] bg-[#0a0a0a] border-[#1f1f1f]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[#666666]">
              Amount (USDC)
            </label>
            <Input
              type="number"
              min="0"
              step="0.000001"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-[12px] bg-[#0a0a0a] border-[#1f1f1f]"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[11px] text-[#ef4444]">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <Button
            size="sm"
            disabled={!isValidAddress || !isValidAmount || isEstimating}
            onClick={handleEstimate}
          >
            {isEstimating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Estimating...</>
            ) : (
              <>Review send</>
            )}
          </Button>
        </>
      )}

      {step === 'confirm' && estimate && (
        <>
          <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#666666]">To</span>
              <span className="font-mono text-right text-[11px] truncate max-w-[180px]">{to}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">Amount</span>
              <span className="font-mono">{amount} USDC</span>
            </div>
            {estimate.fee && (
              <div className="flex justify-between">
                <span className="text-[#666666]">Fee</span>
                <span className="font-mono text-[#e5e5e5]">{estimate.fee}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#666666]">Network</span>
              <span className="text-[#10b981]">Base Sepolia</span>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[11px] text-[#ef4444]">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleSend}
            >
              {isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Confirm send</>
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
