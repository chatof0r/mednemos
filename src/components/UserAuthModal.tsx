import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface UserAuthModalProps {
  initialMode?: 'signup' | 'login';
  onClose: () => void;
}

const inputClass = (error: boolean) =>
  `w-full border-2 rounded-xl px-4 py-3 outline-none transition-colors bg-white/5 text-ink placeholder:text-ink/20 text-sm
   ${error ? 'border-red-400 dark:border-red-500/50' : 'border-white/15 dark:border-brand/65 focus:border-white/40 dark:focus:border-brand'}`;

export default function UserAuthModal({ initialMode = 'signup', onClose }: UserAuthModalProps) {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [niveau, setNiveau] = useState<'P2' | 'D1' | null>(null);
  const [faculte, setFaculte] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    if (step === 'form') emailRef.current?.focus();
    else codeRef.current?.focus();
  }, [step, mode]);

  const canSubmitForm = mode === 'signup'
    ? email.trim() && nom.trim() && prenom.trim() && niveau
    : email.trim();

  const sendCode = async () => {
    if (!canSubmitForm) return;
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: mode === 'signup'
        ? { shouldCreateUser: true, data: { nom: nom.trim(), prenom: prenom.trim(), niveau, faculte: faculte.trim() || null } }
        : { shouldCreateUser: false },
    });
    setLoading(false);
    if (authError) {
      setError(
        mode === 'login'
          ? "Aucun profil trouvé avec cet email. Créez-en un d'abord."
          : "Impossible d'envoyer le code, réessayez."
      );
      return;
    }
    setStep('code');
  };

  const verifyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (authError) {
      setError('Code incorrect ou expiré.');
      setCode('');
      return;
    }
    await refreshProfile();
    onClose();
    navigate('/profil');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') step === 'form' ? sendCode() : verifyCode();
    if (e.key === 'Escape') onClose();
  };

  const switchMode = (next: 'signup' | 'login') => {
    setMode(next);
    setStep('form');
    setError(null);
    setCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-brand dark:bg-charcoal border border-white/15 dark:border-brand/75 rounded-2xl shadow-2xl w-full max-w-sm p-8 transition-colors">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-white/10 border border-white/15 dark:border-brand/65 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-ink/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-ink">
            {step === 'code' ? 'Entrez le code reçu' : mode === 'signup' ? 'Créer un profil' : 'Se connecter'}
          </h2>
          <p className="text-sm text-ink/30 mt-1">
            {step === 'code'
              ? `Un code a été envoyé à ${email.trim()}`
              : mode === 'signup'
                ? 'Un code de connexion vous sera envoyé par email'
                : 'Recevez un code de connexion par email'}
          </p>
        </div>

        {step === 'form' && (
          <>
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-5">
              <button
                onClick={() => switchMode('signup')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === 'signup' ? 'bg-white dark:bg-brand text-brand dark:text-ink' : 'text-ink/50 hover:text-ink/80'
                }`}
              >
                Créer un profil
              </button>
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === 'login' ? 'bg-white dark:bg-brand text-brand dark:text-ink' : 'text-ink/50 hover:text-ink/80'
                }`}
              >
                Se connecter
              </button>
            </div>

            <div className="space-y-3">
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Email"
                autoComplete="email"
                className={inputClass(!!error)}
              />

              {mode === 'signup' && (
                <>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={prenom}
                      onChange={e => { setPrenom(e.target.value); setError(null); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Prénom"
                      autoComplete="given-name"
                      className={inputClass(!!error)}
                    />
                    <input
                      type="text"
                      value={nom}
                      onChange={e => { setNom(e.target.value); setError(null); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Nom"
                      autoComplete="family-name"
                      className={inputClass(!!error)}
                    />
                  </div>

                  <div className="flex gap-3">
                    {(['P2', 'D1'] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setNiveau(n)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                          niveau === n
                            ? 'bg-white dark:bg-brand border-white/60 dark:border-brand/95 text-brand dark:text-ink'
                            : 'bg-white/5 border-white/15 dark:border-brand/65 text-ink/60 hover:border-white/30 dark:hover:border-brand/95'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={faculte}
                    onChange={e => setFaculte(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Faculté (ville) — facultatif"
                    autoComplete="address-level2"
                    className={inputClass(false)}
                  />
                </>
              )}
            </div>

            {error && <p className="text-center text-sm text-red-300 dark:text-red-400 mt-3">{error}</p>}

            <button
              onClick={sendCode}
              disabled={!canSubmitForm || loading}
              className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30
                bg-white dark:bg-brand text-brand dark:text-ink hover:bg-white/90 dark:hover:bg-brand/80"
            >
              {loading ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              value={code}
              onChange={e => { setCode(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Code à 6 chiffres"
              autoComplete="one-time-code"
              className={`${inputClass(!!error)} text-center tracking-[0.3em]`}
            />

            {error && <p className="text-center text-sm text-red-300 dark:text-red-400 mt-3">{error}</p>}

            <button
              onClick={verifyCode}
              disabled={!code.trim() || loading}
              className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30
                bg-white dark:bg-brand text-brand dark:text-ink hover:bg-white/90 dark:hover:bg-brand/80"
            >
              {loading ? 'Vérification...' : 'Valider'}
            </button>

            <button
              onClick={() => { setStep('form'); setCode(''); setError(null); }}
              className="w-full mt-2 py-2 text-sm text-ink/30 hover:text-ink/60 transition-colors"
            >
              Changer d'email
            </button>
          </>
        )}

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
