import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/quickbooks"
import { isQuickBooksConfigured } from "@/lib/quickbooks-demo"
import { setQuickBooksTokensOnResponse } from "@/lib/quickbooks-session"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const realmId = searchParams.get("realmId") || searchParams.get("realm_id")
  const state = searchParams.get("state")
  const stateCookie = request.cookies.get("quickbooks_oauth_state")?.value

  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/mint?quickbooks=demo", appUrl))
  }

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  if (!stateCookie || !state || stateCookie !== state) {
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  try {
    const tokens = await exchangeCodeForTokens(code, realmId)

    const response = NextResponse.redirect(new URL("/dashboard/mint?quickbooks=success", appUrl))
    setQuickBooksTokensOnResponse(response, tokens)
    response.cookies.delete("quickbooks_oauth_state")
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[QuickBooks callback] token exchange failed:", msg)
    const url = new URL("/dashboard/mint", appUrl)
    url.searchParams.set("error", "quickbooks_auth_failed")
    url.searchParams.set("detail", msg.slice(0, 200))
    return NextResponse.redirect(url)
  }
}

