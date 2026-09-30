import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Sparkles, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import type { Transaction } from '../blockchain/types.ts';

interface HistoryItem extends Transaction {
  blockIndex: number;
  blockHash: string;
}

interface TransactionHistoryProps {
  history: HistoryItem[];
  activeAddress: string | null;
  onSelectTx?: (tx: HistoryItem) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  history,
  activeAddress,
  onSelectTx,
}) => {
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatCoin = (val: number) => {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            İşlem Geçmişi (Transaction History)
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
              {history.length} İşlem
            </span>
          </h3>
          <p className="text-xs text-slate-400">Bu cüzdana ait blokzincir üzerindeki tüm onaylı transferler</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">Henüz İşlem Bulunmuyor</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Yeni bir cüzdan oluşturduğunuzda 10.000.000 Coin airdrop işlemi burada görünecektir.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((tx) => {
            const isAirdrop = tx.type === 'AIRDROP';
            const isGenesis = tx.type === 'GENESIS';
            const isIncoming =
              activeAddress && tx.recipient.toLowerCase() === activeAddress.toLowerCase() && !isAirdrop;
            const isOutgoing =
              activeAddress && tx.sender.toLowerCase() === activeAddress.toLowerCase();

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTx && onSelectTx(tx)}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
              >
                {/* Left: Icon & Description */}
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isAirdrop
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : isGenesis
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : isIncoming
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isAirdrop ? (
                      <Sparkles className="w-5 h-5" />
                    ) : isGenesis ? (
                      <Sparkles className="w-5 h-5" />
                    ) : isIncoming ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white">
                        {isAirdrop
                          ? 'Hoş Geldin Ödülü (Airdrop)'
                          : isGenesis
                          ? 'Genesis Mint (Toplam Arz)'
                          : isIncoming
                          ? 'Gelen Transfer'
                          : 'Giden Transfer'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Blok #{tx.blockIndex}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                      <span className="font-mono text-[11px] text-slate-500">
                        {tx.id.slice(0, 10)}...{tx.id.slice(-6)}
                      </span>
                      <span>•</span>
                      <span>{formatTime(tx.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Status */}
                <div className="text-right sm:flex-shrink-0">
                  <div
                    className={`text-base font-mono font-bold tracking-tight ${
                      isAirdrop
                        ? 'text-purple-300'
                        : isGenesis
                        ? 'text-amber-300'
                        : isIncoming
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {isOutgoing ? '-' : '+'}
                    {formatCoin(tx.amount)} <span className="text-xs font-sans">COIN</span>
                  </div>

                  <div className="flex items-center justify-end space-x-1.5 text-[11px] text-emerald-400 mt-0.5">
                    <CheckCircle className="w-3 h-3" />
                    <span>Onaylandı (ECDSA Doğrulandı)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
