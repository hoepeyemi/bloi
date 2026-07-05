# bloi — Pitch

> Turn Invoices into Yield. Automatically.

**Hackathon:** Mantle Global Hackathon 2025
**GitHub:** https://github.com/hoepeyemi/bloi
**Live Demo:** https://vasmo.netlify.app/

---

## The Problem

$3 trillion in B2B invoices sit unpaid globally at any given time. Businesses routinely wait 30–90 days for payment on work already delivered. That capital is completely idle.

**A concrete example:** A consulting firm with $200,000 in outstanding receivables could earn $10,000–$14,000/year at 5–7% APY. Instead, that money earns nothing.

Traditional alternatives fail:
- **Invoice factoring**: advances 80–90% cash but charges 2–5% fees, requires credit checks, and exposes sensitive client data
- **Bank credit lines**: slow, require collateral, unavailable to many freelancers/SMBs
- **DeFi lending**: requires posting crypto collateral — most businesses don't have it

---

## The Solution

**bloi** converts the waiting period into a productive yield-generating position on Mantle Sepolia.

```
Import Invoice (QuickBooks / Manual)
  → Mint NFT (invoice data stays private — only commitment hash on-chain)
    → Deposit to Yield Vault
      → AI Agent Optimizes Strategy 24/7 (Hold / Conservative / Aggressive)
        → Withdraw Principal + Real DeFi Yield When Client Pays
```

**Key differentiators:**
- Not invoice factoring — no credit checks, no lockups, no liquidity advances
- Real yield from Aave V3, not simulated numbers
- AI agent powered by Claude Haiku 4.5 for autonomous optimization
- Invoice data is never stored in plaintext on-chain
- QuickBooks integration for direct import of real invoices

---

## How the AI Works

The autonomous agent runs continuously and:

1. Reads all active deposits from `InvoiceNFT` + `YieldVault` contracts
2. Fetches real-time market data from Pyth oracle
3. Scores each invoice: risk profile, days until due, current APY rates
4. Claude Haiku 4.5 generates a strategy recommendation with a confidence score
5. If confidence ≥ 70%, the agent submits the decision to `AgentRouter.recordDecision()` on-chain
6. The decision is executed on-chain and streamed to the frontend via WebSocket in real-time

**Strategy tiers:**
| Strategy | APY | Risk |
|----------|-----|------|
| Hold | 0% | None |
| Conservative | ~3.5% | Low (Aave V3 USDC) |
| Aggressive | ~7% | Moderate (Aave V3 higher-yield) |

The agent automatically downgrades risk as invoice due dates approach and upgrades when market conditions are favorable — all without user intervention.

---

## Why Mantle

- **Low gas fees**: Mantle L2 makes micro-decisions economically viable — the agent can execute strategy changes on-chain without prohibitive gas costs
- **EVM compatible**: Full compatibility with Aave V3 and Pyth oracle contracts
- **Growing ecosystem**: Mantle's DeFi ecosystem provides real yield sources for the protocol
- **Testnet infrastructure**: Robust Mantle Sepolia testnet with faucet and block explorer

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Mantle Sepolia (Chain ID 5003) |
| Smart Contracts | Solidity 0.8.24 + Hardhat |
| Frontend | Next.js 15 + React 19 + wagmi v3 |
| AI Agent | TypeScript + Node.js |
| LLM | Anthropic Claude Haiku 4.5 |
| Yield | Aave V3 (real DeFi yields, 3–7% APY) |
| Oracle | Pyth Network |
| Privacy | keccak256 commitment hashes + Merkle trees |
| Invoice Import | QuickBooks OAuth 2.0 |

---

## Deployed Infrastructure

All 6 contracts deployed and verified on Mantle Sepolia:

| Contract | Address |
|----------|---------|
| InvoiceNFT | `0x018ee8F363421016177DbC8F9492fe2a1C720e29` |
| YieldVault | `0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6` |
| AgentRouter | `0x4430248F3b2304F946f08c43A06C3451657FD658` |
| PrivacyRegistry | `0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0` |
| PythOracle | `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3` |
| AaveV3YieldSource | `0x5a179d261fD322ecaED06FA9Aa2973980D74322c` |

---

## Target Users

**Primary:** Crypto-native freelancers, consultants, and small agencies
- Issue B2B invoices with 30–90 day payment terms
- $20,000+ in outstanding receivables at any time
- Already have a crypto wallet
- Comfortable with DeFi but want automation, not manual management

**Secondary:** Finance-forward SMBs looking to put receivables to work without giving up control

---

## What Works Today

| Feature | Status |
|---------|--------|
| Invoice tokenization with privacy commitments | Live on Mantle Sepolia |
| Real DeFi yield via Aave V3 | Live |
| Autonomous AI agent with Claude Haiku 4.5 | Live |
| Real-time WebSocket streaming of agent reasoning | Live |
| QuickBooks OAuth 2.0 import | Live |
| Circle x402 nanopayments | Live |
| 6 verified smart contracts | Live |
| Public frontend | Live (Netlify) |

## Honest Limitations

| Limitation | Notes |
|-----------|-------|
| Testnet only | Mantle Sepolia; mainnet deployment straightforward once audited |
| Risk model simplified | Scoring uses Pyth oracle data + rule-based heuristics, not full credit scoring |
| No secondary market | Invoice NFTs are not yet tradeable |
| Token persistence | Agent token state uses file-based cache; production needs a database |

---

## Why bloi Wins

1. **Real DeFi yield** — not a simulation; actual Aave V3 integration
2. **On-chain AI decisions** — the agent writes to the blockchain, not just a dashboard
3. **Privacy by design** — commitment scheme means no sensitive data on-chain
4. **QuickBooks bridge** — real-world invoice import makes this immediately usable
5. **Mantle-native** — designed for Mantle's low-fee, high-throughput environment

---

*Previously awarded $3K at Cronos x402 PayTech Hackathon. Rebuilt and extended for Mantle Global Hackathon 2025.*
