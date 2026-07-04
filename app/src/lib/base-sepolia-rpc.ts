import { fallback, http } from "viem"

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

export function getBaseSepoliaRpcUrls(): string[] {
  return uniqueUrls([
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_1,
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_2,
    "https://sepolia.base.org",
    "https://base-sepolia.drpc.org",
    "https://84532.rpc.thirdweb.com/",
  ])
}

export function createBaseSepoliaTransport() {
  const urls = getBaseSepoliaRpcUrls()
  return fallback(urls.map((url) => http(url)))
}
