/**
 * Nexus Layer-1 Blockchain Cryptographic Keystore Encryption
 * Implements bank-grade AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations).
 * Compatible with Web Crypto API across both Browser (Client) and Node.js (Server).
 */

export interface EncryptedKeystore {
  version: number;
  crypto: {
    cipher: 'aes-256-gcm';
    ciphertext: string; // Hex-encoded ciphertext + tag
    cipherparams: {
      iv: string; // Hex-encoded 12-byte IV
    };
    kdf: 'pbkdf2';
    kdfparams: {
      c: number; // Iteration count (100,000)
      dklen: number; // 32 bytes (256 bits)
      prf: 'sha-256';
      salt: string; // Hex-encoded salt (16 bytes)
    };
    mac: string; // SHA-256 MAC for tampering verification
  };
  address: string;
  publicKey: string;
  name?: string;
  hint?: string;
  createdAt: number;
}

// Helper: Convert ArrayBuffer to Hex String
function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert Hex String to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const cleanHex = hex.trim().replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Get crypto object (supports browser and Node.js)
function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) ortamda mevcut değil.');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    return window.crypto.getRandomValues(array as any) as any;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    return (globalThis.crypto.getRandomValues as any)(array);
  }
  throw new Error('Kriptografik güvenli rastgele sayı üreticisi (getRandomValues) bulunamadı.');
}

/**
 * Derives an AES-256 key from a user password and salt using PBKDF2 with SHA-256
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const passwordKey = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a private key into a standardized, password-protected Keystore file (AES-256-GCM)
 */
export async function encryptKeystore(params: {
  privateKey: string;
  password: string;
  address: string;
  publicKey: string;
  name?: string;
  hint?: string;
}): Promise<EncryptedKeystore> {
  const { privateKey, password, address, publicKey, name, hint } = params;

  if (!password || password.length < 6) {
    throw new Error('Cüzdan şifresi en az 6 karakter uzunluğunda olmalıdır.');
  }

  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();

  // Generate 16 bytes salt and 12 bytes IV
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  // Derive AES-256 Key
  const derivedKey = await deriveKeyFromPassword(password, salt, 100000);

  // Clean private key hex
  const cleanPrivateKey = privateKey.trim().replace(/^0x/, '');
  const dataToEncrypt = enc.encode(cleanPrivateKey);

  // Encrypt with AES-GCM (auto includes 128-bit authentication tag)
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    derivedKey,
    dataToEncrypt as any
  );

  // Compute MAC over ciphertext for extra tamper verification
  const macKey = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const macBuffer = await subtle.sign('HMAC', macKey, ciphertextBuffer);

  return {
    version: 3,
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: bufToHex(ciphertextBuffer),
      cipherparams: {
        iv: bufToHex(iv),
      },
      kdf: 'pbkdf2',
      kdfparams: {
        c: 100000,
        dklen: 32,
        prf: 'sha-256',
        salt: bufToHex(salt),
      },
      mac: bufToHex(macBuffer),
    },
    address,
    publicKey,
    name: name || 'Nexus Cüzdanı',
    hint: hint ? hint.trim() : undefined,
    createdAt: Date.now(),
  };
}

/**
 * Decrypts an encrypted Keystore using the user's password.
 * Throws if the password is wrong or ciphertext has been tampered with.
 */
export async function decryptKeystore(
  keystore: EncryptedKeystore,
  password: string
): Promise<string> {
  if (!password) {
    throw new Error('Cüzdan şifresi gereklidir.');
  }

  if (!keystore || !keystore.crypto) {
    throw new Error('Geçersiz şifrelenmiş anahtar deposu (Keystore) formatı.');
  }

  const subtle = getSubtleCrypto();
  const dec = new TextDecoder();
  const enc = new TextEncoder();

  const { cipher, ciphertext, cipherparams, kdfparams, mac } = keystore.crypto;

  if (cipher !== 'aes-256-gcm') {
    throw new Error(`Desteklenmeyen şifreleme algoritması: ${cipher}. Yalnızca AES-256-GCM desteklenir.`);
  }

  const salt = hexToBuf(kdfparams.salt);
  const iv = hexToBuf(cipherparams.iv);
  const ciphertextBytes = hexToBuf(ciphertext);

  // Optional: Verify MAC
  if (mac) {
    const macKey = await subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const macBytes = hexToBuf(mac);
    const isMacValid = await subtle.verify('HMAC', macKey, macBytes as any, ciphertextBytes as any);
    if (!isMacValid) {
      throw new Error('Yanlış şifre veya bozulmuş anahtar deposu! Şifre çözülemedi.');
    }
  }

  // Derive AES-256 Key
  const derivedKey = await deriveKeyFromPassword(password, salt, kdfparams.c || 100000);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
      },
      derivedKey,
      ciphertextBytes as any
    );

    const privateKey = dec.decode(decryptedBuffer);
    if (!/^[0-9a-fA-F]{64}$/.test(privateKey.trim())) {
      throw new Error('Çözülen veri geçerli bir özel anahtar formatına uymuyor.');
    }

    return privateKey.trim();
  } catch (err: any) {
    throw new Error('Şifre çözme başarısız: Yanlış parola veya bozulmuş veri.');
  }
}

/**
 * Validates a parsed JSON object as an EncryptedKeystore
 */
export function isValidKeystoreObject(obj: any): obj is EncryptedKeystore {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.crypto &&
    obj.crypto.cipher === 'aes-256-gcm' &&
    typeof obj.crypto.ciphertext === 'string' &&
    obj.crypto.cipherparams?.iv &&
    obj.crypto.kdfparams?.salt &&
    typeof obj.address === 'string'
  );
}
