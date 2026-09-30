import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, Copy, Check, Download, Camera, X, AlertCircle } from 'lucide-react';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  nickname?: string;
  onScanAddress?: (scanned: string) => void;
  mode?: 'show' | 'scan';
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  address,
  nickname,
  onScanAddress,
  mode = 'show',
}) => {
  const [activeTab, setActiveTab] = useState<'show' | 'scan'>(mode);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [scanInput, setScanInput] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(mode);
  }, [mode, isOpen]);

  // Generate QR Code
  useEffect(() => {
    if (address && isOpen) {
      QRCode.toDataURL(address, {
        width: 280,
        margin: 2,
        color: {
          dark: '#09090b', // zinc-950
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [address, isOpen]);

  // Handle QR Camera Scanner
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (isOpen && activeTab === 'scan') {
      // Use setTimeout to ensure the DOM element is rendered before starting the scanner
      const timer = setTimeout(() => {
        scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        
        scanner.render(
          (decodedText) => {
            setScanInput(decodedText);
            if (scanner) {
              scanner.clear().catch(console.error);
            }
            if (onScanAddress) {
              onScanAddress(decodedText);
              onClose();
            }
          },
          (error) => {
            // Ignore ongoing scan errors which fire continuously
          }
        );
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(console.error);
        }
      };
    }
  }, [isOpen, activeTab, onScanAddress, onClose]);

  if (!isOpen) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `nexus-qr-${(nickname || address).substring(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    if (onScanAddress) {
      onScanAddress(scanInput.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1.5 rounded-full hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switch */}
        <div className="flex bg-zinc-950/50 p-1 rounded-full border border-zinc-800 text-xs mb-6 max-w-[240px]">
          <button
            onClick={() => setActiveTab('show')}
            className={`flex-1 py-2 rounded-full font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'show' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Göster</span>
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-2 rounded-full font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'scan' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>QR Tara</span>
          </button>
        </div>

        {activeTab === 'show' ? (
          /* Show QR Code */
          <div className="space-y-5 text-center">
            <div>
              <h3 className="text-lg font-medium text-white flex items-center justify-center gap-2">
                <span>Cüzdan QR Kodu</span>
                {nickname && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 font-mono">
                    @{nickname}
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Doğrudan bu cüzdana ödeme almak için okutun.
              </p>
            </div>

            {/* QR Image Box */}
            <div className="p-4 bg-white rounded-[2rem] inline-block shadow-2xl">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Nexus Wallet QR"
                  className="w-52 h-52 mx-auto rounded-xl"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-zinc-400 text-sm">
                  QR Üretiliyor...
                </div>
              )}
            </div>

            {/* Address snippet */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 text-left">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium block mb-1">
                Açık Adres
              </span>
              <p className="font-mono text-xs text-zinc-300 break-all select-all leading-relaxed">
                {address}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={copyAddress}
                className="flex-1 px-4 py-3 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopyalandı' : 'Adresi Kopyala'}</span>
              </button>
              <button
                onClick={downloadQR}
                className="px-4 py-3 text-sm font-medium rounded-full bg-emerald-500 hover:bg-emerald-400 text-black transition flex items-center justify-center gap-2 cursor-pointer"
                title="QR Kodunu İndir"
              >
                <Download className="w-4 h-4" />
                <span>İndir</span>
              </button>
            </div>
          </div>
        ) : (
          /* Scan / Input Mode */
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <span>Kameradan Tara</span>
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Cüzdan adresini kameranızdan otomatik tarayın veya aşağıya manuel girin.
              </p>
            </div>

            {scanError && (
              <div className="p-3 rounded-xl bg-red-900/20 border border-red-900/50 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {/* HTML5 QR Code Scanner Container */}
            <div id="qr-reader" className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-black min-h-[200px]"></div>

            <form onSubmit={handleManualScanSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Veya Manuel Adres / @KullanıcıAdı Girin
                </label>
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="0x... veya @kullanici"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 font-mono focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!scanInput.trim()}
                className="w-full py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition cursor-pointer disabled:opacity-50"
              >
                Onayla
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
