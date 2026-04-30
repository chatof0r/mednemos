import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface AboutModalProps {
  onClose: () => void;
  onAdminClick: () => void;
}

export default function AboutModal({ onClose, onAdminClick }: AboutModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">À propos</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Disclaimer */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-slate-700 space-y-2">
            <p className="font-medium text-blue-800">Disclaimer</p>
            <p>Ce site est destiné à un usage <strong>académique uniquement</strong>. Il s'agit d'un espace de partage entre étudiants en médecine (P2 et D1) pour s'entraîner sur des annales d'examens passés.</p>
            <ul className="space-y-1 mt-2">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                Aucune donnée personnelle collectée
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                Aucun bénéfice commercial
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                Contenu partagé entre étudiants, aucun droit réservé
              </li>
            </ul>
          </div>

          {/* Suggestion */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Une suggestion ?
            </label>
            <textarea
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              placeholder="Erreur dans une question, matière manquante, idée d'amélioration..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !suggestion.trim()}
              className="mt-2 w-full py-2 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? 'Envoi...' : sent ? '✓ Envoyé !' : 'Envoyer'}
            </button>
          </div>

          {/* Admin button */}
          <div className="border-t border-slate-100 pt-4">
            <button
              onClick={() => { onClose(); onAdminClick(); }}
              className="w-full py-2 px-4 border border-slate-200 rounded-xl text-sm text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors flex items-center justify-center gap-2"
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
