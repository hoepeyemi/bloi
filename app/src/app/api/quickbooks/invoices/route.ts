import { NextResponse } from "next/server"
import { fetchInvoices, formatInvoiceForDisplay, refreshAccessToken } from "@/lib/quickbooks"
import { getDemoQuickBooksInvoices, isQuickBooksConfigured } from "@/lib/quickbooks-demo"
import {
  clearQuickBooksTokensOnResponse,
  getQuickBooksTokens,
  setQuickBooksTokensOnResponse,
} from "@/lib/quickbooks-session"

export const dynamic = "force-dynamic"

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  clearQuickBooksTokensOnResponse(response)
  return response
}

export async function GET() {
  try {
    if (!isQuickBooksConfigured()) {
      const invoices = getDemoQuickBooksInvoices().map(formatInvoiceForDisplay)

      return NextResponse.json({
        success: true,
        data: {
          invoices,
          total: invoices.length,
          demo: true,
        },
      })
    }

    const storedTokens = await getQuickBooksTokens()
    if (!storedTokens) {
      return NextResponse.json({
        success: false,
        requiresAuth: true,
        error: "QuickBooks is not connected yet.",
      })
    }

    let tokens = storedTokens
    let refreshed = false
    if (tokens.expiresAt && tokens.expiresAt <= Date.now() + 60_000) {
      try {
        tokens = await refreshAccessToken(tokens.refreshToken, tokens.realmId)
        refreshed = true
      } catch {
        const response = NextResponse.json({
          success: false,
          requiresAuth: true,
          error: "QuickBooks session expired. Please reconnect.",
        })
        clearQuickBooksTokensOnResponse(response)
        return response
      }
    }

    const qbInvoices = await fetchInvoices(tokens.accessToken, tokens.realmId, { status: "open" })
    const invoices = qbInvoices.map(formatInvoiceForDisplay)

    const response = NextResponse.json({
      success: true,
      data: {
        invoices,
        total: invoices.length,
        demo: false,
      },
    })
    if (refreshed) setQuickBooksTokensOnResponse(response, tokens)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch invoices"
    return NextResponse.json(
      {
        success: false,
        requiresAuth: /401|unauthorized|token|auth/i.test(message),
        error: message,
      },
      { status: 500 }
    )
  }
}
