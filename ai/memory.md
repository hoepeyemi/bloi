# bloi - AI Memory

## Project Overview
bloi is an AI treasury agent for B2B commerce that tokenizes invoices as NFTs on Base Sepolia and deposits them into yield-generating DeFi strategies.

## Key Decisions
- **UI Style:** Terminal/Bloomberg aesthetic with monospace fonts, green accents (#10b981), dark theme (#0a0a0a)
- **Video Tool:** Remotion for programmatic video generation
- **Voiceover:** ElevenLabs with Brian voice
- **Tracks Selected:** x402 Agentic Finance/Payment Track + Base Sepolia Integrations
- **Privacy:** Invoice data stored as keccak256 hashes, not plaintext on-chain
- **70% confidence threshold:** Agent auto-executes above this, asks user below

## Tech Stack
- Next.js 15 + React 19 (frontend)
- wagmi v3 + viem v2 for Web3
- TypeScript agent service with OpenAI GPT-4o mini
- Hardhat for contract compilation and deployment
- Network: Base Sepolia (Chain ID 84532)
- Tailwind CSS 4
- pnpm monorepo (workspaces: app, agent, contracts)

## Deployed Contracts (Base Sepolia)
- InvoiceNFT: 0x1045c1fFf861D9f6F6D00F30eCf6075832d998Ec
- YieldVault: 0x271a64E069E683627C23712156EDC804ac6a2CD7
- AgentRouter: 0xA8fDda52A8022610e94C49E54EF61D8ae9662BE0
- PrivacyRegistry: 0xb0e21917954138e84681C3792b9B31D892Bb1670
- PythOracle: 0x69a23dC9Ba9e5C965beCeF191850E5Cea74954C3
- AaveV3YieldSource: 0xCE4E72C577031A96e4EAcA48028eE3d23C64eccE

## Learned Context
- Remotion `staticFile()` serves from `/public` folder
- ElevenLabs voiceover needs `...` for pauses to extend duration
- Puppeteer doesn't support `:has-text()` selector (use evaluateHandle instead)
- pnpm works better than npm for this project (npm had null property errors)
- Lower CRF value = higher quality video (use --crf 18 for HQ)
- wagmi config is in `/app/src/lib/wagmi.ts`
- Contract addresses centralized in `/app/src/lib/contracts/addresses.ts`
- Agent runs as standalone Node.js service, communicates via WebSocket
- QuickBooks tokens stored in httpOnly cookies (Vercel serverless compatible)
- QB SQL does not support `>` operator — filter client-side in JS

## Gotchas & Warnings
- YouTube takes time to process HD - may show low quality initially
- Yields are SIMULATED for demo — architecture wired to real Aave V3
- Contracts NOT audited - testnet only
- KEYBOARD_SHORTCUTS must be exported from use-keyboard-shortcuts.ts
- Use `sleep()` helper instead of `page.waitForTimeout()` in newer Puppeteer

## File Locations
- Remotion compositions: `src/remotion/`
- Demo screenshots: `public/demo/`
- Voiceover audio: `public/audio/voiceover.mp3`
- Rendered videos: `out/`
- Capture script: `capture-interactive-demo.js`
- Deployment manifest: `contracts/deployments/baseSepolia.json`

## Reflections
- Remotion is great for programmatic videos but render times are slow (~3 min for 90s video)
- Screenshot-based demo works but lacks animation smoothness of real screen recording
- For future: consider using actual screen recording + voiceover in post for more authentic demos
