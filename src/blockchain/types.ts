/**
 * Nexus Layer-1 Blockchain Core Data Types & Cryptographic Schemas
 */

export type TransactionType =
  | 'GENESIS'
  | 'AIRDROP'
  | 'TRANSFER'
  | 'NETWORK_FEE'
  | 'REGISTER_ALIAS'
  | 'ADD_CONTACT';

export interface Transaction {
  id: string;              // Deterministic SHA-256 hash of transaction content
  sender: string;          // Sender address or TREASURY_GENESIS
  recipient: string;       // Recipient address (0x...)
  amount: number;          // Net amount in coins received by recipient
  timestamp: number;       // Unix timestamp (ms)
  signature: string;       // ECDSA secp256k1 signature (hex DER)
  publicKey: string;       // Hex-encoded public key of sender (secp256k1)
  type: TransactionType;   // Category of transaction
  fee: number;             // Network fee (returned to Genesis Supply Treasury)
  grossAmount: number;     // Gross amount debited from sender
  nonce: number;           // Sequential account nonce (Replay Attack Prevention)
  alias?: string;          // Optional registered nickname/handle (@alias)
  nameHash?: string;       // Zero-Knowledge salted privacy hash of real name (Real name is NEVER stored in plain text!)
  contactAddress?: string; // Target contact address for ADD_CONTACT
  contactAlias?: string;   // Target contact nickname for ADD_CONTACT
}

export interface UserIdentity {
  address: string;
  nickname: string;        // Publicly searchable handle (e.g. "satoshi")
  nameHash: string;        // SHA-256(fullName + salt) for privacy-preserving verification
  createdAt: number;
}

export interface UserContact {
  ownerAddress: string;
  contactAddress: string;
  nickname?: string;
  addedAt: number;
  txId: string;
}

export interface Block {
  index: number;           // Block height (0 = Genesis)
  timestamp: number;       // Unix timestamp (ms)
  transactions: Transaction[]; // List of transactions in this block
  merkleRoot?: string;     // Cryptographic Merkle Root of all transactions
  previousHash: string;    // Hash of the previous block
  hash: string;            // Hash of current block (satisfying PoW difficulty)
  nonce: number;           // Proof of Work nonce
  difficulty: number;      // Difficulty level (number of leading zeros required)
}

export interface WalletKeys {
  privateKey: string;      // Private key in hex (64 hex characters)
  publicKey: string;       // Public key in hex (secp256k1)
  address: string;         // Derived public address (0x...)
}

export interface SecurityAuditReport {
  isChainValid: boolean;            // Continuous block hash linkage audit
  hardCapStrictlyPreserved: boolean;// Total coins across all balances + treasury == 1,000,000,000
  replayAttackProtection: boolean;  // Strict account nonces + spent tx IDs tracking
  ecdsaAddressBinding: boolean;     // deriveAddress(publicKey) === sender
  clientSideSigningEnforced: boolean; // Zero-knowledge server: private keys kept on client
  antiDoubleSpending: boolean;      // Immediate mempool debit tracking
  merkleRootIntegrity?: boolean;    // Cryptographic Merkle Tree verification
  timestampValidation?: boolean;    // Strict tolerance for network clock drift
  keystoreEncryptionAvailable?: boolean; // AES-256-GCM + PBKDF2 wallet encryption
}

export interface NetworkStats {
  totalSupply: number;          // Fixed at 1,000,000,000
  treasuryBalance: number;      // Remaining coins in Genesis Treasury
  circulatingSupply: number;    // Coins distributed in circulation
  airdropReward: number;        // Fixed at 1 COIN per new wallet
  claimedAirdropsCount: number; // Number of wallets that received the 1-coin airdrop
  maxAirdropsAllowed: number;   // 1,000,000,000 wallets limit
  totalFeesRecycled: number;    // Total fees returned back to Genesis Treasury (0.10%)
  blockHeight: number;          // Total blocks mined
  mempoolSize: number;          // Unconfirmed transactions
  difficulty: number;           // Current PoW difficulty
  isChainValid: boolean;        // Cryptographic integrity audit status
  genesisImmutable: boolean;    // Genesis block is strictly permanent & cannot be deleted
  securityAudit: SecurityAuditReport; // Comprehensive security audit stats
}
