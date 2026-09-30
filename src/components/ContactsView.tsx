import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Send,
  Check,
  Copy,
  AlertCircle,
  Coins
} from 'lucide-react';
import type { UserContact } from '../blockchain/types.ts';
import { ADD_CONTACT_FEE } from '../blockchain/constants.ts';

interface ContactsViewProps {
  contacts: UserContact[];
  onAddContact: (targetQuery: string) => Promise<void>;
  onSendToContact: (target: string) => void;
  isAdding: boolean;
  userBalance: number;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onAddContact,
  onSendToContact,
  isAdding,
  userBalance,
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [targetInput, setTargetInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = targetInput.trim();
    if (!clean) {
      setError('Lütfen bir adres veya @kullanıcı_adı girin.');
      return;
    }

    if (userBalance < ADD_CONTACT_FEE) {
      setError(`Yetersiz bakiye! Arkadaş ekleme için ${ADD_CONTACT_FEE} Coin ağ ücreti gereklidir. Mevcut: ${userBalance} Coin.`);
      return;
    }

    try {
      await onAddContact(clean);
      setTargetInput('');
      setShowAddModal(false);
    } catch (err: any) {
      setError(err.message || 'Arkadaş eklenemedi.');
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              Rehber
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                {contacts.length}
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              Sık etkileşimde bulunduğunuz adresler
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-emerald-400" />
          <span>Kişi Ekle (0.01)</span>
        </button>
      </div>

      {/* Contacts List */}
      {contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <div
              key={contact.contactAddress}
              className="p-5 rounded-2xl bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {contact.nickname ? `@${contact.nickname}` : 'İsimsiz'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      Onaylı
                    </span>
                  </div>
                  <p className="font-mono text-xs text-zinc-500 mt-1 truncate select-all">
                    {contact.contactAddress}
                  </p>
                </div>

                <button
                  onClick={() => handleCopy(contact.contactAddress)}
                  className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer flex-shrink-0"
                  title="Adresi Kopyala"
                >
                  {copiedAddress === contact.contactAddress ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
                <span className="text-[11px] text-zinc-500">
                  {new Date(contact.addedAt).toLocaleDateString('tr-TR')}
                </span>

                <button
                  onClick={() => onSendToContact(contact.nickname ? `@${contact.nickname}` : contact.contactAddress)}
                  className="px-4 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gönder</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/30">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-white mb-2">Rehberiniz Boş</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-6">
            Sık para transferi yaptığınız adresleri ekleyerek daha hızlı işlem yapın.
          </p>
          <button
            onClick={() => {
              setError(null);
              setShowAddModal(true);
            }}
            className="px-6 py-2.5 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition inline-flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Kişi Ekle</span>
          </button>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <UserPlus className="w-5 h-5 ml-0.5" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Kişi Ekle</h3>
                <p className="text-xs text-zinc-500">
                  Blokzinciri rehberine ekle
                </p>
              </div>
            </div>

            {/* Protocol Fee Notice */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
              <Coins className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-zinc-300">İşlem Ücreti: {ADD_CONTACT_FEE} COIN</p>
                <p className="text-zinc-500 leading-relaxed">
                  Bu ücret ağın güvenliğini sağlamak için doğrudan ekosisteme geri döndürülür.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-900/20 border border-red-900/50 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Adres veya @KullanıcıAdı
                </label>
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="0x... veya @kullanici"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-zinc-200 font-mono focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900 transition-colors"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-sm font-medium rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !targetInput.trim()}
                  className="px-6 py-2.5 text-sm font-medium rounded-full bg-emerald-500 hover:bg-emerald-400 text-black transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <UserPlus className={`w-4 h-4 ${isAdding ? 'animate-spin' : ''}`} />
                  <span>{isAdding ? 'Ekleniyor...' : 'Ekle'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
