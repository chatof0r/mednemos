import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import Logo from './Logo';

interface AboutModalProps {
  onClose: () => void;
  onAdminClick: () => void;
}

export default function AboutModal({ onClose, onAdminClick }: AboutModalProps) {
  const { isDark, toggle } = useTheme();
  const [suggestion, setSuggestion] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!suggestion.trim()) return;
    setSending(true);
    await supabase.from('suggestions').insert({ message: suggestion.trim() });
    setSending(false);
    setSent(true);
    setSuggestion('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-colors">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <Logo size={36} />
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">MedNemos</h2>
                <p className="text-xs text-slate-400 dark:text-white/40">Annales médicales P2 · D1</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Theme toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 mb-5">
            <span className="text-sm text-slate-600 dark:text-white/60">
              {isDark ? 'Mode sombre' : 'Mode clair'}
            </span>
            <button
              onClick={toggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isDark ? 'bg-[#e3fe52]/40' : 'bg-slate-200'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                isDark
                  ? 'left-5.5 bg-[#e3fe52] translate-x-0.5'
                  : 'left-0.5 bg-white shadow'
              }`} />
            </button>
          </div>

          {/* Disclaimer */}
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 mb-6 text-sm space-y-2">
            <p className="font-medium text-slate-700 dark:text-white/80">Disclaimer</p>
            <p className="text-slate-600 dark:text-white/50 text-xs leading-relaxed">
              Site à usage <strong className="text-slate-700 dark:text-white/70">académique uniquement</strong>. Partage entre étudiants en médecine (P2 · D1).
            </p>
            <ul className="space-y-1 mt-2">
              {['Aucune donnée personnelle collectée', 'Aucun bénéfice commercial', 'Contenu partagé entre étudiants'].map(t => (
                <li key={t} className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/40">
                  <svg className="w-3.5 h-3.5 text-[#e3fe52] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggestion */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
              Une suggestion ?
            </label>
            <textarea
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              placeholder="Erreur dans une question, matière manquante, idée d'amélioration..."
              rows={3}
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#e3fe52]/50 bg-white dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20 resize-none transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={sending || !suggestion.trim()}
              className="mt-2 w-full py-2 px-4 bg-slate-800 dark:bg-[#e3fe52]/10 border border-transparent dark:border-[#e3fe52]/30 text-white dark:text-[#e3fe52]/80 rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-[#e3fe52]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Envoi...' : sent ? '✓ Envoyé !' : 'Envoyer'}
            </button>
          </div>

          {/* Admin */}
          <div className="border-t border-slate-100 dark:border-white/8 pt-4">
            <button
              onClick={() => { onClose(); onAdminClick(); }}
              className="w-full py-2 px-4 border border-slate-200 dark:border-white/15 rounded-xl text-sm text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70 hover:border-slate-300 dark:hover:border-white/30 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Administrateur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
