import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import UserAuthModal from '../components/UserAuthModal';

const inputClass =
  'w-full border-2 rounded-xl px-4 py-3 outline-none transition-colors bg-white/5 text-ink placeholder:text-ink/20 text-sm border-white/15 dark:border-brand/65 focus:border-white/40 dark:focus:border-brand';

export default function Profile() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [niveau, setNiveau] = useState<'P2' | 'D1' | null>(null);
  const [faculte, setFaculte] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setPrenom(profile.prenom ?? '');
      setNom(profile.nom ?? '');
      setNiveau(profile.niveau);
      setFaculte(profile.faculte ?? '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ prenom: prenom.trim(), nom: nom.trim(), niveau, faculte: faculte.trim() || null })
      .eq('id', session.user.id);
    setSaving(false);
    setSaved(true);
    await refreshProfile();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return null;

  if (!session) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink mb-2">Aucun profil</h1>
        <p className="text-sm text-ink/40 mb-6">Créez un profil ou connectez-vous pour accéder à cette page.</p>
        <button
          onClick={() => setShowAuth(true)}
          className="py-2.5 px-6 rounded-xl font-semibold text-sm bg-white dark:bg-brand text-brand dark:text-ink hover:bg-white/90 dark:hover:bg-brand/80 transition-colors"
        >
          Créer un profil / Se connecter
        </button>
        {showAuth && <UserAuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-10">
      <h1 className="text-xl font-semibold text-ink mb-1">Mon profil</h1>
      <p className="text-sm text-ink/40 mb-6">{profile?.email ?? session.user.email}</p>

      <div className="space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            placeholder="Prénom"
            className={inputClass}
          />
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Nom"
            className={inputClass}
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
          placeholder="Faculté (ville)"
          className={inputClass}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30
          bg-white dark:bg-brand text-brand dark:text-ink hover:bg-white/90 dark:hover:bg-brand/80"
      >
        {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer'}
      </button>

      <button
        onClick={handleLogout}
        className="w-full mt-2 py-2 text-sm text-ink/30 hover:text-ink/60 transition-colors"
      >
        Déconnexion
      </button>
    </div>
  );
}
