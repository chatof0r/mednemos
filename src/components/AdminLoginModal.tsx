import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AdminLoginModalProps {
  onClose: () => void;
}

export default function AdminLoginModal({ onClose }: AdminLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const login = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError('Identifiants incorrects');
      setPassword('');
      return;
    }
    onClose();
    navigate('/admin');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') login();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-brand dark:bg-charcoal border border-white/15 dark:border-brand/40 rounded-2xl shadow-2xl w-full max-w-sm p-8 transition-colors">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-white/10 border border-white/15 dark:border-brand/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-ink/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-ink">Espace administrateur</h2>
          <p className="text-sm text-ink/30 mt-1">Connectez-vous pour continuer</p>
        </div>

        <div className="space-y-3">
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Email"
            autoComplete="username"
            className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition-colors bg-white/5 text-ink placeholder:text-ink/20 text-sm
              ${error ? 'border-red-400 dark:border-red-500/50' : 'border-white/15 dark:border-brand/30 focus:border-white/40 dark:focus:border-brand/70'}`}
          />
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Mot de passe"
            autoComplete="current-password"
            className={`w-full border-2 rounded-xl px-4 py-3 outline-none transition-colors bg-white/5 text-ink placeholder:text-ink/20 text-sm
              ${error ? 'border-red-400 dark:border-red-500/50' : 'border-white/15 dark:border-brand/30 focus:border-white/40 dark:focus:border-brand/70'}`}
          />
        </div>

        {error && (
          <p className="text-center text-sm text-red-300 dark:text-red-400 mt-3">{error}</p>
        )}

        <button
          onClick={login}
          disabled={!email.trim() || !password || loading}
          className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30
            bg-white dark:bg-brand
            text-brand dark:text-ink
            hover:bg-white/90 dark:hover:bg-brand/80"
        >
          {loading ? 'Connexion...' : 'Accéder'}
        </button>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-sm text-ink/30 hover:text-ink/60 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
