import React from 'react';
import { ShieldCheck, RefreshCw, Cpu, Database, Coins, Lock, Flame } from 'lucide-react';
import type { NetworkStats } from '../blockchain/types.ts';

interface NavbarProps {
  stats: NetworkStats | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ stats, onRefresh, isRefreshing }) => {
  const formatNumber = (num: number | undefined) => (num !== undefined ? num.toLocaleString('tr-TR') : '0');

  const treasuryRatio = stats ? ((stats.treasuryBalance / stats.totalSupply) * 100).toFixed(1) : '100';

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Node Status */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Cpu className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">NEXUS</span>
                <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Layer-1
                </span>
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Genesis Kalıcı (Silinemez)
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                PoW Consensus • Airdrop: 1 Coin • %0.10 İade Oranı
              </p>
            </div>
          </div>

          {/* Quick Network Stats */}
          <div className="hidden lg:flex items-center space-x-5 text-xs">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Toplam Sabit Arz</span>
                <span className="font-mono font-bold text-slate-100">1.000.000.000</span>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Hazine Havuzu</span>
                <span className="font-mono font-bold text-cyan-200">
                  {formatNumber(stats?.treasuryBalance)} <span className="text-[10px] text-cyan-400/80">({treasuryRatio}%)</span>
                </span>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Sisteme Dönen Kesinti (%0.10)</span>
                <span className="font-mono font-bold text-amber-300">
                  +{stats?.totalFeesRecycled?.toLocaleString('tr-TR', { minimumFractionDigits: 3 }) ?? '0.000'} Coin
                </span>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
              <div>
                <span className="text-slate-400 block text-[10px]">Blok Yüksekliği</span>
                <span className="font-mono font-bold text-indigo-200">#{stats?.blockHeight ?? 1}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Ağı Yenile"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50 cursor-pointer flex items-center gap-1 text-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Ağı Yenile</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
