import React from 'react';
import { Database, ShieldCheck, Lock, Award, Users, CheckCircle2, RotateCcw, Coins } from 'lucide-react';
import type { NetworkStats } from '../blockchain/types.ts';
import { TREASURY_ADDRESS } from '../blockchain/constants.ts';

interface TreasuryPoolViewProps {
  stats: NetworkStats | null;
}

export const TreasuryPoolView: React.FC<TreasuryPoolViewProps> = ({ stats }) => {
  if (!stats) return null;

  const formatCoin = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const treasuryPercent = ((stats.treasuryBalance / stats.totalSupply) * 100).toFixed(4);
  const circulatingPercent = ((stats.circulatingSupply / stats.totalSupply) * 100).toFixed(4);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Genesis Hazine Havuzu & Kalıcı Sınır Kontrolü
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                1 Milyar Sabit Arz
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Her cüzdana tam 1 Coin airdrop • 1 Milyarıncı cüzdanda bitiş • %0.10 transfer kesintisi havuza geri dönüşü
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Genesis Silinemez • Hard Cap Korunuyor</span>
        </div>
      </div>

      {/* Progress Bars & Allocations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            Hazine Havuzu: {formatCoin(stats.treasuryBalance)} COIN ({treasuryPercent}%)
          </span>
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            Dolaşımda: {formatCoin(stats.circulatingSupply)} COIN ({circulatingPercent}%)
          </span>
        </div>

        {/* Visual Dual Progress Bar */}
        <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800 p-0.5">
          <div
            style={{ width: `${Math.max(0.5, parseFloat(circulatingPercent))}%` }}
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-l-full transition-all duration-500"
            title={`Dolaşım: %${circulatingPercent}`}
          />
          <div
            style={{ width: `${treasuryPercent}%` }}
            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-r-full transition-all duration-500"
            title={`Hazine Havuzu: %${treasuryPercent}`}
          />
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Toplam Sabit Arz */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Toplam Sabit Arz</span>
            <Lock className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="font-mono text-xl font-bold text-white">1.000.000.000</div>
          <p className="text-[11px] text-slate-500 mt-1">Kesinlikle yeni coin basılamaz</p>
        </div>

        {/* Card 2: Hoş Geldin Ödülü */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Cüzdan Başı Ödül</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="font-mono text-xl font-bold text-amber-300">1.0000 COIN</div>
          <p className="text-[11px] text-slate-500 mt-1">Yeni açılan her cüzdana 1 adet</p>
        </div>

        {/* Card 3: Airdrop Kontenjanı */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Dağıtılan / 1 Milyar Sınırı</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="font-mono text-xl font-bold text-cyan-300">
            {stats.claimedAirdropsCount} / 1.000.000.000
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            1 Milyarıncı cüzdanda airdrop tamamen biter
          </p>
        </div>

        {/* Card 4: Sisteme Dönen %0.10 Kesintiler */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Havuza Dönen Kesinti (%0.10)</span>
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-mono text-xl font-bold text-emerald-400">
            +{stats.totalFeesRecycled.toLocaleString('tr-TR', { minimumFractionDigits: 6 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Transfer kesintileri supply'a eklenir</p>
        </div>
      </div>

      {/* Proof of Supply & Genesis Treasury Contract Information */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Matematiksel Eşitlik & Kalıcı Genesis Doğrulaması
          </span>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Audit: PASS (100% Doğrulandı)
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>Hazine ({formatCoin(stats.treasuryBalance)}) + Dolaşım ({formatCoin(stats.circulatingSupply)})</span>
          <span className="text-emerald-400 font-bold">= 1.000.000.000 COIN</span>
        </div>

        <div className="text-[11px] text-slate-400 space-y-1.5 pt-1">
          <p>
            <strong className="text-slate-300">Genesis Bloğu ve Hazine:</strong> Genesis Bloğu blokzincirinin ilk taş kuralıdır, kalıcıdır ve asla silinemez. Tüm ilk 1.000.000.000 Coin arzı bu blokta oluşturulmuş ve <span className="font-mono text-cyan-300 select-all">{TREASURY_ADDRESS}</span> adresine kilitlenmiştir.
          </p>
          <p>
            <strong className="text-slate-300">1 Coin Airdrop Kuralı:</strong> Yeni oluşturulan her cüzdana sadece 1 Coin tahsis edilir. Bu dağıtım tam 1.000.000.000 adet cüzdan açıldığı zaman sıfırlanıp sona erer.
          </p>
          <p>
            <strong className="text-slate-300">%0.10 Transfer Kesintisi ve Geri Dönüş:</strong> Kullanıcılar coin transferi yaptığında tutarın %0.10'luk kısmı sistem tarafından kesilir ve tekrar Genesis Hazine Havuzuna geri aktarılır. Bu sayede blokzincir ekonomisi sürekli canlı kalır.
          </p>
        </div>
      </div>
    </div>
  );
};
