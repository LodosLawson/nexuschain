import React from 'react';
import { Terminal, Download, Server, Cpu, Activity, Play } from 'lucide-react';

export function NodeRunnerView() {
  return (
    <div className="space-y-6">
      <div className="bg-black/40 border border-emerald-900/50 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Server className="w-6 h-6 text-emerald-500" />
          Gönüllü Düğüm (Node) & Madencilik Rehberi
        </h2>
        <p className="text-sm text-emerald-100/70 mb-6">
          NexusChain ağı tamamen merkeziyetsizdir. Kendi bilgisayarınızda bir ağ düğümü çalıştırarak blok zincirinin güvenliğini sağlayabilir ve işlemleri (transferleri) onaylayarak ağa katkıda bulunabilirsiniz.
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-emerald-950/20 p-5 rounded-xl border border-emerald-900/30">
            <Cpu className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="font-bold text-white mb-1">Gereksinimler</h3>
            <ul className="text-xs text-emerald-100/60 space-y-1 list-disc list-inside">
              <li>Node.js (v18+)</li>
              <li>Git</li>
              <li>Sürekli İnternet</li>
              <li>1 GB+ RAM</li>
            </ul>
          </div>

          <div className="bg-emerald-950/20 p-5 rounded-xl border border-emerald-900/30">
            <Activity className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="font-bold text-white mb-1">Görevler</h3>
            <ul className="text-xs text-emerald-100/60 space-y-1 list-disc list-inside">
              <li>İşlem havuzunu (Mempool) işlemek</li>
              <li>Yeni blokları kazmak (Mining)</li>
              <li>Bakiye ve kimlikleri doğrulamak</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-black/40 border border-emerald-900/50 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-500" />
          Kurulum & Çalıştırma Adımları
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-xs">1</span>
              Projeyi İndirin (Clone)
            </div>
            <div className="bg-black border border-emerald-900/50 rounded-lg p-3 font-mono text-xs text-emerald-400 flex items-center justify-between">
              <code>git clone https://github.com/nexuschain/nexuschain-main.git</code>
              <Download className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-xs">2</span>
              Bağımlılıkları Kurun
            </div>
            <div className="bg-black border border-emerald-900/50 rounded-lg p-3 font-mono text-xs text-emerald-400">
              <code>cd nexuschain-main && npm install</code>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-xs">3</span>
              Ağı Başlatın (Düğümü Aktif Edin)
            </div>
            <div className="bg-black border border-emerald-900/50 rounded-lg p-3 font-mono text-xs text-emerald-400 flex items-center justify-between">
              <code>npm run start</code>
              <Play className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs text-emerald-100/50 mt-2">
              Düğümünüz başladığında ağdaki `nexus_blockchain_data.json` dosyası senkronize edilecek ve bekleyen işlemleri otomatik olarak bloklara kazmaya (mine) başlayacaktır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
