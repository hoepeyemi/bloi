# bloi — 2-Minute Demo Script

> Mantle Global Hackathon 2025

---

## Before You Record

- [ ] Browser open at https://vasmo.netlify.app/ (or localhost:3000)
- [ ] MetaMask unlocked and connected to Mantle Sepolia (Chain ID 5003)
- [ ] Agent running (`cd agent && pnpm dev`)
- [ ] QuickBooks connected (or demo mode ready)
- [ ] At least one invoice already minted (so portfolio is non-empty)
- [ ] Screen recording software ready, microphone checked

---

## Script

### 0:00 — Hook (15 seconds)

**Show: Landing page**

> "Businesses are sitting on $3 trillion in unpaid invoices right now — capital locked up for 30 to 90 days while they wait to get paid. bloi puts that money to work. This is real DeFi yield on real invoices, running autonomously on Mantle Sepolia."

---

### 0:15 — Connect + Portfolio (20 seconds)

**Show: Connect wallet → Portfolio dashboard**

> "Connect MetaMask on Mantle Sepolia. The portfolio dashboard loads my invoices instantly — total value locked, yield earned, active deposits, and the live APY range from Aave V3. These are real rates, not simulated."

**Point out:** Total Yield Earned, APY Range (3.5–7%), Active Deposits count

---

### 0:35 — Import from QuickBooks (25 seconds)

**Show: Mint page → QuickBooks panel → select invoice**

> "Minting an invoice takes two clicks. I'll import directly from QuickBooks — here are my 20 open invoices from real clients. I'll pick this one for $10,000 due in 30 days."

**Click invoice — watch form auto-fill and advance to Step 2**

> "The form pre-fills automatically. On-chain, only a cryptographic hash is stored — the actual invoice details never touch the blockchain."

---

### 1:00 — Mint Transaction (20 seconds)

**Show: Review screen → MetaMask popup → confirmation**

> "One transaction on Mantle Sepolia — low fees, fast confirmation. The invoice is now an NFT on-chain."

**Show: Transaction confirmed, redirect to portfolio**

---

### 1:20 — AI Agent in Action (30 seconds)

**Show: Agent page — live reasoning stream**

> "This is where it gets interesting. The AI agent is watching my positions 24/7. It just read my new deposit, pulled Pyth oracle data for risk scoring, and Claude Haiku is generating its analysis."

**Point to confidence score and strategy recommendation**

> "87% confidence — it's recommending the Conservative strategy. High enough to execute. Watch it submit the decision to AgentRouter on Mantle Sepolia."

**Show: Transaction hash appears in the stream**

> "That's a real on-chain transaction. The strategy change is recorded in the AgentRouter contract and I can verify it on Mantle Explorer right now."

---

### 1:50 — Close (10 seconds)

**Show: Explorer link or portfolio with updated strategy**

> "bloi. Real yield on real invoices. Autonomous AI. Privacy-preserving. Built natively for Mantle. Thank you."

---

## Key Points to Hit

| Point | Where |
|-------|-------|
| $3T problem — invoices sitting idle | Hook |
| Real Aave V3 yield (3–7% APY), not simulated | Portfolio dashboard |
| QuickBooks import — real invoices, not test data | Mint step 1 |
| Privacy: commitment hash on-chain, not plaintext | Mint step 2 |
| Claude Haiku 4.5 — real LLM, not templates | Agent page |
| On-chain execution via AgentRouter | Agent page — tx hash |
| Mantle Sepolia — low fees, fast confirmations | Mint confirmation |

---

## Fallback (If Something Breaks)

- **Agent offline**: Show the agent terminal logs instead of WebSocket stream
- **QuickBooks slow**: Use manual entry — still shows the 2-step flow
- **Transaction stuck**: Have a pre-recorded clip of a successful tx for splicing
- **Wrong network**: MetaMask → Settings → Networks → switch to Mantle Sepolia
