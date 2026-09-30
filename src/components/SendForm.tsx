import React, { useState, useEffect } from 'react';
import {
  Send,
  ArrowRight,
  ShieldCheck,
  Zap,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Flame,
  RotateCcw,
  QrCode,
  Users,
  Search
} from 'lucide-react';
import type { SavedWallet } from './WalletCard.tsx';
import type { UserContact } from '../blockchain/types.ts';
import { QRModal } from './QRModal.tsx';

interface SendFormProps {
  activeWallet: SavedWallet | null;
  savedWallets: SavedWallet[];
  contacts?: UserContact[];
  balance: number;
  onSend: (params: { recipient: string; amount: number }) => Promise<void>;
  isSending: boolean;
  prefilledRecipient?: string;
  onClearPrefilled?: () => void;
}

export const SendForm: React.FC<SendFormProps> = ({
  activeWallet,
  savedWallets,
  contacts = [],
  balance,
  onSend,
  isSending,
  prefilledRecipient,
  onClearPrefilled,
}) => {
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showCryptoDetails, setShowCryptoDetails] = useState<boolean>(false);
  const [showQRScanModal, setShowQRScanModal] = useState<boolean>(false);
  const [resolvedInfo, setResolvedInfo] = useState<{ address: string; nickname?: string } | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(false);

  // Sync prefilled recipient
  useEffect(() => {
    if (prefilledRecipient) {
      setRecipient(prefilledRecipient);
      if (onClearPrefilled) onClearPrefilled();
    }
  }, [prefilledRecipient, onClearPrefilled]);

  // Real-time Alias Resolution
  useEffect(() => {
    const clean = recipient.trim();
    if (!clean) {
      setResolvedInfo(null);
      return;
    }

    if (clean.startsWith('@') || (!clean.startsWith('0x') && clean.length >= 3 && clean.length <= 20)) {
      setIsResolving(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/alias/resolve/${encodeURIComponent(clean)}`);
          const data = await res.json();
          if (data.success && data.resolved) {
            setResolvedInfo(data.resolved);
          } else {
            setResolvedInfo(null);
          }
        } catch {
          setResolvedInfo(null);
        } finally {
          setIsResolving(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setResolvedInfo(null);
    }
  }, [recipient]);

  // Filter other saved wallets as quick recipients
  const otherWallets = savedWallets.filter(
    (w) => activeWallet && w.address.toLowerCase() !== activeWallet.address.toLowerCase()
  );

  const parsedAmount = parseFloat(amount) || 0;
  const calculatedFee = parseFloat((parsedAmount * 0.001).toFixed(6)); // 0.10% (%0.10)
  const totalDeduction = parseFloat((parsedAmount + calculatedFee).toFixed(6));

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
    setError(null);
  };

  const handleMaxAmount = () => {
    if (balance > 0) {
      // Calculate max amount such that amount + 0.10% fee <= balance
      const maxNet = parseFloat((balance / 1.001).toFixed(6));
      setAmount(maxNet.toString());
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeWallet) {
      setError('Lütfen önce bir cüzdan seçin veya oluşturun.');
      return;
    }

    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient) {
      setError('Lütfen geçerli bir alıcı adresi veya @kullanıcı_adı girin.');
      return;
    }

    // Resolve target if it's an alias
    let finalRecipient = trimmedRecipient;
    if (resolvedInfo) {
      finalRecipient = resolvedInfo.address;
    }

    if (finalRecipient.toLowerCase() === activeWallet.address.toLowerCase()) {
      setError('Kendi cüzdan adresinize transfer yapamazsınız.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Lütfen 0 dan büyük geçerli bir miktar girin.');
      return;
    }

    const fee = parseFloat((numAmount * 0.001).toFixed(6));
    const totalRequired = parseFloat((numAmount + fee).toFixed(6));

    if (totalRequired > balance) {
      setError(
        `Yetersiz bakiye! İhtiyaç: ${numAmount.toLocaleString('tr-TR')} + %0.10 Sistem Kesintisi (${fee.toFixed(6)}) = ${totalRequired.toFixed(6)} Coin. Mevcut: ${balance.toFixed(6)} Coin`
      );
      return;
    }

    try {
      await onSend({ recipient: finalRecipient, amount: numAmount });
      setAmount('');
      setRecipient('');
      setResolvedInfo(null);
    } catch (err: any) {
      setError(err.message || 'Transfer gerçekleştirilemedi.');
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl relative h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Send className="w-5 h-5 ml-0.5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              Gönder
            </h3>
            <p className="text-xs text-zinc-500">
              Güvenli, hızlı ve ağ kesintisi iadeli
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowQRScanModal(true)}
          className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
          title="QR Kod Tara"
        >
          <QrCode className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-400">
              Kime (Adres veya @kullanıcı_adı)
            </label>
            {resolvedInfo && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>@{resolvedInfo.nickname} ({resolvedInfo.address.slice(0, 8)}...)</span>
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x... veya @kullanici"
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 transition-colors pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowQRScanModal(true)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              title="QR Kod İle Doldur"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
            </button>
          </div>

          {/* Quick Contacts Chips */}
          {contacts.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Users className="w-3 h-3 text-violet-400" />
                Rehberim:
              </span>
              {contacts.slice(0, 4).map((c) => (
                <button
                  key={c.contactAddress}
                  type="button"
                  onClick={() => setRecipient(c.nickname ? `@${c.nickname}` : c.contactAddress)}
                  className="px-2 py-0.5 rounded-lg bg-violet-950/40 hover:bg-violet-900/50 border border-violet-800/40 text-[11px] text-violet-300 transition cursor-pointer"
                >
                  {c.nickname ? `@${c.nickname}` : c.contactAddress.slice(0, 8) + '...'}
                </button>
              ))}
            </div>
          )}

          {/* Quick Selection for User's other Wallets */}
          {otherWallets.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Kendi Cüzdanlarım:
              </span>
              {otherWallets.map((w) => (
                <button
                  key={w.address}
                  type="button"
                  onClick={() => setRecipient(w.address)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition cursor-pointer"
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-400">
              Miktar (COIN)
            </label>
            <span className="text-xs text-zinc-500">
              Kullanılabilir:{' '}
              <strong className="text-zinc-300 font-mono">{balance.toFixed(4)}</strong>
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-4 py-3.5 text-lg text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 transition-colors"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-emerald-500/50">
              COIN
            </span>
          </div>

          {/* Quick amount chips */}
          <div className="flex items-center justify-between mt-2 text-xs">
            <div className="flex items-center space-x-1.5">
              {[0.1, 0.25, 0.5, 1].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs border border-zinc-700 transition cursor-pointer"
                >
                  +{val}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleMaxAmount}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
            >
              Tümü
            </button>
          </div>
        </div>

        {/* Real-time Economic Fee Calculation */}
        {parsedAmount > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Alıcıya Geçecek Net Tutar:</span>
              <span className="font-mono text-white font-semibold">{parsedAmount.toFixed(4)} COIN</span>
            </div>
            <div className="flex items-center justify-between text-cyan-400">
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>%0.10 Sistem Kesintisi (Havuza İade):</span>
              </span>
              <span className="font-mono font-semibold">+{calculatedFee.toFixed(6)} COIN</span>
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-bold text-white">
              <span>Cüzdandan Düşecek Toplam Tutar:</span>
              <span className="font-mono text-emerald-400">{totalDeduction.toFixed(6)} COIN</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 mt-auto">
          <button
            type="submit"
            disabled={isSending || !activeWallet || balance <= 0}
            className="w-full py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
            <span>{isSending ? 'Gönderiliyor...' : 'Gönder'}</span>
          </button>
        </div>
      </form>

      {/* QR Scanner / Input Modal */}
      <QRModal
        isOpen={showQRScanModal}
        onClose={() => setShowQRScanModal(false)}
        address={activeWallet?.address || ''}
        mode="scan"
        onScanAddress={(scanned) => setRecipient(scanned)}
      />
    </div>
  );
};
