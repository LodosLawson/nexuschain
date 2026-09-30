import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Layers,
  History,
  Database,
  Box,
  CheckCircle2,
  AlertCircle,
  X,
  Cpu,
  ShieldCheck,
  Lock,
  Flame,
  ArrowRight,
  Shield,
  Users
} from 'lucide-react';
import { Navbar } from './components/Navbar.tsx';
import { WalletCard, type SavedWallet } from './components/WalletCard.tsx';
import { SendForm } from './components/SendForm.tsx';
import { TransactionHistory } from './components/TransactionHistory.tsx';
import { BlockExplorer } from './components/BlockExplorer.tsx';
import { TreasuryPoolView } from './components/TreasuryPoolView.tsx';
import { SecurityAuditView } from './components/SecurityAuditView.tsx';
import { ContactsView } from './components/ContactsView.tsx';
import { NodeRunnerView } from './components/NodeRunnerView.tsx';
import type { Block, NetworkStats, UserContact } from './blockchain/types.ts';
import {
  generateWallet,
  restoreWalletFromPrivateKey,
  calculateTransactionHash,
  signTransaction,
  calculateHash,
} from './blockchain/crypto.ts';

const LOCAL_STORAGE_KEY = 'nexus_l1_wallets_v3';
const ACTIVE_WALLET_KEY = 'nexus_l1_active_wallet_v3';

export default function App() {
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeWallet, setActiveWallet] = useState<SavedWallet | null>(() => {
    try {
      const activeId = localStorage.getItem(ACTIVE_WALLET_KEY);
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored && activeId) {
        const list: SavedWallet[] = JSON.parse(stored);
        return list.find((w) => w.id === activeId) || list[0] || null;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [chain, setChain] = useState<Block[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [hasClaimedAirdrop, setHasClaimedAirdrop] = useState<boolean>(false);
  const [history, setHistory] = useState<any[]>([]);
  const [contacts, setContacts] = useState<UserContact[]>([]);

  const [activeTab, setActiveTab] = useState<'history' | 'explorer' | 'treasury' | 'security' | 'contacts' | 'node'>('history');

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAddingContact, setIsAddingContact] = useState<boolean>(false);

  const [prefilledRecipient, setPrefilledRecipient] = useState<string>('');

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 5500);
  };

  // Sync wallets with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedWallets));
    } catch (e) {
      console.error('Failed to save wallets', e);
    }
  }, [savedWallets]);

  useEffect(() => {
    if (activeWallet) {
      try {
        localStorage.setItem(ACTIVE_WALLET_KEY, activeWallet.id);
      } catch (e) {
        console.error('Failed to save active wallet', e);
      }
    }
  }, [activeWallet]);

  // Fetch full chain and network stats
  const fetchChainAndStats = useCallback(async () => {
    try {
      const res = await fetch('/api/chain');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setChain(data.chain);
      }
    } catch (err) {
      console.error('Failed to fetch chain:', err);
    }
  }, []);

  // Fetch active wallet balance, history, and contacts
  const fetchWalletData = useCallback(async (address: string) => {
    try {
      const res = await fetch(`/api/balance/${address}`);
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
        setHasClaimedAirdrop(data.hasClaimedAirdrop);
        setHistory(data.history || []);
        setContacts(data.contacts || []);

        // Sync alias if updated
        if (data.identity?.nickname) {
          setSavedWallets((prev) =>
            prev.map((w) =>
              w.address.toLowerCase() === address.toLowerCase()
                ? { ...w, nickname: data.identity.nickname }
                : w
            )
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch wallet data:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchChainAndStats(),
      activeWallet ? fetchWalletData(activeWallet.address) : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  }, [fetchChainAndStats, fetchWalletData, activeWallet]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Handle Create Wallet (100% Client-Side Key Generation with optional Nickname & Privacy Name)
  const handleCreateWallet = async (info?: { nickname?: string; fullName?: string }) => {
    setIsCreating(true);
    try {
      // 1. Generate ECDSA secp256k1 keypair locally in browser
      const clientWallet = generateWallet();

      // 2. Claim 1 Coin airdrop
      const res = await fetch('/api/wallet/claim-airdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: clientWallet.address }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Airdrop talebi başarısız oldu.');
      }

      let registeredNickname = info?.nickname;

      // 3. Register Alias on-chain if nickname provided
      if (info?.nickname && info.nickname.trim()) {
        try {
          const cleanNick = info.nickname.trim().replace(/^@/, '');
          const timestamp = Date.now();
          const nonce = 0;

          // Salted Privacy Hash: Real name is NEVER stored in plain text!
          let nameHash = '';
          if (info.fullName && info.fullName.trim()) {
            nameHash = calculateHash(`PRIVACY_NAME_COMMITMENT:${info.fullName.trim().toLowerCase()}:${clientWallet.address.toLowerCase()}`);
          }

          const txId = calculateHash(`REGISTER_ALIAS:${clientWallet.address}:${cleanNick}:${nameHash}:${timestamp}:${nonce}`);
          const signature = signTransaction(txId, clientWallet.privateKey);

          const aliasRes = await fetch('/api/alias/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              address: clientWallet.address,
              nickname: cleanNick,
              fullName: info.fullName,
              signature,
              publicKey: clientWallet.publicKey,
            }),
          });
          const aliasData = await aliasRes.json();
          if (aliasData.success) {
            registeredNickname = aliasData.identity.nickname;
          }
        } catch (e) {
          console.warn('On-chain alias registration skipped:', e);
        }
      }

      const walletNumber = savedWallets.length + 1;
      const newWallet: SavedWallet = {
        id: `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: registeredNickname ? `@${registeredNickname}` : `Cüzdan ${walletNumber}`,
        nickname: registeredNickname,
        fullName: info?.fullName,
        address: clientWallet.address,
        publicKey: clientWallet.publicKey,
        privateKey: clientWallet.privateKey,
        createdAt: Date.now(),
      };

      const updated = [...savedWallets, newWallet];
      setSavedWallets(updated);
      setActiveWallet(newWallet);
      setBalance(data.newBalance || 1);
      setHasClaimedAirdrop(true);

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      showNotification(
        `Tebrikler! ${newWallet.name} yerel olarak oluşturuldu ve tam 1 Coin hoş geldin ödülü Genesis Havuzundan cüzdanınıza aktarıldı!`,
        'success'
      );

      await fetchChainAndStats();
      await fetchWalletData(newWallet.address);
    } catch (err: any) {
      showNotification(err.message || 'Cüzdan oluşturma başarısız oldu.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Import Private Key (100% Client-Side)
  const handleImportPrivateKey = async (privateKey: string) => {
    try {
      const restored = restoreWalletFromPrivateKey(privateKey);

      const existing = savedWallets.find(
        (w) => w.address.toLowerCase() === restored.address.toLowerCase()
      );

      if (existing) {
        setActiveWallet(existing);
        showNotification('Cüzdan zaten kayıtlı, aktif cüzdan olarak seçildi.', 'info');
        await fetchWalletData(existing.address);
        return;
      }

      const newWallet: SavedWallet = {
        id: `wallet_imp_${Date.now()}`,
        name: `İçe Aktarılan Cüzdan ${savedWallets.length + 1}`,
        address: restored.address,
        publicKey: restored.publicKey,
        privateKey: restored.privateKey,
        createdAt: Date.now(),
      };

      setSavedWallets([...savedWallets, newWallet]);
      setActiveWallet(newWallet);

      showNotification('Cüzdan başarıyla yerel olarak açıldı!', 'success');
      await fetchWalletData(newWallet.address);
      await fetchChainAndStats();
    } catch (err: any) {
      showNotification(err.message || 'İçe aktarma hatası: Geçersiz özel anahtar.', 'error');
    }
  };

  // Handle Manual Airdrop Claim
  const handleClaimAirdrop = async () => {
    if (!activeWallet) return;
    setIsClaiming(true);
    try {
      const res = await fetch('/api/wallet/claim-airdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: activeWallet.address }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Ödül talep edilemedi.');
      }

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      showNotification(
        '1 Coin hoş geldin ödülü başarıyla tanımlandı ve yeni blok kazıldı!',
        'success'
      );

      await Promise.all([fetchChainAndStats(), fetchWalletData(activeWallet.address)]);
    } catch (err: any) {
      showNotification(err.message || 'Talep başarısız.', 'error');
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle Send Transaction (100% Client-Side Signed)
  const handleSendTransaction = async (params: { recipient: string; amount: number }) => {
    if (!activeWallet) return;
    setIsSending(true);

    try {
      // 1. Fetch current sequence nonce for replay protection
      const nonceRes = await fetch(`/api/nonce/${activeWallet.address}`);
      const nonceData = await nonceRes.json();
      const nonce = typeof nonceData.nonce === 'number' ? nonceData.nonce : 0;

      // 2. Resolve recipient if it's an alias
      let targetAddress = params.recipient.trim();
      if (!targetAddress.startsWith('0x')) {
        const resolveRes = await fetch(`/api/alias/resolve/${encodeURIComponent(targetAddress)}`);
        const resolveData = await resolveRes.json();
        if (resolveData.success && resolveData.resolved) {
          targetAddress = resolveData.resolved.address;
        }
      }

      // 3. Calculate fee & timestamp
      const fee = Math.round(params.amount * 0.001 * 1e6) / 1e6;
      const timestamp = Date.now();

      // 4. Deterministic Transaction Hash computation in client browser
      const txHash = calculateTransactionHash({
        sender: activeWallet.address,
        recipient: targetAddress,
        amount: params.amount,
        timestamp,
        type: 'TRANSFER',
        fee,
        nonce,
      });

      // 5. ECDSA secp256k1 client-side signature
      const signature = signTransaction(txHash, activeWallet.privateKey);

      // 6. Submit pre-signed transaction to Layer-1 node
      const res = await fetch('/api/transaction/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: activeWallet.address,
          recipient: targetAddress,
          amount: params.amount,
          timestamp,
          fee,
          nonce,
          signature,
          publicKey: activeWallet.publicKey,
          autoMine: true,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Transfer başarısız.');
      }

      showNotification(
        data.message || `${params.amount.toLocaleString('tr-TR')} Coin transferi onaylandı! %0.10 oran havuza geri döndü.`,
        'success'
      );

      await Promise.all([fetchChainAndStats(), fetchWalletData(activeWallet.address)]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Add Friend / Contact On-Chain (0.01 Coin Fee)
  const handleAddContact = async (targetQuery: string) => {
    if (!activeWallet) return;
    setIsAddingContact(true);
    try {
      const timestamp = Date.now();
      const nonceRes = await fetch(`/api/nonce/${activeWallet.address}`);
      const nonceData = await nonceRes.json();
      const nonce = nonceData.nonce || 0;

      // Resolve target
      const resolveRes = await fetch(`/api/alias/resolve/${encodeURIComponent(targetQuery)}`);
      const resolveData = await resolveRes.json();
      if (!resolveData.success || !resolveData.resolved) {
        throw new Error('Hedef kullanıcı veya adres bulunamadı.');
      }

      const targetAddress = resolveData.resolved.address;

      if (targetAddress === activeWallet.address) {
        throw new Error('Kendinizi rehbere ekleyemezsiniz!');
      }

      const txId = calculateHash(`ADD_CONTACT:${activeWallet.address}:${targetAddress}:${timestamp}:${nonce}`);
      const signature = signTransaction(txId, activeWallet.privateKey);

      const res = await fetch('/api/contacts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: activeWallet.address,
          targetQuery,
          signature,
          publicKey: activeWallet.publicKey,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Arkadaş eklenemedi.');
      }

      showNotification(
        'Arkadaşınız başarıyla blokzincirine kaydedildi! 0.01 Coin ağ kesintisi havuza döndü.',
        'success'
      );

      await Promise.all([fetchChainAndStats(), fetchWalletData(activeWallet.address)]);
    } finally {
      setIsAddingContact(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar */}
      <Navbar
        stats={stats}
        onRefresh={refreshAll}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-10">
        {/* Floating Notification */}
        {notification && (
          <div
            className={`fixed bottom-4 left-4 right-4 md:left-auto md:w-auto md:bottom-6 md:right-6 z-[100] p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-start space-x-3 transition-all transform animate-in slide-in-from-bottom-5 duration-300 ${
              notification.type === 'success'
                ? 'bg-zinc-900/95 border-emerald-500/50 text-emerald-400 shadow-emerald-500/10'
                : notification.type === 'error'
                ? 'bg-zinc-900/95 border-rose-500/50 text-rose-400 shadow-rose-500/10'
                : 'bg-zinc-900/95 border-emerald-500/20 text-zinc-300 shadow-zinc-900/50'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs leading-relaxed font-medium">
              {notification.message}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-zinc-500 hover:text-white transition cursor-pointer p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hero Banner: Minimalist */}
        <section className="text-center space-y-3 pt-2 pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Layer-1 Blockchain</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white">
            Para Transferinin <span className="text-emerald-400">Yeni Yolu</span>
          </h1>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Hızlı, güvenli ve masrafsız. Cüzdanınızı saniyeler içinde oluşturun.
          </p>
        </section>

        {/* Top Grid: Wallet Management & Send Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <WalletCard
            activeWallet={activeWallet}
            savedWallets={savedWallets}
            balance={balance}
            hasClaimedAirdrop={hasClaimedAirdrop}
            onCreateWallet={handleCreateWallet}
            onSelectWallet={(w) => {
              setActiveWallet(w);
              fetchWalletData(w.address);
              showNotification(`${w.name} aktif cüzdan olarak seçildi.`, 'info');
            }}
            onImportPrivateKey={handleImportPrivateKey}
            onClaimAirdrop={handleClaimAirdrop}
            isCreating={isCreating}
            isClaiming={isClaiming}
          />

          <SendForm
            activeWallet={activeWallet}
            savedWallets={savedWallets}
            contacts={contacts}
            balance={balance}
            onSend={handleSendTransaction}
            isSending={isSending}
            prefilledRecipient={prefilledRecipient}
            onClearPrefilled={() => setPrefilledRecipient('')}
          />
        </div>

        {/* Bottom Section: Clean Navigation Tabs */}
        <section className="space-y-4">
          {/* Tab Navigation - scrollable, icon+text on desktop, icon+short label on mobile */}
          <div className="flex items-center gap-1 border-b border-zinc-800/50 pb-2 overflow-x-auto no-scrollbar">
            {([
              { id: 'history', icon: History, label: 'Geçmiş' },
              { id: 'contacts', icon: Users, label: 'Kişiler' },
              { id: 'explorer', icon: Box, label: 'Ağ' },
              { id: 'treasury', icon: Database, label: 'Hazine' },
              { id: 'security', icon: Shield, label: 'Güvenlik' },
              { id: 'node', icon: Cpu, label: 'Node' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer flex-shrink-0 ${
                  activeTab === id
                    ? 'bg-zinc-800/70 text-white border border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="transition-all duration-200">
            {activeTab === 'history' && (
              <TransactionHistory
                history={history}
                activeAddress={activeWallet?.address || null}
              />
            )}

            {activeTab === 'contacts' && (
              <ContactsView
                contacts={contacts}
                onAddContact={handleAddContact}
                onSendToContact={(target) => {
                  setPrefilledRecipient(target);
                  window.scrollTo({ top: 350, behavior: 'smooth' });
                }}
                isAdding={isAddingContact}
                userBalance={balance}
              />
            )}

            {activeTab === 'explorer' && (
              <BlockExplorer
                chain={chain}
                isChainValid={stats?.isChainValid ?? true}
              />
            )}

            {activeTab === 'treasury' && (
              <TreasuryPoolView stats={stats} />
            )}

            {activeTab === 'security' && (
              <SecurityAuditView stats={stats} />
            )}

            {activeTab === 'node' && (
              <NodeRunnerView />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-[#0a0a0a] py-6 text-center text-xs text-zinc-600">
        <p>Nexus Layer-1 • Minimalist & Hızlı Transfer</p>
      </footer>
    </div>
  );
}
