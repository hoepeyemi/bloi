/**
 * Arc App Kit — Agent integration (server-side, Base Sepolia)
 *
 * Gives the vasmo agent the ability to send USDC on Base Sepolia using
 * the Arc App Kit SDK with a viem private-key wallet adapter.
 *
 * The agent uses kit.send() for:
 *   - Forwarding USDC yield to invoice issuers
 *   - Paying for x402-protected external services (alongside nanopayments)
 *   - Treasury rebalancing across addresses
 *
 * Chain: Base Sepolia  ·  Arc chain id: "Base_Sepolia"
 * Docs:  https://docs.arc.io/app-kit/quickstarts/send-tokens-same-chain
 */

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { AppKit } from '@circle-fin/app-kit';
import type { SendParams, EstimateSendResult } from '@circle-fin/app-kit';

const ARC_CHAIN = 'Base_Sepolia' as const;

export interface AgentSendResult {
  state: string;
  txHash?: string;
  explorerUrl?: string;
}

export class ArcAgentKit {
  private kit: AppKit;
  private privateKey: `0x${string}`;
  private rpcUrl: string;

  constructor(privateKey: `0x${string}`, rpcUrl?: string) {
    this.kit = new AppKit();
    this.privateKey = privateKey;
    this.rpcUrl = rpcUrl || process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  }

  private async getAdapter() {
    const { createViemAdapter } = await import('@circle-fin/adapter-viem-v2');
    const account = privateKeyToAccount(this.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(this.rpcUrl),
    });
    return createViemAdapter({ walletClient });
  }

  /**
   * Estimate the fee for a USDC send before submitting.
   */
  async estimateSend(to: string, amount: string): Promise<EstimateSendResult> {
    const adapter = await this.getAdapter();
    const params: SendParams = {
      from: { adapter, chain: ARC_CHAIN },
      to,
      amount,
      token: 'USDC',
    };
    return this.kit.estimateSend(params);
  }

  /**
   * Send USDC to a recipient on Base Sepolia.
   *
   * @param to     Recipient address
   * @param amount Amount in USDC (e.g. "1.00")
   */
  async sendUsdc(to: string, amount: string): Promise<AgentSendResult> {
    const adapter = await this.getAdapter();
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
 * Returns null if AGENT_PRIVATE_KEY is not configured.
 */
export function createArcAgentKit(): ArcAgentKit | null {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return null;
  }
  return new ArcAgentKit(
    privateKey as `0x${string}`,
    process.env.BASE_SEPOLIA_RPC_URL
  );
}
