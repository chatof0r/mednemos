import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Question, Item, SessionConfig } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type ItemState = 'neutral' | 'correct-checked' | 'incorrect-checked' | 'correct-missed' | 'incorrect-missed';

function getItemState(label: string, selected: string[], reponses: string[], validated: boolean): ItemState {
  if (!validated) return 'neutral';
  const isCorrect = reponses.includes(label);
  const isSelected = selected.includes(label);
  if (isCorrect && isSelected) return 'correct-checked';
  if (!isCorrect && isSelected) return 'incorrect-checked';
  if (isCorrect && !isSelected) return 'correct-missed';
  return 'incorrect-missed';
}

// Point-in-polygon (ray casting) — coordonnées normalisées en % de largeur
function pointInPolygon(px: number, py: number, points: Array<{x: number, y: number}>, ar: number): boolean {
  const nx = px;
  const ny = py / ar; // convertit % hauteur → % largeur pour un espace uniforme
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y / ar;
    const xj = points[j].x, yj = points[j].y / ar;
    if (((yi > ny) !== (yj > ny)) && (nx < (xj - xi) * (ny - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function zoneHit(q: Question, sel: string[]): boolean | null {
  if (q.type !== 'QZONE' || !q.hotspot || sel.length === 0) return null;
  const [cx, cy] = sel[0].split(',').map(Number);
  return pointInPolygon(cx, cy, q.hotspot.points, q.hotspot.ar || 1);
}

function scoreForQuestion(q: Question, sel: string[]): number {
  if (q.type === 'QZONE') {
    const hit = zoneHit(q, sel);
    return hit ? 1 : 0;
  }
  if (q.type === 'QRU') {
    const correct = q.reponses[0];
    return sel.length === 1 && sel[0] === correct ? 1 : 0;
  }
  // QCM : 0 erreur = 1pt, 1 erreur = 0.5pt, 2+ = 0pt
  const errors = q.items.filter(i => {
    const isCorrect = q.reponses.includes(i.label);
    const isSelected = sel.includes(i.label);
    return (isCorrect && !isSelected) || (!isCorrect && isSelected);
  }).length;
  if (errors === 0) return 1;
  if (errors === 1) return 0.5;
  return 0;
}

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronIcon = ({ open, className }: { open: boolean; className?: string }) => (
  <svg className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

interface QuestionCardProps {
  question: Question;
  selected: string[];
  validated: boolean;
  onToggle: (label: string) => void;
  onValidate: () => void;
  onNext: () => void;
  isLast: boolean;
  index: number;
  total: number;
}

function QuestionCard({ question, selected, validated, onToggle, onValidate, onNext, isLast, index, total }: QuestionCardProps) {
  const [remarkText, setRemarkText] = useState('');
  const [remarkSent, setRemarkSent] = useState(false);
  const [showRemark, setShowRemark] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [, setZonePxW] = useState(0);
  const zoneContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (validated) {
      const toExpand = new Set(
        question.items
          .filter(i => {
            const s = getItemState(i.label, selected, question.reponses, true);
            return s === 'incorrect-checked' || s === 'correct-missed';
          })
          .map(i => i.label)
      );
      setExpandedItems(toExpand);
    } else {
      setExpandedItems(new Set());
    }
  }, [validated]);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // QZONE — clic sur l'image
  const handleZoneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (validated) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setZonePxW(rect.width);
    const x = (e.clientX - rect.left) / rect.width * 100;   // % largeur
    const y = (e.clientY - rect.top)  / rect.height * 100;  // % hauteur
    onToggle(`${x.toFixed(2)},${y.toFixed(2)}`);
  };

  const zoneClick = question.type === 'QZONE' && selected.length > 0
    ? (() => { const [x, y] = selected[0].split(',').map(Number); return { x, y }; })()
    : null;

  const zoneCorrect = question.type === 'QZONE' && validated
    ? zoneHit(question, selected)
    : null;

  const sendRemark = async () => {
    if (!remarkText.trim()) return;
    const ref = question.numero_officiel
      ? `Q${question.numero_officiel} / ${question.annee ?? '?'}${question.session ? `.${question.session}` : ''}`
      : question.annee ? String(question.annee) : '?';
    await supabase.from('suggestions').insert({
      message: `[${question.matiere} - ${ref}] ${remarkText.trim()}`,
    });
    setRemarkSent(true);
    setRemarkText('');
    setTimeout(() => { setRemarkSent(false); setShowRemark(false); }, 2000);
  };

  return (
    <div className="bg-white dark:bg-[#141414] border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm p-6 sm:p-8 transition-colors">
      {/* Progress + badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 dark:text-white/30 font-medium">{index + 1} / {total}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          question.type === 'QCM'
            ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400'
            : question.type === 'QZONE'
              ? 'bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
              : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
        }`}>{question.type}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1 mb-6">
        <div className="bg-[#e3fe52]/70 dark:bg-[#e3fe52]/50 h-1 rounded-full transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      {/* Énoncé */}
      <p className="text-slate-800 dark:text-white font-medium leading-relaxed mb-4 whitespace-pre-wrap">{question.enonce}</p>

      {/* ── QZONE : image cliquable ── */}
      {question.type === 'QZONE' ? (
        <div className="mb-6">
          <div
            ref={zoneContainerRef}
            className={`relative w-full rounded-xl overflow-hidden bg-slate-50 dark:bg-white/5 ${!validated ? 'cursor-crosshair' : ''}`}
            onClick={!validated ? handleZoneClick : undefined}
            onLoad={() => {
              const el = zoneContainerRef.current;
              if (el) setZonePxW(el.offsetWidth);
            }}
          >
            <img
              src={question.image_url ?? ''}
              alt="Zone à identifier"
              className="w-full block"
              onLoad={() => {
                const el = zoneContainerRef.current;
                if (el) setZonePxW(el.offsetWidth);
              }}
            />

            {/* Polygone correct (affiché après validation) */}
            {validated && question.hotspot && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polygon
                  points={question.hotspot.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(34,197,94,0.2)"
                  stroke="#22c55e"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            {/* Point du clic étudiant */}
            {zoneClick && (
              <div
                style={{
                  position: 'absolute',
                  left: `${zoneClick.x}%`,
                  top: `${zoneClick.y}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
                className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${
                  !validated ? 'bg-[#e3fe52]'
                    : zoneCorrect ? 'bg-green-500'
                      : 'bg-red-500'
                }`}
              />
            )}

            {/* Hint avant clic */}
            {!validated && !zoneClick && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-black/50 dark:bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                  Cliquez sur l'image pour répondre
                </span>
              </div>
            )}
          </div>

          {/* Feedback après validation */}
          {validated && (
            <div className={`mt-3 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl ${
              zoneCorrect
                ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                : zoneCorrect === false
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-500'
            }`}>
              {zoneCorrect === null
                ? 'Pas de réponse — 0 pt'
                : zoneCorrect
                  ? '✓ Bonne zone — 1 pt'
                  : '✗ Mauvaise zone — 0 pt'}
            </div>
          )}

          {/* Invite à re-cliquer avant validation */}
          {!validated && zoneClick && (
            <p className="mt-2 text-xs text-slate-400 dark:text-white/30 text-center">
              Recliquez pour changer votre réponse
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Image classique (non-QZONE) */}
          {question.image_url && (
            <img src={question.image_url} alt="Illustration" className="w-full max-h-64 object-contain rounded-xl mb-4 bg-slate-50 dark:bg-white/5" />
          )}
        </>
      )}

      {/* Items (QCM / QRU uniquement) */}
      {question.type !== 'QZONE' && <div className="space-y-2">
        {question.items.map((item: Item) => {
          const state = getItemState(item.label, selected, question.reponses, validated);
          const isSelected = selected.includes(item.label);
          const isExpanded = expandedItems.has(item.label);

          // ── Styles par état ──
          const containerClass = !validated
            ? isSelected
              ? 'border-[#e3fe52]/50 dark:border-[#e3fe52]/40 bg-[#e3fe52]/5'
              : 'border-slate-200 dark:border-white/10 bg-white dark:bg-transparent hover:border-slate-300 dark:hover:border-white/20'
            : state === 'correct-checked'
              ? 'border-green-300/70 dark:border-green-500/30 bg-green-50/80 dark:bg-green-500/10'
              : state === 'incorrect-checked'
                ? 'border-red-400/70 dark:border-red-500/40 bg-red-50/90 dark:bg-red-500/15'
                : state === 'correct-missed'
                  ? 'border-green-600/60 dark:border-green-400/40 bg-green-100/80 dark:bg-green-500/20'
                  : 'border-slate-200/60 dark:border-white/8 bg-white/50 dark:bg-transparent';

          const iconBg = !validated
            ? isSelected ? 'border-[#e3fe52] bg-[#e3fe52]' : 'border-slate-300 dark:border-white/20 bg-white dark:bg-transparent'
            : state === 'correct-checked' ? 'border-green-400 bg-green-400 dark:border-green-500 dark:bg-green-500/80'
              : state === 'incorrect-checked' ? 'border-red-500 bg-red-500'
                : state === 'correct-missed' ? 'border-green-600 bg-green-600 dark:border-green-400 dark:bg-green-500/50'
                  : 'border-slate-300/60 dark:border-white/15 bg-white/50 dark:bg-transparent';

          const labelColor = !validated
            ? 'text-slate-700 dark:text-white/70'
            : state === 'correct-checked' ? 'text-green-700 dark:text-green-400'
              : state === 'incorrect-checked' ? 'text-red-700 dark:text-red-400'
                : state === 'correct-missed' ? 'text-green-800 dark:text-green-300'
                  : 'text-slate-400 dark:text-white/30';

          const textColor = !validated
            ? 'text-slate-700 dark:text-white'
            : state === 'correct-checked' ? 'text-green-700 dark:text-green-400'
              : state === 'incorrect-checked' ? 'text-red-700 dark:text-red-400'
                : state === 'correct-missed' ? 'text-green-800 dark:text-green-300'
                  : 'text-slate-500 dark:text-white/40';

          // Icône dans la case : ✓ ou ✗
          const showCheck = !validated ? isSelected : (state === 'correct-checked' || state === 'incorrect-missed');
          const showX = validated && (state === 'incorrect-checked' || state === 'correct-missed');

          return (
            <div key={item.label} className={`rounded-xl border transition-all overflow-hidden ${containerClass}`}>
              {/* Ligne principale */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => validated ? toggleExpand(item.label) : onToggle(item.label)}
              >
                {/* Icône sélection */}
                <div className={`shrink-0 w-5 h-5 flex items-center justify-center border-2 transition-all ${
                  question.type === 'QRU' ? 'rounded-full' : 'rounded-md'
                } ${iconBg}`}>
                  {showCheck && <CheckIcon className="w-3 h-3 text-[#0c0c0c] dark:text-[#0c0c0c]" />}
                  {showX && <XIcon className="w-3 h-3 text-white" />}
                </div>

                {/* Texte */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold mr-1 ${labelColor}`}>{item.label}.</span>
                  <span className={`text-sm ${textColor}`}>{item.enonce}</span>
                </div>

                {/* Chevron expand (visible après validation) */}
                {validated && item.justification && (
                  <ChevronIcon
                    open={isExpanded}
                    className={`w-3.5 h-3.5 shrink-0 ${
                      state === 'correct-checked' ? 'text-green-400 dark:text-green-500'
                        : state === 'incorrect-checked' ? 'text-red-400'
                          : state === 'correct-missed' ? 'text-green-600 dark:text-green-400'
                            : 'text-slate-300 dark:text-white/20'
                    }`}
                  />
                )}
              </div>

              {/* Justification expansible */}
              {validated && isExpanded && item.justification && (
                <div className={`px-3 pb-3 pt-0 text-xs leading-relaxed italic border-t ${
                  state === 'correct-checked'
                    ? 'border-green-200/50 dark:border-green-500/20 text-green-700 dark:text-green-400'
                    : state === 'incorrect-checked'
                      ? 'border-red-200/50 dark:border-red-500/20 text-red-600 dark:text-red-400'
                      : state === 'correct-missed'
                        ? 'border-green-300/50 dark:border-green-400/20 text-green-800 dark:text-green-300'
                        : 'border-slate-200/50 dark:border-white/8 text-slate-500 dark:text-white/40'
                }`}>
                  {item.justification}
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        {!validated ? (
          <button
            onClick={onValidate}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
              bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40
              text-slate-900 dark:text-slate-900
              hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65"
          >
            Valider
          </button>
        ) : (
          <button
            onClick={onNext}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
              bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40
              text-slate-900 dark:text-slate-900
              hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65"
          >
            {isLast ? 'Voir les résultats' : 'Question suivante →'}
          </button>
        )}

        {!showRemark ? (
          <button
            onClick={() => setShowRemark(true)}
            className="text-xs text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/50 transition-colors text-center"
          >
            Signaler une erreur
          </button>
        ) : (
          <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 bg-black/5 dark:bg-white/5">
            <p className="text-xs font-medium text-slate-700 dark:text-white/50 mb-2">Remarque sur cette question</p>
            <textarea
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              rows={2}
              placeholder="Décris l'erreur ou ta suggestion..."
              className="w-full text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[#e3fe52]/40 resize-none bg-slate-100 dark:bg-white/30 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={sendRemark}
                disabled={!remarkText.trim()}
                className="flex-1 text-xs py-1.5 rounded-lg bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40 text-[#0c0c0c] dark:text-[#0c0c0c] font-medium hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65 disabled:opacity-30 transition-colors"
              >
                {remarkSent ? '✓ Envoyé' : 'Envoyer'}
              </button>
              <button
                onClick={() => setShowRemark(false)}
                className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ResultsProps {
  questions: Question[];
  answers: Record<string, string[]>;
  onRestart: () => void;
}

function Results({ questions, answers, onRestart }: ResultsProps) {
  const totalScore = questions.reduce((sum, q) => sum + scoreForQuestion(q, answers[q.id] ?? []), 0);
  const displayScore = totalScore % 1 === 0 ? String(totalScore) : totalScore.toFixed(1);
  const pct = Math.max(0, Math.round((totalScore / questions.length) * 100));
  const color = pct >= 70 ? 'text-green-500' : pct >= 50 ? 'text-orange-400' : 'text-red-400';
  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-400' : 'bg-red-400';

  // Seulement les questions avec au moins une erreur
  const errorQuestions = questions.filter(q => scoreForQuestion(q, answers[q.id] ?? []) < 1);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white dark:bg-[#141414] border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm p-8 text-center mb-8 transition-colors">
        <div className={`text-6xl font-bold mb-2 ${color}`}>{displayScore}<span className="text-3xl text-slate-300 dark:text-white/20">/{questions.length}</span></div>
        <div className="text-slate-400 dark:text-white/30 text-sm mb-5">{pct}% de réussite</div>
        <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2 mb-7 overflow-hidden">
          <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <button
          onClick={onRestart}
          className="px-6 py-3 rounded-xl font-semibold text-sm transition-all
            bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40
            text-[#0c0c0c] dark:text-[#0c0c0c]
            hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65"
        >
          Nouvelle session
        </button>
      </div>

      {errorQuestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-4">
            Erreurs à revoir ({errorQuestions.length})
          </p>
          <div className="space-y-4">
            {errorQuestions.map(q => {
              const sel = answers[q.id] ?? [];
              const pts = scoreForQuestion(q, sel);
              // Seulement les items erronés
              const errorItems = q.items.filter(i => {
                const s = getItemState(i.label, sel, q.reponses, true);
                return s === 'incorrect-checked' || s === 'correct-missed';
              });

              return (
                <div key={q.id} className="bg-white dark:bg-[#141414] border border-slate-100 dark:border-white/10 rounded-2xl p-5 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        q.type === 'QCM' ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400'
                          : q.type === 'QZONE' ? 'bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
                            : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                      }`}>{q.type}</span>
                      <span className="text-xs text-slate-400 dark:text-white/30">{q.matiere}{q.annee ? ` · ${q.annee}` : ''}</span>
                    </div>
                    <span className={`text-sm font-bold ${pts >= 0 && pts < 1 ? 'text-orange-400' : 'text-red-400'}`}>
                      {pts > 0 ? `+${pts}` : pts} pt
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white mb-3 whitespace-pre-wrap">{q.enonce}</p>
                  {q.type === 'QZONE' ? (
                    /* Recap QZONE : image avec zone correcte */
                    q.image_url && (
                      <div className="relative w-full rounded-lg overflow-hidden bg-slate-50 dark:bg-white/5">
                        <img src={q.image_url} alt="" className="w-full object-contain" />
                        {q.hotspot && (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <polygon
                              points={q.hotspot.points.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="rgba(34,197,94,0.2)"
                              stroke="#22c55e"
                              strokeWidth="0.7"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        <div className="absolute bottom-2 left-2">
                          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">Zone correcte</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      {q.image_url && <img src={q.image_url} alt="" className="w-full max-h-48 object-contain rounded-lg mb-3 bg-slate-50 dark:bg-white/5" />}
                      <div className="space-y-2">
                        {errorItems.map(item => {
                          const s = getItemState(item.label, sel, q.reponses, true);
                          return (
                            <div key={item.label} className={`p-2.5 rounded-lg text-xs ${
                              s === 'incorrect-checked'
                                ? 'bg-red-50/80 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                                : 'bg-green-100/80 dark:bg-green-500/10 text-green-800 dark:text-green-300'
                            }`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <XIcon className="w-3 h-3 shrink-0" />
                                <span className="font-bold">{item.label}.</span>
                                <span>{item.enonce}</span>
                              </div>
                              {item.justification && (
                                <p className="italic opacity-70 pl-4">{item.justification}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Session() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SessionConfig | null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!state) { navigate('/'); return; }
    setQuestions(state.order === 'random' ? shuffle(state.questions) : state.questions);
  }, []);

  if (!state) return null;
  if (showResults) return <Results questions={questions} answers={answers} onRestart={() => navigate('/')} />;

  const q = questions[currentIndex];
  if (!q) return null;

  const currentSelected = answers[q.id] ?? [];
  const isValidated = validated.has(q.id);

  const handleToggle = (label: string) => {
    setAnswers(prev => {
      const sel = prev[q.id] ?? [];
      if (q.type === 'QZONE') return { ...prev, [q.id]: [label] }; // remplace le clic
      if (q.type === 'QRU') return { ...prev, [q.id]: sel.includes(label) ? [] : [label] };
      return { ...prev, [q.id]: sel.includes(label) ? sel.filter(l => l !== label) : [...sel, label] };
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <QuestionCard
        question={q}
        selected={currentSelected}
        validated={isValidated}
        onToggle={handleToggle}
        onValidate={() => setValidated(prev => new Set([...prev, q.id]))}
        onNext={() => currentIndex + 1 >= questions.length ? setShowResults(true) : setCurrentIndex(i => i + 1)}
        isLast={currentIndex + 1 >= questions.length}
        index={currentIndex}
        total={questions.length}
      />
    </div>
  );
}
