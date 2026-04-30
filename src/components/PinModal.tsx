import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PinModalProps {
  onClose: () => void;
}

export default function PinModal({ onClose }: PinModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const checkPin = () => {
    const correct = import.meta.env.VITE_ADMIN_PIN;
    if (value === correct) {
      sessionStorage.setItem('admin_auth', 'true');
      onClose();
      navigate('/admin');
    } else {
      setError(true);
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') checkPin();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-8 transition-colors">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-slate-500 dark:text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Espace administrateur</h2>
          <p className="text-sm text-slate-400 dark:text-white/30 mt-1">Entrez votre code d'accès</p>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={handleKeyDown}
          placeholder="Code d'accès"
          className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition-colors bg-white dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/20 text-sm
            ${error
              ? 'border-red-400 dark:border-red-500/50'
              : 'border-slate-200 dark:border-white/10 focus:border-[#e3fe52]/60 dark:focus:border-[#e3fe52]/40'
            }`}
        />

        {error && (
          <p className="text-center text-sm text-red-500 dark:text-red-400/80 mt-3">Code incorrect</p>
        )}

        <button
          onClick={checkPin}
          disabled={!value.trim()}
          className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30
            bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 border border-transparent dark:border-[#e3fe52]/50
            text-[#0c0c0c] dark:text-[#0c0c0c]
            hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65"
        >
          Accéder
        </button>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-sm text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
