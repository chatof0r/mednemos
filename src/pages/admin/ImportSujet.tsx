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
  reponses: string[];       // lettres correctes
  noteCorrection: string;   // commentaire de correction (sans [INSERER IMAGE])
  needsImage: boolean;      // true si [INSERER IMAGE] était présent → image_url = '__PENDING__'
}

interface ParsedSection {
  id: string;
  /** dp = dossier progressif, dl = dossier libre, isolees = questions individuelles */
  type: 'dp' | 'dl' | 'isolees';
  titre: string;
  enonce: string;           // contexte clinique
  questions: ParsedQuestion[];
}

// ---------------------------------------------------------------------------
// Parser — format "prof" : Question N Pondération 1 + ☑ / ■
// ---------------------------------------------------------------------------

function parseProfFormat(raw: string): ParsedQuestion[] {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── Normalisation des mots coupés par retour à la ligne ───────────────────
  text = text
    // Types de question (toutes variantes de saut de ligne)
    .replace(/Question\s+à\s+réponses?\s+multiples?/gi, 'TYPE_QCM')
    .replace(/Question\s+à\s+réponse\s+unique/gi,       'TYPE_QRU')
    // Séparateurs enoncé / items — "Réponse attendue" et variantes
    .replace(/Réponse[s]?\s+à\s+cocher[^\n]*/gi, 'RÉPONSE_ATTENDUE')
    .replace(/Proposition[s]?\s+à\s+cocher[^\n]*/gi, 'RÉPONSE_ATTENDUE')
    .replace(/Réponse[s]?\s+attendue[s]?/gi,     'RÉPONSE_ATTENDUE')
    // Numéros de page  (ex : 3/22)
    .replace(/\b\d+\/\d+\b/g, '')
    // Espaces horizontaux multiples
    .replace(/[ \t]+/g, ' ');

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
    // Accepte "Commentaire de correction" avec ou sans "de la question" à la suite
    const corrMatch = /Commentaire\s+de\s+correction\b/i.exec(afterPart);
    let itemsPart:   string;
    let commentPart: string;

    if (corrMatch) {
      itemsPart   = afterPart.slice(0, corrMatch.index);
      commentPart = afterPart.slice(corrMatch.index + corrMatch[0].length);
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

      const rawText = itemsPart.slice(txtStart, txtEnd);

      const itemEnonce = rawText
        .replace(/TYPE_QCM|TYPE_QRU/g, '')
        // Tronquer avant toute ligne qui ressemble à un label de section
        // (ex: "Question à...", "Réponse...", "Commentaire..." apparus en fin de bloc)
        .replace(/\n[ \t]*(?:Question|Réponse|Commentaire|RÉPONSE_ATTENDUE)[^\n]*/g, '')
        // Joindre les lignes et normaliser les espaces
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
      needsImage: false,
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

    questions.push({ numero, type: qType, enonce, items, reponses: [], noteCorrection: '', needsImage: false });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Parser — format Claude : "QCM N : énoncé \n A. item \n Réponse : XYZ \n Note : ..."
// Produit par le prompt de standardisation (Dossier DL/DP/DQI N)
// ---------------------------------------------------------------------------

function parseClaudeQuestions(raw: string): ParsedQuestion[] {
  // Normalisation : unifier sauts de ligne + NFC pour les accents composés
  // On normalise aussi les espaces insécables (U+00A0, U+202F) en espaces ordinaires
  // car certains PDF/LLM en insèrent, ce qui casse les regex d'ancre ^
  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u202F\u2009\u2060\uFEFF]/g, ' ')  // NBSP & espaces spéciaux → espace ordinaire
    .normalize('NFC');

  // En-têtes de question : "QCM N :", "QRU N :", "QROC N :" en début de ligne
  // On tolère des espaces éventuels en tête de ligne (indentation)
  const Q_RE = /^[ \t]*(QCM|QRU|QROC)\s+(\d+)\s*:/gim;
  const qMatches = [...text.matchAll(Q_RE)];
  if (qMatches.length === 0) return [];

  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < qMatches.length; i++) {
    const qm       = qMatches[i];
    const rawType  = qm[1].toUpperCase();
    const type: 'QCM' | 'QRU' = rawType === 'QRU' ? 'QRU' : 'QCM'; // QROC → QCM
    const numero   = parseInt(qm[2], 10);
    const blockStart = qm.index! + qm[0].length;
    const blockEnd   = i + 1 < qMatches.length ? qMatches[i + 1].index! : text.length;
    const block      = text.slice(blockStart, blockEnd);

    // ── Réponses correctes — cherche dans le bloc entier ──────────────────────
    // On cherche DANS BLOCK (pas bodyAfterEnonce) pour être indépendant du
    // calcul des items. Tolère espaces, "Réponse/Réponses/Correction", accents.
    const reponseMatch = /^[ \t]*(?:R[eé]ponses?|Correction)\s*:\s*([A-H][A-H ,]*)/im.exec(block);
    const reponses: string[] = reponseMatch
      ? reponseMatch[1].toUpperCase().split('').filter(c => /[A-H]/.test(c))
      : [];

    // ── Note de correction — cherche dans le bloc entier ─────────────────────
    const noteMatch = /^[ \t]*Note\s*:\s*(.+)/im.exec(block);
    let rawNote = noteMatch ? noteMatch[1].trim() : '';

    // Détecter et extraire le marqueur [INSERER IMAGE]
    const needsImage = /\[INSERER\s+IMAGE\]/i.test(rawNote);
    rawNote = rawNote.replace(/\[INSERER\s+IMAGE\]/gi, '').trim();

    // "non" → note vide
    const noteCorrection = rawNote.toLowerCase() === 'non' ? '' : rawNote;

    // ── Énoncé : texte avant le premier item "A." ─────────────────────────────
    const firstItemIdx = block.search(/^[ \t]*[A-H]\./m);
    let enonce = '';

    if (firstItemIdx !== -1) {
      enonce = block.slice(0, firstItemIdx)
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // ── Items : entre le premier item et la ligne Réponse ────────────────────
    const reponseLineStart = reponseMatch
      ? block.indexOf(reponseMatch[0])
      : block.length;
    const itemsText = block.slice(
      firstItemIdx !== -1 ? firstItemIdx : 0,
      reponseLineStart,
    );

    const items: Item[] = [];
    let currentLabel: string | null = null;
    let currentLines: string[] = [];

    for (const line of itemsText.split('\n')) {
      // Tolère l'indentation éventuelle devant "A. texte"
      const m = line.match(/^[ \t]*([A-H])\.\s*(.*)/);
      if (m) {
        if (currentLabel !== null) {
          items.push({
            label:         currentLabel,
            enonce:        currentLines.join(' ').replace(/\s+/g, ' ').trim(),
            justification: '',
          });
        }
        currentLabel = m[1];
        currentLines = [m[2]];
      } else if (currentLabel !== null && line.trim()) {
        currentLines.push(line.trim());
      }
    }
    if (currentLabel !== null && currentLines.length > 0) {
      items.push({
        label:         currentLabel,
        enonce:        currentLines.join(' ').replace(/\s+/g, ' ').trim(),
        justification: '',
      });
    }

    // ── Justifications par item depuis la Note ────────────────────────────────
    // Format : "A — Localisées ; D — Obstructif et restrictif"
    if (noteCorrection) {
      const parts = noteCorrection.split(/\s*[;,]\s*/);
      for (const part of parts) {
        const jm = part.match(/^([A-H])\s*[—–\-]+\s*(.+)/);
        if (jm) {
          const item = items.find(it => it.label === jm[1]);
          if (item) item.justification = jm[2].trim();
        }
      }
    }

    questions.push({ numero, type, enonce, items, reponses, noteCorrection, needsImage });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Détection automatique du format et dispatch
// ---------------------------------------------------------------------------

function parseQuestions(raw: string): ParsedQuestion[] {
  // Format Claude : "QCM N :" / "QRU N :" / "QROC N :" — tolère indentation
  if (/^[ \t]*(?:QCM|QRU|QROC)\s+\d+\s*:/im.test(raw)) return parseClaudeQuestions(raw);
  const isProfFormat = /Question\s+\d+\s+Pondération/i.test(raw);
  return isProfFormat ? parseProfFormat(raw) : parseOldFormat(raw);
}

// ---------------------------------------------------------------------------
// Détection des sections (Dossier N / Questions isolées)
// ---------------------------------------------------------------------------

function parseSections(raw: string): ParsedSection[] {
  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u202F\u2009\u2060\uFEFF]/g, ' ');  // NBSP & espaces spéciaux → espace ordinaire

  // ── 0. Format Claude : en-têtes "Dossier DL/DP/DQI N [titre optionnel] :" ──
  // Exemple : "Dossier DQI 1 :" ou "Dossier DQI 2 (Histologie) :"
  const CLAUDE_SECTION_RE = /(?:^|\n)(Dossier\s+(DL|DP|DQI)\s+\d+[^\n:]*)\s*:/gi;
  const claudeMatches = [...text.matchAll(CLAUDE_SECTION_RE)];

  if (claudeMatches.length > 0) {
    const sections: ParsedSection[] = [];

    for (let i = 0; i < claudeMatches.length; i++) {
      const sm         = claudeMatches[i];
      const headerText = sm[1].trim();
      const dossierType = sm[2].toUpperCase() as 'DL' | 'DP' | 'DQI';
      const contentStart = sm.index! + sm[0].length;
      const contentEnd   = i + 1 < claudeMatches.length
        ? claudeMatches[i + 1].index!
        : text.length;
      const content = text.slice(contentStart, contentEnd);

      // DQI → isolees (questions indépendantes sans dossier DB)
      // DP  → dossier progressif
      // DL  → dossier libre
      const type: 'dp' | 'dl' | 'isolees' =
        dossierType === 'DP' ? 'dp' :
        dossierType === 'DL' ? 'dl' : 'isolees';

      // Extraire le contexte clinique (DP/DL) : texte avant le premier QCM/QRU
      const firstQIdx = content.search(/^(?:QCM|QRU|QROC)\s+\d+\s*:/im);
      let enonce = '';
      let questionsText = content;

      if (firstQIdx !== -1) {
        enonce = content.slice(0, firstQIdx)
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        questionsText = content.slice(firstQIdx);
      }

      sections.push({
        id: `s${i}`,
        type,
        titre: headerText,
        enonce,
        questions: parseClaudeQuestions(questionsText),
      });
    }

    return sections;
  }

  // ── 1. Chercher les en-têtes explicites "Dossier N" / "Questions isolées" ──
  const SECTION_RE = /(?:^|\n)(Dossier\s+\d+[^\n]*|Questions?\s+isolées?[^\n]*)\n/gi;
  const sectionMatches = [...text.matchAll(SECTION_RE)];

  if (sectionMatches.length > 0) {
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

      sections.push({
        id: `s${i}`,
        type: isDossier ? 'dp' : 'isolees',
        titre: headerText,
        enonce,
        questions: parseQuestions(questionsText),
      });
    }

    return sections;
  }

  // ── 2. Fallback : détecter les resets de numérotation (Q1 après Q2+) ──
  // S'applique uniquement au format prof "Question N Pondération"
  const Q_HEADER_RE = /(?:^|\n)[ \t]*Question\s+(\d+)\s+Pondération/gi;
  const qHeaderMatches = [...text.matchAll(Q_HEADER_RE)];

  // splitPoints[0] = 0 (début du texte), puis chaque reset de Q1
  const splitPoints: number[] = [0];
  let lastNum = 0;
  for (const m of qHeaderMatches) {
    const num = parseInt(m[1], 10);
    if (num === 1 && lastNum > 1) {
      // Reset : nouvelle section commence ici (on pointe sur le \n ou le début)
      splitPoints.push(m.index!);
    }
    lastNum = num;
  }

  if (splitPoints.length === 1) {
    // Pas de reset → section unique
    const questions = parseQuestions(raw);
    return [{
      id: 's0',
      type: 'isolees' as const,
      titre: '',
      enonce: '',
      questions,
    }];
  }

  // Plusieurs blocs détectés par reset de numérotation
  const autoSections: ParsedSection[] = [];

  for (let i = 0; i < splitPoints.length; i++) {
    const start = splitPoints[i];
    const end   = i + 1 < splitPoints.length ? splitPoints[i + 1] : text.length;
    const content = text.slice(start, end);

    // Extraire le contexte clinique : texte avant la première question
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

    autoSections.push({
      id: `s${i}`,
      type: 'dp' as const,       // défaut DP — l'utilisateur peut changer via le toggle
      titre: `Dossier ${i + 1}`, // titre provisoire
      enonce,
      questions: parseQuestions(questionsText),
    });
  }

  return autoSections;
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

  const setSectionType = (sectionId: string, type: 'dp' | 'dl' | 'isolees') => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, type } : s));
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
    // Numérotation séquentielle inter-sections pour les isolées
    let isoléesSaveOffset = 0;
    // Une question sans réponse détectée ne doit jamais être publiée telle quelle
    // (sinon un étudiant qui ne répond rien obtient la note maximale) — elle reste
    // en brouillon même si le lot est publié, à compléter manuellement ensuite.
    const qStatut = (q: ParsedQuestion) =>
      statut === 'publiee' && q.reponses.length === 0 ? 'brouillon' : statut;

    for (const section of sections) {
      if (section.type === 'dp' || section.type === 'dl') {
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
              type_dossier: section.type,
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
              image_url:       q.needsImage ? '__PENDING__' : null,
              hotspot:         null,
              statut:          qStatut(q),
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
        // Numéroter en séquence : si plusieurs sections isolées, la 2e commence après la 1re
        for (let i = 0; i < section.questions.length; i++) {
          const q = section.questions[i];
          const adjNum = q.numero !== null
            ? q.numero + isoléesSaveOffset
            : i + 1 + isoléesSaveOffset;
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
              image_url:       q.needsImage ? '__PENDING__' : null,
              hotspot:         null,
              statut:          qStatut(q),
              numero_officiel: source === 'ronéo' ? null : adjNum,
              dossier_id:      null,
              ordre_dossier:   null,
            }).select().single();
            if (error) {
              setSaveError(`Q${adjNum} : ${error.message}`);
              setSaving(false);
              return;
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
            setSaveError(`Q${adjNum} : ${msg}`);
            setSaving(false);
            return;
          }
          savedCount++;
          setSaveProgress(savedCount);
        }
        // Avancer l'offset pour la prochaine section isolées
        isoléesSaveOffset += section.questions.length;
      }
    }

    setSaving(false);
    onDone(savedCount);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalQuestions     = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const totalWithCorrections = sections.reduce((sum, s) => sum + s.questions.filter(q => q.reponses.length > 0).length, 0);
  const totalWarnings      = sections.reduce((sum, s) => sum + s.questions.filter(q => q.items.length === 0).length, 0);
  // Une section "dossier" = type dp ou dl
  const hasDossierSections = sections.some(s => s.type === 'dp' || s.type === 'dl');
  const hasCorrections     = totalWithCorrections > 0;
  // Afficher la vue par sections dès qu'il y a plusieurs sections OU au moins un dossier
  const showSectionView    = sections.length > 1 || hasDossierSections;

  // Offsets de numérotation pour les questions isolées (numérotation séquentielle inter-sections)
  const isoléesOffsets: Record<string, number> = {};
  {
    let running = 0;
    for (const s of sections) {
      if (s.type === 'isolees') {
        isoléesOffsets[s.id] = running;
        running += s.questions.length;
      }
    }
  }

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
              : showSectionView
                ? `${sections.filter(s => s.type !== 'isolees').length} dossier${sections.filter(s => s.type !== 'isolees').length > 1 ? 's' : ''} · ${totalQuestions} question${totalQuestions > 1 ? 's' : ''}${hasCorrections ? ` · ${totalWithCorrections} avec corrections` : ''}`
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
              {showSectionView && sections.some(s => s.type !== 'isolees') && (
                <> · <strong>{sections.filter(s => s.type !== 'isolees').length}</strong> dossier{sections.filter(s => s.type !== 'isolees').length > 1 ? 's' : ''}</>
              )}
              {hasCorrections && <> · <span className="text-green-600 font-semibold">{totalWithCorrections} avec corrections</span></>}
            </span>
            {totalWarnings > 0 && (
              <span className="ml-auto text-amber-600 text-xs">⚠ {totalWarnings} sans item</span>
            )}
          </div>

          {/* ── Sections avec dossiers ── */}
          {showSectionView ? (
            <div className="space-y-3">
              {sections.map(section => {
                const sectionWarnings = section.questions.filter(q => q.items.length === 0).length;
                const sectionCorrections = section.questions.filter(q => q.reponses.length > 0).length;

                return (
                  <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                      {/* Titre + stats */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate block">
                          {section.titre || 'Questions'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {section.questions.length} question{section.questions.length > 1 ? 's' : ''}
                          {sectionCorrections > 0 && <span className="text-green-600"> · {sectionCorrections} corrigée{sectionCorrections > 1 ? 's' : ''}</span>}
                          {sectionWarnings > 0 && <span className="text-amber-500"> · ⚠ {sectionWarnings}</span>}
                          {section.questions.some(q => q.needsImage) && (
                            <span className="text-orange-500"> · 🖼 {section.questions.filter(q => q.needsImage).length} image{section.questions.filter(q => q.needsImage).length > 1 ? 's' : ''} à insérer</span>
                          )}
                        </span>
                      </div>

                      {/* Toggle 3 états : DP / DL / Isolées */}
                      <div className="flex gap-0.5 bg-slate-200 rounded-lg p-0.5 shrink-0">
                        {([
                          { v: 'dp',       label: 'DP',       active: 'bg-amber-100 text-amber-700' },
                          { v: 'dl',       label: 'DL',       active: 'bg-teal-100 text-teal-700' },
                          { v: 'isolees',  label: 'Isolées',  active: 'bg-white text-slate-700' },
                        ] as { v: 'dp' | 'dl' | 'isolees'; label: string; active: string }[]).map(opt => (
                          <button
                            key={opt.v}
                            onClick={() => setSectionType(section.id, opt.v)}
                            className={`text-xs font-semibold px-2 py-1 rounded-md transition-all ${
                              section.type === opt.v
                                ? `${opt.active} shadow-sm`
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contexte clinique */}
                    {section.enonce && (
                      <div className="px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 text-xs text-blue-700 leading-relaxed line-clamp-2">
                        {section.enonce}
                      </div>
                    )}

                    {/* Questions */}
                    <div className="divide-y divide-slate-100">
                      {section.questions.map((q, qIdx) => {
                        // Pour les sections isolées, numérotation séquentielle inter-sections
                        const baseNum = q.numero ?? qIdx + 1;
                        const displayNum = section.type === 'isolees'
                          ? baseNum + (isoléesOffsets[section.id] ?? 0)
                          : baseNum;
                        return (
                        <div key={qIdx} className={`px-4 py-2.5 flex items-start gap-3 ${q.items.length === 0 ? 'bg-amber-50' : ''}`}>
                          <span className="text-xs font-mono font-semibold text-slate-400 pt-0.5 w-6 shrink-0 text-right">
                            {displayNum}
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
                                {q.reponses.length > 0
                                  ? <span className="text-xs text-green-600 font-medium">✓ {q.reponses.join('')}</span>
                                  : <span className="text-xs text-slate-300">sans réponse</span>
                                }
                                {q.noteCorrection && (
                                  <span className="text-xs text-blue-500">📝</span>
                                )}
                                {q.needsImage && (
                                  <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded">🖼 image</span>
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
                        );
                      })}
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
                          {q.reponses.length > 0
                            ? <span className="text-xs text-green-600 font-medium">✓ {q.reponses.join('')}</span>
                            : <span className="text-xs text-slate-300">sans réponse</span>
                          }
                          {q.noteCorrection && (
                            <span className="text-xs text-blue-500 ml-1">📝</span>
                          )}
                          {q.needsImage && (
                            <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded ml-1">🖼 image</span>
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
            {sections.some(s => s.type !== 'isolees')
              ? `${sections.filter(s => s.type !== 'isolees').length} dossier${sections.filter(s => s.type !== 'isolees').length > 1 ? 's' : ''} seront créés${sections.some(s => s.type === 'isolees') ? ' + questions isolées' : ''}.${hasCorrections ? ' Corrections incluses, publication directe possible.' : ''}`
              : hasCorrections
                ? `${totalWithCorrections}/${totalQuestions} questions ont des corrections — tu peux publier directement.`
                : 'Aucune correction détectée — enregistrement en brouillon, à compléter ensuite.'}
          </p>
        </div>
      )}
    </div>
  );
}
