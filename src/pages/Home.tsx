import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Question } from '../types';

type Niveau = 'P2' | 'D1';
type Order = 'official' | 'random';
type Sem = 'S1' | 'S2';

// Curriculum prédéfini par semestre
const CURRICULUM: Record<Niveau, Record<Sem, string[]>> = {
  P2: {
    S1: ['Cardiologie', 'Pneumologie', 'Nutrition', 'Pharmacologie', 'Hémato'],
    S2: ['Appareil Locomoteur', 'Dermatologie', 'Tête et cou', 'Immunologie', 'Biopathologie'],
  },
  D1: {
    S1: ['Appareil digestif', 'Génétique / Pédiatrie', 'SSH', 'Hormonologie', 'Neurosensoriel'],
    S2: ['Néphrologie', 'AEM', 'Sémiologie écrite', 'Infectiologie', 'Psychiatrie'],
  },
};

function getCurrentPeriod(): Sem | 'all' {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m >= 9 || (m === 1 && day === 1)) return 'S1';
  if ((m === 1 && day >= 2) || (m >= 2 && m <= 4) || (m === 5 && day <= 10)) return 'S2';
  return 'all';
}

export default function Home() {
  const navigate = useNavigate();
  const period = getCurrentPeriod();

  const [selectedNiveau, setSelectedNiveau] = useState<Niveau | null>(null);
  const [viewSem, setViewSem] = useState<Sem>(period === 'S2' ? 'S2' : 'S1');
  const [selectedMatiere, setSelectedMatiere] = useState<string | null>(null);
  const [coursList, setCoursList] = useState<string[]>([]);
  const [selectedCours, setSelectedCours] = useState<string>('Tous');
  const [annees, setAnnees] = useState<number[]>([]);
  const [selectedAnnee, setSelectedAnnee] = useState<string>('Toutes');
  const [order, setOrder] = useState<Order>('official');
  const [launching, setLaunching] = useState(false);

  // Matières affichées selon le semestre courant
  const getDisplayedMatieres = (niveau: Niveau): string[] => {
    if (period === 'all') return [...CURRICULUM[niveau].S1, ...CURRICULUM[niveau].S2];
    return CURRICULUM[niveau][viewSem];
  };

  // Charge cours et années dès qu'une matière est sélectionnée
  useEffect(() => {
    if (!selectedMatiere || !selectedNiveau) return;
    setSelectedCours('Tous');
    setSelectedAnnee('Toutes');
    Promise.all([
      supabase
        .from('questions').select('cours')
        .eq('niveau', selectedNiveau).eq('matiere', selectedMatiere)
        .eq('statut', 'publiee').not('cours', 'is', null),
      supabase
        .from('questions').select('annee')
        .eq('niveau', selectedNiveau).eq('matiere', selectedMatiere)
        .eq('statut', 'publiee').not('annee', 'is', null),
    ]).then(([c, a]) => {
      setCoursList([...new Set((c.data ?? []).map((r: { cours: string }) => r.cours))].filter(Boolean).sort() as string[]);
      setAnnees([...new Set((a.data ?? []).map((r: { annee: number }) => r.annee))].filter(Boolean).sort((x, y) => y - x) as number[]);
    });
  }, [selectedMatiere, selectedNiveau]);

  // Réinitialise la matière si on change de semestre affiché
  const switchSem = (s: Sem) => {
    setViewSem(s);
    setSelectedMatiere(null);
    setSelectedCours('Tous');
    setSelectedAnnee('Toutes');
  };

  const handleLaunch = async () => {
    if (!selectedNiveau || !selectedMatiere) return;
    setLaunching(true);
    let query = supabase.from('questions').select('*')
      .eq('niveau', selectedNiveau).eq('matiere', selectedMatiere).eq('statut', 'publiee');
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

  const matieres = selectedNiveau ? getDisplayedMatieres(selectedNiveau) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2 tracking-tight">MedNemos</h1>
        <p className="text-slate-500 dark:text-white/40 text-sm">Entraîne-toi sur les annales des examens passés</p>
      </div>

      {/* Step 1 — Niveau */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
          1 · Niveau
        </p>
        <div className="grid grid-cols-2 gap-4">
          {(['P2', 'D1'] as Niveau[]).map(n => (
            <button
              key={n}
              onClick={() => { setSelectedNiveau(n); setSelectedMatiere(null); }}
              className={`relative rounded-2xl p-5 text-left transition-all border-2 ${
                selectedNiveau === n
                  ? 'border-[#e3fe52]/60 dark:border-[#e3fe52]/50 bg-[#e3fe52]/10 dark:bg-[#e3fe52]/5'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <div className={`text-2xl font-bold mb-0.5 ${
                selectedNiveau === n ? 'text-slate-800 dark:text-[#e3fe52]' : 'text-slate-700 dark:text-white'
              }`}>{n}</div>
              <div className="text-xs text-slate-500 dark:text-white/40">
                {n === 'P2' ? 'Deuxième année' : 'Première année DFASM'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Matière */}
      {selectedNiveau && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
              2 · Matière
            </p>
            {/* Semester toggle — uniquement hors période "all" */}
            {period !== 'all' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
                {(['S1', 'S2'] as Sem[]).map(s => (
                  <button
                    key={s}
                    onClick={() => switchSem(s)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      viewSem === s
                        ? 'bg-white dark:bg-[#e3fe52]/20 text-slate-800 dark:text-[#e3fe52] shadow-sm'
                        : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {matieres.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMatiere(m)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedMatiere === m
                    ? 'bg-[#e3fe52]/10 dark:bg-[#e3fe52]/10 border-[#e3fe52]/50 text-slate-800 dark:text-[#e3fe52]'
                    : 'bg-white dark:bg-[#141414] border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300 dark:hover:border-white/25'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Steps 3 & 4 — Cours + Année */}
      {selectedMatiere && (
        <div className="mb-8 grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-2">
              3 · Cours <span className="font-normal normal-case opacity-60">(optionnel)</span>
            </p>
            <select
              value={selectedCours}
              onChange={e => setSelectedCours(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#141414] text-slate-800 dark:text-white outline-none focus:border-[#e3fe52]/40 transition-colors"
            >
              <option value="Tous">Tous les cours</option>
              {coursList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-2">
              4 · Année <span className="font-normal normal-case opacity-60">(optionnel)</span>
            </p>
            <select
              value={selectedAnnee}
              onChange={e => setSelectedAnnee(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#141414] text-slate-800 dark:text-white outline-none focus:border-[#e3fe52]/40 transition-colors"
            >
              <option value="Toutes">Toutes les années</option>
              {annees.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Step 5 — Ordre */}
      {selectedMatiere && (
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
            5 · Ordre
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'official' as Order, label: 'Ordre officiel', sub: "Dans l'ordre de l'examen" },
              { key: 'random' as Order, label: 'Mélangé', sub: 'Dossiers progressifs conservés' },
            ].map(o => (
              <button
                key={o.key}
                onClick={() => setOrder(o.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  order === o.key
                    ? 'border-[#e3fe52]/50 bg-[#e3fe52]/5 dark:bg-[#e3fe52]/5'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#141414] hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className={`text-sm font-semibold mb-0.5 ${
                  order === o.key ? 'text-slate-800 dark:text-[#e3fe52]' : 'text-slate-700 dark:text-white/70'
                }`}>{o.label}</div>
                <div className="text-xs text-slate-400 dark:text-white/30">{o.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={!selectedNiveau || !selectedMatiere || launching}
        className="w-full py-4 rounded-2xl font-semibold text-base transition-all
          bg-slate-800 dark:bg-[#e3fe52]/10 dark:border dark:border-[#e3fe52]/30
          text-white dark:text-[#e3fe52]
          hover:bg-slate-700 dark:hover:bg-[#e3fe52]/20
          disabled:opacity-25 disabled:cursor-not-allowed"
      >
        {launching ? 'Chargement...' : 'Lancer la session →'}
      </button>
    </div>
  );
}
