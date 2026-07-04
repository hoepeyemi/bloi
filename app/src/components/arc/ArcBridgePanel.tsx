'use client';

/**
 * ArcBridgePanel — Bridge USDC into Base Sepolia via Arc App Kit
 *
 * Uses kit.bridge() (CCTP-backed) to move USDC from a source chain to
 * Base Sepolia. The destination is always the connected wallet on Base Sepolia.
 */

import { useState } from 'react';
import { ExternalLink, ArrowDownToLine, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useArcAppKit } from '@/hooks/use-arc-appkit';

const SOURCE_CHAINS = [
  { label: 'Ethereum Sepolia', value: 'Ethereum_Sepolia' },
  { label: 'Polygon Amoy', value: 'Polygon_Amoy' },
  { label: 'Arbitrum Sepolia', value: 'Arbitrum_Sepolia' },
  { label: 'Avalanche Fuji', value: 'Avalanche_Fuji' },
] as const;

export function ArcBridgePanel() {
  const { bridge, isPending, isConnected } = useArcAppKit();

  const [fromChain, setFromChain] = useState<string>(SOURCE_CHAINS[0].value);
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{ txHash?: string; explorerUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isValidAmount = parseFloat(amount) > 0;

  const handleBridge = async () => {
    setError(null);
    try {
      const res = await bridge({ fromChain, amount });
      setResult(res);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bridge failed');
    }
  };

  const reset = () => {
    setAmount('');
    setResult(null);
    setError(null);
    setDone(false);
  };

  if (!isConnected) {
    return (
      <div className="text-[12px] text-[#666666] p-3 rounded border border-[#1f1f1f] bg-[#0a0a0a]">
        Connect a wallet to bridge USDC to Base Sepolia.
      </div>
    );
  }

  if (done && result) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[#10b981]">
          <CheckCircle className="w-4 h-4" />
          <span className="text-[13px] font-semibold">Bridged {amount} USDC to Base Sepolia</span>
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
        <div className="text-[11px] text-[#666666]">
          CCTP bridging typically finalises in ~13 minutes. USDC will appear in your Base Sepolia wallet shortly.
        </div>
        <Button variant="secondary" size="sm" onClick={reset}>
          Bridge again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-[#666666]">From chain</label>
        <select
          value={fromChain}
          onChange={(e) => setFromChain(e.target.value)}
          className="w-full rounded border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-[12px] text-[#e5e5e5] focus:outline-none focus:border-[#10b981]/40"
        >
          {SOURCE_CHAINS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider text-[#666666]">Amount (USDC)</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="font-mono text-[12px] bg-[#0a0a0a] border-[#1f1f1f]"
        />
      </div>
      <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-2 text-[11px] text-[#666666]">
        <span className="text-[#e5e5e5]">Destination:</span> Base Sepolia (connected wallet) · CCTP · ~13 min
      </div>
      {error && (
        <div className="flex items-center gap-2 text-[11px] text-[#ef4444]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
      <Button
        size="sm"
        disabled={!isValidAmount || isPending}
        onClick={handleBridge}
      >
        {isPending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Bridging...</>
        ) : (
          <><ArrowDownToLine className="w-3.5 h-3.5" /> Bridge to Base Sepolia</>
        )}
      </Button>
    </div>
  );
}
