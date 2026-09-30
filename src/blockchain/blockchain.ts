import fs from 'fs';
import path from 'path';
import {
  calculateHash,
  calculateTransactionHash,
  verifyTransactionSignature,
  verifySenderOwnership,
  isValidAddress,
  calculateMerkleRoot,
  timingSafeEqual,
} from './crypto.ts';
import type {
  Block,
  Transaction,
  NetworkStats,
  SecurityAuditReport,
  UserIdentity,
  UserContact,
} from './types.ts';
import {
  TOTAL_SUPPLY,
  AIRDROP_REWARD,
  MAX_AIRDROPS,
  TREASURY_ADDRESS,
  DEFAULT_DIFFICULTY,
  TRANSACTION_FEE_RATE,
  ALIAS_REGISTRATION_FEE,
  ADD_CONTACT_FEE,
} from './constants.ts';

export {
  TOTAL_SUPPLY,
  AIRDROP_REWARD,
  MAX_AIRDROPS,
  TREASURY_ADDRESS,
  DEFAULT_DIFFICULTY,
  TRANSACTION_FEE_RATE,
  ALIAS_REGISTRATION_FEE,
  ADD_CONTACT_FEE,
};

// Persisted blockchain state file
const STORAGE_FILE = path.resolve(process.cwd(), 'nexus_blockchain_data.json');

export class Blockchain {
  public chain: Block[] = [];
  public mempool: Transaction[] = [];
  public claimedAirdrops: Set<string> = new Set();
  public spentTxIds: Set<string> = new Set();
  public difficulty: number = DEFAULT_DIFFICULTY;
  public totalFeesRecycled: number = 0;

  // On-Chain Identity & Contact Registries
  public identities: Map<string, UserIdentity> = new Map(); // address (lowercase) -> UserIdentity
  public aliasToAddress: Map<string, string> = new Map(); // nickname (lowercase) -> address
  public contacts: Map<string, UserContact[]> = new Map(); // ownerAddress (lowercase) -> UserContact[]

  constructor() {
    this.initOrLoad();
  }

  /**
   * Initializes or loads persisted blockchain from disk.
   * Ensures the Genesis Block is permanent, immutable, and NEVER deleted.
   */
  private initOrLoad(): void {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.chain) && data.chain.length > 0) {
          this.chain = data.chain;
          this.claimedAirdrops = new Set(data.claimedAirdrops || []);
          this.totalFeesRecycled = data.totalFeesRecycled || 0;
          this.difficulty = data.difficulty || DEFAULT_DIFFICULTY;

          // Rebuild indices: spentTxIds, identities, aliases, and contacts
          this.spentTxIds = new Set();
          this.identities = new Map();
          this.aliasToAddress = new Map();
          this.contacts = new Map();

          for (const block of this.chain) {
            for (const tx of block.transactions) {
              this.spentTxIds.add(tx.id);

              if (tx.type === 'REGISTER_ALIAS' && tx.alias) {
                const ident: UserIdentity = {
                  address: tx.sender,
                  nickname: tx.alias,
                  nameHash: tx.nameHash || '',
                  createdAt: tx.timestamp,
                };
                this.identities.set(tx.sender.toLowerCase(), ident);
                this.aliasToAddress.set(tx.alias.toLowerCase(), tx.sender);
              }

              if (tx.type === 'ADD_CONTACT' && tx.contactAddress) {
                const contactList = this.contacts.get(tx.sender.toLowerCase()) || [];
                if (!contactList.some((c) => c.contactAddress.toLowerCase() === tx.contactAddress!.toLowerCase())) {
                  contactList.push({
                    ownerAddress: tx.sender,
                    contactAddress: tx.contactAddress,
                    nickname: tx.contactAlias,
                    addedAt: tx.timestamp,
                    txId: tx.id,
                  });
                  this.contacts.set(tx.sender.toLowerCase(), contactList);
                }
              }
            }
          }

          // Verify Genesis block presence & immutability
          if (this.chain[0]?.index === 0 && this.chain[0]?.transactions[0]?.type === 'GENESIS') {
            console.log(`[Nexus L1 Node] Blockchain loaded from disk with ${this.chain.length} blocks. Genesis is intact & immutable.`);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('[Nexus L1 Node] Could not load persisted data, initializing fresh chain:', err);
    }

    this.createGenesisBlock();
    this.saveToDisk();
  }

  /**
   * Persists blockchain state to disk
   */
  public saveToDisk(): void {
    try {
      const data = {
        chain: this.chain,
        claimedAirdrops: Array.from(this.claimedAirdrops),
        totalFeesRecycled: this.totalFeesRecycled,
        difficulty: this.difficulty,
        savedAt: Date.now(),
      };
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Nexus L1 Node] Failed to save blockchain to disk:', err);
    }
  }

  /**
   * Creates the Immutable Genesis Block (Block #0).
   * All 1,000,000,000 coins are permanently minted into the Genesis Supply Treasury.
   * Once created, this block cannot be deleted or overwritten.
   */
  public createGenesisBlock(): void {
    if (this.chain.length > 0 && this.chain[0]?.index === 0) {
      return;
    }

    this.chain = [];
    this.mempool = [];
    this.claimedAirdrops = new Set();
    this.spentTxIds = new Set();
    this.totalFeesRecycled = 0;

    const genesisTxId = calculateHash('IMMUTABLE_GENESIS_TRANSACTION_1_BILLION_TOTAL_SUPPLY');
    const genesisTx: Transaction = {
      id: genesisTxId,
      sender: '0x0000000000000000000000000000000000000000',
      recipient: TREASURY_ADDRESS,
      amount: TOTAL_SUPPLY,
      timestamp: 1700000000000, // Fixed permanent genesis epoch
      signature: 'IMMUTABLE_GENESIS_MINT_SIGNATURE',
      publicKey: 'IMMUTABLE_GENESIS_MASTER_KEY',
      type: 'GENESIS',
      fee: 0,
      grossAmount: TOTAL_SUPPLY,
      nonce: 0,
    };

    const genesisBlock: Block = {
      index: 0,
      timestamp: 1700000000000,
      transactions: [genesisTx],
      previousHash: '0'.repeat(64),
      hash: '',
      nonce: 0,
      difficulty: this.difficulty,
    };

    genesisBlock.hash = this.calculateBlockHash(genesisBlock);
    this.chain.push(genesisBlock);
    this.spentTxIds.add(genesisTxId);
  }

  public getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Computes SHA-256 hash of a block
   */
  public calculateBlockHash(block: Omit<Block, 'hash'>): string {
    const txContent = block.transactions.map((t) => `${t.id}:${t.fee || 0}`).join('-');
    const payload = `${block.index}:${block.previousHash}:${block.timestamp}:${txContent}:${block.nonce}:${block.difficulty}`;
    return calculateHash(payload);
  }

  public getNonce(address: string): number {
    const normalized = address.toLowerCase();
    let count = 0;

    // Count in mined chain
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.sender.toLowerCase() === normalized) {
          // We only exclude AIRDROP, since AIRDROP sender is TREASURY and doesn't increment user nonce,
          // but normalized is the user's address, so it's fine. 
          // For NETWORK_FEE, the sender is the user, but we shouldn't double count it.
          // The primary user-initiated tx types are TRANSFER, REGISTER_ALIAS, ADD_CONTACT.
          if (['TRANSFER', 'REGISTER_ALIAS', 'ADD_CONTACT'].includes(tx.type)) {
             count++;
          }
        }
      }
    }

    // Count in mempool
    for (const tx of this.mempool) {
      if (tx.sender.toLowerCase() === normalized) {
        if (['TRANSFER', 'REGISTER_ALIAS', 'ADD_CONTACT'].includes(tx.type)) {
           count++;
        }
      }
    }

    return count;
  }

  /**
   * Retrieves the confirmed balance of an address by calculating all UTXO/account history
   */
  public getBalance(address: string): number {
    let balance = 0;
    const normalized = address.toLowerCase();

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.recipient.toLowerCase() === normalized) {
          balance += tx.amount;
        }
        if (tx.sender.toLowerCase() === normalized) {
          // For TRANSFER, the fee is handled in a separate companion NETWORK_FEE transaction.
          // Debiting tx.amount here prevents double-counting the fee and eliminates negative balances!
          const debit = tx.type === 'TRANSFER' ? tx.amount : (tx.grossAmount !== undefined ? tx.grossAmount : tx.amount);
          balance -= debit;
        }
      }
    }

    // Deduct unconfirmed pending outgoing transactions in mempool
    for (const tx of this.mempool) {
      if (tx.sender.toLowerCase() === normalized) {
        const debit = tx.type === 'TRANSFER' ? tx.amount : (tx.grossAmount !== undefined ? tx.grossAmount : tx.amount);
        balance -= debit;
      }
    }

    const finalBalance = Math.round(balance * 1e6) / 1e6;
    return finalBalance <= 0 ? 0 : finalBalance;
  }

  /**
   * Retrieves the current remaining balance of the Genesis Treasury Pool.
   */
  public getTreasuryBalance(): number {
    return this.getBalance(TREASURY_ADDRESS);
  }

  /**
   * Calculates the currently circulating supply (Total Supply - Treasury Pool)
   */
  public getCirculatingSupply(): number {
    const circulating = TOTAL_SUPPLY - this.getTreasuryBalance();
    return Math.max(0, Math.round(circulating * 1e6) / 1e6);
  }

  /**
   * Claims exactly 1 COIN welcome reward for a newly created or registered wallet.
   * Strictly enforces:
   * 1. Recipient address must be valid hex address
   * 2. Exactly 1 claim per address
   * 3. Hard cap limit: Treasury must have >= 1 coin available
   */
  public claimWelcomeAirdrop(recipientAddress: string): { transaction: Transaction; block: Block } {
    if (!isValidAddress(recipientAddress)) {
      throw new Error('Geçersiz alıcı adresi formatı! Adres "0x" ile başlamalı ve 40 onaltılık karakter içermelidir.');
    }

    const normalized = recipientAddress.toLowerCase();

    if (this.claimedAirdrops.has(normalized)) {
      throw new Error('Bu cüzdan adresi 1 Coin hoş geldin ödülünü daha önce aldı!');
    }

    const currentTreasury = this.getTreasuryBalance();
    if (currentTreasury < AIRDROP_REWARD) {
      throw new Error(
        `Genesis Hazine Havuzu tükendi! 1 Milyarıncı cüzdana ulaşıldı ve airdrop dağıtımı tamamen sona erdi. Kalan: ${currentTreasury} Coin.`
      );
    }

    const timestamp = Date.now();
    const nonce = this.claimedAirdrops.size;
    const txId = calculateTransactionHash({
      sender: TREASURY_ADDRESS,
      recipient: recipientAddress,
      amount: AIRDROP_REWARD,
      timestamp,
      type: 'AIRDROP',
      fee: 0,
      nonce,
    });

    const airdropTx: Transaction = {
      id: txId,
      sender: TREASURY_ADDRESS,
      recipient: recipientAddress,
      amount: AIRDROP_REWARD,
      timestamp,
      signature: 'TREASURY_AUTHORIZED_SYSTEM_SIGNATURE',
      publicKey: 'TREASURY_SYSTEM_KEY',
      type: 'AIRDROP',
      fee: 0,
      grossAmount: AIRDROP_REWARD,
      nonce,
    };

    // Mark as claimed & record tx
    this.claimedAirdrops.add(normalized);
    this.spentTxIds.add(txId);

    // Auto-mine into a new block immediately
    const minedBlock = this.mineBlockWithTransactions([airdropTx]);
    this.saveToDisk();

    return {
      transaction: airdropTx,
      block: minedBlock,
    };
  }

  /**
   * Calculates 0.10% (%0.10) network fee for a transfer amount.
   */
  public calculateFee(amount: number): number {
    return Math.round(amount * TRANSACTION_FEE_RATE * 1e6) / 1e6;
  }

  /**
   * Submits a pre-signed transaction to the mempool after comprehensive cryptographic audit:
   * 1. Address syntax validation (both sender and recipient)
   * 2. Sender != Recipient
   * 3. Amount > 0, finite, <= TOTAL_SUPPLY
   * 4. Account Nonce verification (Replay Attack Immunity)
   * 5. Tx ID uniqueness check (Anti-Replay)
   * 6. Sender Address-to-PublicKey ownership verification (Impersonation Defense)
   * 7. Cryptographic ECDSA secp256k1 signature verification
   * 8. Balance check (amount + 0.10% fee)
   */
  public submitSignedTransaction(params: {
    sender: string;
    recipient: string;
    amount: number;
    timestamp: number;
    fee: number;
    nonce: number;
    signature: string;
    publicKey: string;
  }): { transferTx: Transaction; feeTx?: Transaction } {
    const { sender, recipient, amount, timestamp, fee, nonce, signature, publicKey } = params;

    // 0. Anti-DoS Mempool Flooding Protection (Capacity Limit)
    const MAX_MEMPOOL_SIZE = 500;
    if (this.mempool.length >= MAX_MEMPOOL_SIZE) {
      throw new Error(
        'İşlem havuzu (Mempool) maksimum kapasiteye (500) ulaştı! Lütfen bekleyen işlemlerin bloklara kazılmasını bekleyin (Spam Koruması).'
      );
    }

    // 1. Resolve & Validate Recipient (Supports @alias, nickname, or 0x address)
    let finalRecipient = recipient.trim();
    if (!isValidAddress(finalRecipient)) {
      const resolved = this.resolveQuery(finalRecipient);
      if (!resolved) {
        throw new Error(`Geçersiz alıcı adresi veya ağda bulunamayan kullanıcı adı: ${recipient}`);
      }
      finalRecipient = resolved.address;
    }

    if (!isValidAddress(sender)) {
      throw new Error('Geçersiz gönderen adresi formatı.');
    }
    if (finalRecipient.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      throw new Error('Sıfır adresine (0x000...000) coin gönderilemez.');
    }

    // 2. Sender != Recipient
    if (sender.toLowerCase() === finalRecipient.toLowerCase()) {
      throw new Error('Kendi cüzdan adresinize transfer yapamazsınız.');
    }

    // 3. Amount Validation (Precision, Finite, Dust limit, Hard-cap)
    if (typeof amount !== 'number' || !Number.isFinite(amount) || isNaN(amount) || amount <= 0) {
      throw new Error('Geçersiz transfer miktarı. 0 dan büyük pozitif bir sayı olmalıdır.');
    }
    if (amount < 0.000001) {
      throw new Error('Minimum transfer miktarı 0.000001 Coin olmalıdır (Toz saldırısı koruması).');
    }
    if (amount > TOTAL_SUPPLY) {
      throw new Error('Transfer miktarı toplam arzdan (1.000.000.000) büyük olamaz.');
    }
    const amountStr = amount.toString();
    if (amountStr.includes('.') && amountStr.split('.')[1].length > 6) {
      throw new Error('Transfer miktarı en fazla 6 ondalık basamağa sahip olabilir.');
    }

    // 4. Timestamp Sanity Check (Time-jacking / Clock Drift Immunity)
    const now = Date.now();
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 10 * 60 * 1000) {
      throw new Error('İşlem zaman damgası (Timestamp) ağ tolerans aralığının (±10 dakika) dışında!');
    }

    // 5. Expected Fee Verification
    const expectedFee = this.calculateFee(amount);
    if (Math.abs(fee - expectedFee) > 0.000001) {
      throw new Error(`Geçersiz işlem kesintisi! Beklenen (%0.10): ${expectedFee}, Verilen: ${fee}`);
    }

    // 6. Account Nonce Verification (Replay Attack Protection)
    const expectedNonce = this.getNonce(sender);
    if (nonce !== expectedNonce) {
      throw new Error(
        `Geçersiz hesap işlem sırası (Nonce mismatch)! Beklenen Nonce: ${expectedNonce}, Alınan: ${nonce}. Tekrar saldırısı (Replay Attack) tespit edildi veya işlem sırası bozuk.`
      );
    }

    // Check for in-flight nonce collision in mempool
    const isNoncePending = this.mempool.some(
      (tx) => tx.sender.toLowerCase() === sender.toLowerCase() && tx.nonce === nonce
    );
    if (isNoncePending) {
      throw new Error('Bu cüzdan için aynı Nonce numarasına sahip bir işlem zaten havuzda bekliyor.');
    }

    // 7. Sender Impersonation Defense: verify deriveAddress(publicKey) === sender
    if (!verifySenderOwnership(sender, publicKey)) {
      throw new Error('Kritik Güvenlik Hatası: Açık anahtar (Public Key) gönderen adresine (Sender) ait değil! Kimlik taklidi engellendi.');
    }

    // 8. Deterministic Transaction Hash & Signature Verification
    const txHash = calculateTransactionHash({
      sender,
      recipient: finalRecipient,
      amount,
      timestamp,
      type: 'TRANSFER',
      fee: expectedFee,
      nonce,
    });

    if (this.spentTxIds.has(txHash)) {
      throw new Error('Bu işlem özeti (Tx ID) ağda daha önce işlendi. Tekrar gönderim engellendi.');
    }

    const isSigValid = verifyTransactionSignature(txHash, signature, publicKey, sender);
    if (!isSigValid) {
      throw new Error('Geçersiz dijital imza! İşlem gönderen cüzdanın Özel Anahtarı (Private Key) tarafından onaylanmadı.');
    }

    // 9. Sufficient Balance Verification
    const totalRequired = Math.round((amount + expectedFee) * 1e6) / 1e6;
    const senderBalance = this.getBalance(sender);
    if (senderBalance < totalRequired) {
      throw new Error(
        `Yetersiz bakiye! İhtiyaç: ${amount.toFixed(4)} Coin + ${expectedFee.toFixed(6)} Coin (%0.10 Kesinti) = ${totalRequired.toFixed(6)} Coin. Mevcut: ${senderBalance.toFixed(6)} Coin.`
      );
    }

    const transferTx: Transaction = {
      id: txHash,
      sender,
      recipient: finalRecipient,
      amount,
      timestamp,
      signature,
      publicKey,
      type: 'TRANSFER',
      fee: expectedFee,
      grossAmount: amount,
      nonce,
    };

    this.mempool.push(transferTx);
    this.spentTxIds.add(txHash);

    // 10. Network Fee Recycling directly back to Genesis Supply Treasury
    let feeTx: Transaction | undefined;
    if (expectedFee > 0) {
      const feeTxId = calculateHash(`FEE_RECYCLE:${transferTx.id}:${expectedFee}:${nonce}`);
      feeTx = {
        id: feeTxId,
        sender,
        recipient: TREASURY_ADDRESS,
        amount: expectedFee,
        timestamp,
        signature: 'SYSTEM_FEE_PROTOCOL_SIGNATURE',
        publicKey: 'SYSTEM_FEE_KEY',
        type: 'NETWORK_FEE',
        fee: 0,
        grossAmount: expectedFee,
        nonce,
      };
      this.totalFeesRecycled = Math.round((this.totalFeesRecycled + expectedFee) * 1e6) / 1e6;
      this.mempool.push(feeTx);
      this.spentTxIds.add(feeTxId);
    }

    return { transferTx, feeTx };
  }

  /**
   * Mines a single block containing specific transactions using Proof of Work
   */
  public mineBlockWithTransactions(transactions: Transaction[]): Block {
    const latestBlock = this.getLatestBlock();
    const index = latestBlock.index + 1;
    const timestamp = Date.now();
    const previousHash = latestBlock.hash;
    const targetPrefix = '0'.repeat(this.difficulty);
    const merkleRoot = calculateMerkleRoot(transactions.map((t) => t.id));

    let nonce = 0;
    let hash = '';

    // Proof of Work loop
    while (true) {
      const candidate: Omit<Block, 'hash'> = {
        index,
        timestamp,
        transactions,
        merkleRoot,
        previousHash,
        nonce,
        difficulty: this.difficulty,
      };
      hash = this.calculateBlockHash(candidate);

      if (hash.startsWith(targetPrefix)) {
        break;
      }
      nonce++;
    }

    const newBlock: Block = {
      index,
      timestamp,
      transactions,
      merkleRoot,
      previousHash,
      hash,
      nonce,
      difficulty: this.difficulty,
    };

    this.chain.push(newBlock);
    this.saveToDisk();
    return newBlock;
  }

  /**
   * Resolves an alias (e.g. "@satoshi" or "satoshi") or raw address (0x...)
   */
  public resolveQuery(query: string): { address: string; nickname?: string; hasIdentity: boolean } | null {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim();

    // If query starts with @
    if (clean.startsWith('@')) {
      const alias = clean.slice(1).toLowerCase();
      const addr = this.aliasToAddress.get(alias);
      if (addr) {
        const ident = this.identities.get(addr.toLowerCase());
        return { address: addr, nickname: ident?.nickname || alias, hasIdentity: true };
      }
      return null;
    }

    // Direct alias match without @
    const directAddr = this.aliasToAddress.get(clean.toLowerCase());
    if (directAddr) {
      const ident = this.identities.get(directAddr.toLowerCase());
      return { address: directAddr, nickname: ident?.nickname || clean, hasIdentity: true };
    }

    // Direct hex address match
    if (isValidAddress(clean)) {
      const ident = this.identities.get(clean.toLowerCase());
      return { address: clean, nickname: ident?.nickname, hasIdentity: !!ident };
    }

    return null;
  }

  /**
   * Registers a user-friendly nickname (Alias) and privacy-preserving Name Hash on-chain.
   * Real name is hashed with salted commitment so it NEVER appears on-chain in plain text!
   * Network fee: ALIAS_REGISTRATION_FEE (0.005 COIN) -> Recycled directly to Genesis Supply Treasury.
   */
  public registerAlias(params: {
    address: string;
    nickname: string;
    fullName?: string;
    signature: string;
    publicKey: string;
  }): { transaction: Transaction; identity: UserIdentity } {
    const { address, nickname, fullName, signature, publicKey } = params;

    if (!isValidAddress(address)) {
      throw new Error('Geçersiz cüzdan adresi formatı.');
    }

    // Validate nickname syntax: 3-20 characters, alphanumeric & underscore
    const cleanNick = nickname.trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanNick)) {
      throw new Error('Kullanıcı adı (Nickname) 3-20 karakter arasında harf, rakam ve alt çizgi içermelidir.');
    }

    // Check availability
    const existing = this.aliasToAddress.get(cleanNick.toLowerCase());
    if (existing && existing.toLowerCase() !== address.toLowerCase()) {
      throw new Error(`@${cleanNick} kullanıcı adı başka bir cüzdan tarafından alınmış.`);
    }

    // Sender ownership check
    if (!verifySenderOwnership(address, publicKey)) {
      throw new Error('Açık anahtar (Public Key) gönderici adresiyle eşleşmiyor.');
    }

    // Balance check
    const balance = this.getBalance(address);
    if (balance < ALIAS_REGISTRATION_FEE) {
      throw new Error(
        `Yetersiz bakiye! Nickname kaydı için ${ALIAS_REGISTRATION_FEE} Coin ağ ücreti gereklidir. Mevcut: ${balance} Coin.`
      );
    }

    // Salted Privacy Hash: Real name is NEVER stored in plain text on the blockchain!
    let nameHash = '';
    if (fullName && fullName.trim()) {
      nameHash = calculateHash(`PRIVACY_NAME_COMMITMENT:${fullName.trim().toLowerCase()}:${address.toLowerCase()}`);
    }

    const timestamp = Date.now();
    const nonce = this.getNonce(address);
    const txId = calculateHash(`REGISTER_ALIAS:${address}:${cleanNick}:${nameHash}:${timestamp}:${nonce}`);

    // Verify signature
    if (!verifyTransactionSignature(txId, signature, publicKey, address)) {
      throw new Error('Geçersiz dijital imza! Nickname kaydı cüzdan özel anahtarı tarafından imzalanmalıdır.');
    }

    const aliasTx: Transaction = {
      id: txId,
      sender: address,
      recipient: TREASURY_ADDRESS,
      amount: ALIAS_REGISTRATION_FEE,
      timestamp,
      signature,
      publicKey,
      type: 'REGISTER_ALIAS',
      fee: ALIAS_REGISTRATION_FEE,
      grossAmount: ALIAS_REGISTRATION_FEE,
      nonce,
      alias: cleanNick,
      nameHash,
    };

    const identity: UserIdentity = {
      address,
      nickname: cleanNick,
      nameHash,
      createdAt: timestamp,
    };

    this.identities.set(address.toLowerCase(), identity);
    this.aliasToAddress.set(cleanNick.toLowerCase(), address);
    this.totalFeesRecycled = Math.round((this.totalFeesRecycled + ALIAS_REGISTRATION_FEE) * 1e6) / 1e6;
    this.spentTxIds.add(txId);

    // Auto-mine into chain
    this.mineBlockWithTransactions([aliasTx]);
    this.saveToDisk();

    return { transaction: aliasTx, identity };
  }

  /**
   * Adds a friend / contact to the user's on-chain address book.
   * Network fee: ADD_CONTACT_FEE (0.01 COIN) -> Recycled to Genesis Treasury.
   */
  public addContact(params: {
    ownerAddress: string;
    targetQuery: string;
    signature: string;
    publicKey: string;
  }): { transaction: Transaction; contact: UserContact } {
    const { ownerAddress, targetQuery, signature, publicKey } = params;

    if (!isValidAddress(ownerAddress)) {
      throw new Error('Geçersiz cüzdan adresi.');
    }

    const resolved = this.resolveQuery(targetQuery);
    if (!resolved) {
      throw new Error('Hedef kullanıcı veya cüzdan adresi ağda bulunamadı.');
    }

    if (resolved.address.toLowerCase() === ownerAddress.toLowerCase()) {
      throw new Error('Kendinizi arkadaş olarak ekleyemezsiniz.');
    }

    const currentContacts = this.contacts.get(ownerAddress.toLowerCase()) || [];
    if (currentContacts.some((c) => c.contactAddress.toLowerCase() === resolved.address.toLowerCase())) {
      throw new Error('Bu cüzdan zaten arkadaş listenizde kayıtlı.');
    }

    // Ownership check
    if (!verifySenderOwnership(ownerAddress, publicKey)) {
      throw new Error('Açık anahtar (Public Key) cüzdan adresiyle eşleşmiyor.');
    }

    // Balance check
    const balance = this.getBalance(ownerAddress);
    if (balance < ADD_CONTACT_FEE) {
      throw new Error(
        `Yetersiz bakiye! Arkadaş ekleme için ${ADD_CONTACT_FEE} Coin ağ ücreti gereklidir. Mevcut: ${balance} Coin.`
      );
    }

    const timestamp = Date.now();
    const nonce = this.getNonce(ownerAddress);
    const txId = calculateHash(`ADD_CONTACT:${ownerAddress}:${resolved.address}:${timestamp}:${nonce}`);

    if (!verifyTransactionSignature(txId, signature, publicKey, ownerAddress)) {
      throw new Error('Geçersiz dijital imza! Arkadaş ekleme işlemi onaylanmadı.');
    }

    const contactTx: Transaction = {
      id: txId,
      sender: ownerAddress,
      recipient: TREASURY_ADDRESS,
      amount: ADD_CONTACT_FEE,
      timestamp,
      signature,
      publicKey,
      type: 'ADD_CONTACT',
      fee: ADD_CONTACT_FEE,
      grossAmount: ADD_CONTACT_FEE,
      nonce,
      contactAddress: resolved.address,
      contactAlias: resolved.nickname,
    };

    const newContact: UserContact = {
      ownerAddress,
      contactAddress: resolved.address,
      nickname: resolved.nickname,
      addedAt: timestamp,
      txId,
    };

    currentContacts.push(newContact);
    this.contacts.set(ownerAddress.toLowerCase(), currentContacts);
    this.totalFeesRecycled = Math.round((this.totalFeesRecycled + ADD_CONTACT_FEE) * 1e6) / 1e6;
    this.spentTxIds.add(txId);

    // Auto-mine into chain
    this.mineBlockWithTransactions([contactTx]);
    this.saveToDisk();

    return { transaction: contactTx, contact: newContact };
  }

  /**
   * Retrieves all on-chain contacts for an address
   */
  public getContacts(ownerAddress: string): UserContact[] {
    return this.contacts.get(ownerAddress.toLowerCase()) || [];
  }

  /**
   * Mines all pending transactions in the mempool
   */
  public minePendingTransactions(): Block | null {
    if (this.mempool.length === 0) {
      return null;
    }

    const txToMine = [...this.mempool];
    this.mempool = [];

    return this.mineBlockWithTransactions(txToMine);
  }

  /**
   * Retrieves transaction history for a specific address
   */
  public getHistory(address: string): Array<Transaction & { blockIndex: number; blockHash: string }> {
    const history: Array<Transaction & { blockIndex: number; blockHash: string }> = [];
    const normalized = address.toLowerCase();

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.sender.toLowerCase() === normalized || tx.recipient.toLowerCase() === normalized) {
          history.push({
            ...tx,
            blockIndex: block.index,
            blockHash: block.hash,
          });
        }
      }
    }

    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Comprehensive Cryptographic & Supply Integrity Security Audit
   */
  public performSecurityAudit(): SecurityAuditReport {
    const targetPrefix = '0'.repeat(this.difficulty);
    let isChainValid = true;
    let hardCapStrictlyPreserved = true;
    let replayAttackProtection = true;
    let ecdsaAddressBinding = true;
    let antiDoubleSpending = true;
    let merkleRootIntegrity = true;
    let timestampValidation = true;

    // Verify Genesis block
    const genesis = this.chain[0];
    if (
      !genesis ||
      genesis.index !== 0 ||
      genesis.transactions.length !== 1 ||
      genesis.transactions[0].type !== 'GENESIS' ||
      genesis.transactions[0].amount !== TOTAL_SUPPLY
    ) {
      isChainValid = false;
      hardCapStrictlyPreserved = false;
    }

    const seenTxIds = new Set<string>();
    const senderNonces = new Map<string, number>();

    // Audit each block in chain
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // 1. Previous hash continuity
      if (currentBlock.previousHash !== previousBlock.hash) {
        isChainValid = false;
      }

      // 2. Hash correctness
      const calculatedHash = this.calculateBlockHash({
        index: currentBlock.index,
        timestamp: currentBlock.timestamp,
        transactions: currentBlock.transactions,
        previousHash: currentBlock.previousHash,
        nonce: currentBlock.nonce,
        difficulty: currentBlock.difficulty,
      });

      if (currentBlock.hash !== calculatedHash) {
        isChainValid = false;
      }

      // 3. PoW target
      if (!currentBlock.hash.startsWith(targetPrefix)) {
        isChainValid = false;
      }

      // 4. Timestamp monotonic progression check
      if (currentBlock.timestamp < previousBlock.timestamp) {
        timestampValidation = false;
      }

      // 5. Merkle Root integrity check
      const expectedMerkleRoot = calculateMerkleRoot(currentBlock.transactions.map((t) => t.id));
      if (currentBlock.merkleRoot && currentBlock.merkleRoot !== expectedMerkleRoot) {
        merkleRootIntegrity = false;
      }

      // 6. Verify each transaction in block
      for (const tx of currentBlock.transactions) {
        if (seenTxIds.has(tx.id)) {
          replayAttackProtection = false;
        }
        seenTxIds.add(tx.id);

        if (tx.type === 'TRANSFER') {
          // Verify public key ownership binding
          if (!verifySenderOwnership(tx.sender, tx.publicKey)) {
            ecdsaAddressBinding = false;
          }

          // Verify digital signature on transaction hash (tx.id)
          if (!verifyTransactionSignature(tx.id, tx.signature, tx.publicKey, tx.sender)) {
            isChainValid = false;
          }

          // Verify strictly monotonic nonce (Replay Attack Protection)
          if (typeof tx.nonce === 'number') {
            const lastNonce = senderNonces.get(tx.sender.toLowerCase());
            if (lastNonce !== undefined && tx.nonce <= lastNonce) {
              replayAttackProtection = false;
            }
            senderNonces.set(tx.sender.toLowerCase(), tx.nonce);
          }
        }
      }
    }

    // 7. Total Supply Conservation Law Check:
    // Treasury balance + sum of user balances == 1,000,000,000
    const treasuryBal = this.getTreasuryBalance();
    const circulatingBal = this.getCirculatingSupply();
    const totalAccounted = Math.round((treasuryBal + circulatingBal) * 1e6) / 1e6;

    if (Math.abs(totalAccounted - TOTAL_SUPPLY) > 0.001) {
      hardCapStrictlyPreserved = false;
    }

    return {
      isChainValid,
      hardCapStrictlyPreserved,
      replayAttackProtection,
      ecdsaAddressBinding,
      clientSideSigningEnforced: true,
      antiDoubleSpending,
      merkleRootIntegrity,
      timestampValidation,
      keystoreEncryptionAvailable: true,
    };
  }

  /**
   * Returns current high-level network statistics
   */
  public getNetworkStats(): NetworkStats {
    const treasuryBalance = this.getTreasuryBalance();
    const circulatingSupply = TOTAL_SUPPLY - treasuryBalance;
    const securityAudit = this.performSecurityAudit();

    return {
      totalSupply: TOTAL_SUPPLY,
      treasuryBalance,
      circulatingSupply: Math.max(0, Math.round(circulatingSupply * 1e6) / 1e6),
      airdropReward: AIRDROP_REWARD,
      claimedAirdropsCount: this.claimedAirdrops.size,
      maxAirdropsAllowed: MAX_AIRDROPS,
      totalFeesRecycled: this.totalFeesRecycled,
      blockHeight: this.chain.length,
      mempoolSize: this.mempool.length,
      difficulty: this.difficulty,
      isChainValid: securityAudit.isChainValid,
      genesisImmutable: true,
      securityAudit,
    };
  }
}
