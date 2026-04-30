import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Suggestion } from '../../types';

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    setSuggestions((data ?? []) as Suggestion[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await supabase.from('suggestions').update({ lu: true }).eq('id', id);
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, lu: true } : s));
  };

  const deleteOne = async (id: string) => {
    await supabase.from('suggestions').delete().eq('id', id);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const unread = suggestions.filter(s => !s.lu).length;

  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Suggestions
          {unread > 0 && (
            <span className="ml-2 text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
              {unread} non lue{unread > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <button
          onClick={load}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Actualiser
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Aucune suggestion pour l'instant
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => (
            <div
              key={s.id}
              className={`p-4 rounded-xl border transition-all ${
                s.lu ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className={`text-sm flex-1 ${s.lu ? 'text-slate-400' : 'text-slate-700'}`}>
                  {s.message}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {!s.lu && (
                    <button
                      onClick={() => markRead(s.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors whitespace-nowrap"
                    >
                      Marquer lu
                    </button>
                  )}
                  <button
                    onClick={() => deleteOne(s.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {new Date(s.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
