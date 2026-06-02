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
  reponses: string[];       // lettres correctes (☑)
  noteCorrection: string;   // commentaire de correction
}

interface ParsedSection {
  id: string;
  kind: 'dossier' | 'isolees';
  titre: string;
  enonce: string;           // contexte clinique
  typeDossier: 'dp' | 'dl';
  questions: ParsedQuestion[];
}

// ---------------------------------------------------------------------------
// Parser — format "prof" : Question N Pondération 1 + ☑ / ■
// ---------------------------------------------------------------------------

function parseProfFormat(raw: string): ParsedQuestion[] {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── Normalisation des mots coupés par retour à la ligne ───────────────────
  text = text
    .replace(/Question\s+à\s+réponses?\s*\n\s*multiples?/gi, 'TYPE_QCM')
    .replace(/Question\s+à\s+réponse\s*\n\s*unique/gi,       'TYPE_QRU')
    .replace(/Question\s+à\s+réponses?\s+multiples?/gi,       'TYPE_QCM')
    .replace(/Question\s+à\s+réponse\s+unique/gi,             'TYPE_QRU')
    .replace(/Réponse\s*\n\s*attendue/gi,   'RÉPONSE_ATTENDUE')
    .replace(/Réponse\s+attendue/gi,        'RÉPONSE_ATTENDUE')
    .replace(/\d+\/\d+/g, '')              // numéros de page  1/22
    .replace(/[ \t]+/g, ' ');             // espaces horizontaux

  // ── Repérage des en-têtes de questions ────────────────────────────────────
  const Q_RE = /[ \t]*Question\s+(\d+)\s+Pondération\s+\d+/g;
  const qMatches = [...text.matchAll(Q_RE)];
  if (qMatches.length === 0) return [];

  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < qMatches.length; i++) {
    const qm = qMatches[i];
    const numero = parseInt(qm[1], 10);
    const blockStart = qm.index! + qm[0].length;
    const blockEnd   = i + 1 < qMatches.length ? qMatches[i + 1].index! : text.length;
    const block      = text.slice(blockStart, blockEnd);

    // ── Type ─────────────────────────────────────────────────────────────────
    const type: 'QCM' | 'QRU' = /TYPE_QRU/.test(block) ? 'QRU' : 'QCM';

    // ── Séparation enoncé / items (après "RÉPONSE_ATTENDUE") ─────────────────
    const repIdx = block.indexOf('RÉPONSE_ATTENDUE');
    let enoncePart: string;
    let afterPart:  string;

    if (repIdx !== -1) {
      enoncePart = block.slice(0, repIdx);
      afterPart  = block.slice(repIdx + 'RÉPONSE_ATTENDUE'.length);
    } else {
      // Fallback : premier item comme délimiteur
      const firstItem = block.match(/\n?([A-H])\s*(☑|■)/);
      if (firstItem?.index !== undefined) {
        enoncePart = block.slice(0, firstItem.index);
        afterPart  = block.slice(firstItem.index);
      } else {
        enoncePart = block;
        afterPart  = '';
      }
    }

    // ── Nettoyage de l'énoncé ────────────────────────────────────────────────
    const enonce = enoncePart
      .replace(/TYPE_QCM|TYPE_QRU/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // ── Séparation items / commentaire de correction ──────────────────────────
    const COMMENT_MARKER = 'Commentaire de correction de la question';
    const corrIdx = afterPart.indexOf(COMMENT_MARKER);
    let itemsPart:   string;
    let commentPart: string;

    if (corrIdx !== -1) {
      itemsPart   = afterPart.slice(0, corrIdx);
      commentPart = afterPart.slice(corrIdx + COMMENT_MARKER.length);
    } else {
      itemsPart   = afterPart;
      commentPart = '';
    }

    // ── Parsing des items (repérés par lettre + ☑/■) ─────────────────────────
    const itemRe = /([A-H])\s*(☑|■)\s*/g;
    const itemMatches = [...itemsPart.matchAll(itemRe)];

    const items:    Item[]    = [];
    const reponses: string[]  = [];

    for (let j = 0; j < itemMatches.length; j++) {
      const im       = itemMatches[j];
      const label    = im[1];
      const correct  = im[2] === '☑';
      const txtStart = im.index! + im[0].length;
      const txtEnd   = j + 1 < itemMatches.length ? itemMatches[j + 1].index! : itemsPart.length;

      const itemEnonce = itemsPart.slice(txtStart, txtEnd)
        .replace(/TYPE_QCM|TYPE_QRU/g, '')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      items.push({ label, enonce: itemEnonce, justification: '' });
      if (correct) reponses.push(label);
    }

    // ── Parsing du commentaire de correction ──────────────────────────────────
    const noteLines: string[] = [];

    if (commentPart.trim()) {
      const lines = commentPart.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^([A-H])\s+(.+)/);
        if (m) {
          const itemLabel = m[1];
          const justif    = m[2].trim();
          const item = items.find(it => it.label === itemLabel);
          if (item) item.justification = justif;
          noteLines.push(`${itemLabel} : ${justif}`);
        } else {
          noteLines.push(line);
        }
      }
    }

    questions.push({
      numero,
      type,
      enonce,
      items,
      reponses,
      noteCorrection: noteLines.join('\n'),
    });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Parser — format "ancien" : QCM n°1 : ... A. item B. item
// ---------------------------------------------------------------------------

function parseOldFormat(raw: string): ParsedQuestion[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const Q_RE = /(QCM|QRU)\s*(?:n[°o]?\s*)?(\d+)\s*[:.)]?\s*/i;
  const parts = text.split(Q_RE);
  const questions: ParsedQuestion[] = [];

  for (let i = 1; i + 2 < parts.length; i += 3) {
    const qType  = (parts[i] ?? '').toUpperCase() as 'QCM' | 'QRU';
    const numero = parseInt(parts[i + 1] ?? '0', 10);
    const body   = (parts[i + 2] ?? '').trim();
    if (isNaN(numero) || numero <= 0) continue;

    const sentinel   = '\x01';
    const markedBody = body.replace(/(^|[\s\n])([A-H])\. /g, `$1${sentinel}$2. `);
    const segments   = markedBody.split(sentinel);

    const enonce = segments[0]
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const items: Item[] = [];
    for (let j = 1; j < segments.length; j++) {
      const m = segments[j].match(/^([A-H])\. ([\s\S]*)/);
      if (m) {
        items.push({
          label:         m[1],
          enonce:        m[2].replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
          justification: '',
        });
      }
    }

    questions.push({ numero, type: qType, enonce, items, reponses: [], noteCorrection: '' });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Détection automatique du format et dispatch
// ---------------------------------------------------------------------------

function parseQuestions(raw: string): ParsedQuestion[] {
  const isProfFormat = /Question\s+\d+\s+Pondération/i.test(raw);
  return isProfFormat ? parseProfFormat(raw) : parseOldFormat(raw);
}

// ---------------------------------------------------------------------------
// Détection des sections (Dossier N / Questions isolées)
// ---------------------------------------------------------------------------

function parseSections(raw: string): ParsedSection[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Repérer les en-têtes de section : "Dossier N..." ou "Questions isolées..."
  // Doit être en début de ligne (précédé par newline ou début de texte)
  const SECTION_RE = /(?:^|\n)(Dossier\s+\d+[^\n]*|Questions?\s+isolées?[^\n]*)\n/gi;
  const sectionMatches = [...text.matchAll(SECTION_RE)];

  // Pas de sections → flat parse
  if (sectionMatches.length === 0) {
    const questions = parseQuestions(raw);
    return [{
      id: 's0',
      kind: 'isolees',
      titre: '',
      enonce: '',
      typeDossier: 'dp',
      questions,
    }];
  }

  const sections: ParsedSection[] = [];

  for (let i = 0; i < sectionMatches.length; i++) {
    const sm = sectionMatches[i];
    const headerText = sm[1].trim();
    const contentStart = sm.index! + sm[0].length;
    const contentEnd = i + 1 < sectionMatches.length
      ? sectionMatches[i + 1].index!
      : text.length;
    const content = text.slice(contentStart, contentEnd);

    const isDossier = /^Dossier\s+\d+/i.test(headerText);

    // Extraire le contexte clinique : texte avant la première "Question N Pondération"
    const firstQIdx = content.search(/Question\s+\d+\s+Pondération/i);
    let enonce = '';
    let questionsText = content;

    if (firstQIdx !== -1) {
      enonce = content.slice(0, firstQIdx)
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      questionsText = content.slice(firstQIdx);
    }

    const questions = parseQuestions(questionsText);

    sections.push({
      id: `s${i}`,
      kind: isDossier ? 'dossier' : 'isolees',
      titre: headerText,
      enonce,
      typeDossier: 'dp',
      questions,
    });
  }

  return sections;
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
  const [step, setStep]       = useState<Step>('input');
  const [source, setSource]   = useState<'annale' | 'ronéo'>('annale');
  const [niveau, setNiveau]   = useState<'P2' | 'D1'>('P2');
  const [matiere, setMatiere] = useState('');
  const [annee, setAnnee]     = useState<number>(ANNEES[0]);
  const [session, setSession] = useState<1 | 2>(1);
  const [text, setText]       = useState('');
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [saving, setSaving]   = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canParse = text.trim().length > 0 && matiere !== '';

  const handleNiveauChange = (n: 'P2' | 'D1') => { setNiveau(n); setMatiere(''); };

  const handleParse = () => {
    setSections(parseSections(text));
    setStep('preview');
  };

  // ── Toggles ────────────────────────────────────────────────────────────────

  const toggleSectionType = (sectionId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, typeDossier: s.typeDossier === 'dp' ? 'dl' : 'dp' }
        : s
    ));
  };

  const toggleQuestionType = (sectionId: string, qIdx: number) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        questions: s.questions.map((q, i) =>
          i === qIdx ? { ...q, type: q.type === 'QCM' ? 'QRU' : 'QCM' } : q
        ),
      };
    }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async (statut: 'brouillon' | 'publiee') => {
    setSaving(true);
    setSaveProgress(0);
    setSaveError(null);

    let savedCount = 0;

    for (const section of sections) {
      if (section.kind === 'dossier') {
        // 1. Créer le dossier
        let dossierId: string;
        try {
          const { data, error } = await supabase
            .from('dossiers')
            .insert({
              titre: section.titre,
              enonce: section.enonce || null,
              image_url: null,
              niveau,
              matiere,
              cours: null,
              annee: source === 'ronéo' ? null : annee,
              session: source === 'ronéo' ? null : session,
              source,
              statut,
              numero_officiel: null,
              type_dossier: section.typeDossier,
            })
            .select()
            .single();
          if (error) {
            setSaveError(`Dossier "${section.titre}" : ${error.message}`);
            setSaving(false);
            return;
          }
          dossierId = (data as { id: string }).id;
        } catch (e: unknown) {
          const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
          setSaveError(`Dossier "${section.titre}" : ${msg}`);
          setSaving(false);
          return;
        }

        // 2. Insérer les questions du dossier
        for (let i = 0; i < section.questions.length; i++) {
          const q = section.questions[i];
          try {
            const { error } = await supabase.from('questions').insert({
              niveau,
              matiere,
              source,
              annee:           source === 'ronéo' ? null : annee,
              session:         source === 'ronéo' ? null : session,
              type:            q.type,
              enonce:          q.enonce,
              items:           q.items,
              reponses:        q.reponses,
              note_correction: q.noteCorrection || null,
              cours:           null,
              image_url:       null,
              hotspot:         null,
              statut,
              numero_officiel: source === 'ronéo' ? null : q.numero,
              dossier_id:      dossierId,
              ordre_dossier:   i + 1,
            }).select().single();
            if (error) {
              setSaveError(`${section.titre} Q${i + 1} : ${error.message}`);
              setSaving(false);
              return;
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
            setSaveError(`${section.titre} Q${i + 1} : ${msg}`);
            setSaving(false);
            return;
          }
          savedCount++;
          setSaveProgress(savedCount);
        }
      } else {
        // Questions isolées → sans dossier
        for (let i = 0; i < section.questions.length; i++) {
          const q = section.questions[i];
          try {
            const { error } = await supabase.from('questions').insert({
              niveau,
              matiere,
              source,
              annee:           source === 'ronéo' ? null : annee,
              session:         source === 'ronéo' ? null : session,
              type:            q.type,
              enonce:          q.enonce,
              items:           q.items,
              reponses:        q.reponses,
              note_correction: q.noteCorrection || null,
              cours:           null,
              image_url:       null,
              hotspot:         null,
              statut,
              numero_officiel: source === 'ronéo' ? null : q.numero,
              dossier_id:      null,
              ordre_dossier:   null,
            }).select().single();
            if (error) {
              setSaveError(`Q${i + 1} : ${error.message}`);
              setSaving(false);
              return;
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
            setSaveError(`Q${i + 1} : ${msg}`);
            setSaving(false);
            return;
          }
          savedCount++;
          setSaveProgress(savedCount);
        }
      }
    }

    setSaving(false);
    onDone(savedCount);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalQuestions     = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const totalWithCorrections = sections.reduce((sum, s) => sum + s.questions.filter(q => q.reponses.length > 0).length, 0);
  const totalWarnings      = sections.reduce((sum, s) => sum + s.questions.filter(q => q.items.length === 0).length, 0);
  const hasDossierSections = sections.some(s => s.kind === 'dossier');
  const hasCorrections     = totalWithCorrections > 0;
  // (isFlatMode = pas de sections dossier → vue plate)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
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
              : hasDossierSections
                ? `${sections.filter(s => s.kind === 'dossier').length} dossier${sections.filter(s => s.kind === 'dossier').length > 1 ? 's' : ''} · ${totalQuestions} question${totalQuestions > 1 ? 's' : ''}${hasCorrections ? ` · ${totalWithCorrections} avec corrections` : ''}`
                : `${totalQuestions} question${totalQuestions > 1 ? 's' : ''} détectée${totalQuestions > 1 ? 's' : ''}${hasCorrections ? ` · ${totalWithCorrections} avec corrections` : ''}`}
          </p>
        </div>
      </div>

      {/* ── STEP 1 : INPUT ─────────────────────────────────────────────────── */}
      {step === 'input' && (
        <div className="space-y-6">
          {/* Source */}
          <div className="flex gap-2">
            {([
              { v: 'annale', label: 'Annale' },
              { v: 'ronéo', label: 'Entraînement Ronéo' },
            ] as { v: 'annale' | 'ronéo'; label: string }[]).map(s => (
              <button key={s.v} onClick={() => setSource(s.v)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                  source === s.v
                    ? s.v === 'ronéo' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Metadata */}
          <div className={`grid gap-4 ${source === 'ronéo' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Niveau</label>
              <div className="flex gap-1">
                {(['P2', 'D1'] as const).map(n => (
                  <button key={n} onClick={() => handleNiveauChange(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      niveau === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {source !== 'ronéo' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Année</label>
                <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}

            {source !== 'ronéo' && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Session</label>
                <div className="flex gap-1">
                  {([1, 2] as const).map(s => (
                    <button key={s} onClick={() => setSession(s)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        session === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      S{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Matière</label>
              <select value={matiere} onChange={e => setMatiere(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— choisir —</option>
                {(['S1', 'S2'] as const).map(sem => (
                  <optgroup key={sem} label={sem}>
                    {CURRICULUM[niveau][sem].map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Texte du sujet</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={18}
              placeholder={`Formats supportés :\n\n• Avec dossiers (Dossier 1 / Dossier 2 / Questions isolées) :\nDossier 1\nContexte clinique…\nQuestion 1 Pondération 1\n…\n\n• Format corrigé (profs) :\nQuestion 1 Pondération 1\nÀ propos du cœur :\nRéponse attendue\nA ☑ Le cœur a 4 cavités\nB ■ Le VD est plus musclé que le VG\n\n• Format QCM/QRU classique :\nQCM n°1 : Concernant l'anatomie...\nA. L'oreille interne contient la cochlée`}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">
              Formats reconnus : <strong>dossiers progressifs / libres</strong> (avec "Dossier N"), <strong>format corrigé profs</strong> (☑/■) et <strong>QCM/QRU classique</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleParse} disabled={!canParse}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Analyser le sujet →
            </button>
            <button onClick={onCancel} className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 : PREVIEW ───────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
            totalWarnings > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <span className={totalWarnings > 0 ? 'text-amber-700' : 'text-green-700'}>
              <strong>{totalQuestions}</strong> question{totalQuestions > 1 ? 's' : ''} — <strong>{matiere}</strong>
              {source !== 'ronéo' && <> · {annee}.S{session}</>} · {niveau}
              {hasDossierSections && (
                <> · <strong>{sections.filter(s => s.kind === 'dossier').length}</strong> dossier{sections.filter(s => s.kind === 'dossier').length > 1 ? 's' : ''}</>
              )}
              {hasCorrections && <> · <span className="text-green-600 font-semibold">{totalWithCorrections} avec corrections</span></>}
            </span>
            {totalWarnings > 0 && (
              <span className="ml-auto text-amber-600 text-xs">⚠ {totalWarnings} sans item</span>
            )}
          </div>

          {/* ── Sections avec dossiers ── */}
          {hasDossierSections ? (
            <div className="space-y-3">
              {sections.map(section => {
                const sectionWarnings = section.questions.filter(q => q.items.length === 0).length;
                const sectionCorrections = section.questions.filter(q => q.reponses.length > 0).length;

                return (
                  <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <span className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">
                        {section.titre}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {section.questions.length} question{section.questions.length > 1 ? 's' : ''}
                        {sectionCorrections > 0 && <span className="text-green-600"> · {sectionCorrections} corrigée{sectionCorrections > 1 ? 's' : ''}</span>}
                        {sectionWarnings > 0 && <span className="text-amber-500"> · ⚠ {sectionWarnings}</span>}
                      </span>
                      {section.kind === 'dossier' && (
                        <button
                          onClick={() => toggleSectionType(section.id)}
                          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                            section.typeDossier === 'dp'
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                          }`}
                          title="Cliquer pour changer le type"
                        >
                          {section.typeDossier === 'dp' ? 'Progressif' : 'Libre'}
                        </button>
                      )}
                      {section.kind === 'isolees' && (
                        <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                          Isolées
                        </span>
                      )}
                    </div>

                    {/* Contexte clinique */}
                    {section.enonce && (
                      <div className="px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 text-xs text-blue-700 leading-relaxed line-clamp-2">
                        {section.enonce}
                      </div>
                    )}

                    {/* Questions */}
                    <div className="divide-y divide-slate-100">
                      {section.questions.map((q, qIdx) => (
                        <div key={qIdx} className={`px-4 py-2.5 flex items-start gap-3 ${q.items.length === 0 ? 'bg-amber-50' : ''}`}>
                          <span className="text-xs font-mono font-semibold text-slate-400 pt-0.5 w-6 shrink-0 text-right">
                            {q.numero ?? qIdx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 leading-snug truncate">
                              {q.enonce || <em className="text-slate-400">Énoncé vide</em>}
                            </p>
                            {q.items.length > 0 ? (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex gap-1">
                                  {q.items.map(it => (
                                    <span key={it.label}
                                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
                                        q.reponses.includes(it.label)
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}>
                                      {it.label}
                                    </span>
                                  ))}
                                </div>
                                {q.reponses.length > 0 && (
                                  <span className="text-xs text-green-600">✓ {q.reponses.join('')}</span>
                                )}
                                {q.noteCorrection && (
                                  <span className="text-xs text-blue-500">📝</span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-amber-500 mt-0.5">Aucun item détecté</p>
                            )}
                          </div>
                          <button onClick={() => toggleQuestionType(section.id, qIdx)} title="Basculer QCM / QRU"
                            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                              q.type === 'QCM'
                                ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>
                            {q.type}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Mode plat (pas de dossiers) ── */
            <div className="space-y-1.5">
              {sections[0]?.questions.map((q, idx) => (
                <div key={idx}
                  className={`px-4 py-3 rounded-xl border transition-colors ${
                    q.items.length === 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono font-semibold text-slate-400 pt-0.5 w-6 shrink-0 text-right">
                      {q.numero ?? idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-snug truncate">
                        {q.enonce || <em className="text-slate-400">Énoncé vide</em>}
                      </p>
                      {q.items.length > 0 ? (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-1">
                            {q.items.map(it => (
                              <span key={it.label}
                                className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${
                                  q.reponses.includes(it.label)
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                {it.label}
                              </span>
                            ))}
                          </div>
                          {q.reponses.length > 0 && (
                            <span className="text-xs text-green-600">✓ {q.reponses.join('')}</span>
                          )}
                          {q.noteCorrection && (
                            <span className="text-xs text-blue-500 ml-1">📝</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-500 mt-0.5">Aucun item détecté</p>
                      )}
                    </div>
                    <button onClick={() => toggleQuestionType(sections[0].id, idx)} title="Basculer QCM / QRU"
                      className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                        q.type === 'QCM'
                          ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>
                      {q.type}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erreur */}
          {saveError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              Erreur : {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {/* Brouillon */}
            <button
              onClick={() => handleSave('brouillon')}
              disabled={saving || totalQuestions === 0}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {saveProgress}/{totalQuestions}…
                </>
              ) : 'Brouillon'}
            </button>

            {/* Publier — uniquement si corrections présentes */}
            {hasCorrections && (
              <button
                onClick={() => handleSave('publiee')}
                disabled={saving || totalQuestions === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? `${saveProgress}/${totalQuestions}…` : `Publier ${totalQuestions} question${totalQuestions > 1 ? 's' : ''}`}
              </button>
            )}

            <button onClick={() => setStep('input')}
              className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              ← Modifier
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {hasDossierSections
              ? `${sections.filter(s => s.kind === 'dossier').length} dossier${sections.filter(s => s.kind === 'dossier').length > 1 ? 's' : ''} seront créés${sections.some(s => s.kind === 'isolees') ? ' + questions isolées' : ''}.${hasCorrections ? ' Corrections incluses, publication directe possible.' : ''}`
              : hasCorrections
                ? `${totalWithCorrections}/${totalQuestions} questions ont des corrections — tu peux publier directement.`
                : 'Aucune correction détectée — enregistrement en brouillon, à compléter ensuite.'}
          </p>
        </div>
      )}
    </div>
  );
}
