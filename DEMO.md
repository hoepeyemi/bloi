# bloi — Demo Guide

> Mantle Global Hackathon 2025

This guide walks through the full bloi demo on Base Sepolia.

---

## Prerequisites

- MetaMask (or compatible wallet) installed
- Connected to **Base Sepolia** (Chain ID: 84532)
- ETH test tokens for gas — get them at https://www.alchemy.com/faucets/base-sepolia
- Live frontend: https://bloi.vercel.app/ (or `localhost:3000` for local)
- Agent running locally or at your public WebSocket endpoint

---

## Network Setup

Add Base Sepolia to MetaMask:

| Field | Value |
|-------|-------|
| Network Name | Base Sepolia |
| RPC URL | https://sepolia.base.org |
| Chain ID | 84532 |
| Currency Symbol | ETH |
| Block Explorer | https://sepolia.basescan.org |

---

## Demo Flow

### Step 1 — Connect Wallet

1. Open the app and click **Connect Wallet**
2. Select MetaMask, approve the Base Sepolia connection
3. The header updates to show your wallet address and the chain badge (B-SEP)
4. The dashboard loads your portfolio (empty on first connect)

### Step 2 — Import or Create an Invoice

**Option A — QuickBooks import (recommended for demo):**
1. Navigate to **Mint Invoice**
2. Click **Connect QuickBooks** in the Recommended panel
3. Authorize via OAuth — your open invoices appear immediately
4. Click any invoice to pre-fill the form (amount, due date, client name)
5. The form advances to Step 2 automatically

**Option B — Manual entry:**
1. Navigate to **Mint Invoice**
2. Fill in:
   - **Client name**: e.g. `Acme Corporation`
   - **Amount**: e.g. `10000`
   - **Currency**: USD
   - **Due date**: 30–60 days from today
   - **Selective disclosure**: toggle on to allow verified parties to request details
3. Click **Review & Mint**

### Step 3 — Review and Mint

1. The review screen shows all invoice details
2. Invoice data is shown as a keccak256 commitment hash — never in plaintext on-chain
3. Click **Mint Invoice** and approve the MetaMask transaction
4. Wait for confirmation on Base Sepolia (~2–4 seconds)
5. You are redirected to the **Portfolio** dashboard

### Step 4 — Portfolio Dashboard

The dashboard shows your wallet's invoices with:
- **Total Value Locked** — sum of your invoice amounts in the vault
- **Total Yield Earned** — real accrued yield from Aave V3
- **Active Deposits** — number of invoices currently earning yield
- **APY Range** — current Conservative (3.5%) to Aggressive (7%) rates from Aave V3

Click any invoice row to open the **Invoice Detail** page, which shows the full history and a link to the NFT on Base Sepolia Explorer (Basescan).

### Step 5 — Watch the AI Agent

1. Navigate to **Agent** in the sidebar
2. The agent panel shows:
   - Connection status (online/offline)
   - Agent wallet balances (ETH + USDC)
   - Live reasoning stream from Claude Haiku 4.5
   - Strategy decisions with confidence scores
   - On-chain execution confirmations

**What to observe:**
- The agent reads all active deposits every 30 seconds
- It evaluates risk using Pyth oracle data and the invoice due date
- Claude generates a human-readable explanation for each decision
- Decisions ≥ 70% confidence are submitted to `AgentRouter` on-chain
- You can verify the transaction on Base Sepolia Explorer (Basescan)

### Step 6 — Issuer Controls

1. Navigate to **Issuer** in the sidebar
2. See all invoices you have minted
3. You can update strategy (Hold / Conservative / Aggressive) per invoice
4. Changes write through `AgentRouter` with your wallet signature

### Step 7 — Explorer Verification

On any invoice detail page, click **Show in Explorer**. This opens the NFT on Base Sepolia Explorer (Basescan) at:
```
https://sepolia.basescan.org/token/<InvoiceNFT_address>?a=<tokenId>
```

You can verify:
- The NFT exists and is owned by your wallet (or the YieldVault after deposit)
- The commitment hash is stored in the token metadata
- Agent transactions appear in the AgentRouter contract history

---

## What Is Real vs. Testnet

| Feature | Real |
|---------|------|
| Smart contracts | Yes — deployed and verified on Base Sepolia |
| Aave V3 yield | Yes — real Aave V3 pool integration |
| Pyth oracle data | Yes — live price feeds |
| AI reasoning | Yes — Claude Haiku 4.5 (real LLM, not templates) |
| On-chain agent decisions | Yes — AgentRouter writes to Base Sepolia |
| WebSocket streaming | Yes — live from the agent process |
| QuickBooks invoices | Yes — real OAuth 2.0 connection to your QB account |

The only testnet aspect is the chain itself (Base Sepolia vs. Base Mainnet). All protocol logic, contracts, AI, and yield flows are production-grade.

---

## Running Locally

```bash
# Clone and install
git clone https://github.com/hoepeyemi/bloi.git
cd bloi
pnpm install

# Start everything
pnpm dev
# Frontend: http://localhost:3000
# Agent WebSocket: ws://localhost:8080
```

Configure environment variables:
```bash
cp app/.env.example app/.env.local
cp agent/.env.example agent/.env.local
# Fill in your ANTHROPIC_API_KEY and AGENT_PRIVATE_KEY
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Agent offline" | Start the agent: `cd agent && pnpm dev` |
| No invoices showing | Ensure wallet is on Base Sepolia (Chain ID 84532) |
| QuickBooks "connection failed" | Verify redirect URI `http://localhost:3000/api/quickbooks/callback` is registered in Intuit Developer Portal |
| Low balance warning | Get ETH from faucet: https://www.alchemy.com/faucets/base-sepolia |
| Transaction reverts | Agent may be on cooldown — wait 60s and retry |
