# bloi — Smart Contracts

> Hardhat workspace for the bloi Invoice Yield Protocol on Base Sepolia

Six Solidity contracts deployed and verified on Base Sepolia (Chain ID: 84532), implementing invoice tokenization, privacy-preserving commitments, autonomous yield management, and AI-driven strategy execution.

---

## Deployed Contracts — Base Sepolia (Chain ID: 84532)

| Contract | Address | Explorer |
|----------|---------|---------|
| InvoiceNFT | `0x1045c1fFf861D9f6F6D00F30eCf6075832d998Ec` | [View](https://sepolia.basescan.org/address/0x1045c1fFf861D9f6F6D00F30eCf6075832d998Ec) |
| YieldVault | `0x271a64E069E683627C23712156EDC804ac6a2CD7` | [View](https://sepolia.basescan.org/address/0x271a64E069E683627C23712156EDC804ac6a2CD7) |
| AgentRouter | `0xA8fDda52A8022610e94C49E54EF61D8ae9662BE0` | [View](https://sepolia.basescan.org/address/0xA8fDda52A8022610e94C49E54EF61D8ae9662BE0) |
| PrivacyRegistry | `0xb0e21917954138e84681C3792b9B31D892Bb1670` | [View](https://sepolia.basescan.org/address/0xb0e21917954138e84681C3792b9B31D892Bb1670) |
| PythOracle | `0x69a23dC9Ba9e5C965beCeF191850E5Cea74954C3` | [View](https://sepolia.basescan.org/address/0x69a23dC9Ba9e5C965beCeF191850E5Cea74954C3) |
| AaveV3YieldSource | `0xCE4E72C577031A96e4EAcA48028eE3d23C64eccE` | [View](https://sepolia.basescan.org/address/0xCE4E72C577031A96e4EAcA48028eE3d23C64eccE) |

Deployment manifest: [`deployments/baseSepolia.json`](deployments/baseSepolia.json)

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
Adapter for Pyth Network price feeds on Base Sepolia. Provides real-time asset prices used by the AI agent for risk scoring and strategy decisions. The agent reads oracle data before each analysis cycle.

### AaveV3YieldSource
Adapter that deposits USDC into Aave V3 pools and tracks accrued interest. Returns the real Aave V3 APY to the vault and frontend. This is a live integration — yield numbers shown in the UI reflect actual Aave protocol rates.

---

## Architecture

```
InvoiceNFT
    │  (mint, commit, reveal)
    ▼
YieldVault ◄────── AgentRouter ◄──── AI Agent (off-chain)
    │                                (GPT-4o mini)
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

### Base Sepolia (testnet)

```bash
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export DEPLOYER_PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=your_basescan_api_key

npm run deploy:base-sepolia
```

### Local Hardhat Network

```bash
npm run deploy:local
```

---

## Verification

Verify all contracts on Basescan:

```bash
export ETHERSCAN_API_KEY=your_basescan_api_key
npm run verify:base-sepolia
```

This programmatically verifies all 6 contracts and reports status.

---

## Notes

- The deployment manifest (`deployments/baseSepolia.json`) is the single source of truth for all contract addresses — both the frontend and agent read from this file
- If you redeploy any contract, update the manifest first, then update `app/.env` and `agent/.env` to match
- All contracts use Solidity 0.8.24 with OpenZeppelin 5.2 and Pyth SDK Solidity 4.0
