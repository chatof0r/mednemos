import { Link } from 'react-router-dom';
import Logo from './Logo';

interface NavbarProps {
  onLogoClick: () => void;
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  return (
    <nav className="bg-white dark:bg-[#0c0c0c] border-b border-slate-200 dark:border-white/10 sticky top-0 z-40 transition-colors">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          aria-label="À propos"
        >
          <Logo size={32} />
          <span className="font-semibold text-slate-800 dark:text-white text-sm hidden sm:block tracking-tight">
            MedNemos
          </span>
        </button>
        <Link
          to="/"
          className="text-sm font-medium text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          Accueil
        </Link>
      </div>
    </nav>
  );
}
