# bloi Protocol — Technical Whitepaper

> Invoice Yield Optimization via Autonomous AI on Base

**Version:** 1.0 — Lepton Agents Hackathon
**GitHub:** https://github.com/hoepeyemi/bloi
**Live Demo:** https://bloi.vercel.app/
**Demo Video:** https://www.youtube.com/watch?v=kJkpo2Gmft8

---

## Abstract

bloi is a permissionless protocol that converts B2B invoice receivables into yield-bearing on-chain positions on Base Sepolia. Invoices are tokenized as ERC-721 NFTs using privacy-preserving cryptographic commitments, deposited into a yield vault integrated with Aave V3, and continuously managed by an autonomous AI agent powered by Anthropic GPT-4o mini. The agent monitors market conditions via Pyth Network oracle feeds, scores invoice risk, and executes strategy changes on-chain through the AgentRouter contract — without user intervention. Invoice details never appear in plaintext on-chain; only keccak256 commitment hashes are stored, enabling selective disclosure through Merkle proofs.

---

## 1. Problem Statement

### 1.1 The Invoice Financing Gap

Global B2B outstanding receivables exceed **$3 trillion** at any given time. Businesses routinely extend 30–90 day payment terms to clients, leaving earned revenue completely idle. For a company with $200,000 in outstanding invoices, this represents $10,000–$14,000 in lost DeFi yield annually at 5–7% APY.

Existing solutions fail in different ways:

| Solution | Failure Mode |
|----------|-------------|
| Invoice factoring | 2–5% fees, credit checks, exposes client relationships |
| Bank credit lines | Slow, require collateral, unavailable to SMBs/freelancers |
| Manual DeFi | Requires separate crypto collateral; no connection to invoice lifecycle |
| Net-30 financing platforms | Web2 solutions; not permissionless, not composable |

### 1.2 The Opportunity

The intersection of DeFi yield infrastructure (Aave V3), real-world asset tokenization (ERC-721), and autonomous AI agents creates a new primitive: **yield-bearing invoice receivables** that require no manual management and expose no sensitive business data on-chain.

---

## 2. Protocol Design

### 2.1 Core Flow

```
1. Invoice Created (off-chain: QuickBooks, manual)
       │
       ▼
2. InvoiceNFT.mint(dataCommitment, amountCommitment)
   → ERC-721 minted; only keccak256 hashes stored on-chain
       │
       ▼
3. YieldVault.deposit(tokenId, strategy)
   → Invoice NFT transferred to vault
   → USDC equivalent deployed to Aave V3 (or held)
       │
       ▼
4. AI Agent Loop (every 30 seconds)
   → Reads active deposits
   → Fetches Pyth oracle data
   → GPT-4o mini generates recommendation
   → AgentRouter.recordDecision() if confidence ≥ 70%
       │
       ▼
5. YieldVault.withdraw(tokenId)
   → NFT returned to owner
   → Principal + accrued Aave V3 yield paid out
```

### 2.2 Privacy Architecture

Invoice data is never stored in plaintext on Base Sepolia. The commitment scheme works as follows:

```
dataCommitment  = keccak256(abi.encode(clientName, invoiceId, dueDate, nonce))
amountCommitment = keccak256(abi.encode(amount, currency, nonce))
```

The `nonce` is known only to the invoice issuer, making the commitments non-reversible without the original data. The `PrivacyRegistry` stores these commitments in a Merkle tree; selective disclosure uses Merkle proofs to reveal specific fields to verified parties without exposing the full invoice.

### 2.3 Yield Strategies

| Strategy | Yield Source | Target APY | Risk Profile |
|----------|-------------|------------|--------------|
| Hold | None | 0% | Zero risk — principal preserved |
| Conservative | Aave V3 USDC | ~3.5% | Low — Aave USDC lending pool |
| Aggressive | Aave V3 high-yield | ~7% | Moderate — higher-yield Aave pool |

The vault enforces a `decisionCooldown` period between strategy changes (configurable by governance) to prevent gas-intensive oscillation.

---

## 3. Smart Contracts

### 3.1 InvoiceNFT (ERC-721)

Tokenizes invoices as NFTs with privacy-preserving metadata.

**Key functions:**
```solidity
function mint(bytes32 dataCommitment, bytes32 amountCommitment) external returns (uint256 tokenId)
function getActiveInvoices() external view returns (uint256[] memory)
function getInvoice(uint256 tokenId) external view returns (Invoice memory)
```

**Events:** `InvoiceMinted(tokenId, issuer, dataCommitment, amountCommitment)`

### 3.2 YieldVault

Manages deposits, strategy assignment, and yield accrual.

**Key functions:**
```solidity
function deposit(uint256 tokenId, Strategy strategy) external
function withdraw(uint256 tokenId) external returns (uint256 principal, uint256 yield)
function setStrategy(uint256 tokenId, Strategy strategy) external
function getAccruedYield(uint256 tokenId) external view returns (uint256)
```

**Strategies:** `Hold = 0`, `Conservative = 1`, `Aggressive = 2`

### 3.3 AgentRouter (AI-Powered On-Chain Function)

The core AI-powered contract. The autonomous agent submits decisions here; the router validates authorization and forwards execution.

**Key functions:**
```solidity
function recordDecision(uint256 tokenId, uint8 strategy, uint256 confidence) external
function authorizeAgent(address agent) external onlyOwner
function lastAnalysis(uint256 tokenId) external view returns (uint256 timestamp)
function decisionCooldown() external view returns (uint256 seconds)
```

**Authorization:** Only wallet addresses in the `authorizedAgents` mapping can submit decisions. The agent's private key (`AGENT_PRIVATE_KEY`) must be authorized before the agent can execute on-chain.

### 3.4 PrivacyRegistry

Merkle tree-based selective disclosure.

**Key functions:**
```solidity
function registerCommitment(bytes32 root) external
function verifyField(bytes32[] calldata proof, bytes32 leaf) external view returns (bool)
function requestDisclosure(uint256 tokenId, string[] calldata fields) external
```

### 3.5 PythOracle

Adapter for Pyth Network price feeds.

**Key functions:**
```solidity
function getPrice(bytes32 priceId) external view returns (int64 price, uint64 conf, int32 expo)
function updatePriceFeeds(bytes[] calldata updateData) external payable
```

### 3.6 AaveV3YieldSource

Integrates with Aave V3 for real DeFi yield.

**Key functions:**
```solidity
function deposit(uint256 amount) external returns (uint256 shares)
function withdraw(uint256 shares) external returns (uint256 amount)
function getAPY() external view returns (uint256 bps)
function getBalance(address account) external view returns (uint256)
```

---

## 4. AI Agent Architecture

### 4.1 Agent Loop

```
AgentLoop (every 30s)
    │
    ├── blockchain.getActiveInvoices()       → tokenIds[]
    │
    ├── For each tokenId:
    │   ├── blockchain.getInvoice(tokenId)   → Invoice data
    │   ├── pythOracle.getPrice()            → Market data
    │   ├── analyzer.score(invoice, market)  → { riskScore, paymentProb, daysUntilDue }
    │   ├── optimizer.shouldChangeStrategy() → { recommended, confidence }
    │   ├── llm.generateReasoning()          → Human-readable explanation
    │   └── if confidence ≥ 70%:
    │       blockchain.recordDecision(tokenId, strategy)
    │
    └── websocket.broadcast(events)          → Frontend clients
```

### 4.2 Risk Scoring

The analyzer computes a composite risk score (0–100) per invoice:

```typescript
score = (
  daysUntilDueScore * 0.4 +    // Urgency: 0 (1 day) → 100 (90+ days)
  paymentProbScore  * 0.4 +    // History: estimated probability of on-time payment
  marketCondScore   * 0.2      // Pyth oracle: volatility and liquidity indicators
)
```

### 4.3 Optimizer Logic

Strategy selection uses asymmetric confidence thresholds:

```typescript
if (recommended < current) {
  // Downgrade (risky → safe): lower threshold, bias toward safety
  return confidence >= 50
}
if (recommended > current) {
  // Upgrade (safe → risky): higher threshold, require stronger signal
  return confidence >= 80
}
```

This asymmetry means the agent is more willing to reduce risk than to increase it — protecting principal when uncertain.

### 4.4 OpenAI Integration

Each analysis cycle sends a structured prompt to GPT-4o mini:

```
Invoice #<tokenId>
Current strategy: <current>
Risk score: <score>/100
Days until due: <days>
Recommended strategy: <recommended>
Confidence: <pct>%

Explain this recommendation in 2-3 sentences for a non-technical user.
```

The model's response is streamed to frontend clients via WebSocket in real-time.

### 4.5 Transaction Safety

Two mechanisms prevent transaction failures:

1. **Nonce serialization mutex** — blockchain writes are serialized via a promise-chain mutex, preventing nonce collisions when multiple invoices execute in the same cycle
2. **Cooldown pre-flight** — the agent reads `lastAnalysis[tokenId] + decisionCooldown` before submitting; if the cooldown has not elapsed, the decision is deferred with a log message instead of reverting on-chain

---

## 5. Frontend Architecture

Built with Next.js 15 + React 19 + wagmi v3 + viem v2.

### 5.1 Wallet Data Isolation

All invoice fetches are scoped to the connected wallet:

```typescript
useEffect(() => {
  if (!address) return
  fetch(`/api/invoices?issuer=${address}`)
    .then(res => res.json())
    .then(data => setInvoices(data.data.invoices))
}, [address])
```

Switching wallets triggers a re-fetch, ensuring users only see their own invoices.

### 5.2 Real-Time Agent Stream

The frontend connects to the agent WebSocket and renders events as they arrive:

```typescript
const ws = new WebSocket(process.env.NEXT_PUBLIC_AGENT_WS_URL)
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  appendThought(msg) // renders in the agent feed
}
```

### 5.3 QuickBooks Integration

OAuth 2.0 flow with file-based token persistence:
- Tokens stored at `.next/cache/quickbooks-tokens.json` (survives hot-reloads and server restarts)
- Token refresh happens automatically on each invoice fetch when `expiresAt ≤ now + 60s`
- CSRF protection via httpOnly state cookie validated on callback
- Demo fallback: if `QUICKBOOKS_CLIENT_ID` is not set, demo invoices are returned without requiring OAuth

---

## 6. Security Considerations

| Risk | Mitigation |
|------|-----------|
| Agent private key exposure | Key stored server-side only; never in frontend env or client bundles |
| Unauthorized agent decisions | `AgentRouter` maintains an `authorizedAgents` allowlist; only owner can authorize |
| Invoice data privacy | Only commitment hashes on-chain; Merkle proofs for selective disclosure |
| CSRF in QuickBooks OAuth | httpOnly state cookie validated on callback; strict mismatch rejection |
| Nonce collisions | Promise-chain mutex serializes all blockchain writes from the agent |
| Contract cooldown bypass | Agent pre-checks cooldown via `lastAnalysis + decisionCooldown` before submitting |

---

## 7. Why Base

Base L2 is uniquely suited for the bloi protocol:

- **Low gas fees** enable the agent to make frequent, small strategy adjustments that would be economically unviable on Ethereum L1
- **EVM compatibility** allows direct integration with Aave V3 and Pyth oracle without custom bridges
- **Fast finality** (~2s block time) means the agent can observe the result of its previous decision before the next analysis cycle
- **Growing DeFi ecosystem** provides real yield sources with competitive APY

---

## 8. Limitations and Future Work

### Current Limitations

| Limitation | Impact |
|-----------|--------|
| Testnet only (Base Sepolia) | Requires audit before mainnet deployment |
| File-based token storage for QuickBooks | Not suitable for multi-instance production deployment; needs a database |
| Risk model uses simplified heuristics | Full credit scoring would require additional data sources |
| No secondary market for invoice NFTs | Positions cannot be liquidated before due date |
| Single-agent architecture | No redundancy; agent downtime pauses optimization |

### Roadmap

1. **Mainnet deployment** — Base Mainnet after security audit
2. **Multi-agent coordination** — distributed agent network with consensus for high-value decisions
3. **ZK proof disclosure** — replace Merkle proofs with ZK proofs (Noir circuits) for trustless disclosure
4. **Secondary market** — order book for trading invoice NFTs before maturity
5. **Credit scoring oracle** — integrate off-chain credit data via TLS notary (TLSNotary/DECO)
6. **Database persistence** — PostgreSQL for agent state, token storage, and historical analysis

---

## 9. Deployed Infrastructure Summary

**Network:** Base Sepolia (Chain ID: 84532)
**Explorer:** https://sepolia.basescan.org
**Frontend:** https://bloi.vercel.app/
**GitHub:** https://github.com/hoepeyemi/bloi

| Contract | Address |
|----------|---------|
| InvoiceNFT | `0x018ee8F363421016177DbC8F9492fe2a1C720e29` |
| YieldVault | `0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6` |
| AgentRouter | `0x4430248F3b2304F946f08c43A06C3451657FD658` |
| PrivacyRegistry | `0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0` |
| PythOracle | `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3` |
| AaveV3YieldSource | `0x5a179d261fD322ecaED06FA9Aa2973980D74322c` |

---

*bloi — Turn Invoices into Yield. Automatically.*
*Lepton Agents Hackathon*
