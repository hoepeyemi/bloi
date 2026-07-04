/**
 * GET /api/gateway/balance
 *
 * Returns the seller's Circle Gateway and wallet USDC balances.
 * Uses GATEWAY_SELLER_PRIVATE_KEY (server-only env var) to authenticate with
 * GatewayClient. Safe to expose to the dashboard since it only reads balances.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const privateKey = process.env.GATEWAY_SELLER_PRIVATE_KEY;

  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return NextResponse.json({
      configured: false,
      sellerAddress: process.env.GATEWAY_SELLER_ADDRESS || null,
      message: 'GATEWAY_SELLER_PRIVATE_KEY not set — balance unavailable',
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { GatewayClient } = await import('@circle-fin/x402-batching/client') as any;
    const client = new GatewayClient({
      chain: 'baseSepolia',
      privateKey: privateKey as `0x${string}`,
    });

    const balances = await client.getBalances();

    return NextResponse.json({
      configured: true,
      sellerAddress: process.env.GATEWAY_SELLER_ADDRESS || null,
      gateway: {
        available: balances.gateway.formattedAvailable,
        pending: '0.000000',
        raw: balances.gateway.available.toString(),
      },
      wallet: {
        balance: balances.wallet.formatted,
        raw: balances.wallet.balance.toString(),
      },
      network: 'Base Sepolia',
      usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : 'Failed to fetch balance',
      },
      { status: 500 }
    );
  }
}
