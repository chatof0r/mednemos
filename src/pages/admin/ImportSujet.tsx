import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types';
import { ANNEES, CURRICULUM } from '../../lib/curriculum';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedQuestion {
  numero: number | null;
  type: 'QCM' | 'QRU';
  enonce: string;
  items: Item[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseSubject(raw: string): ParsedQuestion[] {
  // ── Approche : split par en-tête de question ─────────────────────────────
  //
  // On divise le texte entier sur les marqueurs QCM/QRU sans jamais dépendre
  // des sauts de ligne. Chaque bloc obtenu est ensuite découpé en énoncé +
  // items en cherchant les marqueurs "X. " (lettre A-E + point + espace).
  //
  // Ça gère indifféremment :
  //   • items déjà sur leurs propres lignes
  //   • items inline : "QCM 4 : ... A. texte B. texte C. texte"
  //   • mélange des deux

  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── 1. Découpage par en-têtes de question ─────────────────────────────────
  // Regex avec 2 groupes capturants → split produit :
  // [avant_Q1, type1, num1, corps1, type2, num2, corps2, …]
  const Q_RE = /(QCM|QRU)\s*(?:n[°o]?\s*)?(\d+)\s*[:.)]?\s*/i;
  const parts = text.split(Q_RE);
  // parts[0]           = préambule (ignoré)
  // parts[3k+1]        = type  (k = 0, 1, 2 …)
  // parts[3k+2]        = numéro
  // parts[3k+3]        = corps de la question

  const questions: ParsedQuestion[] = [];

  for (let i = 1; i + 2 < parts.length; i += 3) {
    const qType  = (parts[i] ?? '').toUpperCase() as 'QCM' | 'QRU';
    const numero = parseInt(parts[i + 1] ?? '0', 10);
    const body   = (parts[i + 2] ?? '').trim();

    if (isNaN(numero) || numero <= 0) continue;

    // ── 2. Découpage du corps en énoncé + items ────────────────────────────
    // Un item commence par (espace/newline ou début) + [A-E] + ". "
    // On insère un sentinelle '\x01' avant chaque marqueur d'item.
    const sentinel = '\x01';
    const markedBody = body.replace(
      /(^|[\s\n])([A-E])\. /g,
      `$1${sentinel}$2. `
    );
    const segments = markedBody.split(sentinel);

    // segments[0] = énoncé (tout ce qui précède le premier item)
    const enonce = segments[0].replace(/\s+/g, ' ').trim();

    const items: Item[] = [];
    for (let j = 1; j < segments.length; j++) {
      const seg = segments[j];
      const m   = seg.match(/^([A-E])\. ([\s\S]*)/);
      if (m) {
        items.push({
          label        : m[1],
          enonce       : m[2].replace(/\s+/g, ' ').trim(),
          justification: '',
        });
      }
    }

    questions.push({ numero, type: qType, enonce, items });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onDone: (count: number) => void;
  onCancel: () => void;
}

type Step = 'input' | 'preview';

export default function ImportSujet({ onDone, onCancel }: Props) {
  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('input');

  // ── Metadata ──────────────────────────────────────────────────────────────
  const [source, setSource] = useState<'annale' | 'ronéo'>('annale');
  const [niveau, setNiveau] = useState<'P2' | 'D1'>('P2');
  const [matiere, setMatiere] = useState('');
  const [annee, setAnnee] = useState<number>(ANNEES[0]);
  const [session, setSession] = useState<1 | 2>(1);

  // ── Raw text ──────────────────────────────────────────────────────────────
  const [text, setText] = useState('');

  // ── Parsed questions (step preview) ───────────────────────────────────────
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  const canParse = text.trim().length > 0 && matiere !== '';

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNiveauChange = (n: 'P2' | 'D1') => {
    setNiveau(n);
    setMatiere('');
  };

  const handleParse = () => {
    const result = parseSubject(text);
    setParsed(result);
    setStep('preview');
  };

  const toggleType = (idx: number) => {
    setParsed(prev => prev.map((q, i) =>
      i === idx ? { ...q, type: q.type === 'QCM' ? 'QRU' : 'QCM' } : q
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const rows = parsed.map(q => ({
      niveau,
      matiere,
      source,
      annee: source === 'ronéo' ? null : annee,
      session: source === 'ronéo' ? null : session,
      type: q.type,
      enonce: q.enonce,
      items: q.items,
      reponses: [],
      cours: null,
      image_url: null,
      hotspot: null,
      statut: 'brouillon',
      numero_officiel: source === 'ronéo' ? null : q.numero,
    }));

    const { error } = await supabase.from('questions').insert(rows);
    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    onDone(parsed.length);
  };

  // ── Derived stats for preview ─────────────────────────────────────────────
  const warnings = parsed.filter(q => q.items.length === 0).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Back button + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={step === 'preview' ? () => setStep('input') : onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Import de sujet</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {step === 'input'
              ? 'Collez un sujet entier — les questions seront détectées automatiquement'
              : `${parsed.length} question${parsed.length > 1 ? 's' : ''} détectée${parsed.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* ── STEP 1 : INPUT ───────────────────────────────────────────────── */}
      {step === 'input' && (
        <div className="space-y-6">
          {/* Source toggle */}
          <div className="flex gap-2">
            {([
              { v: 'annale', label: 'Annale' },
              { v: 'ronéo', label: 'Entraînement Ronéo' },
            ] as { v: 'annale' | 'ronéo'; label: string }[]).map(s => (
              <button
                key={s.v}
                onClick={() => setSource(s.v)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  source === s.v
                    ? s.v === 'ronéo'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Metadata row */}
          <div className={`grid gap-4 ${source === 'ronéo' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {/* Niveau */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Niveau</label>
              <div className="flex gap-1">
                {(['P2', 'D1'] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => handleNiveauChange(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      niveau === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Année — masqué pour Ronéo */}
            {source !== 'ronéo' && <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Année</label>
              <select
                value={annee}
                onChange={e => setAnnee(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ANNEES.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>}

            {/* Session — masqué pour Ronéo */}
            {source !== 'ronéo' && <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Session</label>
              <div className="flex gap-1">
                {([1, 2] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSession(s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      session === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    S{s}
                  </button>
                ))}
              </div>
            </div>}

            {/* Matière */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Matière</label>
              <select
                value={matiere}
                onChange={e => setMatiere(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— choisir —</option>
                {(['S1', 'S2'] as const).map(sem => (
                  <optgroup key={sem} label={`${sem}`}>
                    {CURRICULUM[niveau][sem].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Texte du sujet
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={18}
              placeholder={`Collez le sujet ici. Formats supportés :\n\nQCM n°1 : Concernant l'anatomie de l'oreille :\nA. L'oreille interne contient la cochlée\nB. Le tympan sépare l'oreille externe de l'oreille moyenne\n...\n\nQCM n°2 : À propos de la physiologie...\nA. ...\n...`}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">
              Formats reconnus : <span className="font-mono">QCM n°1 :</span>, <span className="font-mono">QRU n°2 :</span>, <span className="font-mono">1.</span>, <span className="font-mono">n°1 :</span> — Items : <span className="font-mono">A.</span> <span className="font-mono">B)</span> <span className="font-mono">C -</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleParse}
              disabled={!canParse}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Analyser le sujet →
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 : PREVIEW ─────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            warnings > 0
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            <span className={warnings > 0 ? 'text-amber-700' : 'text-green-700'}>
              <strong>{parsed.length}</strong> question{parsed.length > 1 ? 's' : ''} détectée{parsed.length > 1 ? 's' : ''}
              {' '}— <strong>{matiere}</strong> · {annee}.S{session} · {niveau}
            </span>
            {warnings > 0 && (
              <span className="ml-auto text-amber-600 text-xs">
                ⚠ {warnings} question{warnings > 1 ? 's' : ''} sans item détecté
              </span>
            )}
          </div>

          {/* Questions list */}
          <div className="space-y-2">
            {parsed.map((q, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  q.items.length === 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-slate-100'
                }`}
              >
                {/* Numero */}
                <span className="text-xs font-mono font-semibold text-slate-400 pt-0.5 w-6 shrink-0 text-right">
                  {q.numero ?? idx + 1}
                </span>

                {/* Enonce + items */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug truncate">
                    {q.enonce || <em className="text-slate-400">Énoncé vide</em>}
                  </p>
                  {q.items.length > 0 ? (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {q.items.length} item{q.items.length > 1 ? 's' : ''} ·{' '}
                      {q.items.map(it => it.label).join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-500 mt-0.5">Aucun item détecté</p>
                  )}
                </div>

                {/* Type toggle */}
                <button
                  onClick={() => toggleType(idx)}
                  title="Cliquer pour basculer QCM / QRU"
                  className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                    q.type === 'QCM'
                      ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  {q.type}
                </button>
              </div>
            ))}
          </div>

          {/* Error */}
          {saveError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              Erreur : {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || parsed.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Enregistrement…
                </>
              ) : (
                <>
                  Enregistrer {parsed.length} question{parsed.length > 1 ? 's' : ''} en brouillon
                </>
              )}
            </button>
            <button
              onClick={() => setStep('input')}
              className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Modifier le texte
            </button>
          </div>

          {parsed.length > 0 && (
            <p className="text-xs text-slate-400">
              Les questions seront enregistrées en brouillon sans cours ni réponse — vous les compléterez une par une ensuite.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
