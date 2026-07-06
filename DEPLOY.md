# bloi — Deployment Guide

> Lepton Agents Hackathon

This guide covers the full deployment: smart contracts on Base Sepolia, the AI agent, and the Next.js frontend.

---

## 1. Smart Contracts

### Live Deployment (Already Deployed)

All 6 contracts are deployed and verified on Base Sepolia. The canonical addresses are in:

```
contracts/deployments/baseSepolia.json
```

| Contract | Address |
|----------|---------|
| InvoiceNFT | `0x1045c1fFf861D9f6F6D00F30eCf6075832d998Ec` |
| YieldVault | `0x271a64E069E683627C23712156EDC804ac6a2CD7` |
| AgentRouter | `0xA8fDda52A8022610e94C49E54EF61D8ae9662BE0` |
| PrivacyRegistry | `0xb0e21917954138e84681C3792b9B31D892Bb1670` |
| PythOracle | `0x69a23dC9Ba9e5C965beCeF191850E5Cea74954C3` |
| AaveV3YieldSource | `0xCE4E72C577031A96e4EAcA48028eE3d23C64eccE` |

### Redeploy to Base Sepolia

Only needed if you modify and redeploy contracts:

```bash
cd contracts

# Set environment variables
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export DEPLOYER_PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=your_basescan_api_key

# Deploy
npm run deploy:base-sepolia

# Verify on Basescan
npm run verify:base-sepolia
```

After redeployment, update:
1. `contracts/deployments/baseSepolia.json`
2. `app/.env` — all `NEXT_PUBLIC_*_ADDRESS` values
3. `agent/.env` — all `*_ADDRESS` values

### Local Development Network

```bash
cd contracts
npm run deploy:local
```

---

## 2. AI Agent

### Environment Variables

Create `agent/.env` with:

```bash
# Network
DEPLOYMENT_NETWORK=baseSepolia
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# WebSocket server
WS_PORT=8080

# Contract addresses (Base Sepolia)
INVOICE_NFT_ADDRESS=0x1045c1fFf861D9f6F6D00F30eCf6075832d998Ec
YIELD_VAULT_ADDRESS=0x271a64E069E683627C23712156EDC804ac6a2CD7
AGENT_ROUTER_ADDRESS=0xA8fDda52A8022610e94C49E54EF61D8ae9662BE0
PYTH_ORACLE_ADDRESS=0x69a23dC9Ba9e5C965beCeF191850E5Cea74954C3
AAVE_YIELD_ADDRESS=0xCE4E72C577031A96e4EAcA48028eE3d23C64eccE

# Keys (server-side only — never expose to frontend)
AGENT_PRIVATE_KEY=0x...
OPENAI_API_KEY=sk-...
```

### Run Locally

```bash
cd agent
pnpm install
pnpm dev
# WebSocket server starts at ws://localhost:8080
# Health check: http://localhost:8080/health
```

### Docker Deployment

Build the agent image:

```bash
# From repo root
docker build -f Dockerfile.mcp -t bloi-agent .
```

Run the container:

```bash
docker run -d \
  -p 8080:8080 \
  --env-file agent/.env \
  --name bloi-agent \
  bloi-agent
```

Health check:

```bash
curl https://your-agent-domain/health
```

### Cloud Deployment Options

| Platform | Command / Notes |
|----------|----------------|
| Railway | Connect repo ? set env vars ? deploy from `Dockerfile.mcp` |
| Render | New Web Service ? Docker ? set root to `/` ? `Dockerfile.mcp` |
| Fly.io | `fly launch` ? set secrets via `fly secrets set KEY=VALUE` |
| VPS | `docker run` as above, expose port 8080, add TLS via nginx/caddy |

The agent exposes a single WebSocket endpoint. In production, use `wss://` (TLS required for browser connections).

---

## 3. Frontend

### Environment Variables

Create `app/.env` (or `.env.local`) with:

```bash
# Chain
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_NETWORK_MODE=testnet

# RPC
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_1=https://base-sepolia.drpc.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_2=https://84532.rpc.thirdweb.com/

# Contract addresses (Base Sepolia)
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x1045c1fFf861D9f6F6D00F30eCf6075832d998Ec
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0x271a64E069E683627C23712156EDC804ac6a2CD7
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0xA8fDda52A8022610e94C49E54EF61D8ae9662BE0
NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS=0xb0e21917954138e84681C3792b9B31D892Bb1670
NEXT_PUBLIC_PYTH_ORACLE_ADDRESS=0x69a23dC9Ba9e5C965beCeF191850E5Cea74954C3
NEXT_PUBLIC_AAVE_YIELD_ADDRESS=0xCE4E72C577031A96e4EAcA48028eE3d23C64eccE

# Agent
NEXT_PUBLIC_AGENT_WS_URL=wss://your-public-agent-domain

# App
NEXT_PUBLIC_APP_URL=https://your-public-frontend-domain
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# Circle Gateway (x402 nanopayments)
NEXT_PUBLIC_GATEWAY_SELLER_ADDRESS=0x...
GATEWAY_SELLER_ADDRESS=0x...
GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com
GATEWAY_SELLER_PRIVATE_KEY=0x...

# QuickBooks (optional — demo fallback if not set)
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=https://your-domain/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
```

### Build and Deploy

```bash
cd app
pnpm install
pnpm build
pnpm start
```

#### Netlify

The frontend is configured for Netlify static deployment:

```bash
# Build command
pnpm build

# Publish directory
.next

# Environment variables
# Add all NEXT_PUBLIC_* vars in Netlify dashboard ? Site settings ? Environment variables
```

#### Vercel

```bash
vercel deploy --prod
# Set env vars in Vercel dashboard or via `vercel env add`
```

---

## 4. QuickBooks OAuth Setup

For real QuickBooks connections (not demo):

1. Go to https://developer.intuit.com ? My Apps ? your app
2. Under **Keys & credentials**, add your redirect URI:
   - Dev: `http://localhost:3000/api/quickbooks/callback`
   - Prod: `https://your-domain.com/api/quickbooks/callback`
3. Copy Client ID and Client Secret to your env

Without QuickBooks credentials set, the app automatically falls back to demo invoices.

---

## 5. Pre-Submission Checklist

- [ ] Smart contracts deployed on Base Sepolia
- [ ] All 6 contracts verified on Basescan
- [ ] Frontend publicly accessible (Netlify / Vercel / VPS)
- [ ] Agent running with public WebSocket endpoint (`wss://`)
- [ ] `NEXT_PUBLIC_AGENT_WS_URL` points to public agent URL
- [ ] Agent successfully calls `AgentRouter.recordDecision()` on Base Sepolia
- [x] Demo video — https://vimeo.com/1207549307?share=copy&fl=sv&fe=ci#t=0
- [ ] `contracts/deployments/baseSepolia.json` up to date
- [ ] GitHub repository public

---

## 6. Useful URLs

| Resource | URL |
|----------|-----|
| Base Sepolia Explorer (Basescan) | https://sepolia.basescan.org |
| Base Sepolia Faucet | https://www.alchemy.com/faucets/base-sepolia |
| Base Sepolia RPC | https://sepolia.base.org |
| Pyth Network | https://pyth.network |
| Aave V3 | https://aave.com |
| Circle x402 Docs | https://developers.circle.com/gateway/nanopayments |
| OpenAI API | https://platform.openai.com/docs |
