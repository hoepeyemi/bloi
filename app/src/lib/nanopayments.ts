/**
 * Circle Gateway Nanopayments — Base Sepolia
 *
 * Uses @circle-fin/x402-batching to provide gasless sub-cent USDC payments
 * via the x402 protocol on Base Sepolia.
 *
 * Docs: https://developers.circle.com/gateway/nanopayments
 * USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * Get testnet USDC: https://faucet.circle.com
 */

export const GATEWAY_CONFIG = {
  /** Circle Gateway facilitator API (testnet) */
  facilitatorUrl: process.env.NEXT_PUBLIC_GATEWAY_FACILITATOR_URL
    || 'https://gateway-api-testnet.circle.com',

  /** Chain name used by GatewayClient — must be 'baseSepolia' for Base Sepolia */
  chain: 'baseSepolia' as const,

  /** USDC contract address on Base Sepolia */
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,

  /** EVM chain ID for Base Sepolia */
  chainId: 84532,
} as const;

/**
 * Returns the x402-protected API URL for a given resource path.
 * Sellers should protect these routes with createGatewayMiddleware.
 */
export function gatewayResourceUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/api/payments${path}`;
}

/**
 * Seller address that receives USDC payments.
 * Set NEXT_PUBLIC_GATEWAY_SELLER_ADDRESS in your environment.
 */
export const GATEWAY_SELLER_ADDRESS =
  (process.env.NEXT_PUBLIC_GATEWAY_SELLER_ADDRESS || '') as `0x${string}`;
