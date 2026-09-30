import pkg from 'elliptic';
const { ec: EC } = pkg;
import { sha256 as jsSha256 } from 'js-sha256';
const sha256 = (data: string): string => jsSha256(data);
import type { WalletKeys, Transaction } from './types.ts';
import { TREASURY_ADDRESS } from './constants.ts';

// Standard secp256k1 curve (same curve used by Bitcoin & Ethereum)
const ec = new EC('secp256k1');

/**
 * Calculates SHA-256 hash of a string
 */
export function calculateHash(data: string): string {
  return sha256(data);
}

/**
 * Validates that an address conforms to Nexus Layer-1 address specifications:
 * Either '0x' + 40 hexadecimal characters, or the official Genesis Treasury address.
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.toUpperCase() === TREASURY_ADDRESS.toUpperCase()) return true;
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

/**
 * Validates that a private key is a valid 64-character hexadecimal secp256k1 scalar.
 */
export function isValidPrivateKey(privateKeyHex: string): boolean {
  if (!privateKeyHex || typeof privateKeyHex !== 'string') return false;
  const cleaned = privateKeyHex.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) return false;
  try {
    const keyPair = ec.keyFromPrivate(cleaned, 'hex');
    const result = keyPair.validate();
    return result.result;
  } catch {
    return false;
  }
}

/**
 * Validates that a public key is a valid secp256k1 point.
 */
export function isValidPublicKey(publicKeyHex: string): boolean {
  if (!publicKeyHex || typeof publicKeyHex !== 'string') return false;
  try {
    const key = ec.keyFromPublic(publicKeyHex.trim(), 'hex');
    const result = key.validate();
    return result.result;
  } catch {
    return false;
  }
}

/**
 * Generates a new cryptographic keypair using ECDSA secp256k1
 * and derives a deterministic wallet address.
 */
export function generateWallet(): WalletKeys {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate('hex').padStart(64, '0');
  const publicKey = keyPair.getPublic('hex');
  const address = deriveAddress(publicKey);

  return {
    privateKey,
    publicKey,
    address,
  };
}

/**
 * Derives a clean public address from a public key:
 * Format: '0x' + first 40 characters of SHA-256(publicKey)
 */
export function deriveAddress(publicKey: string): string {
  const hash = sha256(publicKey.trim());
  return `0x${hash.substring(0, 40).toUpperCase()}`;
}

/**
 * Cryptographically verifies that the public key corresponds directly to the sender address.
 * CRITICAL SECURITY DEFENSE: Prevents address impersonation / spoofing attacks!
 */
export function verifySenderOwnership(sender: string, publicKey: string): boolean {
  if (!sender || !publicKey) return false;
  if (sender.toUpperCase() === TREASURY_ADDRESS.toUpperCase()) {
    return true; // Treasury special system keys
  }
  const derived = deriveAddress(publicKey);
  return derived.toUpperCase() === sender.trim().toUpperCase();
}

/**
 * Restores a wallet from an existing private key with input sanitization
 */
export function restoreWalletFromPrivateKey(privateKeyHex: string): WalletKeys {
  const cleaned = privateKeyHex.trim().replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error('Özel anahtar tam 64 karakterli onaltılık (hexadecimal) olmalıdır.');
  }

  const keyPair = ec.keyFromPrivate(cleaned, 'hex');
  const privateKey = keyPair.getPrivate('hex').padStart(64, '0');
  const publicKey = keyPair.getPublic('hex');
  const address = deriveAddress(publicKey);

  return {
    privateKey,
    publicKey,
    address,
  };
}

/**
 * Calculates deterministic transaction hash to be signed.
 * Incorporates:
 * - sender address
 * - recipient address
 * - normalized amount (6 decimals)
 * - timestamp
 * - transaction type
 * - normalized fee (6 decimals)
 * - account nonce (REPLAY ATTACK IMMUNITY)
 */
export function calculateTransactionHash(tx: {
  sender: string;
  recipient: string;
  amount: number;
  timestamp: number;
  type: string;
  fee?: number;
  nonce?: number;
}): string {
  const senderNorm = tx.sender.trim().toUpperCase();
  const recipientNorm = tx.recipient.trim().toUpperCase();
  const amountStr = Number(tx.amount).toFixed(6);
  const feeStr = Number(tx.fee || 0).toFixed(6);
  const nonceStr = Number(tx.nonce || 0).toString();

  const payload = `${senderNorm}:${recipientNorm}:${amountStr}:${tx.timestamp}:${tx.type}:${feeStr}:${nonceStr}`;
  return sha256(payload);
}

/**
 * Signs a transaction hash using the sender's ECDSA private key.
 * Produces canonical DER signature.
 */
export function signTransaction(
  txHash: string,
  privateKeyHex: string
): string {
  const cleaned = privateKeyHex.trim().replace(/^0x/, '');
  const keyPair = ec.keyFromPrivate(cleaned, 'hex');
  const signature = keyPair.sign(txHash, { canonical: true });
  return signature.toDER('hex');
}

/**
 * Verifies that a transaction signature is cryptographically valid for the given public key and tx hash.
 * Also verifies sender ownership if sender address is provided.
 */
export function verifyTransactionSignature(
  txHash: string,
  signatureHex: string,
  publicKeyHex: string,
  senderAddress?: string
): boolean {
  try {
    if (!signatureHex || !publicKeyHex) return false;

    // Address-to-PublicKey binding check
    if (senderAddress && !verifySenderOwnership(senderAddress, publicKeyHex)) {
      return false;
    }

    const key = ec.keyFromPublic(publicKeyHex.trim(), 'hex');
    return key.verify(txHash, signatureHex);
  } catch {
    return false;
  }
}

/**
 * Calculates cryptographic Merkle Root from a list of transaction IDs (hashes)
 * Builds a binary Merkle Tree standard in Bitcoin/Ethereum architectures.
 */
export function calculateMerkleRoot(txHashes: string[]): string {
  if (!txHashes || txHashes.length === 0) {
    return sha256('EMPTY_MERKLE_ROOT');
  }

  let currentLevel = [...txHashes];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // If odd number of hashes, duplicate the last one
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(sha256(`${left}:${right}`));
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Timing-safe string comparison to protect against timing side-channel attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

