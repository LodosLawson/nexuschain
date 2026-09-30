/**
 * Nexus Layer-1 Blockchain Shared Constants
 * Safe to import in both client (browser) and server (node) environments.
 */

export const TOTAL_SUPPLY = 1_000_000_000; // 1 Billion Fixed Total Supply
export const AIRDROP_REWARD = 1;            // Exactly 1 COIN per newly created wallet
export const MAX_AIRDROPS = 1_000_000_000;  // Up to 1 Billion wallets can receive 1 coin
export const TREASURY_ADDRESS = '0x000000000000000000000000000000000000GENESIS';
export const DEFAULT_DIFFICULTY = 2;        // Fast & responsive PoW (hash starts with "00")
export const TRANSACTION_FEE_RATE = 0.001;  // 0.10% (%0.10) returned directly back to Genesis Treasury
export const ALIAS_REGISTRATION_FEE = 0.005; // 0.005 COIN network fee for alias registration
export const ADD_CONTACT_FEE = 0.01;        // 0.01 COIN network fee for on-chain friend/contact addition

