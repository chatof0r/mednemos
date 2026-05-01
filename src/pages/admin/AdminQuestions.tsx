import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Question } from '../../types';
import QuestionForm from './QuestionForm';

type View = 'list' | 'create' | 'edit';

export default function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<Question | null>(null);
  const [lastSaved, setLastSaved] = useState<Question | null>(null);
  const [prefill, setPrefill] = useState<Partial<Question> | null>(null);

  // Filters
  const [filterNiveau, setFilterNiveau] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatut, setFilterStatut] = useState<string | null>(null);
  const [filterMatiere, setFilterMatiere] = useState<string | null>(null);
  const [filterCours, setFilterCours] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('annee', { ascending: false, nullsFirst: false })
      .order('session', { ascending: true, nullsFirst: false })
      .order('numero_officiel', { ascending: true, nullsFirst: false });
    if (error) console.error('load error:', error);
    setQuestions((data ?? []) as Question[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Derived lists for filter options
  const allMatieres = useMemo(() =>
    [...new Set(questions.map(q => q.matiere))].sort(), [questions]);

  const allCours = useMemo(() =>
    [...new Set(questions.flatMap(q => q.cours ?? []))].sort(), [questions]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette question définitivement ?')) return;
    await supabase.from('questions').delete().eq('id', id);
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleSaved = (q: Question) => {
    setLastSaved(q);
    setView('list');
    setEditing(null);
    setPrefill(null);
    load();
  };

  const handleAddAnother = () => {
    if (!lastSaved) return;
    setPrefill({ niveau: lastSaved.niveau, matiere: lastSaved.matiere, cours: lastSaved.cours, annee: lastSaved.annee });
    setLastSaved(null);
    setView('create');
  };

  const startEdit = (q: Question) => {
    setEditing(q);
    setLastSaved(null);
    setView('edit');
  };

  const startCreate = () => {
    setEditing(null);
    setLastSaved(null);
    setPrefill(null);
    setView('create');
  };

  const clearAll = () => {
    setFilterNiveau(null);
    setFilterType(null);
    setFilterStatut(null);
    setFilterMatiere(null);
    setFilterCours(null);
  };

  const hasFilter = filterNiveau || filterType || filterStatut || filterMatiere || filterCours;

  const filtered = questions.filter(q => {
    if (filterNiveau && q.niveau !== filterNiveau) return false;
    if (filterType && q.type !== filterType) return false;
    if (filterStatut && q.statut !== filterStatut) return false;
    if (filterMatiere && q.matiere !== filterMatiere) return false;
    if (filterCours && !(q.cours ?? []).includes(filterCours)) return false;
    return true;
  });

  if (view === 'create' || view === 'edit') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setView('list'); setEditing(null); setPrefill(null); }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-slate-800">
            {view === 'edit' ? 'Modifier la question' : 'Nouvelle question'}
          </h2>
        </div>
        <QuestionForm
          initial={view === 'edit' && editing ? editing : prefill ? (prefill as Question) : undefined}
          onSaved={handleSaved}
          onCancel={() => { setView('list'); setEditing(null); setPrefill(null); }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Questions
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({filtered.length}{filtered.length !== questions.length ? `/${questions.length}` : ''})
          </span>
        </h2>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle question
        </button>
      </div>

      {/* Success banner */}
      {lastSaved && (
        <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-sm text-green-700">
            Question {lastSaved.statut === 'publiee' ? 'publiée' : 'sauvegardée'} avec succès
          </span>
          <button
            onClick={handleAddAnother}
            className="text-sm font-medium text-green-700 hover:text-green-900 transition-colors underline underline-offset-2"
          >
            + Ajouter une question à la suite
          </button>
        </div>
      )}

      {/* Filtres */}
      {!loading && questions.length > 0 && (
        <div className="space-y-2 mb-4">
          {/* Row 1 : Niveau / Type / Statut */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 w-12 shrink-0">Niveau</span>
            {(['P2', 'D1'] as const).map(n => (
              <button key={n} onClick={() => setFilterNiveau(filterNiveau === n ? null : n)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterNiveau === n
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-slate-100 text-slate-500 border border-transparent hover:border-slate-200'
                }`}>{n}</button>
            ))}
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <span className="text-xs text-slate-400">Type</span>
            {(['QCM', 'QRU'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(filterType === t ? null : t)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterType === t
                    ? 'bg-violet-100 text-violet-700 border border-violet-300'
                    : 'bg-slate-100 text-slate-500 border border-transparent hover:border-slate-200'
                }`}>{t}</button>
            ))}
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <span className="text-xs text-slate-400">Statut</span>
            {[{ v: 'publiee', l: 'Publiée' }, { v: 'brouillon', l: 'Brouillon' }].map(s => (
              <button key={s.v} onClick={() => setFilterStatut(filterStatut === s.v ? null : s.v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterStatut === s.v
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-slate-100 text-slate-500 border border-transparent hover:border-slate-200'
                }`}>{s.l}</button>
            ))}
            {hasFilter && (
              <button onClick={clearAll}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors ml-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Effacer tout
              </button>
            )}
          </div>

          {/* Row 2 : Matière */}
          {allMatieres.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 w-12 shrink-0">Matière</span>
              {allMatieres.map(m => (
                <button key={m} onClick={() => { setFilterMatiere(filterMatiere === m ? null : m); setFilterCours(null); }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors max-w-[180px] truncate ${
                    filterMatiere === m
                      ? 'bg-orange-100 text-orange-700 border border-orange-300'
                      : 'bg-slate-100 text-slate-500 border border-transparent hover:border-slate-200'
                  }`}>{m}</button>
              ))}
            </div>
          )}

          {/* Row 3 : Cours (dynamique selon matière sélectionnée ou tous) */}
          {allCours.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 w-12 shrink-0">Cours</span>
              {(filterMatiere
                ? [...new Set(questions.filter(q => q.matiere === filterMatiere).flatMap(q => q.cours ?? []))].sort()
                : allCours
              ).map(c => (
                <button key={c} onClick={() => setFilterCours(filterCours === c ? null : c)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors max-w-[200px] truncate ${
                    filterCours === c
                      ? 'bg-teal-100 text-teal-700 border border-teal-300'
                      : 'bg-slate-100 text-slate-500 border border-transparent hover:border-slate-200'
                  }`}>{c}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Chargement...</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm mb-3">Aucune question pour l'instant</p>
          <button onClick={startCreate} className="text-blue-600 text-sm font-medium hover:underline">
            Créer la première question
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Niveau</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Matière</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Cours</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Année</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Type</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Statut</th>
                <th className="text-right text-xs font-medium text-slate-400 pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(q => (
                <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                      q.niveau === 'P2' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>{q.niveau}</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-700 max-w-[160px] truncate">{q.matiere}</td>
                  <td className="py-3 pr-4 text-slate-500 max-w-[160px] truncate">{q.cours?.join(', ') ?? '—'}</td>
                  <td className="py-3 pr-4 text-slate-500">
                    {q.annee ? `${q.annee}${q.session ? `.${q.session}` : ''}` : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                      q.type === 'QCM' ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
                    }`}>{q.type}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                      q.statut === 'publiee' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {q.statut === 'publiee' ? 'Publiée' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => startEdit(q)}
                      className="text-slate-400 hover:text-blue-600 transition-colors mr-3"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
