import React, { useState } from 'react';
import { Box, Hash, Key, Clock, ShieldCheck, ChevronRight, Layers, Cpu, Lock, RotateCcw } from 'lucide-react';
import type { Block } from '../blockchain/types.ts';

interface BlockExplorerProps {
  chain: Block[];
  isChainValid: boolean;
}

export const BlockExplorer: React.FC<BlockExplorerProps> = ({ chain, isChainValid }) => {
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Blok Gezgini (Block Explorer)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {chain.length} Blok
              </span>
            </h3>
            <p className="text-xs text-slate-400">Layer-1 Blokzincir Kayıtları • Genesis Kalıcı & Silinemez</p>
          </div>
        </div>

        {/* Audit Status */}
        <div className="flex items-center space-x-2">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              isChainValid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isChainValid ? 'Zincir Bütünlüğü Doğrulandı (%100 Geçerli)' : 'Zincir Bütünlüğü Bozuk!'}</span>
          </div>
        </div>
      </div>

      {/* Visual Chain Timeline */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          En Son Kazılan Bloklar (Son blok en üstte)
        </div>

        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {[...chain].reverse().map((block) => {
            const isGenesis = block.index === 0;
            const isSelected = selectedBlock?.index === block.index;

            return (
              <div
                key={block.hash + block.index}
                onClick={() => setSelectedBlock(isSelected ? null : block)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-sm text-indigo-300 flex-shrink-0">
                      #{block.index}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-white">
                          Hash: {block.hash.slice(0, 14)}...{block.hash.slice(-8)}
                        </span>
                        {isGenesis && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            GENESIS (SİLİNEMEZ)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {formatTime(block.timestamp)}
                        </span>
                        <span>•</span>
                        <span className="text-cyan-400 font-mono">
                          Nonce: {block.nonce.toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 font-medium border border-slate-700">
                      {block.transactions.length} İşlem
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isSelected ? 'rotate-90 text-indigo-400' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-500 block">Önceki Blok Hash'i (Previous Hash)</span>
                        <span className="font-mono text-[11px] text-slate-300 break-all select-all">
                          {block.previousHash}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-500 block">Mevcut Blok Hash'i (Current Hash)</span>
                        <span className="font-mono text-[11px] text-emerald-400 break-all select-all">
                          {block.hash}
                        </span>
                      </div>
                      {block.merkleRoot && (
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 md:col-span-2">
                          <span className="text-[11px] text-cyan-400 font-semibold block flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            Kriptografik Merkle Kökü (Merkle Root Tree)
                          </span>
                          <span className="font-mono text-[11px] text-cyan-200 break-all select-all">
                            {block.merkleRoot}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-slate-400 text-xs">
                      <span>
                        PoW Hedef Zorluğu: <strong className="text-slate-200">{block.difficulty} Sıfır ('00')</strong>
                      </span>
                      <span>
                        Hesaplanan Nonce: <strong className="text-slate-200">{block.nonce}</strong>
                      </span>
                      <span>
                        Zaman Damgası (Epoch): <strong className="text-slate-200">{block.timestamp}</strong>
                      </span>
                    </div>

                    {/* Transactions inside this block */}
                    <div>
                      <span className="text-xs font-semibold text-slate-300 block mb-2">
                        Bloktaki İşlemler ({block.transactions.length}):
                      </span>
                      <div className="space-y-2">
                        {block.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2"
                          >
                            <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
                              <div>
                                <span className="text-slate-500">Gönderen:</span>{' '}
                                <span className="text-slate-300">{tx.sender}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Alıcı:</span>{' '}
                                <span className="text-cyan-300">{tx.recipient}</span>
                              </div>
                              {tx.nonce !== undefined && (
                                <div className="text-[10px] text-slate-400">
                                  <span>Hesap Nonce (Sıra No):</span>{' '}
                                  <span className="text-indigo-400 font-mono">#{tx.nonce}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-mono font-bold text-emerald-400 text-sm">
                                {tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 4 })} COIN
                              </div>
                              {tx.fee && tx.fee > 0 ? (
                                <div className="text-[10px] text-amber-300 font-mono flex items-center justify-end gap-1">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  %0.10 İade: +{tx.fee.toLocaleString('tr-TR', { minimumFractionDigits: 6 })} COIN
                                </div>
                              ) : null}
                              <span className="block text-[10px] text-slate-500 uppercase">{tx.type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
