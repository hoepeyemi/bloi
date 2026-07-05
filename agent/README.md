# bloi — AI Agent

> Autonomous yield optimization agent for the bloi Invoice Yield Protocol

The bloi agent is a TypeScript Node.js service that monitors active invoice deposits on Mantle Sepolia, analyzes yield opportunities using Pyth oracle data, generates strategy recommendations via Claude Haiku 4.5, and executes on-chain decisions through the `AgentRouter` contract.

---

## What the Agent Does

Every 30 seconds, the agent:

1. Reads all active invoice deposits from `InvoiceNFT` and `YieldVault`
2. Fetches real-time market data from Pyth oracle
3. Computes a risk score for each invoice based on: days until due, payment probability, current APY rates
4. Sends the analysis to Claude Haiku 4.5, which generates a human-readable recommendation with a confidence score
5. Submits decisions with ≥ 70% confidence to `AgentRouter.recordDecision()` on Mantle Sepolia
6. Streams all reasoning and execution events to connected frontend clients via WebSocket

**Strategy tiers:**
| Strategy | APY | When Used |
|----------|-----|-----------|
| Hold | 0% | Low confidence, invoice near due date |
| Conservative | ~3.5% | Moderate confidence, stable risk |
| Aggressive | ~7% | High confidence, low risk, long time horizon |

---

## Quick Start

```bash
cd agent
pnpm install
pnpm dev
# WebSocket server: ws://localhost:8080
# Health endpoint: http://localhost:8080/health
```

---

## Environment Variables

Create `agent/.env`:

```bash
# Network
DEPLOYMENT_NETWORK=mantleSepolia
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz

# WebSocket
WS_PORT=8080

# Contract addresses (Mantle Sepolia)
INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29
YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6
AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658
PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3
AAVE_YIELD_ADDRESS=0x5a179d261fD322ecaED06FA9Aa2973980D74322c

# Secrets — server-side only, never expose to frontend
AGENT_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Docker

Build from the repo root:

```bash
docker build -f Dockerfile.mcp -t bloi-agent .
```

Run:

```bash
docker run -d \
  -p 8080:8080 \
  --env-file agent/.env \
  --name bloi-agent \
  bloi-agent
```

---

## WebSocket API

The agent broadcasts JSON messages to all connected clients:

```typescript
// Thinking / reasoning
{ type: "thinking", message: string, timestamp: string }

// Strategy decision
{ type: "decision", tokenId: number, strategy: "Hold" | "Conservative" | "Aggressive",
  confidence: number, reasoning: string, timestamp: string }

// On-chain execution result
{ type: "execution", tokenId: number, txHash: string, success: boolean, timestamp: string }

// Error
{ type: "error", message: string, timestamp: string }
```

**Local:** `ws://localhost:8080`
**Production:** `wss://your-agent-domain` (TLS required for browser connections)

---

## Architecture

```
agent/src/
├── index.ts          Entry point — starts agent loop + WebSocket server
├── agent.ts          Main loop — orchestrates analysis and execution per invoice
├── analyzer.ts       Risk scoring — days until due, payment probability
├── optimizer.ts      Strategy selection — confidence thresholds and downgrade logic
├── llm.ts            Claude Haiku 4.5 integration — generates human-readable reasoning
├── blockchain.ts     Contract interactions — reads state, writes AgentRouter decisions
└── websocket.ts      WebSocket server — broadcasts events to connected frontends
```

### Transaction Safety

The agent serializes blockchain writes with a promise-chain mutex to prevent nonce collisions when multiple invoices execute decisions concurrently. It also pre-checks the `AgentRouter` cooldown period before submitting, gracefully skipping if the cooldown has not elapsed.

---

## Production Notes

- Keep `AGENT_PRIVATE_KEY` and `ANTHROPIC_API_KEY` on the server only — never in frontend env
- The agent wallet needs MNT for gas on Mantle Sepolia; monitor the balance via the frontend's low-balance warning
- For production, use a process manager (PM2, Docker restart policy) to ensure the agent stays running
- The WebSocket endpoint must use `wss://` (TLS) for browser connections; use nginx or Caddy as a TLS terminator

---

## Deployment

See [`agent/DEPLOYMENT.md`](DEPLOYMENT.md) for detailed deployment guides for Railway, Render, Fly.io, and self-hosted Docker.
