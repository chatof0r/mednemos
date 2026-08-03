import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CURRICULUM, COURSES, Niveau, Sem } from '../lib/curriculum';
import { Question, Dossier } from '../types';

type Order = 'official' | 'random';

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
  const [selectedCours, setSelectedCours] = useState<string[]>([]);
  const [annees, setAnnees] = useState<number[]>([]);
  const [selectedAnnees, setSelectedAnnees] = useState<number[]>([]);
  const [hasRoneo, setHasRoneo] = useState(false);
  const [includeRoneo, setIncludeRoneo] = useState(false);
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({});
  const [totalRows, setTotalRows] = useState(0);
  const [order, setOrder] = useState<Order>('official');
  const [launching, setLaunching] = useState(false);

  const getDisplayedMatieres = (niveau: Niveau): string[] => {
    if (period === 'all') return [...CURRICULUM[niveau].S1, ...CURRICULUM[niveau].S2];
    return CURRICULUM[niveau][viewSem];
  };

  useEffect(() => {
    if (!selectedMatiere || !selectedNiveau) return;
    setSelectedCours([]);
    setAnnees([]);
    setSelectedAnnees([]);
    setHasRoneo(false);
    setIncludeRoneo(false);
    setCourseCounts({});
    setTotalRows(0);

    supabase
      .from('questions')
      .select('cours, annee, source')
      .eq('niveau', selectedNiveau)
      .eq('matiere', selectedMatiere)
      .eq('statut', 'publiee')
      .then(({ data }) => {
        const rows = data ?? [];
        const counts: Record<string, number> = {};
        rows.forEach((r: { cours: string[] | null; source?: string }) => {
          (r.cours ?? []).forEach(c => {
            counts[c] = (counts[c] ?? 0) + 1;
          });
        });
        setCourseCounts(counts);
        setTotalRows(rows.length);
        const ys = [...new Set(
          rows
            .filter((r: { annee: number | null; source?: string }) => r.source !== 'ronéo')
            .map((r: { annee: number | null }) => r.annee)
            .filter(Boolean)
        )] as number[];
        const sorted = ys.sort((a, b) => b - a);
        setAnnees(sorted);
        setSelectedAnnees(sorted);
        const roneoCnt = rows.filter((r: { source?: string }) => r.source === 'ronéo').length;
        setHasRoneo(roneoCnt > 0);
        setIncludeRoneo(roneoCnt > 0);
      });
  }, [selectedMatiere, selectedNiveau]);

  const switchSem = (s: Sem) => {
    setViewSem(s);
    setSelectedMatiere(null);
    setSelectedCours([]);
    setAnnees([]);
    setSelectedAnnees([]);
    setHasRoneo(false);
    setIncludeRoneo(false);
  };

  const toggleCours = (c: string) => {
    setSelectedCours(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const toggleAnnee = (a: number) => {
    setSelectedAnnees(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  const handleLaunch = async () => {
    if (!selectedNiveau || !selectedMatiere) return;
    setLaunching(true);

    let query = supabase
      .from('questions').select('*')
      .eq('niveau', selectedNiveau)
      .eq('matiere', selectedMatiere)
      .eq('statut', 'publiee')
      .order('annee', { ascending: false })
      .order('numero_officiel', { ascending: true });

    if (selectedCours.length > 0) query = query.overlaps('cours', selectedCours);

    // Filtrage source / années
    const annaleFiltered = selectedAnnees.length < annees.length;
    // Toutes les années désélectionnées : `.in('annee', [])` / `annee.in.()` produirait
    // une liste vide invalide côté requête — on gère ce cas explicitement.
    const noYearsSelected = annees.length > 0 && selectedAnnees.length === 0;

    if (noYearsSelected && !includeRoneo) {
      alert('Aucune question disponible pour cette sélection.');
      setLaunching(false);
      return;
    } else if (noYearsSelected && includeRoneo) {
      query = query.eq('source', 'ronéo');
    } else if (includeRoneo && annaleFiltered) {
      // ronéo OU (annales avec filtre d'année)
      query = query.or(`source.eq.ronéo,annee.in.(${selectedAnnees.join(',')})`);
    } else if (includeRoneo && !annaleFiltered) {
      // tout inclus, pas de filtre supplémentaire
    } else if (!includeRoneo && annaleFiltered) {
      query = query.in('annee', selectedAnnees);
    } else {
      // Pas de ronéo, toutes les années → exclure ronéo si la colonne existe
      query = query.neq('source', 'ronéo');
    }

    const { data } = await query;
    const questions = (data ?? []) as Question[];

    if (questions.length === 0) {
      alert('Aucune question disponible pour cette sélection.');
      setLaunching(false);
      return;
    }

    // Récupérer les métadonnées des dossiers référencés
    const dossierIds = [...new Set(questions.map(q => q.dossier_id).filter(Boolean))] as string[];
    let dossiers: Dossier[] = [];
    if (dossierIds.length > 0) {
      const { data: dossierData } = await supabase.from('dossiers').select('*').in('id', dossierIds);
      dossiers = (dossierData ?? []) as Dossier[];
    }

    navigate('/session', { state: { questions, dossiers, order } });
  };

  const matieres = selectedNiveau ? getDisplayedMatieres(selectedNiveau) : [];
  const coursOptions = selectedMatiere ? (COURSES[selectedMatiere] ?? []) : [];
  const allYearsSelected = selectedAnnees.length === annees.length;

  const btnSelected = 'bg-white dark:bg-brand border-white/60 dark:border-brand/60 text-brand dark:text-ink';
  const btnDefault = 'bg-white/5 border-white/15 dark:border-brand/30 text-ink/60 hover:border-white/30 dark:hover:border-brand/60';
  const btnDisabled = 'bg-white/5 border-white/10 dark:border-brand/15 text-ink/20 line-through';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-ink mb-2 tracking-tight">MedNemos</h1>
        <p className="text-ink/40 text-sm">Entraîne-toi sur les annales des examens passés</p>
      </div>

      {/* Step 1 — Niveau */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/30 mb-3">1 · Niveau</p>
        <div className="grid grid-cols-2 gap-4">
          {(['P2', 'D1'] as Niveau[]).map(n => (
            <button key={n}
              onClick={() => { setSelectedNiveau(n); setSelectedMatiere(null); setSelectedCours([]); setAnnees([]); setSelectedAnnees([]); }}
              className={`rounded-2xl p-5 text-left transition-all border-2 ${
                selectedNiveau === n ? btnSelected : btnDefault
              }`}>
              <div className="text-2xl font-bold mb-0.5">{n}</div>
              <div className="text-xs opacity-60">{n === 'P2' ? 'Deuxième année' : 'Première année DFASM'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Matière */}
      {selectedNiveau && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/30">2 · Matière</p>
            {period !== 'all' && (
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
                {(['S1', 'S2'] as Sem[]).map(s => (
                  <button key={s} onClick={() => switchSem(s)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      viewSem === s
                        ? 'bg-white/25 dark:bg-brand/40 text-ink shadow-sm'
                        : 'text-ink/30 hover:text-ink/60'
                    }`}>{s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {matieres.map(m => (
              <button key={m} onClick={() => setSelectedMatiere(m)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedMatiere === m ? btnSelected : btnDefault
                }`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Cours multi-select */}
      {selectedMatiere && coursOptions.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/30 mb-3">3 · Cours</p>
          <div className="space-y-2">
            <button onClick={() => setSelectedCours([])}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                selectedCours.length === 0 ? btnSelected : btnDefault
              }`}>
              <span className="text-sm font-medium">Tous les cours</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                selectedCours.length === 0 ? 'bg-black/10' : 'bg-white/10 text-ink/40'
              }`}>{totalRows}</span>
            </button>
            {coursOptions.map(c => {
              const count = courseCounts[c] ?? 0;
              const isSel = selectedCours.includes(c);
              return (
                <button key={c} onClick={() => toggleCours(c)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    isSel ? btnSelected : btnDefault
                  }`}>
                  <span className="text-sm font-medium text-left">{c}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    isSel ? 'bg-black/10 text-brand dark:text-ink'
                      : count === 0 ? 'bg-white/5 text-ink/20'
                        : 'bg-white/10 text-ink/40'
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4 — Années toggle-off + Ronéo */}
      {selectedMatiere && (annees.length > 0 || hasRoneo) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/30">
              {coursOptions.length > 0 ? '4' : '3'} · Année
            </p>
            {annees.length > 0 && !allYearsSelected && (
              <button
                onClick={() => setSelectedAnnees(annees)}
                className="text-xs text-ink/30 hover:text-ink/60 transition-colors underline underline-offset-2"
              >
                Tout réactiver
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {annees.map(a => {
              const active = selectedAnnees.includes(a);
              return (
                <button key={a} onClick={() => toggleAnnee(a)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                    active ? btnSelected : btnDisabled
                  }`}>
                  {a}
                </button>
              );
            })}
            {hasRoneo && (
              <button
                onClick={() => setIncludeRoneo(v => !v)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                  includeRoneo ? btnSelected : btnDisabled
                }`}
              >
                Ronéo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 5 — Ordre */}
      {selectedMatiere && (
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/30 mb-3">
            {coursOptions.length > 0 ? '5' : annees.length > 0 ? '4' : '3'} · Ordre
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'official' as Order, label: 'Ordre officiel', sub: 'Année récente → ancienne, Q1 → Qn' },
              { key: 'random' as Order, label: 'Mélangé', sub: 'Dossiers progressifs conservés' },
            ].map(o => (
              <button key={o.key} onClick={() => setOrder(o.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  order === o.key
                    ? 'border-white/60 dark:border-brand/60 bg-white/10 dark:bg-brand/10'
                    : 'border-white/15 dark:border-brand/30 bg-white/5 hover:border-white/30 dark:hover:border-brand/60'
                }`}>
                <div className={`text-sm font-semibold mb-0.5 ${
                  order === o.key ? 'text-ink' : 'text-ink/70'
                }`}>{o.label}</div>
                <div className="text-xs text-ink/30">{o.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleLaunch}
        disabled={!selectedNiveau || !selectedMatiere || launching}
        className="w-full py-4 rounded-2xl font-semibold text-base transition-all
          bg-white dark:bg-brand border border-transparent dark:border-brand/50
          text-brand dark:text-ink
          hover:bg-white/90 dark:hover:bg-brand/80
          disabled:opacity-25 disabled:cursor-not-allowed">
        {launching ? 'Chargement...' : 'Lancer la session →'}
      </button>
    </div>
  );
}
