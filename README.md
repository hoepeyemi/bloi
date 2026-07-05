# bloi — Invoice Yield Protocol

> Turn Invoices into Yield. Automatically.

**bloi** tokenizes B2B invoices as Real-World Assets (RWAs) on Mantle Sepolia, then deploys an autonomous AI agent powered by Claude Haiku 4.5 to continuously optimize yield via Aave V3 — while protecting sensitive invoice data with cryptographic commitments.

Built for the **Mantle Global Hackathon 2025**.

---

## Live Demo

| Resource | URL |
|----------|-----|
| Frontend | https://vasmo.netlify.app/ |
| GitHub | https://github.com/hoepeyemi/bloi |
| Mantle Sepolia Explorer | https://explorer.sepolia.mantle.xyz |

---

## The Problem

B2B businesses wait **30–90 days** for invoice payment. A company with $200,000 in outstanding receivables loses roughly $10,000–$14,000 per year in potential DeFi yield — capital that sits completely idle while payment clears.

Traditional invoice factoring is expensive (2–5% fees), requires credit checks, and exposes sensitive business data to third parties.

## The Solution

bloi turns the waiting period into a productive asset:

```
Connect Wallet → Import Invoice (QuickBooks / Manual)
→ Mint NFT → Deposit to Yield Vault
→ AI Agent Optimizes Strategy 24/7
→ Withdraw Principal + Yield When Client Pays
```

- **Real yield** from Aave V3 (3–7% APY) — not simulated
- **Privacy-first** — invoice data stored as keccak256 commitment hashes, never in plaintext on-chain
- **Autonomous AI** — Claude Haiku 4.5 monitors and rebalances positions automatically
- **No lockups** — withdraw anytime
- **No KYC** — permissionless; your wallet is your identity
- **QuickBooks integration** — import real invoices directly with OAuth 2.0

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    bloi Protocol                                │
│                                                                 │
│  ┌──────────────┐   WebSocket    ┌────────────────────────┐    │
│  │  Next.js 15  │◄──────────────►│  AI Agent (Node.js)    │    │
│  │  Frontend    │                │  Claude Haiku 4.5       │    │
│  └──────┬───────┘                └──────────┬─────────────┘    │
│         │ wagmi/viem                        │ ethers.js         │
│         ▼                                   ▼                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Mantle Sepolia (Chain ID: 5003)              │  │
│  │                                                          │  │
│  │  InvoiceNFT → YieldVault → AgentRouter                  │  │
│  │       ↕              ↕                                   │  │
│  │  PrivacyRegistry  AaveV3YieldSource ← PythOracle        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Description |
|-----------|-------------|
| `app/` | Next.js 15 + React 19 frontend — minting, portfolio, agent monitoring, issuer controls |
| `agent/` | Autonomous TypeScript service — analyzes invoices, executes strategy changes on-chain via AgentRouter |
| `contracts/` | Hardhat workspace — 6 Solidity contracts deployed and verified on Mantle Sepolia |

---

## Deployed Contracts — Mantle Sepolia (Chain ID: 5003)

| Contract | Address | Status |
|----------|---------|--------|
| InvoiceNFT | [`0x018ee8F363421016177DbC8F9492fe2a1C720e29`](https://explorer.sepolia.mantle.xyz/address/0x018ee8F363421016177DbC8F9492fe2a1C720e29) | Verified |
| YieldVault | [`0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6`](https://explorer.sepolia.mantle.xyz/address/0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6) | Verified |
| AgentRouter | [`0x4430248F3b2304F946f08c43A06C3451657FD658`](https://explorer.sepolia.mantle.xyz/address/0x4430248F3b2304F946f08c43A06C3451657FD658) | Verified |
| PrivacyRegistry | [`0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0`](https://explorer.sepolia.mantle.xyz/address/0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0) | Verified |
| PythOracle | [`0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3`](https://explorer.sepolia.mantle.xyz/address/0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3) | Verified |
| AaveV3YieldSource | [`0x5a179d261fD322ecaED06FA9Aa2973980D74322c`](https://explorer.sepolia.mantle.xyz/address/0x5a179d261fD322ecaED06FA9Aa2973980D74322c) | Verified |

Deployment manifest: [`contracts/deployments/mantleSepolia.json`](contracts/deployments/mantleSepolia.json)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Mantle Sepolia (Chain ID 5003), native token MNT |
| Smart Contracts | Solidity 0.8.24 + Hardhat |
| Frontend | Next.js 15 + React 19 + TypeScript |
| Wallet / Web3 | wagmi v3 + viem v2 |
| AI Agent | TypeScript + Node.js + WebSocket (ws) |
| LLM | Anthropic Claude Haiku 4.5 |
| Yield Source | Aave V3 (real DeFi, 3–7% APY) |
| Oracle | Pyth Network (real-time price feeds) |
| Privacy | keccak256 commitment hashes + Merkle trees |
| Invoice Import | QuickBooks OAuth 2.0 |
| Payments | Circle x402 nanopayments |
| Package Manager | pnpm (monorepo workspace) |

---

## AI-Powered On-Chain Flow

The agent-to-contract path is the core AI-powered function:

1. Agent reads active deposits from `InvoiceNFT` and `YieldVault`
2. Agent fetches risk data from Pyth oracle
3. Claude Haiku 4.5 generates human-readable reasoning with confidence scores
4. Decisions above **70% confidence** are submitted to `AgentRouter.recordDecision()`
5. `AgentRouter` validates authorization and executes the strategy change on-chain
6. Frontend receives the result in real-time via WebSocket and displays the agent's reasoning

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask connected to Mantle Sepolia

### Run everything locally

```bash
pnpm install
pnpm dev
```

This starts the frontend (port 3000) and agent (port 8080) in parallel.

### Individual services

```bash
# Frontend
cd app && pnpm dev

# Agent
cd agent && pnpm dev

# Contracts
cd contracts && npm run build && npm test
```

### Mantle Sepolia network details

| Field | Value |
|-------|-------|
| Chain ID | 5003 |
| RPC | https://rpc.sepolia.mantle.xyz |
| Fallback RPC 1 | https://mantle-sepolia.drpc.org |
| Fallback RPC 2 | https://5003.rpc.thirdweb.com/ |
| Explorer | https://explorer.sepolia.mantle.xyz |
| Faucet | https://faucet.sepolia.mantle.xyz/ |
| Native Token | MNT |

---

## Hackathon Submission Checklist

- [x] Smart contracts deployed on Mantle Sepolia
- [x] All 6 contracts verified on Mantle Explorer
- [x] AI-powered function callable on-chain via AgentRouter
- [x] Frontend publicly accessible (Netlify)
- [x] Deployed addresses documented (above + deployment manifest)
- [x] Architecture documented
- [ ] Demo video (2+ minutes, core use case walkthrough)

---

## Notes

- QuickBooks integration has a demo fallback — OAuth is optional for local testing
- The agent streams reasoning to the frontend in real-time; connect MetaMask to Mantle Sepolia to see live data
- All contract addresses in `contracts/deployments/mantleSepolia.json` are the canonical source of truth
