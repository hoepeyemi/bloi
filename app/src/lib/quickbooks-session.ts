import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import type { QuickBooksTokens } from "./quickbooks"

const COOKIE_NAME = "qb_tokens"
const MAX_AGE = 60 * 60 * 24 * 100 // 100 days (QB refresh token validity)

function encode(tokens: QuickBooksTokens): string {
  return Buffer.from(JSON.stringify(tokens)).toString("base64")
}

function decode(value: string): QuickBooksTokens | null {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf-8")) as QuickBooksTokens
  } catch {
    return null
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
}

/**
 * Read tokens from the incoming request cookies.
 * Works in any Route Handler. Returns undefined if not connected.
 */
export async function getQuickBooksTokens(): Promise<QuickBooksTokens | undefined> {
  const store = await cookies()
  const value = store.get(COOKIE_NAME)?.value
  if (!value) return undefined
  return decode(value) ?? undefined
}

/**
 * Write tokens onto an outgoing response. Setting the cookie directly on the
 * returned response is required — cookies().set() does NOT attach to a
 * manually-created NextResponse (e.g. redirect), so the token would be lost
 * on Vercel where each serverless invocation is isolated.
 */
export function setQuickBooksTokensOnResponse(response: NextResponse, tokens: QuickBooksTokens) {
  response.cookies.set(COOKIE_NAME, encode(tokens), cookieOptions)
}

/** Clear the tokens cookie on an outgoing response. */
export function clearQuickBooksTokensOnResponse(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 })
}
