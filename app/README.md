# bloi — Frontend

> Next.js 15 frontend for the bloi Invoice Yield Protocol

Built with Next.js 15 + React 19 + wagmi v3, deployed on Mantle Sepolia.

---

## What This App Does

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Protocol overview and wallet connect CTA |
| Portfolio | `/dashboard` | Per-wallet invoice portfolio with live yield stats |
| Mint | `/dashboard/mint` | 2-step invoice minting — QuickBooks import or manual entry |
| Agent | `/dashboard/agent` | Live AI agent reasoning stream via WebSocket |
| Issuer | `/dashboard/issuer` | Issuer controls — manage and update invoice strategies |
| Invoice Detail | `/dashboard/invoice/[tokenId]` | Per-invoice history, strategy, explorer link |

### Key Features

- **Wallet isolation** — all data fetches are scoped to the connected wallet address
- **QuickBooks OAuth 2.0** — import real invoices directly; falls back to demo data if unconfigured
- **Real-time agent stream** — WebSocket connection to the AI agent; live reasoning, confidence scores, and on-chain execution confirmations
- **Privacy-preserving** — invoice amounts and details displayed from chain commitment hashes, never stored in plaintext
- **Low balance warning** — persistent banner when agent wallet ETH or USDC drops below $7, with faucet links
- **Circle x402 nanopayments** — payment gateway integration for invoice settlement

---

## Local Development

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask connected to Mantle Sepolia

```bash
# From repo root (starts frontend + agent together)
pnpm dev

# Frontend only
cd app
pnpm dev
# Opens at http://localhost:3000
```

---

## Environment Variables

Copy `.env` to `.env.local` and fill in your values:

```bash
# Chain
NEXT_PUBLIC_CHAIN_ID=5003
NEXT_PUBLIC_NETWORK_MODE=testnet

# Mantle Sepolia RPC (with fallbacks)
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_1=https://mantle-sepolia.drpc.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_2=https://5003.rpc.thirdweb.com/

# Contract addresses (Mantle Sepolia — do not change unless redeploying)
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658
NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS=0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0
NEXT_PUBLIC_PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3
NEXT_PUBLIC_AAVE_YIELD_ADDRESS=0x5a179d261fD322ecaED06FA9Aa2973980D74322c

# Agent WebSocket
NEXT_PUBLIC_AGENT_WS_URL=ws://localhost:8080    # use wss:// in production

# App URL (used for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# WalletConnect (get a project ID at https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# Circle Gateway nanopayments
NEXT_PUBLIC_GATEWAY_SELLER_ADDRESS=0x...
GATEWAY_SELLER_ADDRESS=0x...                    # server-side (same address)
GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com
GATEWAY_SELLER_PRIVATE_KEY=0x...               # server-side only, never exposed to client

# QuickBooks (optional — demo fallback loads automatically if not set)
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
```

---

## Scripts

```bash
pnpm dev        # Start development server (hot reload)
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # ESLint
pnpm tsc        # TypeScript type check (no emit)
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/invoices` | GET | Fetch invoices, optionally filtered by `?issuer=<address>` |
| `/api/gateway/balance` | GET | Agent wallet ETH + USDC balances with low-balance detection |
| `/api/quickbooks/auth` | GET | Initiate QuickBooks OAuth flow |
| `/api/quickbooks/callback` | GET | OAuth callback — exchanges code for tokens |
| `/api/quickbooks/invoices` | GET | Fetch open QB invoices (or demo data) |
| `/api/quickbooks/invoices` | DELETE | Disconnect QuickBooks (clears stored tokens) |

---

## Deployment

### Netlify

```bash
# Build command
pnpm build

# Publish directory
.next
```

Set all environment variables in Netlify dashboard → Site settings → Environment variables. The `GATEWAY_SELLER_PRIVATE_KEY` and `QUICKBOOKS_CLIENT_SECRET` must be set as server-side env vars (not exposed to the browser).

### Vercel

```bash
vercel deploy --prod
```

---

## Notes

- Contract addresses come from `contracts/deployments/mantleSepolia.json` — the frontend `.env` values must match this manifest
- If you redeploy contracts, update both the manifest and the frontend env vars together
- QuickBooks tokens are persisted to `.next/cache/quickbooks-tokens.json` on the server — this file is gitignored
- The agent WebSocket URL must be `wss://` (not `ws://`) for browser connections in production
