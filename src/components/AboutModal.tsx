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
      <div className="bg-brand dark:bg-charcoal border border-white/15 dark:border-brand/40 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-colors">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <Logo size={36} />
              <div>
                <h2 className="text-lg font-semibold text-ink">MedNemos</h2>
                <p className="text-xs text-ink/40">Annales médicales P2 · D1</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-ink/30 hover:text-ink/60 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Theme toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-white/15 dark:border-brand/30 mb-5">
            <span className="text-sm text-ink/60">
              {isDark ? 'Mode sombre' : 'Mode clair'}
            </span>
            <button
              onClick={toggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isDark ? 'bg-brand/50' : 'bg-white/20'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                isDark
                  ? 'left-5.5 bg-brand translate-x-0.5'
                  : 'left-0.5 bg-white shadow'
              }`} />
            </button>
          </div>

          {/* Disclaimer */}
          <div className="bg-white/5 border border-white/15 dark:border-brand/30 rounded-xl p-4 mb-6 text-sm space-y-2">
            <p className="font-medium text-ink/80">Disclaimer</p>
            <p className="text-ink/50 text-xs leading-relaxed">
              Site à usage <strong className="text-ink/70">académique uniquement</strong>. Partage entre étudiants en médecine (P2 · D1).
            </p>
            <ul className="space-y-1 mt-2">
              {['Aucune donnée personnelle collectée', 'Aucun bénéfice commercial', 'Contenu partagé entre étudiants'].map(t => (
                <li key={t} className="flex items-center gap-2 text-xs text-ink/40">
                  <svg className="w-3.5 h-3.5 text-white dark:text-brand shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggestion */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-ink/70 mb-2">
              Une suggestion ?
            </label>
            <textarea
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              placeholder="Erreur dans une question, matière manquante, idée d'amélioration..."
              rows={3}
              className="w-full border border-white/15 dark:border-brand/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-white/40 dark:focus:border-brand/60 bg-white/5 text-ink placeholder:text-ink/20 resize-none transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={sending || !suggestion.trim()}
              className="mt-2 w-full py-2 px-4 bg-white dark:bg-brand text-brand dark:text-ink rounded-xl text-sm font-medium hover:bg-white/90 dark:hover:bg-brand/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Envoi...' : sent ? '✓ Envoyé !' : 'Envoyer'}
            </button>
          </div>

          {/* Admin */}
          <div className="border-t border-white/10 dark:border-brand/20 pt-4">
            <button
              onClick={() => { onClose(); onAdminClick(); }}
              className="w-full py-2 px-4 border border-white/15 dark:border-brand/30 rounded-xl text-sm text-ink/40 hover:text-ink/70 hover:border-white/30 dark:hover:border-brand/60 transition-colors flex items-center justify-center gap-2"
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
