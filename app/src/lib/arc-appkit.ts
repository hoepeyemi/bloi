/**
 * Arc App Kit — vasmo integration
 *
 * Provides a singleton AppKit instance and Base Sepolia chain constants
 * for Send, Bridge, Swap, and Unified Balance operations.
 *
 * Docs:  https://docs.arc.io/app-kit
 * Chain: Base Sepolia (Arc chain identifier: "Base_Sepolia")
 *        Chain ID 84532 · USDC 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 */

import { AppKit } from '@circle-fin/app-kit';

// Singleton — one instance per app session
let _kit: AppKit | null = null;

export function getAppKit(): AppKit {
  if (!_kit) {
    _kit = new AppKit();
  }
  return _kit;
}

/**
 * Arc chain identifier for Base Sepolia.
 *
 * Follows Arc's underscore-separated convention (e.g. "Arc_Testnet").
 * See https://docs.arc.io/app-kit/references/supported-blockchains
 */
export const ARC_CHAIN_BASE_SEPOLIA = 'Base_Sepolia' as const;

/** USDC contract on Base Sepolia */
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

/** Default token for all App Kit operations */
export const DEFAULT_TOKEN = 'USDC' as const;
