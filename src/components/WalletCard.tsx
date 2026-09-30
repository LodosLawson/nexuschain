import React, { useState } from 'react';
import {
  Wallet,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  PlusCircle,
  KeyRound,
  Lock,
  Unlock,
  Download,
  FileCode,
  ShieldCheck,
  ChevronDown,
  AlertCircle,
  QrCode,
  AtSign,
  UserCheck
} from 'lucide-react';
import type { WalletKeys } from '../blockchain/types.ts';
import {
  encryptKeystore,
  decryptKeystore,
  isValidKeystoreObject,
  type EncryptedKeystore
} from '../blockchain/encryption.ts';
import { QRModal } from './QRModal.tsx';

export interface SavedWallet extends WalletKeys {
  id: string;
  name: string;
  nickname?: string;
  fullName?: string;
  createdAt: number;
}

interface WalletCardProps {
  activeWallet: SavedWallet | null;
  savedWallets: SavedWallet[];
  balance: number;
  hasClaimedAirdrop: boolean;
  onCreateWallet: (info?: { nickname?: string; fullName?: string }) => void;
  onSelectWallet: (wallet: SavedWallet) => void;
  onImportPrivateKey: (pk: string) => void;
  onClaimAirdrop: () => void;
  isCreating: boolean;
  isClaiming: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  activeWallet,
  savedWallets,
  balance,
  hasClaimedAirdrop,
  onCreateWallet,
  onSelectWallet,
  onImportPrivateKey,
  onClaimAirdrop,
  isCreating,
  isClaiming,
}) => {
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<'address' | 'private' | 'public' | 'keystore' | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'raw' | 'keystore'>('raw');
  const [importKeyInput, setImportKeyInput] = useState<string>('');
  const [keystoreJsonInput, setKeystoreJsonInput] = useState<string>('');
  const [keystorePasswordInput, setKeystorePasswordInput] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  // QR Modal
  const [showQRModal, setShowQRModal] = useState<boolean>(false);

  // Create Wallet Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');

  // Encrypt & Backup Keystore Modal State
  const [showEncryptModal, setShowEncryptModal] = useState<boolean>(false);
  const [encryptPassword, setEncryptPassword] = useState<string>('');
  const [encryptPasswordConfirm, setEncryptPasswordConfirm] = useState<string>('');
  const [passwordHint, setPasswordHint] = useState<string>('');
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [generatedKeystore, setGeneratedKeystore] = useState<EncryptedKeystore | null>(null);
  const [encryptError, setEncryptError] = useState<string | null>(null);

  const [showSwitchDropdown, setShowSwitchDropdown] = useState<boolean>(false);

  const copyToClipboard = (text: string, type: 'address' | 'private' | 'public' | 'keystore') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);

    if (importMode === 'raw') {
      if (!importKeyInput.trim()) {
        setImportError('Lütfen geçerli bir özel anahtar girin.');
        return;
      }
      try {
        onImportPrivateKey(importKeyInput.trim());
        setImportKeyInput('');
        setShowImportModal(false);
      } catch (err: any) {
        setImportError(err.message || 'Geçersiz özel anahtar.');
      }
    } else {
      if (!keystoreJsonInput.trim()) {
        setImportError('Lütfen Keystore JSON içeriğini yapıştırın.');
        return;
      }
      if (!keystorePasswordInput) {
        setImportError('Lütfen Keystore şifresini girin.');
        return;
      }

      setIsDecrypting(true);
      try {
        let parsed: any;
        try {
          parsed = JSON.parse(keystoreJsonInput.trim());
        } catch {
          throw new Error('Geçersiz JSON formatı! Lütfen geçerli bir Keystore JSON metni yapıştırın.');
        }

        if (!isValidKeystoreObject(parsed)) {
          throw new Error('Bu dosya Nexus AES-256-GCM Keystore standardına uymuyor.');
        }

        const decryptedPrivateKey = await decryptKeystore(parsed, keystorePasswordInput);
        onImportPrivateKey(decryptedPrivateKey);

        setKeystoreJsonInput('');
        setKeystorePasswordInput('');
        setShowImportModal(false);
      } catch (err: any) {
        setImportError(err.message || 'Şifre çözülemedi. Parolanızı kontrol edin.');
      } finally {
        setIsDecrypting(false);
      }
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateWallet({
      nickname: newNickname.trim() ? newNickname.trim().replace(/^@/, '') : undefined,
      fullName: newFullName.trim() ? newFullName.trim() : undefined,
    });
    setNewNickname('');
    setNewFullName('');
    setShowCreateModal(false);
  };

  const handleEncryptWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setEncryptError(null);

    if (!activeWallet) return;
    if (encryptPassword.length < 6) {
      setEncryptError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (encryptPassword !== encryptPasswordConfirm) {
      setEncryptError('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setIsEncrypting(true);
    try {
      const keystore = await encryptKeystore({
        privateKey: activeWallet.privateKey,
        password: encryptPassword,
        address: activeWallet.address,
        publicKey: activeWallet.publicKey,
        name: activeWallet.name,
        hint: passwordHint.trim() || undefined,
      });

      setGeneratedKeystore(keystore);
    } catch (err: any) {
      setEncryptError(err.message || 'Cüzdan şifrelenemedi.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const downloadKeystoreFile = () => {
    if (!generatedKeystore) return;
    const jsonStr = JSON.stringify(generatedKeystore, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-keystore-${generatedKeystore.address.substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCoin = (val: number) => {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 md:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden flex flex-col gap-6 min-h-[300px]">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Top row: wallet name + switch dropdown */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-medium text-white truncate">
                {activeWallet?.nickname ? `@${activeWallet.nickname}` : (activeWallet?.name || 'Cüzdan')}
              </h2>
              {activeWallet && (
                <p className="text-[11px] text-zinc-500 font-mono truncate">
                  {activeWallet.address.slice(0, 12)}...{activeWallet.address.slice(-6)}
                </p>
              )}
            </div>
          </div>

          {savedWallets.length > 1 && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition cursor-pointer"
              >
                <span>{savedWallets.length}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showSwitchDropdown && (
                <div className="absolute right-0 mt-2 w-60 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Kayıtlı Cüzdanlar
                  </div>
                  {savedWallets.map((w, idx) => (
                    <button
                      key={w.address}
                      onClick={() => {
                        onSelectWallet(w);
                        setShowSwitchDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-zinc-800 transition ${
                        activeWallet?.address === w.address ? 'text-emerald-400 font-bold' : 'text-zinc-300'
                      }`}
                    >
                      <div className="truncate">
                        <p className="truncate font-medium">{w.nickname ? `@${w.nickname}` : (w.name || `Cüzdan ${idx + 1}`)}</p>
                        <p className="text-[10px] font-mono text-zinc-500 truncate">{w.address.slice(0, 12)}...{w.address.slice(-6)}</p>
                      </div>
                      {activeWallet?.address === w.address && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom row: action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setImportError(null);
              setShowImportModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>İçe Aktar</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isCreating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-500 hover:bg-emerald-400 text-black transition disabled:opacity-50 cursor-pointer"
          >
            <PlusCircle className={`w-3.5 h-3.5 ${isCreating ? 'animate-spin' : ''}`} />
            <span>{isCreating ? 'Üretiliyor...' : 'Yeni Cüzdan'}</span>
          </button>
        </div>
      </div>

      {activeWallet ? (
        <div className="relative z-10 flex flex-col items-center gap-5">
          {/* Main Balance Display */}
          <div className="text-center">
            <p className="text-xs font-medium text-zinc-500 mb-1">Bakiye</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl sm:text-5xl font-light tracking-tight text-white">
                {formatCoin(balance)}
              </span>
              <span className="text-lg font-medium text-emerald-400">COIN</span>
            </div>
            {/* Compact address row */}
            <button
              onClick={() => copyToClipboard(activeWallet.address, 'address')}
              className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition cursor-pointer group"
              title="Adresi kopyala"
            >
              <span className="group-hover:text-zinc-300">{activeWallet.address.slice(0, 16)}...{activeWallet.address.slice(-10)}</span>
              {copiedKey === 'address' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
              )}
            </button>
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setShowQRModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Al (QR)</span>
            </button>

            <button
              onClick={() => {
                setGeneratedKeystore(null);
                setEncryptPassword('');
                setEncryptPasswordConfirm('');
                setEncryptError(null);
                setShowEncryptModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition cursor-pointer"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Yedekle</span>
            </button>

            {!hasClaimedAirdrop && (
              <button
                onClick={onClaimAirdrop}
                disabled={isClaiming}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isClaiming ? 'Alınıyor...' : '+1 Hediye'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 px-4 relative z-10 flex flex-col items-center justify-center h-full">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
            <Wallet className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3">Cüzdanınız Yok</h3>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto mb-8">
            Basit ve güvenli bir cüzdan oluşturun, transferlere hemen başlayın.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isCreating}
            className="px-8 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isCreating ? 'animate-spin' : ''}`} />
            <span>{isCreating ? 'Oluşturuluyor...' : 'Hemen Başla'}</span>
          </button>
        </div>
      )}

      {/* Create Wallet Modal with Nickname & Privacy Commitment */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Yeni Kriptografik Cüzdan</h3>
                <p className="text-xs text-slate-400">+1 Coin Hoş Geldin Ödülü Tanımlanacak</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kullanıcı Adı / Nickname (İsteğe Bağlı)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    placeholder="satoshi"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Arkadaşlarınız uzun hex adresi yerine bu isimle size coin gönderebilir.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ad Soyad (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ahmet Yılmaz"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Privacy Notice Requirement */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Kriptografik Gizlilik Kalkanı (Zero-Knowledge)</span>
                </div>
                <p>
                  Adınız blokzincirinde <strong>asla açık metin olarak yazılmaz</strong>. SHA-256 kriptografik tuzuyla özetlenerek gizlenir ve kimliğiniz korunur.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cüzdanı Oluştur (+1 Coin)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal for Receiving */}
      {activeWallet && (
        <QRModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          address={activeWallet.address}
          nickname={activeWallet.nickname}
          mode="show"
        />
      )}

      {/* Import Modal (Raw Key or Encrypted Keystore) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Cüzdan İçe Aktar
              </h3>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => { setImportMode('raw'); setImportError(null); }}
                  className={`px-2.5 py-1 rounded font-medium cursor-pointer transition ${
                    importMode === 'raw' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Özel Anahtar
                </button>
                <button
                  type="button"
                  onClick={() => { setImportMode('keystore'); setImportError(null); }}
                  className={`px-2.5 py-1 rounded font-medium cursor-pointer transition ${
                    importMode === 'keystore' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Şifreli Keystore
                </button>
              </div>
            </div>

            {importError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4">
              {importMode === 'raw' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Private Key (64-char Hex)
                  </label>
                  <textarea
                    value={importKeyInput}
                    onChange={(e) => setImportKeyInput(e.target.value)}
                    placeholder="e.g. 4f3edf983ac636a65a842ce7c78d3270..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Anahtarınız asla sunucuya gitmez, tarayıcınızda yerel olarak doğrulanır.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Keystore JSON İçeriği
                    </label>
                    <textarea
                      value={keystoreJsonInput}
                      onChange={(e) => setKeystoreJsonInput(e.target.value)}
                      placeholder='{"version":3,"crypto":{"cipher":"aes-256-gcm",...}}'
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Keystore Şifresi
                    </label>
                    <input
                      type="password"
                      value={keystorePasswordInput}
                      onChange={(e) => setKeystorePasswordInput(e.target.value)}
                      placeholder="Cüzdanınızı şifrelerken belirlediğiniz parola"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isDecrypting}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isDecrypting ? (
                    <>
                      <Lock className="w-3.5 h-3.5 animate-spin" />
                      <span>Şifre Çözülüyor (PBKDF2)...</span>
                    </>
                  ) : (
                    <span>Cüzdanı Aç</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Encrypt Wallet / Keystore Backup Modal */}
      {showEncryptModal && activeWallet && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cüzdanı Şifrele & Keystore Yedekle</h3>
                <p className="text-xs text-slate-400">Bankacılık standardı AES-256-GCM + PBKDF2 (100.000 döngü)</p>
              </div>
            </div>

            {encryptError && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{encryptError}</span>
              </div>
            )}

            {!generatedKeystore ? (
              <form onSubmit={handleEncryptWallet} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cüzdan Şifresi (En az 6 karakter)
                  </label>
                  <input
                    type="password"
                    value={encryptPassword}
                    onChange={(e) => setEncryptPassword(e.target.value)}
                    placeholder="Güçlü bir parola belirleyin"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Şifre Tekrarı
                  </label>
                  <input
                    type="password"
                    value={encryptPasswordConfirm}
                    onChange={(e) => setEncryptPasswordConfirm(e.target.value)}
                    placeholder="Parolayı tekrar girin"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Şifre İpucu (İsteğe bağlı)
                  </label>
                  <input
                    type="text"
                    value={passwordHint}
                    onChange={(e) => setPasswordHint(e.target.value)}
                    placeholder="e.g. İlkokul öğretmenimin adı"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Sıfır Bilgi Güvenliği (Zero-Knowledge)</span>
                  </div>
                  <p>
                    Parolanız sunucuya gönderilmez. Özel anahtarınız Web Crypto API aracılığıyla cihazınızın donanımında şifrelenir.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEncryptModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isEncrypting}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Lock className={`w-3.5 h-3.5 ${isEncrypting ? 'animate-spin' : ''}`} />
                    <span>{isEncrypting ? 'Şifreleniyor...' : 'Şifrele & Keystore Oluştur'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Cüzdanınız Başarıyla AES-256-GCM ile Şifrelendi!
                  </p>
                  <p className="text-[11px] text-emerald-400/80">
                    Artık bu Keystore dosyasını güvenle indirebilir veya yedekleyebilirsiniz. Parolanızı unutmayın!
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Şifrelenmiş Keystore JSON
                  </label>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto select-all">
                    {JSON.stringify(generatedKeystore, null, 2)}
                  </pre>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(generatedKeystore, null, 2), 'keystore')}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedKey === 'keystore' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'keystore' ? 'Kopyalandı' : 'JSON Kopyala'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadKeystoreFile}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Keystore Dosyasını İndir (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEncryptModal(false)}
                    className="px-3 py-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
