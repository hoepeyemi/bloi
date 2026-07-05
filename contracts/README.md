# bloi — Smart Contracts

> Hardhat workspace for the bloi Invoice Yield Protocol on Mantle Sepolia

Six Solidity contracts deployed and verified on Mantle Sepolia (Chain ID: 5003), implementing invoice tokenization, privacy-preserving commitments, autonomous yield management, and AI-driven strategy execution.

---

## Deployed Contracts — Mantle Sepolia (Chain ID: 5003)

| Contract | Address | Explorer |
|----------|---------|---------|
| InvoiceNFT | `0x018ee8F363421016177DbC8F9492fe2a1C720e29` | [View](https://explorer.sepolia.mantle.xyz/address/0x018ee8F363421016177DbC8F9492fe2a1C720e29) |
| YieldVault | `0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6` | [View](https://explorer.sepolia.mantle.xyz/address/0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6) |
| AgentRouter | `0x4430248F3b2304F946f08c43A06C3451657FD658` | [View](https://explorer.sepolia.mantle.xyz/address/0x4430248F3b2304F946f08c43A06C3451657FD658) |
| PrivacyRegistry | `0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0` | [View](https://explorer.sepolia.mantle.xyz/address/0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0) |
| PythOracle | `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3` | [View](https://explorer.sepolia.mantle.xyz/address/0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3) |
| AaveV3YieldSource | `0x5a179d261fD322ecaED06FA9Aa2973980D74322c` | [View](https://explorer.sepolia.mantle.xyz/address/0x5a179d261fD322ecaED06FA9Aa2973980D74322c) |

Deployment manifest: [`deployments/mantleSepolia.json`](deployments/mantleSepolia.json)

---

## Contract Overview

### InvoiceNFT
ERC-721 contract that tokenizes B2B invoices as NFTs. Invoice data (amount, payer, terms) is never stored in plaintext — only a keccak256 commitment hash is recorded on-chain, enabling selective disclosure without exposing sensitive business information.

### YieldVault
Manages invoice deposits and yield accrual. Supports three strategy tiers:
- **Hold** — 0% APY, principal preserved, no DeFi exposure
- **Conservative** — ~3.5% APY via Aave V3 USDC lending
- **Aggressive** — ~7% APY via Aave V3 higher-yield pools

The vault enforces cooldown periods between strategy changes to prevent excessive gas consumption from rapid oscillation.

### AgentRouter
Authorization and execution layer for the autonomous AI agent. The agent calls `recordDecision(tokenId, strategy, confidence)` which:
1. Validates the caller is an authorized agent address
2. Checks the per-invoice cooldown period has elapsed
3. Records the decision on-chain
4. Forwards execution to the YieldVault

This is the **AI-powered on-chain function** — every agent decision produces a verifiable on-chain transaction.

### PrivacyRegistry
Implements a Merkle tree-based commitment scheme for selective invoice disclosure. Verified parties can request access to specific invoice fields; the owner reveals only the requested data using Merkle proofs, without exposing the full invoice.

### PythOracle
Adapter for Pyth Network price feeds on Mantle Sepolia. Provides real-time asset prices used by the AI agent for risk scoring and strategy decisions. The agent reads oracle data before each analysis cycle.

### AaveV3YieldSource
Adapter that deposits USDC into Aave V3 pools and tracks accrued interest. Returns the real Aave V3 APY to the vault and frontend. This is a live integration — yield numbers shown in the UI reflect actual Aave protocol rates.

---

## Architecture

```
InvoiceNFT
    │  (mint, commit, reveal)
    ▼
YieldVault ◄────── AgentRouter ◄──── AI Agent (off-chain)
    │                                (Claude Haiku 4.5)
    ├── Conservative ──► AaveV3YieldSource
    ├── Aggressive   ──► AaveV3YieldSource
    └── Hold         ──► (no yield source)

PrivacyRegistry ◄── InvoiceNFT (commitment hashes)
PythOracle      ◄── Agent (price feeds for risk scoring)
```

---

## Setup

```bash
cd contracts
npm install
npm run build
npm test
```

---

## Deployment

### Mantle Sepolia (testnet)

```bash
export MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
export DEPLOYER_PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=your_mantle_explorer_key

npm run deploy:mantle-sepolia
```

### Local Hardhat Network

```bash
npm run deploy:local
```

---

## Verification

Verify all contracts on Mantle Explorer:

```bash
export ETHERSCAN_API_KEY=your_mantle_explorer_key
npm run verify:mantle-sepolia
```

This programmatically verifies all 6 contracts and reports status.

---

## Notes

- The deployment manifest (`deployments/mantleSepolia.json`) is the single source of truth for all contract addresses — both the frontend and agent read from this file
- If you redeploy any contract, update the manifest first, then update `app/.env` and `agent/.env` to match
- All contracts use Solidity 0.8.24 with OpenZeppelin 5.2 and Pyth SDK Solidity 4.0
