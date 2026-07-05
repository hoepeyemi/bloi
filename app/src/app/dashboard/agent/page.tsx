"use client"

/**
 * vasmo Agent Page - Terminal/Bloomberg Aesthetic
 * ALIVE: Live agent log, pulse animations, grid background
 */

import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { formatUnits } from "viem"
import { Switch } from "@/components/ui/switch"
import { StatusBar } from "@/components/ui/status-bar"
import { TerminalNav } from "@/components/terminal-nav"
import { LiveAgentLog } from "@/components/live-agent-log"
import { useGatewayBalance } from "@/hooks/use-gateway-balance"
import { ArcSendPanel } from "@/components/arc/ArcSendPanel"
import { ArcBridgePanel } from "@/components/arc/ArcBridgePanel"

export default function AgentPage() {
  const [autoExecute, setAutoExecute] = useState(true)
  const [activeDepositsCount, setActiveDepositsCount] = useState(0)
  const [yieldFormatted, setYieldFormatted] = useState(0)
  const { address, isConnected } = useAccount()
  const { data: gwBalance, isLoading: gwLoading } = useGatewayBalance(30_000)

  useEffect(() => {
    if (!address) { setActiveDepositsCount(0); setYieldFormatted(0); return }
    fetch(`/api/invoices?issuer=${address}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return
        const invs = data.data.invoices as Array<{ deposit: { accruedYield: string } | null; status: string }>
        setActiveDepositsCount(invs.filter((i) => i.status === "InYield").length)
        setYieldFormatted(
          invs.reduce((sum, i) => sum + (i.deposit ? Number(formatUnits(BigInt(i.deposit.accruedYield), 18)) : 0), 0)
        )
      })
      .catch(() => {})
  }, [address])

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-grid noise-overlay scan-line pb-8">
      <TerminalNav />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-bold mb-1">AI AGENT</h1>
            <p className="text-[12px] text-[#666666]">Autonomous yield optimization</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] status-pulse" />
            <span className="text-[12px] text-[#10b981] font-semibold">ONLINE</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid grid-cols-3 mb-8">
          <div className="stat-cell">
            <div className="stat-label">Monitoring</div>
            <div className="stat-value tabular-nums">{activeDepositsCount}</div>
            <div className="text-[11px] text-[#666666] mt-1">active deposits</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Total Yield Generated</div>
            <div className="stat-value stat-value-green tabular-nums">
              {yieldFormatted > 0 && yieldFormatted < 0.01 ? "+$<0.01" : `+$${yieldFormatted.toFixed(2)}`}
            </div>
            <div className="text-[11px] text-[#666666] mt-1">from vault strategies</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Confidence Threshold</div>
            <div className="stat-value stat-value-amber tabular-nums">70%</div>
            <div className="text-[11px] text-[#666666] mt-1">for auto-execute</div>
          </div>
        </div>

        {/* Agent Controls */}
        <div className="terminal-card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[14px] font-semibold mb-1">Agent Controls</h2>
              <p className="text-[11px] text-[#666666]">Configure autonomous decision-making</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 p-4 bg-[#0a0a0a] rounded border border-[#1f1f1f]">
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold mb-1">Auto-Execute Decisions</h3>
              <p className="text-[11px] text-[#666666]">
                Allow the AI agent to automatically implement strategy changes when confidence exceeds 70%.
              </p>
            </div>
            <Switch checked={autoExecute} onCheckedChange={setAutoExecute} />
          </div>

          {autoExecute && (
            <div className="mt-4 p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded">
              <div className="text-[11px]">
                <span className="text-[#10b981] font-semibold">SAFETY LIMITS ACTIVE</span>
                <ul className="text-[#666666] mt-2 space-y-1">
                  <li>• Max 50% portfolio in aggressive strategies</li>
                  <li>• Min 70% confidence for auto-execution</li>
                  <li>• Manual override always available</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Circle Gateway Nanopayments */}
        <div className="terminal-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-semibold mb-1">Gateway Nanopayments</h2>
              <p className="text-[11px] text-[#666666]">Circle x402 · Base Sepolia · gasless USDC micropayments</p>
            </div>
            <div className="flex items-center gap-1.5">
              {gwBalance?.configured ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] status-pulse" />
                  <span className="text-[10px] text-[#10b981]">ACTIVE</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#666666]" />
                  <span className="text-[10px] text-[#666666]">NOT CONFIGURED</span>
                </>
              )}
            </div>
          </div>

          {gwLoading ? (
            <div className="text-[12px] text-[#666666]">loading gateway balance...</div>
          ) : gwBalance?.configured && gwBalance.gateway ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
              <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3">
                <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-1">Gateway Available</div>
                <div className="font-mono text-[#10b981] text-[15px]">${gwBalance.gateway.available}</div>
                <div className="text-[10px] text-[#666666] mt-1">USDC (ready to collect)</div>
              </div>
              <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3">
                <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-1">Wallet Balance</div>
                <div className="font-mono text-[#e5e5e5] text-[15px]">${gwBalance.wallet?.balance ?? '—'}</div>
                <div className="text-[10px] text-[#666666] mt-1">USDC (EOA wallet)</div>
              </div>
              <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3">
                <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-1">Price per Request</div>
                <div className="font-mono text-[#e5e5e5] text-[15px]">$0.001</div>
                <div className="text-[10px] text-[#666666] mt-1">USDC · gasless EIP-3009</div>
              </div>
              <div className="rounded border border-[#1f1f1f] bg-[#0a0a0a] p-3">
                <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-1">Seller Address</div>
                <div className="font-mono text-[#e5e5e5] text-[11px] truncate">
                  {gwBalance.sellerAddress
                    ? `${gwBalance.sellerAddress.slice(0, 6)}...${gwBalance.sellerAddress.slice(-4)}`
                    : '—'}
                </div>
                <div className="text-[10px] text-[#666666] mt-1">Base Sepolia</div>
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-[#666666] p-3 rounded border border-[#1f1f1f] bg-[#0a0a0a]">
              {gwBalance?.message ?? 'Set GATEWAY_SELLER_PRIVATE_KEY to enable nanopayment balance tracking.'}
            </div>
          )}

          <div className="mt-4 p-3 bg-[#111111] rounded border border-[#1f1f1f] text-[11px] text-[#666666]">
            <span className="text-[#e5e5e5] font-semibold">Protected endpoint: </span>
            <span className="font-mono">GET /api/payments</span>
            <span className="mx-2">·</span>
            <span>Invoice dataset · $0.001 USDC · x402 protocol</span>
          </div>
        </div>

        {/* Arc App Kit — Send & Bridge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="terminal-card p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold mb-1">Send USDC</h2>
              <p className="text-[11px] text-[#666666]">kit.send() · Base Sepolia</p>
            </div>
            <ArcSendPanel />
          </div>
          <div className="terminal-card p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold mb-1">Bridge to Base Sepolia</h2>
              <p className="text-[11px] text-[#666666]">kit.bridge() · CCTP</p>
            </div>
            <ArcBridgePanel />
          </div>
        </div>

        {/* Live Agent Log */}
        <div className="terminal-card mb-8">
          <div className="px-4 py-3 border-b border-[#1f1f1f] bg-[#111111]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Agent Activity</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] status-pulse" />
                <span className="text-[10px] text-[#10b981]">LIVE</span>
              </div>
            </div>
          </div>
          <div className="p-4 text-[12px]">
            <LiveAgentLog maxEntries={8} />
          </div>
        </div>

        {/* Current Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="terminal-card p-6">
            <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-3">Current Tasks</div>
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] status-pulse" />
                <span className="text-[#e5e5e5]">Monitoring Aave V3 supply rates</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] status-pulse" />
                <span className="text-[#e5e5e5]">Checking ETH price via Pyth</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] status-pulse" />
                <span className="text-[#e5e5e5]">Analyzing market volatility</span>
              </div>
            </div>
          </div>

          <div className="terminal-card p-6">
            <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-3">Ready to Act</div>
            <p className="text-[12px] text-[#666666] mb-4">
              {activeDepositsCount > 0
                ? `Watching ${activeDepositsCount} active deposits for optimization.`
                : "Deposit an invoice to enable yield optimization."}
            </p>
            <div className="flex items-center gap-6 text-[11px]">
              <div>
                <span className="text-[#666666]">next_check:</span>
                <span className="text-[#10b981] ml-1 tabular-nums">~30s</span>
              </div>
              <div>
                <span className="text-[#666666]">uptime:</span>
                <span className="text-[#10b981] ml-1">24/7</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="stats-grid grid-cols-2">
          <div className="stat-cell">
            <div className="stat-label">Strategy Optimization</div>
            <div className="stat-value stat-value-amber tabular-nums">3.5-7%</div>
            <div className="text-[11px] text-[#666666] mt-1">APY based on strategy</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Risk Management</div>
            <div className="stat-value stat-value-green">24/7</div>
            <div className="text-[11px] text-[#666666] mt-1">Pyth oracle price feeds</div>
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar status="online" network="BASE SEPOLIA" />
    </div>
  )
}
