import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminQuestions from './admin/AdminQuestions';
import AdminSuggestions from './admin/AdminSuggestions';

type Tab = 'questions' | 'suggestions';

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('questions');

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    navigate('/');
  };

  if (sessionStorage.getItem('admin_auth') !== 'true') return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Administration</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestion des questions et suggestions</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-8 w-fit">
        {([
          { key: 'questions', label: 'Questions' },
          { key: 'suggestions', label: 'Suggestions' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'questions' && <AdminQuestions />}
        {tab === 'suggestions' && <AdminSuggestions />}
      </div>
    </div>
  );
}
