/**
 * Circle Gateway Nanopayments — Agent buyer (Base Sepolia)
 *
 * Gives the bloi agent a Gateway wallet so it can autonomously:
 *   - Deposit USDC into Gateway (one-time onchain tx)
 *   - Pay for x402-protected resources gaslessly (EIP-3009 offchain signature)
 *   - Withdraw unused Gateway balance back to the agent wallet
 *
 * Chain: Base Sepolia (eip155:84532)
 * SDK:   @circle-fin/x402-batching
 * Docs:  https://developers.circle.com/gateway/nanopayments/quickstarts/buyer
 *
 * USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * Get testnet USDC at:  https://faucet.circle.com
 *
 * NOTE: Nanopayments require an EOA wallet (not a smart contract account).
 *       The agent's AGENT_PRIVATE_KEY is used directly for signing.
 */

// Dynamic import wrapper — GatewayClient is ESM-only.
// Using 'any' for the cached constructor to avoid the duplicate-private-property
// error that arises when the same package is resolved via two different module paths
// (a known TS limitation with ESM dynamic imports in CJS hosts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _GatewayClient: any = null;

async function getGatewayClient() {
  if (!_GatewayClient) {
    const mod = await import('@circle-fin/x402-batching/client');
    _GatewayClient = mod.GatewayClient;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _GatewayClient as any;
}

export interface NanopaymentConfig {
  /** Agent EOA private key — used to sign EIP-3009 authorizations */
  privateKey: `0x${string}`;
  /** Minimum Gateway balance (in USDC) before auto-depositing */
  minGatewayBalance?: string;
  /** Amount to deposit when balance is low */
  depositAmount?: string;
}

export class AgentNanopayments {
  private config: Required<NanopaymentConfig>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;

  constructor(config: NanopaymentConfig) {
    this.config = {
      minGatewayBalance: '0.1',
      depositAmount: '1',
      ...config,
    };
  }

  private async ensureClient() {
    if (!this.client) {
      const GatewayClient = await getGatewayClient();
      this.client = new GatewayClient({
        // Base Sepolia — the chain where the agent holds its Gateway balance
        chain: 'baseSepolia',
        privateKey: this.config.privateKey,
      });
    }
    return this.client;
  }

  /**
   * Returns the agent's current Gateway and wallet USDC balances.
   */
  async getBalances() {
    const client = await this.ensureClient();
    return client.getBalances();
  }

  /**
   * Ensures the agent has enough USDC in Gateway to make payments.
   * Deposits automatically if the available balance falls below the threshold.
   */
  async ensureFunded(): Promise<void> {
    const client = await this.ensureClient();
    const balances = await client.getBalances();
    const minUnits = BigInt(Math.floor(parseFloat(this.config.minGatewayBalance) * 1_000_000));

    if (balances.gateway.available < minUnits) {
      console.log(
        `[nanopay] Gateway balance low (${balances.gateway.formattedAvailable} USDC). ` +
        `Depositing ${this.config.depositAmount} USDC from wallet...`
      );
      const deposit = await client.deposit(this.config.depositAmount);
      console.log(`[nanopay] Deposit tx: ${deposit.depositTxHash}`);
    }
  }

  /**
   * Pays for an x402-protected URL and returns the response data.
   * Handles the full 402 negotiation: request → payment signature → retry.
   *
   * @param url  URL of the x402-protected resource
   */
  async pay<T = unknown>(url: string): Promise<{ data: T; amountPaid: string }> {
    const client = await this.ensureClient();
    const result = await client.pay(url);
    return { data: result.data as T, amountPaid: result.formattedAmount };
  }

  /**
   * Checks whether a URL supports Circle Gateway batching before paying.
   */
  async supports(url: string): Promise<boolean> {
    const client = await this.ensureClient();
    const support = await client.supports(url);
    return support.supported;
  }

  /**
   * Withdraws USDC from the Gateway balance back to the agent wallet.
   */
  async withdraw(amount: string): Promise<string> {
    const client = await this.ensureClient();
    const result = await client.withdraw(amount);
    console.log(`[nanopay] Withdrew ${result.formattedAmount} USDC. Tx: ${result.mintTxHash}`);
    return result.mintTxHash;
  }
}

/**
 * Creates an AgentNanopayments instance from environment variables.
 * Returns null if AGENT_PRIVATE_KEY is not configured.
 */
export function createNanopayments(): AgentNanopayments | null {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return null;
  }

  return new AgentNanopayments({
    privateKey: privateKey as `0x${string}`,
    minGatewayBalance: process.env.GATEWAY_MIN_BALANCE || '0.1',
    depositAmount: process.env.GATEWAY_DEPOSIT_AMOUNT || '1',
  });
}
