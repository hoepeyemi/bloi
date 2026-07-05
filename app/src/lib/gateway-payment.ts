/**
 * Circle Gateway x402 payment middleware for Next.js App Router.
 *
 * Express's createGatewayMiddleware doesn't work in Next.js route handlers,
 * so this replicates the same 402 → settle → respond flow using fetch directly.
 *
 * Usage:
 *   export const GET = withGatewayPayment(myHandler, { amount: '1000' });
 */

import { NextRequest, NextResponse } from 'next/server';

export interface GatewayPaymentOptions {
  /** Amount in USDC micro-units (6 decimals). Default 1000 = $0.001 */
  amount?: string;
  /** Human-readable description shown in the 402 response */
  description?: string;
}

type RouteHandler = (request: NextRequest) => Promise<NextResponse> | NextResponse;

const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const NETWORK = 'eip155:84532';

export function withGatewayPayment(
  handler: RouteHandler,
  options: GatewayPaymentOptions = {}
): RouteHandler {
  return async (request: NextRequest) => {
    const sellerAddress = process.env.GATEWAY_SELLER_ADDRESS || '';
    const facilitatorUrl =
      process.env.GATEWAY_FACILITATOR_URL || 'https://gateway-api-testnet.circle.com';
    const amount = options.amount ?? '1000';
    const description = options.description ?? 'bloi API access';

    const paymentSignature = request.headers.get('payment-signature');

    // No payment header → return 402 with requirements
    if (!paymentSignature) {
      const paymentRequired = {
        x402Version: 2,
        resource: {
          url: request.url,
          description,
          mimeType: 'application/json',
        },
        accepts: [
          {
            scheme: 'exact',
            network: NETWORK,
            asset: USDC_BASE_SEPOLIA,
            amount,
            maxTimeoutSeconds: 604900,
            payTo: sellerAddress,
            extra: { name: 'GatewayWalletBatched', version: '1' },
          },
        ],
      };

      return new NextResponse(
        JSON.stringify({ error: 'Payment required', x402Version: 2 }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
          },
        }
      );
    }

    // Decode the signed payment payload
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(paymentSignature, 'base64').toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Invalid payment-signature encoding' }, { status: 402 });
    }

    // Settle with Circle Gateway facilitator
    const requirements = {
      scheme: 'exact',
      network: NETWORK,
      asset: USDC_BASE_SEPOLIA,
      amount,
      maxTimeoutSeconds: 604900,
      payTo: sellerAddress,
      extra: { name: 'GatewayWalletBatched', version: '1' },
    };

    let settled: { success: boolean; payer?: string; errorReason?: string };
    try {
      const res = await fetch(`${facilitatorUrl}/v1/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPayload: payload, paymentRequirements: requirements }),
      });

      if (!res.ok) {
        const body = await res.text();
        return NextResponse.json(
          { error: 'Gateway settle error', reason: body },
          { status: 402 }
        );
      }

      settled = await res.json();
    } catch (err) {
      return NextResponse.json(
        { error: 'Gateway unreachable', reason: err instanceof Error ? err.message : String(err) },
        { status: 402 }
      );
    }

    if (!settled.success) {
      return NextResponse.json(
        { error: 'Payment rejected', reason: settled.errorReason },
        { status: 402 }
      );
    }

    // Payment confirmed — forward to the real handler
    return handler(request);
  };
}
