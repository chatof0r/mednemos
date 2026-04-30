import { Link } from 'react-router-dom';

interface NavbarProps {
  onLogoClick: () => void;
}

export default function Navbar({ onLogoClick }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label="À propos"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="font-semibold text-slate-800 text-sm hidden sm:block">MedNemos</span>
        </button>
        <Link
          to="/"
          className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          Accueil
        </Link>
      </div>
    </nav>
  );
}
