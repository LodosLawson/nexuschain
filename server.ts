import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Blockchain } from './src/blockchain/blockchain.ts';
import {
  generateWallet,
  restoreWalletFromPrivateKey,
  calculateTransactionHash,
  signTransaction,
  isValidAddress,
} from './src/blockchain/crypto.ts';
import type { Transaction } from './src/blockchain/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '500kb' }));

// Trust the reverse proxy for accurate client IP (crucial for rate limiting behind Nginx/Cloudflare)
app.set('trust proxy', 1);

// Security Response Headers & CORS
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (_req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// In-memory Anti-DoS Rate Limiter (with memory leak protection)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Cleanup interval to prevent memory leaks from inactive IPs
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(ip);
    }
  }
}, 60000); // Clean up every minute

function rateLimiter(limit: number, windowMs: number = 60000) {
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(ip);

    if (!record || now > record.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= limit) {
      return res.status(429).json({
        success: false,
        error: 'Çok fazla istek yapıldı (Hız Sınırı Aşıldı). Lütfen bir dakika bekleyin (Anti-DoS / Spam Koruması).',
      });
    }

    record.count++;
    next();
  };
}

// Initialize Singleton Layer-1 Blockchain instance (Persisted & Immutable Genesis)
const nexusChain = new Blockchain();

// -------------------------------------------------------------
// REST API ENDPOINTS (HARDENED & SECURED)
// -------------------------------------------------------------

app.use('/api/', rateLimiter(120, 60000)); // 120 reqs/min per IP general rate limit

/**
 * GET /api/chain - Network statistics, security audit, and complete chain blocks
 */
app.get('/api/chain', (_req: Request, res: Response) => {
  try {
    const stats = nexusChain.getNetworkStats();
    res.json({
      success: true,
      stats,
      chain: nexusChain.chain,
      mempool: nexusChain.mempool,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/security/audit - Comprehensive Cryptographic & Economic Audit Report
 */
app.get('/api/security/audit', (_req: Request, res: Response) => {
  try {
    const audit = nexusChain.performSecurityAudit();
    const stats = nexusChain.getNetworkStats();
    res.json({
      success: true,
      audit,
      stats,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/nonce/:address - Current sequential account nonce for replay protection
 */
app.get('/api/nonce/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ success: false, error: 'Geçersiz cüzdan adresi.' });
    }
    const nonce = nexusChain.getNonce(address);
    res.json({ success: true, address, nonce });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/balance/:address - Balance, nonce & tx history for an address
 */
app.get('/api/balance/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ success: false, error: 'Geçerli bir cüzdan adresi gereklidir.' });
    }

    const balance = nexusChain.getBalance(address);
    const nonce = nexusChain.getNonce(address);
    const history = nexusChain.getHistory(address);
    const hasClaimedAirdrop = nexusChain.claimedAirdrops.has(address.toLowerCase());
    const identity = nexusChain.identities.get(address.toLowerCase()) || null;
    const contacts = nexusChain.getContacts(address);

    res.json({
      success: true,
      address,
      balance,
      nonce,
      hasClaimedAirdrop,
      identity,
      contacts,
      transactionCount: history.length,
      history,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/alias/resolve/:query - Resolve @alias or 0x address
 */
app.get('/api/alias/resolve/:query', (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const resolved = nexusChain.resolveQuery(query);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Kullanıcı adı veya adres bulunamadı.' });
    }
    res.json({ success: true, resolved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/alias/register - Register on-chain alias & privacy-salted name hash
 */
app.post('/api/alias/register', (req: Request, res: Response) => {
  try {
    const { address, nickname, fullName, signature, publicKey, privateKey } = req.body;

    if (privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Güvenlik Kuralı: Özel anahtar sunucuya gönderilemez! İşlem istemcide imzalanmalıdır.',
      });
    }

    if (!address || !nickname || !signature || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Eksik parametreler: address, nickname, signature ve publicKey zorunludur.',
      });
    }

    const result = nexusChain.registerAlias({
      address,
      nickname,
      fullName,
      signature,
      publicKey,
    });

    const newBalance = nexusChain.getBalance(address);
    res.json({
      success: true,
      message: `@${result.identity.nickname} kullanıcı adı başarıyla kaydedildi! 0.005 Coin havuza döndü.`,
      identity: result.identity,
      transaction: result.transaction,
      newBalance,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contacts/add - Add a friend on-chain (0.01 Coin fee)
 */
app.post('/api/contacts/add', (req: Request, res: Response) => {
  try {
    const { ownerAddress, targetQuery, signature, publicKey, privateKey } = req.body;

    if (privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Güvenlik Kuralı: Özel anahtar sunucuya gönderilemez! İşlem istemcide imzalanmalıdır.',
      });
    }

    if (!ownerAddress || !targetQuery || !signature || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Eksik parametreler: ownerAddress, targetQuery, signature ve publicKey zorunludur.',
      });
    }

    const result = nexusChain.addContact({
      ownerAddress,
      targetQuery,
      signature,
      publicKey,
    });

    const newBalance = nexusChain.getBalance(ownerAddress);
    res.json({
      success: true,
      message: 'Kullanıcı başarıyla arkadaşlarınıza eklendi! 0.01 Coin ağ kesintisi havuza döndü.',
      contact: result.contact,
      transaction: result.transaction,
      newBalance,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contacts/:address - Get on-chain contacts for an address
 */
app.get('/api/contacts/:address', (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!isValidAddress(address)) {
      return res.status(400).json({ success: false, error: 'Geçersiz adres formatı.' });
    }

    const contacts = nexusChain.getContacts(address);
    res.json({ success: true, contacts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/new - Create new cryptographic wallet and automatically claim 1 COIN airdrop
 */
app.post('/api/wallet/new', (_req: Request, res: Response) => {
  try {
    // 1. Generate ECDSA secp256k1 keypair & address
    const wallet = generateWallet();

    // 2. Automatically claim exactly 1 COIN welcome reward from Genesis Supply Treasury
    let airdropResult: { transaction: Transaction; block: any } | null = null;
    let airdropError: string | null = null;

    try {
      airdropResult = nexusChain.claimWelcomeAirdrop(wallet.address);
    } catch (err: any) {
      airdropError = err.message;
    }

    const currentBalance = nexusChain.getBalance(wallet.address);
    const stats = nexusChain.getNetworkStats();

    res.status(201).json({
      success: true,
      wallet,
      balance: currentBalance,
      airdropSuccess: Boolean(airdropResult),
      airdropError,
      airdropTransaction: airdropResult?.transaction,
      minedBlock: airdropResult?.block,
      networkStats: stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/claim-airdrop - Claim 1 coin airdrop for an existing address
 */
app.post('/api/wallet/claim-airdrop', (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address || !isValidAddress(address)) {
      return res.status(400).json({ success: false, error: 'Geçerli bir cüzdan adresi gereklidir.' });
    }

    const result = nexusChain.claimWelcomeAirdrop(address);
    const updatedBalance = nexusChain.getBalance(address);
    const stats = nexusChain.getNetworkStats();

    res.json({
      success: true,
      message: '1 Coin hoş geldin ödülü başarıyla cüzdanınıza aktarıldı ve yeni blok kazıldı!',
      address,
      newBalance: updatedBalance,
      transaction: result.transaction,
      block: result.block,
      networkStats: stats,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/wallet/restore - Restore/verify wallet from private key
 */
app.post('/api/wallet/restore', (req: Request, res: Response) => {
  try {
    const { privateKey } = req.body;
    if (!privateKey) {
      return res.status(400).json({ success: false, error: 'Özel anahtar (Private Key) gereklidir.' });
    }

    const wallet = restoreWalletFromPrivateKey(privateKey);
    const balance = nexusChain.getBalance(wallet.address);
    const nonce = nexusChain.getNonce(wallet.address);
    const hasClaimedAirdrop = nexusChain.claimedAirdrops.has(wallet.address.toLowerCase());

    res.json({
      success: true,
      wallet,
      balance,
      nonce,
      hasClaimedAirdrop,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: 'Geçersiz özel anahtar: ' + error.message });
  }
});

/**
 * POST /api/transaction/send - Send coins between addresses
 * Accepts client-side signed transactions (Zero-Knowledge Server model).
 * Strictly verifies ECDSA secp256k1 signature, Public Key ownership binding, and Account Nonce.
 */
app.post('/api/transaction/send', (req: Request, res: Response) => {
  try {
    const {
      sender,
      recipient,
      amount,
      privateKey,
      signature,
      publicKey,
      timestamp = Date.now(),
      fee,
      nonce,
      autoMine = true,
    } = req.body;

    if (!sender || !recipient || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz transfer parametreleri.' });
    }

    const expectedFee = nexusChain.calculateFee(amount);
    const expectedNonce = typeof nonce === 'number' ? nonce : nexusChain.getNonce(sender);
    const finalFee = typeof fee === 'number' ? fee : expectedFee;

    // CRITICAL SECURITY ENFORCEMENT: Reject any transmission of Private Keys over the wire
    if (privateKey) {
      return res.status(400).json({
        success: false,
        error:
          'Kritik Güvenlik İlkesi İhlali: Özel Anahtar (Private Key) asla sunucuya veya ağa gönderilemez! İşlemler istemci (tarayıcı) tarafında yerel olarak imzalanmalı ve yalnızca imza (Signature) sunucuya iletilmelidir.',
      });
    }

    if (!signature || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'İşlem dijital imzası (Signature) ve Açık Anahtar (Public Key) zorunludur.',
      });
    }

    const finalSignature = signature;
    const finalPublicKey = publicKey;

    // Process hardened transaction submission
    const { transferTx, feeTx } = nexusChain.submitSignedTransaction({
      sender,
      recipient,
      amount,
      timestamp,
      fee: finalFee,
      nonce: expectedNonce,
      signature: finalSignature,
      publicKey: finalPublicKey,
    });

    let minedBlock = null;
    if (autoMine) {
      minedBlock = nexusChain.minePendingTransactions();
    }

    const senderBalance = nexusChain.getBalance(sender);
    const recipientBalance = nexusChain.getBalance(recipient);
    const stats = nexusChain.getNetworkStats();

    res.json({
      success: true,
      message: `${amount.toFixed(4)} Coin aktarıldı. %0.10 sistem kesintisi (${finalFee.toFixed(6)} Coin) doğrudan Genesis Hazine Havuzuna geri döndürüldü${minedBlock ? ' ve blok #' + minedBlock.index + ' kazıldı!' : '!'}`,
      transaction: transferTx,
      feeTransaction: feeTx,
      fee: finalFee,
      nonce: expectedNonce,
      feeRate: '0.10%',
      minedBlock,
      senderBalance,
      recipientBalance,
      networkStats: stats,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mine - Manually trigger mining of mempool transactions
 */
app.post('/api/mine', (_req: Request, res: Response) => {
  try {
    const minedBlock = nexusChain.minePendingTransactions();
    if (!minedBlock) {
      return res.json({ success: true, message: 'İşlem havuzu (Mempool) boş, kazılacak işlem yok.', minedBlock: null });
    }

    res.json({
      success: true,
      message: `Yeni Blok #${minedBlock.index} başarıyla kazıldı! Nonce: ${minedBlock.nonce}`,
      minedBlock,
      networkStats: nexusChain.getNetworkStats(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/block/:hashOrIndex - Get block details by index or hash
 */
app.get('/api/block/:hashOrIndex', (req: Request, res: Response) => {
  const { hashOrIndex } = req.params;
  const isNumeric = /^\d+$/.test(hashOrIndex);

  const block = isNumeric
    ? nexusChain.chain.find((b) => b.index === parseInt(hashOrIndex, 10))
    : nexusChain.chain.find((b) => b.hash.toLowerCase() === hashOrIndex.toLowerCase());

  if (!block) {
    return res.status(404).json({ success: false, error: 'Blok bulunamadı.' });
  }

  res.json({ success: true, block });
});

/**
 * POST /api/reset - Re-asserts Genesis Block Immutability
 * By protocol design, Genesis cannot be deleted.
 */
app.post('/api/reset', (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: 'İşlem Reddedildi: Blokzinciri kuralı gereği Genesis Bloğu kalıcıdır ve asla silinemez (Immutable).',
    genesisImmutable: true,
  });
});

// -------------------------------------------------------------
// VITE INTEGRATION / STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nexus L1 Node] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[Nexus L1 Node] Security Hardened: ECDSA Ownership Binding, Replay Protection & Account Nonces active.`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
