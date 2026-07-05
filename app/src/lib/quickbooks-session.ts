import fs from "fs"
import path from "path"
import type { QuickBooksTokens } from "./quickbooks"

const DEFAULT_SESSION_KEY = "default"

// Persist to a file in .next/cache so tokens survive hot-reloads.
// The file is gitignored (lives under .next) and never sent to the client.
function getStorePath(): string {
  const dir = path.join(process.cwd(), ".next", "cache")
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // already exists
  }
  return path.join(dir, "quickbooks-tokens.json")
}

function readStore(): Record<string, QuickBooksTokens> {
  try {
    const raw = fs.readFileSync(getStorePath(), "utf-8")
    return JSON.parse(raw) as Record<string, QuickBooksTokens>
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, QuickBooksTokens>): void {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(store), "utf-8")
  } catch {
    // non-fatal — fall back to in-memory behaviour
  }
}

export function storeQuickBooksTokens(tokens: QuickBooksTokens, sessionKey = DEFAULT_SESSION_KEY) {
  const store = readStore()
  store[sessionKey] = tokens
  writeStore(store)
}

export function getQuickBooksTokens(sessionKey = DEFAULT_SESSION_KEY): QuickBooksTokens | undefined {
  return readStore()[sessionKey]
}

export function clearQuickBooksTokens(sessionKey = DEFAULT_SESSION_KEY) {
  const store = readStore()
  delete store[sessionKey]
  writeStore(store)
}
