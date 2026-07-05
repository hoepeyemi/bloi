/**
 * Arc App Kit — Agent integration (server-side, Base Sepolia)
 *
 * Uses createViemAdapterFromPrivateKey to give the bloi agent a wallet adapter
 * for kit.send() USDC transfers on Base Sepolia — no browser wallet required.
 *
 * Use cases:
 *   - Distribute yield earnings to invoice issuers
 *   - Pay for external x402 services (alongside nanopayments)
 *   - Treasury rebalancing
 *
 * Chain: Base Sepolia · Arc chain id: "Base_Sepolia"
 * Docs:  https://docs.arc.io/app-kit/quickstarts/send-tokens-same-chain
 */

import { AppKit } from '@circle-fin/app-kit';
import { createViemAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';
import type { SendParams, EstimatedGas } from '@circle-fin/app-kit';

const ARC_CHAIN = 'Base_Sepolia' as const;

export interface AgentSendResult {
  state: string;
  txHash?: string;
  explorerUrl?: string;
}

export class ArcAgentKit {
  private kit: AppKit;
  private privateKey: string;
  private adapter: ReturnType<typeof createViemAdapterFromPrivateKey> | null = null;

  constructor(privateKey: string) {
    this.kit = new AppKit();
    this.privateKey = privateKey;
  }

  private getAdapter() {
    if (!this.adapter) {
      this.adapter = createViemAdapterFromPrivateKey({ privateKey: this.privateKey });
    }
    return this.adapter;
  }

  /**
   * Estimate the fee for a USDC send before submitting.
   */
  async estimateSend(to: string, amount: string): Promise<EstimatedGas> {
    const adapter = this.getAdapter();
    const params: SendParams = {
      from: { adapter, chain: ARC_CHAIN },
      to,
      amount,
      token: 'USDC',
    };
    return this.kit.estimateSend(params);
  }

  /**
   * Send USDC to a recipient on Base Sepolia via Arc App Kit.
   *
   * @param to     Recipient address (0x...)
   * @param amount Amount in USDC string (e.g. "1.00")
   */
  async sendUsdc(to: string, amount: string): Promise<AgentSendResult> {
    const adapter = this.getAdapter();
    const params: SendParams = {
      from: { adapter, chain: ARC_CHAIN },
      to,
      amount,
      token: 'USDC',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.kit.send(params) as any;
    return {
      state: result.state ?? 'success',
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
    };
  }
}

/**
 * Creates an ArcAgentKit from environment variables.
 * Returns null if AGENT_PRIVATE_KEY is not set.
 */
export function createArcAgentKit(): ArcAgentKit | null {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return null;
  }
  return new ArcAgentKit(privateKey);
}
