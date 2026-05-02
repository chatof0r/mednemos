import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dossier } from '../../types';
import DossierForm from './DossierForm';

type View = 'list' | 'create' | 'edit';

export default function AdminDossiers() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [qCounts, setQCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<Dossier | null>(null);
  const [lastSaved, setLastSaved] = useState<Dossier | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: dossierData }, { data: qData }] = await Promise.all([
      supabase
        .from('dossiers')
        .select('*')
        .order('annee', { ascending: false, nullsFirst: false })
        .order('numero_officiel', { ascending: true, nullsFirst: false }),
      supabase
        .from('questions')
        .select('dossier_id')
        .not('dossier_id', 'is', null),
    ]);

    setDossiers((dossierData ?? []) as Dossier[]);

    // Compter les questions par dossier
    const counts: Record<string, number> = {};
    for (const q of (qData ?? []) as { dossier_id: string }[]) {
      if (q.dossier_id) counts[q.dossier_id] = (counts[q.dossier_id] ?? 0) + 1;
    }
    setQCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce dossier et toutes ses questions ?')) return;
    // Les questions sont supprimées en cascade (SET NULL) mais on veut aussi les supprimer
    await supabase.from('questions').delete().eq('dossier_id', id);
    await supabase.from('dossiers').delete().eq('id', id);
    setDossiers(prev => prev.filter(d => d.id !== id));
    setQCounts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSaved = (d: Dossier) => {
    setLastSaved(d);
    setView('list');
    setEditing(null);
    load();
  };

  const startEdit = (d: Dossier) => {
    setEditing(d);
    setLastSaved(null);
    setView('edit');
  };

  const startCreate = () => {
    setEditing(null);
    setLastSaved(null);
    setView('create');
  };

  if (view === 'create' || view === 'edit') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setView('list'); setEditing(null); }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-slate-800">
            {view === 'edit' ? 'Modifier le dossier' : 'Nouveau dossier progressif'}
          </h2>
        </div>
        <DossierForm
          initial={view === 'edit' && editing ? editing : undefined}
          onSaved={handleSaved}
          onCancel={() => { setView('list'); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Dossiers progressifs
          <span className="ml-2 text-sm font-normal text-slate-400">({dossiers.length})</span>
        </h2>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau dossier
        </button>
      </div>

      {/* Success banner */}
      {lastSaved && (
        <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-sm text-green-700">
            Dossier «{lastSaved.titre}» {lastSaved.statut === 'publiee' ? 'publié' : 'sauvegardé'} avec succès
          </span>
          <button onClick={() => setLastSaved(null)} className="text-green-400 hover:text-green-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Chargement...</div>
      ) : dossiers.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm mb-3">Aucun dossier progressif</p>
          <button onClick={startCreate} className="text-blue-600 text-sm font-medium hover:underline">
            Créer le premier dossier
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {dossiers.map(d => {
            const shortYear = d.annee ? String(d.annee).slice(-2) : null;
            const ref = d.numero_officiel && d.annee
              ? `DP${d.numero_officiel} / ${shortYear}${d.session ? `.${d.session}` : ''}`
              : d.annee ? `${d.annee}${d.session ? `.${d.session}` : ''}` : null;
            const qCount = qCounts[d.id] ?? 0;

            return (
              <div key={d.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors">
                {/* Ref */}
                <span className="text-xs font-mono text-slate-500 w-20 shrink-0">{ref ?? '—'}</span>

                {/* Titre */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{d.titre}</p>
                  <p className="text-xs text-slate-400">
                    {d.niveau} · {d.matiere}
                    {d.source === 'ronéo' && <span className="ml-1 text-purple-500">· Ronéo</span>}
                  </p>
                </div>

                {/* Q count */}
                <span className="text-xs text-slate-400 shrink-0">{qCount} question{qCount !== 1 ? 's' : ''}</span>

                {/* Type + Statut */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${
                  d.statut === 'publiee' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {d.statut === 'publiee' ? 'Publié' : 'Brouillon'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(d)}
                    className="text-slate-400 hover:text-blue-600 transition-colors" title="Modifier">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(d.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors" title="Supprimer">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
