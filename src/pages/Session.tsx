import { useState, useEffect } from 'react';
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

type ItemState = 'neutral' | 'correct-checked' | 'incorrect-checked' | 'correct-missed';

function getItemState(label: string, selected: string[], reponses: string[], validated: boolean): ItemState {
  if (!validated) return 'neutral';
  const isCorrect = reponses.includes(label);
  const isSelected = selected.includes(label);
  if (isCorrect && isSelected) return 'correct-checked';
  if (!isCorrect && isSelected) return 'incorrect-checked';
  if (isCorrect && !isSelected) return 'correct-missed';
  return 'neutral';
}

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

  const sendRemark = async () => {
    if (!remarkText.trim()) return;
    await supabase.from('suggestions').insert({
      message: `[Q ${question.id.slice(0, 8)} - ${question.matiere}] ${remarkText.trim()}`,
    });
    setRemarkSent(true);
    setRemarkText('');
    setTimeout(() => { setRemarkSent(false); setShowRemark(false); }, 2000);
  };

  return (
    <div className="bg-white dark:bg-[#141414] border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm p-6 sm:p-8 transition-colors">
      {/* Progress + badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 dark:text-white/30 font-medium">
          {index + 1} / {total}
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          question.type === 'QCM'
            ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400'
            : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
        }`}>
          {question.type}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1 mb-6">
        <div
          className="bg-[#e3fe52]/70 dark:bg-[#e3fe52]/50 h-1 rounded-full transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Image */}
      {question.image_url && (
        <img src={question.image_url} alt="Illustration" className="w-full max-h-64 object-contain rounded-xl mb-4 bg-slate-50 dark:bg-white/5" />
      )}

      {/* Énoncé */}
      <p className="text-slate-800 dark:text-white font-medium leading-relaxed mb-6 whitespace-pre-wrap">{question.enonce}</p>

      {/* Items */}
      <div className="space-y-2">
        {question.items.map((item: Item) => {
          const state = getItemState(item.label, selected, question.reponses, validated);
          const isSelected = selected.includes(item.label);

          const borderClass = !validated
            ? isSelected
              ? 'border-[#e3fe52]/50 dark:border-[#e3fe52]/40 bg-[#e3fe52]/5 dark:bg-[#e3fe52]/5'
              : 'border-slate-200 dark:border-white/10 bg-white dark:bg-transparent hover:border-slate-300 dark:hover:border-white/20'
            : state === 'correct-checked'
              ? 'border-green-400 dark:border-green-500/50 bg-green-50 dark:bg-green-500/5'
              : state === 'incorrect-checked'
                ? 'border-red-400 dark:border-red-500/50 bg-red-50 dark:bg-red-500/5'
                : state === 'correct-missed'
                  ? 'border-green-700 dark:border-green-400/30 bg-green-100 dark:bg-green-500/10'
                  : 'border-slate-200 dark:border-white/8 bg-white dark:bg-transparent';

          const checkClass = !validated
            ? isSelected
              ? 'border-[#e3fe52] bg-[#e3fe52]'
              : 'border-slate-300 dark:border-white/20 bg-white dark:bg-transparent'
            : state === 'correct-checked'
              ? 'border-green-500 bg-green-500'
              : state === 'incorrect-checked'
                ? 'border-red-500 bg-red-500'
                : state === 'correct-missed'
                  ? 'border-green-600 bg-green-600 dark:border-green-400 dark:bg-green-500/40'
                  : 'border-slate-300 dark:border-white/20 bg-white dark:bg-transparent';

          return (
            <div key={item.label}>
              <button
                onClick={() => !validated && onToggle(item.label)}
                disabled={validated}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${borderClass}`}
              >
                <div className={`shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center border-2 transition-all ${
                  question.type === 'QRU' ? 'rounded-full' : 'rounded-md'
                } ${checkClass}`}>
                  {(isSelected || state === 'correct-missed') && (
                    <svg className="w-3 h-3 text-slate-800 dark:text-[#0c0c0c]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold mr-1 ${
                    validated
                      ? state === 'correct-checked' ? 'text-green-700 dark:text-green-400'
                        : state === 'incorrect-checked' ? 'text-red-700 dark:text-red-400'
                          : state === 'correct-missed' ? 'text-green-800 dark:text-green-300'
                            : 'text-slate-400 dark:text-white/30'
                      : 'text-slate-700 dark:text-white/70'
                  }`}>{item.label}.</span>
                  <span className={`text-sm ${
                    validated
                      ? state === 'correct-checked' ? 'text-green-700 dark:text-green-400'
                        : state === 'incorrect-checked' ? 'text-red-700 dark:text-red-400'
                          : state === 'correct-missed' ? 'text-green-800 dark:text-green-300'
                            : 'text-slate-500 dark:text-white/40'
                      : 'text-slate-700 dark:text-white'
                  }`}>{item.enonce}</span>
                  {validated && (state !== 'neutral') && item.justification && (
                    <p className={`mt-1.5 text-xs leading-relaxed italic ${
                      state === 'correct-checked' ? 'text-green-600 dark:text-green-500'
                        : state === 'incorrect-checked' ? 'text-red-600 dark:text-red-400'
                          : 'text-green-700 dark:text-green-400'
                    }`}>{item.justification}</p>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        {!validated ? (
          <button
            onClick={onValidate}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
              bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40
              text-white dark:text-[#e3fe52]
              hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65"
          >
            Valider
          </button>
        ) : (
          <button
            onClick={onNext}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
              bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40
              text-white dark:text-[#e3fe52]
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
          <div className="border border-slate-200 dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-white/3">
            <p className="text-xs font-medium text-slate-600 dark:text-white/50 mb-2">Remarque sur cette question</p>
            <textarea
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              rows={2}
              placeholder="Décris l'erreur ou ta suggestion..."
              className="w-full text-xs border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[#e3fe52]/40 resize-none bg-white dark:bg-white/5 text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/20"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={sendRemark}
                disabled={!remarkText.trim()}
                className="flex-1 text-xs py-1.5 rounded-lg bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40 text-white dark:text-[#e3fe52] font-medium hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65 disabled:opacity-30 transition-colors"
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
  const wrong = questions.filter(q => {
    const sel = answers[q.id] ?? [];
    return [...q.reponses].sort().join(',') !== [...sel].sort().join(',');
  });
  const score = questions.length - wrong.length;
  const pct = Math.round((score / questions.length) * 100);
  const color = pct >= 70 ? 'text-green-500' : pct >= 50 ? 'text-orange-400' : 'text-red-400';
  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-400' : 'bg-red-400';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white dark:bg-[#141414] border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm p-8 text-center mb-8 transition-colors">
        <div className={`text-6xl font-bold mb-2 ${color}`}>{score}/{questions.length}</div>
        <div className="text-slate-400 dark:text-white/30 text-sm mb-5">{pct}% de bonnes réponses</div>
        <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2 mb-7 overflow-hidden">
          <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <button
          onClick={onRestart}
          className="px-6 py-3 rounded-xl font-semibold text-sm transition-all
            bg-[#e3fe52]/75 dark:bg-[#e3fe52]/50 dark:border dark:border-[#e3fe52]/40
            text-white dark:text-[#e3fe52]
            hover:bg-[#e3fe52]/90 dark:hover:bg-[#e3fe52]/65"
        >
          Nouvelle session
        </button>
      </div>

      {wrong.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-4">
            À revoir ({wrong.length})
          </p>
          <div className="space-y-4">
            {wrong.map(q => {
              const sel = answers[q.id] ?? [];
              return (
                <div key={q.id} className="bg-white dark:bg-[#141414] border border-slate-100 dark:border-white/10 rounded-2xl p-5 transition-colors">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      q.type === 'QCM' ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400' : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                    }`}>{q.type}</span>
                    <span className="text-xs text-slate-400 dark:text-white/30">{q.matiere}{q.annee ? ` · ${q.annee}` : ''}</span>
                  </div>
                  {q.image_url && <img src={q.image_url} alt="" className="w-full max-h-48 object-contain rounded-lg mb-3 bg-slate-50 dark:bg-white/5" />}
                  <p className="text-sm font-medium text-slate-800 dark:text-white mb-3 whitespace-pre-wrap">{q.enonce}</p>
                  <div className="space-y-1.5">
                    {q.items.map(item => {
                      const state = getItemState(item.label, sel, q.reponses, true);
                      if (state === 'neutral') return null;
                      return (
                        <div key={item.label} className={`p-2.5 rounded-lg text-xs ${
                          state === 'correct-checked' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                            : state === 'incorrect-checked' ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                              : 'bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-300'
                        }`}>
                          <span className="font-bold">{item.label}.</span> {item.enonce}
                          {item.justification && <p className="mt-1 italic opacity-70">{item.justification}</p>}
                        </div>
                      );
                    })}
                  </div>
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
