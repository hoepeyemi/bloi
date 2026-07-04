/**
 * x402 Payment Gateway — Invoice data feed (Base Sepolia)
 *
 * External callers (AI agents, third-party services) pay $0.001 USDC per request
 * via Circle Gateway nanopayments to receive the current active invoice dataset.
 *
 * Protocol flow:
 *   GET /api/payments          → 402 + PAYMENT-REQUIRED header
 *   GET /api/payments + sig    → settle → 200 + invoice data
 *
 * Buyers: use GatewayClient.pay('/api/payments') for automatic handling.
 */

import { NextRequest } from 'next/server';
import { withGatewayPayment } from '@/lib/gateway-payment';
import { getActiveInvoices, getInvoice, getDeposit, getAccruedYield } from '@/lib/contracts/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function formatStatus(status: number): string {
  return ['Minted', 'InYield', 'Paid', 'Defaulted', 'Cancelled'][status] ?? 'Unknown';
}

function formatStrategy(strategy: number): string {
  return ['Hold', 'Conservative', 'Aggressive'][strategy] ?? 'Unknown';
}

async function invoiceDataHandler(_request: NextRequest): Promise<NextResponse> {
  const activeInvoices = await getActiveInvoices();

  const invoices = await Promise.all(
    activeInvoices.map(async (tokenId) => {
      const [invoice, deposit] = await Promise.all([
        getInvoice(tokenId),
        getDeposit(tokenId),
      ]);
      if (!invoice) return null;

      const accruedYield =
        deposit?.active ? await getAccruedYield(tokenId) : BigInt(0);

      return {
        tokenId: tokenId.toString(),
        dueDate: new Date(Number(invoice.dueDate) * 1000).toISOString(),
        createdAt: new Date(Number(invoice.createdAt) * 1000).toISOString(),
        status: formatStatus(Number(invoice.status)),
        riskScore: invoice.riskScore,
        paymentProbability: invoice.paymentProbability,
        issuer: invoice.issuer,
        deposit: deposit?.active
          ? {
              principal: deposit.principal.toString(),
              accruedYield: accruedYield.toString(),
              strategy: formatStrategy(Number(deposit.strategy)),
              strategyCode: Number(deposit.strategy),
            }
          : null,
      };
    })
  );

  return NextResponse.json({
    paid: true,
    network: 'Base Sepolia (eip155:84532)',
    usdcPaid: '$0.001',
    data: {
      invoices: invoices.filter(Boolean),
      total: activeInvoices.length,
      fetchedAt: new Date().toISOString(),
    },
  });
}

export const GET = withGatewayPayment(invoiceDataHandler, {
  amount: '1000', // $0.001 USDC
  description: 'vasmo active invoice dataset — Base Sepolia',
});
