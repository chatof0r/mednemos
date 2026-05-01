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
  // ── Pre-normalisation ─────────────────────────────────────────────────────
  // Insert a newline before every inline item marker so "...text. A. item B. item"
  // becomes "...text.\nA. item\nB. item" before line-by-line parsing.
  //
  // Rule (per user spec): any [A-E] immediately followed by ". " is a new item,
  // whether it's already on its own line or embedded inline after other text.
  //
  // Strategy: replace any run of spaces/tabs that precedes "[A-E]. " with a newline.
  // "talus. A. text" → "talus.\nA. text"
  // "pied : A. text" → "pied :\nA. text"
  // Already at start of line (no leading spaces): left untouched.
  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // " A. " / " B. " etc. → "\nA. " / "\nB. " etc.
    .replace(/[ \t]+([A-E])\. /g, '\n$1. ')
    // Edge-case: ".A. " with no space → ".\nA. "
    .replace(/\.([A-E])\. /g, '.\n$1. ');

  const lines = normalized.split('\n').map(l => l.trim());

  // Question with explicit type prefix: "QCM n°1 : ..." / "QRU 2 : ..."
  const Q_TYPED = /^(QCM|QRU)\s*(?:n[°o]?\s*)?(\d+)\s*[:.)]?\s*(.*)/i;
  // Plain numbered question: "n°1 : ..." / "1. ..." / "1) ..."
  const Q_NUM = /^(?:n[°o]\s*)?(\d+)\s*[:.]\s*(.*)/i;
  // Item line: "[A-E]. " (period specifically, per user spec)
  const ITEM_RE = /^([A-E])\. (.*)/;

  const questions: ParsedQuestion[] = [];
  let cur: ParsedQuestion | null = null;
  let pendingEnonce: string[] = [];

  const flush = () => {
    if (!cur) return;
    const extra = pendingEnonce.join(' ').trim();
    if (extra) cur.enonce = cur.enonce ? `${cur.enonce} ${extra}` : extra;
    cur.enonce = cur.enonce.trim();
    if (cur.enonce || cur.items.length > 0) questions.push(cur);
    cur = null;
    pendingEnonce = [];
  };

  for (const line of lines) {
    if (!line) continue;

    // 1. Item line?
    const im = line.match(ITEM_RE);
    if (im && cur) {
      // Flush any pending énoncé lines
      const extra = pendingEnonce.join(' ').trim();
      if (extra) { cur.enonce = cur.enonce ? `${cur.enonce} ${extra}` : extra; }
      pendingEnonce = [];
      cur.items.push({ label: im[1].toUpperCase(), enonce: im[2].trim(), justification: '' });
      continue;
    }

    // 2. Typed question header? (QCM / QRU prefix)
    const qt = line.match(Q_TYPED);
    if (qt) {
      flush();
      cur = {
        numero: parseInt(qt[2], 10),
        type: qt[1].toUpperCase() === 'QRU' ? 'QRU' : 'QCM',
        enonce: qt[3]?.trim() ?? '',
        items: [],
      };
      continue;
    }

    // 3. Plain numbered question? (only when not already inside a question's items)
    if (!cur || cur.items.length === 0) {
      const qn = line.match(Q_NUM);
      if (qn) {
        const num = parseInt(qn[1], 10);
        // Sanity check: plausible question number
        if (num >= 1 && num <= 200) {
          flush();
          cur = {
            numero: num,
            type: 'QCM',
            enonce: qn[2]?.trim() ?? '',
            items: [],
          };
          continue;
        }
      }
    }

    // 4. Continuation of current énoncé (before first item)
    if (cur && cur.items.length === 0) {
      pendingEnonce.push(line);
    }
    // Lines after items start are ignored (could be footnotes / page numbers etc.)
  }

  flush();
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
      annee,
      session,
      type: q.type,
      enonce: q.enonce,
      items: q.items,
      reponses: [],
      cours: null,
      image_url: null,
      hotspot: null,
      statut: 'brouillon',
      numero_officiel: q.numero,
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
          {/* Metadata row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

            {/* Année */}
            <div>
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
            </div>

            {/* Session */}
            <div>
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
            </div>

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
