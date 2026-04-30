import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Question } from '../types';

type Niveau = 'P2' | 'D1';
type Order = 'official' | 'random';

export default function Home() {
  const navigate = useNavigate();

  const [selectedNiveau, setSelectedNiveau] = useState<Niveau | null>(null);
  const [matieres, setMatieres] = useState<string[]>([]);
  const [selectedMatiere, setSelectedMatiere] = useState<string | null>(null);
  const [coursList, setCoursList] = useState<string[]>([]);
  const [selectedCours, setSelectedCours] = useState<string>('Tous');
  const [annees, setAnnees] = useState<number[]>([]);
  const [selectedAnnee, setSelectedAnnee] = useState<string>('Toutes');
  const [order, setOrder] = useState<Order>('official');
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!selectedNiveau) return;
    setLoading(true);
    setSelectedMatiere(null);
    setSelectedCours('Tous');
    setSelectedAnnee('Toutes');
    setMatieres([]);
    supabase
      .from('questions')
      .select('matiere')
      .eq('niveau', selectedNiveau)
      .eq('statut', 'publiee')
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { matiere: string }) => r.matiere))].sort();
        setMatieres(unique);
        setLoading(false);
      });
  }, [selectedNiveau]);

  useEffect(() => {
    if (!selectedMatiere || !selectedNiveau) return;
    setSelectedCours('Tous');
    setSelectedAnnee('Toutes');

    Promise.all([
      supabase
        .from('questions')
        .select('cours')
        .eq('niveau', selectedNiveau)
        .eq('matiere', selectedMatiere)
        .eq('statut', 'publiee')
        .not('cours', 'is', null),
      supabase
        .from('questions')
        .select('annee')
        .eq('niveau', selectedNiveau)
        .eq('matiere', selectedMatiere)
        .eq('statut', 'publiee')
        .not('annee', 'is', null),
    ]).then(([coursRes, anneeRes]) => {
      const uniqueCours = [...new Set((coursRes.data ?? []).map((r: { cours: string }) => r.cours))]
        .filter(Boolean)
        .sort() as string[];
      const uniqueAnnees = [...new Set((anneeRes.data ?? []).map((r: { annee: number }) => r.annee))]
        .filter(Boolean)
        .sort((a, b) => b - a) as number[];
      setCoursList(uniqueCours);
      setAnnees(uniqueAnnees);
    });
  }, [selectedMatiere, selectedNiveau]);

  const handleLaunch = async () => {
    if (!selectedNiveau || !selectedMatiere) return;
    setLaunching(true);

    let query = supabase
      .from('questions')
      .select('*')
      .eq('niveau', selectedNiveau)
      .eq('matiere', selectedMatiere)
      .eq('statut', 'publiee');

    if (selectedCours !== 'Tous') query = query.eq('cours', selectedCours);
    if (selectedAnnee !== 'Toutes') query = query.eq('annee', parseInt(selectedAnnee));

    const { data } = await query;
    const questions = (data ?? []) as Question[];

    if (questions.length === 0) {
      alert('Aucune question disponible pour cette sélection.');
      setLaunching(false);
      return;
    }

    navigate('/session', { state: { questions, order } });
  };

  const canLaunch = selectedNiveau !== null && selectedMatiere !== null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">MedNemos</h1>
        <p className="text-slate-500">Entraîne-toi sur les questions des examens passés</p>
      </div>

      {/* Step 1: Niveau */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          1. Choisir le niveau
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {(['P2', 'D1'] as Niveau[]).map(n => (
            <button
              key={n}
              onClick={() => setSelectedNiveau(n)}
              className={`relative rounded-2xl p-6 text-left transition-all border-2 ${
                selectedNiveau === n
                  ? n === 'P2'
                    ? 'border-blue-500 bg-blue-600'
                    : 'border-indigo-500 bg-indigo-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`text-3xl font-bold mb-1 ${selectedNiveau === n ? 'text-white' : 'text-slate-700'}`}>
                {n}
              </div>
              <div className={`text-sm ${selectedNiveau === n ? 'text-blue-100' : 'text-slate-500'}`}>
                {n === 'P2' ? 'Deuxième année' : 'Première année de DFASM'}
              </div>
              {selectedNiveau === n && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Matière */}
      {selectedNiveau && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            2. Choisir la matière
          </h2>
          {loading ? (
            <div className="text-sm text-slate-400 py-4 text-center">Chargement...</div>
          ) : matieres.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 text-center">Aucune question disponible pour ce niveau</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {matieres.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMatiere(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                    selectedMatiere === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Steps 3 & 4: Cours + Année */}
      {selectedMatiere && (
        <div className="mb-8 grid sm:grid-cols-2 gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              3. Cours <span className="font-normal normal-case text-slate-300">(optionnel)</span>
            </h2>
            <select
              value={selectedCours}
              onChange={e => setSelectedCours(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="Tous">Tous les cours</option>
              {coursList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              4. Année <span className="font-normal normal-case text-slate-300">(optionnel)</span>
            </h2>
            <select
              value={selectedAnnee}
              onChange={e => setSelectedAnnee(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="Toutes">Toutes les années</option>
              {annees.map(a => (
                <option key={a} value={String(a)}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 5: Ordre */}
      {selectedMatiere && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            5. Ordre des questions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOrder('official')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                order === 'official'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-semibold mb-0.5 ${order === 'official' ? 'text-blue-700' : 'text-slate-700'}`}>
                Ordre officiel
              </div>
              <div className="text-xs text-slate-500">Questions dans l'ordre de l'examen</div>
            </button>
            <button
              onClick={() => setOrder('random')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                order === 'random'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-semibold mb-0.5 ${order === 'random' ? 'text-blue-700' : 'text-slate-700'}`}>
                Mélangé
              </div>
              <div className="text-xs text-slate-500">Ordre aléatoire — dossiers progressifs conservés</div>
            </button>
          </div>
        </div>
      )}

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={!canLaunch || launching}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
      >
        {launching ? 'Chargement...' : 'Lancer la session →'}
      </button>
    </div>
  );
}
