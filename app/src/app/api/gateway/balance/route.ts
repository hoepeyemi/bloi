/**
 * GET /api/gateway/balance
 *
 * Returns the seller's Circle Gateway and wallet USDC balances.
 * Uses GATEWAY_SELLER_PRIVATE_KEY (server-only env var).
 *
 * Calls the Circle Gateway REST API and Base Sepolia RPC directly — no
 * @circle-fin/x402-batching import — that package imports `arc` from
 * viem/chains which does not exist and breaks Next.js webpack.
 */

import { NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export const dynamic = 'force-dynamic';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const GATEWAY_API = 'https://gateway-api-testnet.circle.com/v1';
const BASE_SEPOLIA_DOMAIN = 6;

const erc20BalanceOfAbi = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

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
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const address = account.address;

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const [walletBalanceRaw, ethBalanceRaw, gatewayRes, priceRes] = await Promise.all([
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20BalanceOfAbi,
        functionName: 'balanceOf',
        args: [address],
      }),
      publicClient.getBalance({ address }),
      fetch(`${GATEWAY_API}/balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'USDC',
          sources: [{ depositor: address, domain: BASE_SEPOLIA_DOMAIN }],
        }),
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
        next: { revalidate: 60 },
      }).catch(() => null),
    ]);

    const walletFormatted = formatUnits(walletBalanceRaw as bigint, 6);
    const ethFormatted = formatUnits(ethBalanceRaw as bigint, 18);

    // ETH price in USD — fallback to 2000 if CoinGecko is unavailable
    let ethPriceUsd = 2000;
    if (priceRes?.ok) {
      try {
        const priceData = await priceRes.json() as { ethereum?: { usd?: number } };
        ethPriceUsd = priceData.ethereum?.usd ?? 2000;
      } catch { /* use fallback */ }
    }

    const ethUsdValue = parseFloat(ethFormatted) * ethPriceUsd;
    const usdcUsdValue = parseFloat(walletFormatted);
    const LOW_BALANCE_THRESHOLD = 7;

    let gateway = { available: '0.000000', pending: '0.000000', raw: '0' };
    if (gatewayRes.ok) {
      const gatewayData = await gatewayRes.json() as {
        balances?: Array<{ balance?: string; withdrawing?: string }>;
      };
      const entry = gatewayData.balances?.[0];
      if (entry) {
        gateway = {
          available: entry.balance ?? '0.000000',
          pending: entry.withdrawing ?? '0.000000',
          raw: entry.balance ?? '0',
        };
      }
    }

    return NextResponse.json({
      configured: true,
      sellerAddress: address,
      gateway,
      wallet: {
        balance: walletFormatted,
        raw: (walletBalanceRaw as bigint).toString(),
        usdValue: usdcUsdValue.toFixed(2),
      },
      eth: {
        balance: parseFloat(ethFormatted).toFixed(6),
        priceUsd: ethPriceUsd,
        usdValue: ethUsdValue.toFixed(2),
      },
      lowBalance: {
        eth: ethUsdValue <= LOW_BALANCE_THRESHOLD,
        usdc: usdcUsdValue <= LOW_BALANCE_THRESHOLD,
        any: ethUsdValue <= LOW_BALANCE_THRESHOLD || usdcUsdValue <= LOW_BALANCE_THRESHOLD,
        threshold: LOW_BALANCE_THRESHOLD,
      },
      network: 'Base Sepolia',
      usdcAddress: USDC_ADDRESS,
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
