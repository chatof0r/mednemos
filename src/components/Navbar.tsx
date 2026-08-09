import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Logo from './Logo';

interface NavbarProps {
  onLogoClick: () => void;
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  const { session, profile } = useAuth();

  return (
    <nav className="bg-brand dark:bg-charcoal border-b border-white/10 dark:border-brand/75 sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto px-4 h-20 relative flex items-center justify-end gap-4">
        <button
          onClick={onLogoClick}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 hover:opacity-80 transition-opacity"
          aria-label="À propos"
        >
          <Logo size={48} />
          <span className="font-semibold text-ink text-base hidden sm:block tracking-tight">
            MedNemos
          </span>
        </button>
        <Link
          to="/"
          className="text-sm font-medium text-ink/60 hover:text-ink transition-colors"
        >
          Accueil
        </Link>
        <Link
          to="/profil"
          className="text-sm font-medium text-ink/60 hover:text-ink transition-colors"
        >
          {session ? (profile?.prenom || 'Mon profil') : 'Se connecter'}
        </Link>
      </div>
    </nav>
  );
}
